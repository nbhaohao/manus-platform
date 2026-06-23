// m10 · SSE + 会话生命周期 + 断点续传
// 红→绿：依次实现 agentService.ts 各关 TODO 后对应 describe 变绿。
// 不依赖真实 LLM/Redis：flow 用计数 mock 注入，仓储用 InMemorySessionRepository。
import { describe, it, expect } from "vitest";
import {
  AgentService,
  transitionSession,
  isTerminalEvent,
} from "../src/app/agentService.ts";
import {
  Session,
  SessionStatus,
} from "../src/domain/models/session.ts";
import { InMemorySessionRepository } from "../src/domain/repositories/session.ts";
import { createEvent, type Event } from "../src/domain/models/event.ts";

// 计数 flow：每次 invoke 自增 calls，用来验「重连不重调 LLM」
function makeCountingFlow(msgs: string[] = ["a", "b"]) {
  const state = { calls: 0 };
  const flow = {
    async *invoke(_msg: string): AsyncGenerator<Event> {
      state.calls++;
      for (const m of msgs)
        yield { type: "message", role: "assistant", message: m } as any;
      yield { type: "done" } as any;
    },
  };
  return { flow, state };
}

async function newSession(
  repo: InMemorySessionRepository,
  status = SessionStatus.PENDING,
): Promise<Session> {
  const s = new Session({ status });
  await repo.save(s);
  return s;
}

// ── stage 1: 状态机守卫 ───────────────────────────────────────────────────
describe("stage 1: transitionSession 状态机", () => {
  it("PENDING → RUNNING 合法，落到 session.status", () => {
    const s = new Session({ status: SessionStatus.PENDING });
    transitionSession(s, SessionStatus.RUNNING);
    expect(s.status).toBe(SessionStatus.RUNNING);
  });

  it("RUNNING → COMPLETED 合法，COMPLETED → RUNNING 可重启", () => {
    const s = new Session({ status: SessionStatus.RUNNING });
    transitionSession(s, SessionStatus.COMPLETED);
    expect(s.status).toBe(SessionStatus.COMPLETED);
    transitionSession(s, SessionStatus.RUNNING);
    expect(s.status).toBe(SessionStatus.RUNNING);
  });

  it("PENDING → WAITING 非法，抛错且状态不变", () => {
    const s = new Session({ status: SessionStatus.PENDING });
    expect(() => transitionSession(s, SessionStatus.WAITING)).toThrow();
    expect(s.status).toBe(SessionStatus.PENDING);
  });
});

// ── stage 2: chat 起步——写入 input + 启动 task ───────────────────────────
describe("stage 2: startChat 写入 input + 启动 task", () => {
  it("人类消息进 inputStream，task 跑完后 output 有事件，状态转 RUNNING", async () => {
    const repo = new InMemorySessionRepository();
    const session = await newSession(repo);
    const { flow } = makeCountingFlow();
    const svc = new AgentService(repo, flow);

    const task = await svc.startChat(session, "go");
    expect(session.taskId).toBe(task.id);
    expect(session.status).toBe(SessionStatus.RUNNING);
    // runner 同步跑完：output_stream 已含 flow 产出的事件（含 done）
    expect(await task.outputStream.size()).toBeGreaterThanOrEqual(2);
  });
});

// ── stage 3: SSE event_generator ─────────────────────────────────────────
describe("stage 3: streamEvents 按游标产出", () => {
  it("从 0 起产出全部事件并以 done 收尾", async () => {
    const repo = new InMemorySessionRepository();
    const session = await newSession(repo);
    const { flow } = makeCountingFlow(["x", "y"]);
    const svc = new AgentService(repo, flow);
    const task = await svc.startChat(session, "go");

    const out: Event[] = [];
    for await (const e of svc.streamEvents(task)) out.push(e);
    expect(out[out.length - 1].type).toBe("done");
    expect(out.map((e) => (e as any).message).filter(Boolean)).toEqual([
      "x",
      "y",
    ]);
  });

  it("带游标时只产出游标之后的事件", async () => {
    const repo = new InMemorySessionRepository();
    const session = await newSession(repo);
    const { flow } = makeCountingFlow(["x", "y"]);
    const svc = new AgentService(repo, flow);
    const task = await svc.startChat(session, "go");

    const all: Event[] = [];
    for await (const e of svc.streamEvents(task)) all.push(e);
    const firstId = all[0].id;
    const rest: Event[] = [];
    for await (const e of svc.streamEvents(task, firstId)) rest.push(e);
    // 第一条不再出现
    expect(rest.map((e) => e.id)).not.toContain(firstId);
    expect(rest.length).toBe(all.length - 1);
  });
});

// ── stage 4: 事件持久化的重放 ─────────────────────────────────────────────
describe("stage 4: getHistory 从 DB 重放游标之后的历史", () => {
  it("无游标重放全部已落库事件", async () => {
    const repo = new InMemorySessionRepository();
    const session = await newSession(repo);
    const e1 = createEvent("message", { role: "assistant", message: "1" });
    e1.id = "100-0";
    const e2 = createEvent("message", { role: "assistant", message: "2" });
    e2.id = "100-1";
    await repo.addEvent(session.id, e1);
    await repo.addEvent(session.id, e2);

    const svc = new AgentService(repo, makeCountingFlow().flow);
    const got: Event[] = [];
    for await (const e of svc.getHistory(session.id)) got.push(e);
    expect(got.map((e) => e.id)).toEqual(["100-0", "100-1"]);
  });

  it("带游标只重放其后事件", async () => {
    const repo = new InMemorySessionRepository();
    const session = await newSession(repo);
    const e1 = createEvent("message", { role: "assistant", message: "1" });
    e1.id = "100-0";
    const e2 = createEvent("message", { role: "assistant", message: "2" });
    e2.id = "100-1";
    await repo.addEvent(session.id, e1);
    await repo.addEvent(session.id, e2);

    const svc = new AgentService(repo, makeCountingFlow().flow);
    const got: Event[] = [];
    for await (const e of svc.getHistory(session.id, "100-0")) got.push(e);
    expect(got.map((e) => e.id)).toEqual(["100-1"]);
  });
});

// ── stage 5: chat 集成——断点续传，重连不重调 LLM ─────────────────────────
describe("stage 5: chat 断点续传", () => {
  it("首连产出事件并落库", async () => {
    const repo = new InMemorySessionRepository();
    const session = await newSession(repo);
    const { flow, state } = makeCountingFlow(["m1", "m2"]);
    const svc = new AgentService(repo, flow);

    const got: Event[] = [];
    for await (const e of svc.chat(session.id, "go")) got.push(e);
    expect(state.calls).toBe(1);
    expect(got[got.length - 1].type).toBe("done");
    // 落库：会话事件数 = 流式产出数
    const persisted = await repo.getById(session.id);
    expect(persisted!.events.length).toBe(got.length);
  });

  it("中途断开 → 带游标重连：续传剩余事件且 flow 未被重调", async () => {
    const repo = new InMemorySessionRepository();
    const session = await newSession(repo);
    const { flow, state } = makeCountingFlow(["m1", "m2"]);
    const svc = new AgentService(repo, flow);

    // 首连：只读第一条就「断开」
    let lastId = "0";
    for await (const e of svc.chat(session.id, "go")) {
      lastId = e.id;
      break;
    }
    expect(state.calls).toBe(1);

    // 重连：无 message，带游标 → 不应再调用 flow
    const resumed: Event[] = [];
    for await (const e of svc.chat(session.id, undefined, lastId)) {
      resumed.push(e);
    }
    expect(state.calls).toBe(1); // ★ LLM 调用计数未增
    expect(resumed.map((e) => e.id)).not.toContain(lastId);
    expect(resumed[resumed.length - 1].type).toBe("done");
  });
});

// ── stage 6: stop / 终态 ──────────────────────────────────────────────────
describe("stage 6: stopSession + 终态判定", () => {
  it("isTerminalEvent 仅对 done/error/wait 为真", () => {
    expect(isTerminalEvent({ type: "done" } as any)).toBe(true);
    expect(isTerminalEvent({ type: "error" } as any)).toBe(true);
    expect(isTerminalEvent({ type: "wait" } as any)).toBe(true);
    expect(isTerminalEvent({ type: "message" } as any)).toBe(false);
    expect(isTerminalEvent({ type: "tool" } as any)).toBe(false);
  });

  it("stopSession 置 COMPLETED 并丢弃任务", async () => {
    const repo = new InMemorySessionRepository();
    const session = await newSession(repo);
    const svc = new AgentService(repo, makeCountingFlow().flow);
    await svc.startChat(session, "go"); // → RUNNING + 注册 task

    await svc.stopSession(session.id);
    const after = await repo.getById(session.id);
    expect(after!.status).toBe(SessionStatus.COMPLETED);
  });
});

// ── ★ marquee e2e: CLI kill → 重连 → 断言续传 + LLM 计数未增 ───────────────
describe("marquee: e2e_m10 断点续传不重调 LLM", () => {
  it("runMarquee() 续传剩余事件且 llmCalls === 1", async () => {
    const { runMarquee } = await import("../scripts/e2e_m10.ts");
    const r = await runMarquee();
    expect(r.llmCalls).toBe(1);
    expect(r.resumed[r.resumed.length - 1].type).toBe("done");
  });
});
