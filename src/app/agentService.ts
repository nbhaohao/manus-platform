// Source: materials/mooc-manus/api/app/application/services/agent_service.py
//         + interfaces/endpoints/session_routes.py（chat / stop_session）
// m10 简化版：无沙箱 / 无 attachments / 无后台 asyncio Task。
//   - runner.invoke() 同步跑完，事件全部预先落进 output_stream（ponytail 见 startChat）。
//   - 「SSE」= streamEvents 这个异步生成器，端点只是把它的 yield 转成 ServerSentEvent。
//   - 核心命题：生成与传输解耦——事件产出即写进持久 stream，重连只是把游标挂回日志，
//     模型从不被重新调用（见 chat 的 message? 分支 + e2e_m10 的 llmCalls 断言）。
import { Session, SessionStatus } from "../domain/models/session.ts";
import type { SessionRepository } from "../domain/repositories/session.ts";
import { type Event, createEvent } from "../domain/models/event.ts";
import { Task } from "./task.ts";
import { AgentTaskRunner } from "./agentTaskRunner.ts";
import type { PlannerReActFlow } from "./flows/plannerReact.ts";

// ── 已就位（AI 生成）：合法状态迁移表 ─────────────────────────────────────
// 源码锚点：session.py SessionStatus + agent_service.py 的状态流转
//   PENDING  : 新建，还没跑 → 可启动(RUNNING) 或直接收尾(COMPLETED)
//   RUNNING  : 跑动中     → 可挂起等人(WAITING) 或结束(COMPLETED)
//   WAITING  : 等人类响应  → 人来了重新跑(RUNNING) 或放弃(COMPLETED)
//   COMPLETED: 终态       → 来了新消息可重启一轮(RUNNING)
const TRANSITIONS: Record<SessionStatus, SessionStatus[]> = {
  [SessionStatus.PENDING]: [SessionStatus.RUNNING, SessionStatus.COMPLETED],
  [SessionStatus.RUNNING]: [SessionStatus.WAITING, SessionStatus.COMPLETED],
  [SessionStatus.WAITING]: [SessionStatus.RUNNING, SessionStatus.COMPLETED],
  [SessionStatus.COMPLETED]: [SessionStatus.RUNNING],
};

// ── 已就位（AI 生成）：终态事件判定 ───────────────────────────────────────
// done / error / wait 三类事件意味着「本轮 agent 端结束」，SSE 循环遇到即收尾。
export function isTerminalEvent(event: Event): boolean {
  return (
    event.type === "done" || event.type === "error" || event.type === "wait"
  );
}

// ── Stage 1: 状态机守卫（核心手写）────────────────────────────────────────
// TODO stage 1: 校验并应用状态迁移
//   1. 取 session.status 的允许目标列表 TRANSITIONS[session.status]
//   2. 若 to 不在列表里 → throw new Error(`非法状态迁移 ${session.status} -> ${to}`)
//   3. 合法则 session.status = to
export function transitionSession(session: Session, to: SessionStatus): void {
  if (!TRANSITIONS[session.status]?.includes(to)) {
    throw new Error(`非法状态迁移 ${session.status} -> ${to}`);
  }
  session.status = to;
}

export class AgentService {
  // taskId → Task：同一进程内按会话复用任务（重连时靠它找回既有 output_stream）
  private readonly tasks = new Map<string, Task>();

  constructor(
    private readonly sessionRepo: SessionRepository,
    // ponytail: flow 只需 invoke；测试注入计数 mock 即可验「LLM 没被重调」
    private readonly flow: Pick<PlannerReActFlow, "invoke">,
  ) {}

  // ── Stage 2: chat 起步——写入 input + 启动 task（核心手写）────────────────
  async startChat(session: Session, message: string): Promise<Task> {
    const task = Task.create();
    session.taskId = task.id;
    this.tasks.set(task.id, task);
    await this.sessionRepo.save(session);
    const humanEvent = createEvent("message", {
      role: "user",
      message,
      attachments: [],
    });
    await task.inputStream.put(JSON.stringify(humanEvent));
    transitionSession(session, SessionStatus.RUNNING);
    await new AgentTaskRunner(this.flow).invoke(task);
    return task;
  }

  // ── Stage 3: SSE event_generator——按游标循环读 output_stream（核心手写）──
  async *streamEvents(task: Task, latestEventId = "0"): AsyncGenerator<Event> {
    let cursor = latestEventId || "0";
    while (true) {
      const [id, str] = await task.outputStream.get(cursor);
      if (id === null) break;
      cursor = id;
      const event = JSON.parse(str);
      event.id = id;
      yield event;
      if (isTerminalEvent(event)) break;
    }
  }

  // ── Stage 4: 事件持久化的重放——从 DB 取游标之后的历史（核心手写）──────────
  async *getHistory(sessionId: string, afterId = "0"): AsyncGenerator<Event> {
    const session = await this.sessionRepo.getById(sessionId);
    if (!session) return;
    let started = !afterId || afterId === "0";
    for (const event of session.events) {
      if (started) yield event;
      else if (event.id === afterId) started = true;
    }
  }

  // ── Stage 5: chat 集成——断点续传（核心手写）──────────────────────────────
  async *chat(
    sessionId: string,
    message?: string,
    latestEventId = "0",
  ): AsyncGenerator<Event> {
    const session = await this.sessionRepo.getById(sessionId);
    if (!session) return;
    let task: Task | undefined;
    if (message) {
      task = await this.startChat(session, message);
    } else {
      task = this.tasks.get(session.taskId ?? "");
    }
    if (!task) return;
    for await (const event of this.streamEvents(task, latestEventId)) {
      await this.sessionRepo.addEvent(sessionId, event);
      yield event;
      if (isTerminalEvent(event) && session.status === SessionStatus.RUNNING)
        transitionSession(session, SessionStatus.COMPLETED);
    }
    await this.sessionRepo.save(session);
  }

  // ── Stage 6: 停止会话 / 终态（核心手写）──────────────────────────────────
  // TODO stage 6: 停掉会话——丢弃任务 + 置终态
  //   1. session = await this.sessionRepo.getById(sessionId); if (!session) throw
  //   2. if (session.taskId) this.tasks.delete(session.taskId)
  //   3. transitionSession(session, SessionStatus.COMPLETED)
  //   4. await this.sessionRepo.save(session)
  async stopSession(sessionId: string): Promise<void> {
    throw new Error("TODO: stage 6");
  }
}
