// m08 · Planner + ReAct Flow 编排
// 红→绿：实现 src/domain/plan.ts、app/agent/planner.ts、app/agent/react.ts、
//        app/flows/base.ts、app/flows/plannerReact.ts 后逐关变绿。
// 不调真 LLM：用 makeMockLLM 按调用顺序喂脚本化 JSON 响应。
import { describe, it, expect } from "vitest";
import { makeMockLLM, type LLMResponse } from "../src/ports/llm.ts";
import { ToolRegistry } from "../src/app/registry.ts";
import type { AgentConfig } from "../src/domain/models/appConfig.ts";
import {
  makePlan,
  makeStep,
  stepDone,
  planDone,
  getNextStep,
  ExecutionStatus,
} from "../src/domain/plan.ts";
import { PlannerAgent } from "../src/app/agent/planner.ts";
import { ReActAgent } from "../src/app/agent/react.ts";
import { BaseFlow, FlowStatus } from "../src/app/flows/base.ts";
import { PlannerReActFlow } from "../src/app/flows/plannerReact.ts";
import type { Event } from "../src/domain/models/event.ts";

const config: AgentConfig = { maxIterations: 5, maxRetries: 1 };
const emptyTools = () => [new ToolRegistry([])];
const J = (o: unknown): LLMResponse => ({
  role: "assistant",
  content: JSON.stringify(o),
});

async function collect(gen: AsyncGenerator<Event>): Promise<Event[]> {
  const out: Event[] = [];
  for await (const ev of gen) out.push(ev);
  return out;
}

// ── stage 1 · Plan 模型 ────────────────────────────────────────────────────
describe("stage 1: Plan 模型", () => {
  it("stepDone 只在 COMPLETED/FAILED 为真", () => {
    expect(stepDone(makeStep("a"))).toBe(false); // PENDING
    const done = makeStep("b");
    done.status = ExecutionStatus.COMPLETED;
    expect(stepDone(done)).toBe(true);
    const failed = makeStep("c");
    failed.status = ExecutionStatus.FAILED;
    expect(stepDone(failed)).toBe(true);
  });

  it("getNextStep 返回第一个未结束步骤，全部结束返回 undefined", () => {
    const s1 = makeStep("一");
    s1.status = ExecutionStatus.COMPLETED;
    const s2 = makeStep("二");
    const plan = makePlan({ steps: [s1, s2] });
    expect(getNextStep(plan)).toBe(s2);
    s2.status = ExecutionStatus.COMPLETED;
    expect(getNextStep(plan)).toBeUndefined();
  });

  it("planDone 反映计划终态", () => {
    const plan = makePlan();
    expect(planDone(plan)).toBe(false);
    plan.status = ExecutionStatus.COMPLETED;
    expect(planDone(plan)).toBe(true);
  });
});

// ── stage 2 · PlannerAgent ─────────────────────────────────────────────────
describe("stage 2: PlannerAgent", () => {
  it("createPlan 把 LLM 的 JSON 解析成 Plan 并发 created 事件", async () => {
    const llm = makeMockLLM([
      J({
        message: "我来处理",
        language: "zh",
        title: "测试任务",
        goal: "完成测试",
        steps: [
          { id: "1", description: "第一步" },
          { id: "2", description: "第二步" },
        ],
      }),
    ]);
    const planner = new PlannerAgent(llm, emptyTools(), config);
    const events = await collect(planner.createPlan("做个测试"));
    const planEv = events.find((e) => e.type === "plan");
    expect(planEv).toBeDefined();
    expect(planEv!.type === "plan" && planEv!.status).toBe("created");
    expect(planEv!.type === "plan" && planEv!.plan.steps.length).toBe(2);
    expect(planEv!.type === "plan" && planEv!.plan.title).toBe("测试任务");
  });
});

// ── stage 3 · ReActAgent ───────────────────────────────────────────────────
describe("stage 3: ReActAgent", () => {
  it("executeStep 发 started+completed 并把结果写回 step", async () => {
    const llm = makeMockLLM([
      J({ success: true, result: "第一步完成", attachments: [] }),
    ]);
    const react = new ReActAgent(llm, emptyTools(), config);
    const plan = makePlan({ language: "zh" });
    const step = makeStep("执行第一步");
    const events = await collect(react.executeStep(plan, step, "用户消息"));
    const stepEvents = events.filter((e) => e.type === "step");
    expect(stepEvents.map((e) => e.type === "step" && e.status)).toEqual([
      "started",
      "completed",
    ]);
    expect(step.status).toBe(ExecutionStatus.COMPLETED);
    expect(step.result).toBe("第一步完成");
    expect(step.success).toBe(true);
  });
});

// ── stage 4 · BaseFlow ─────────────────────────────────────────────────────
describe("stage 4: BaseFlow", () => {
  it("done 只在状态机走到 COMPLETED 才为真", () => {
    class Dummy extends BaseFlow {
      async *invoke(): AsyncGenerator<Event> {}
    }
    const f = new Dummy();
    expect(f.done).toBe(false); // IDLE
    f.status = FlowStatus.EXECUTING;
    expect(f.done).toBe(false);
    f.status = FlowStatus.COMPLETED;
    expect(f.done).toBe(true);
  });
});

// 1 步计划跑完整流程的脚本响应（按调用顺序：create → execute → update → summarize）
const oneStepRun = (): LLMResponse[] => [
  J({
    message: "开始干活",
    language: "zh",
    title: "演示任务",
    goal: "演示 plan-and-execute",
    steps: [{ id: "1", description: "唯一一步" }],
  }),
  J({ success: true, result: "这一步做完了", attachments: [] }),
  J({ steps: [] }), // updatePlan：无剩余步骤
  J({ message: "全部完成，结果如上", attachments: [] }),
];

// ── stage 5 · PlannerReActFlow 状态机 ──────────────────────────────────────
describe("stage 5: PlannerReActFlow 状态机", () => {
  it("驱动 plan→execute→summarize 并终止（流走到 COMPLETED）", async () => {
    const flow = new PlannerReActFlow(
      makeMockLLM(oneStepRun()),
      config,
      emptyTools(),
    );
    const events = await collect(flow.invoke("帮我演示一下"));
    // 计划创建事件
    expect(
      events.some((e) => e.type === "plan" && e.status === "created"),
    ).toBe(true);
    // 至少一个步骤被执行
    expect(events.some((e) => e.type === "step")).toBe(true);
    // 流终止在 COMPLETED
    expect(flow.done).toBe(true);
  });
});

// ── stage 6 · Flow 顶层事件 ────────────────────────────────────────────────
describe("stage 6: Flow 顶层事件", () => {
  it("补发 TitleEvent、计划完成 PlanEvent，结尾 DoneEvent", async () => {
    const flow = new PlannerReActFlow(
      makeMockLLM(oneStepRun()),
      config,
      emptyTools(),
    );
    const events = await collect(flow.invoke("帮我演示一下"));
    const title = events.find((e) => e.type === "title");
    expect(title && title.type === "title" && title.title).toBe("演示任务");
    expect(
      events.some((e) => e.type === "plan" && e.status === "completed"),
    ).toBe(true);
    expect(events[events.length - 1].type).toBe("done");
  });
});
