// Source: materials/mooc-manus/api/app/domain/services/flows/planner_react.py
// PlannerReActFlow：plan-and-execute 编排状态机。
//   PLANNING（planner 出计划）→ EXECUTING（react 执行一步）→ UPDATING（planner 重规划剩余步骤）
//   → ...循环直到无下一步 → SUMMARIZING（react 汇总）→ COMPLETED。
// 简化（m08）：无 session/UoW/DB、无 rollBack/compactMemory、无 message_ask_user/WaitEvent（属后续模块）。
import { BaseFlow, FlowStatus } from "./base.ts";
import { PlannerAgent } from "../agent/planner.ts";
import { ReActAgent } from "../agent/react.ts";
import type { AgentTool } from "../agent/base.ts";
import type { LLMPort } from "../../ports/llm.ts";
import type { AgentConfig } from "../../domain/models/appConfig.ts";
import { Memory } from "../../domain/memory.ts";
import {
  createEvent,
  type Event,
  type TitleEvent,
  type MessageEvent,
  type PlanEvent,
  type DoneEvent,
} from "../../domain/models/event.ts";
import {
  type Plan,
  type Step,
  ExecutionStatus,
  getNextStep,
} from "../../domain/plan.ts";

export class PlannerReActFlow extends BaseFlow {
  private planner: PlannerAgent;
  private react: ReActAgent;
  plan: Plan | null = null;

  constructor(llm: LLMPort, config: AgentConfig, tools: AgentTool[]) {
    super();
    // planner 与 react 各持独立 Memory（上下文不串）
    this.planner = new PlannerAgent(llm, tools, config, new Memory());
    this.react = new ReActAgent(llm, tools, config, new Memory());
  }

  // ── stage 5 · 状态机主循环 + stage 6 · 顶层事件 ───────────────────────────
  async *invoke(message: string): AsyncGenerator<Event> {
    this.status = FlowStatus.PLANNING;
    let step: Step | undefined;
    while (true) {
      if (this.status === FlowStatus.PLANNING) {
        let ev: Event;
        for await (ev of this.planner.createPlan(message)) {
          if (ev.type === "plan" && ev.status === "created") {
            this.plan = ev.plan;
            yield createEvent("title", { title: ev.plan.title }) as TitleEvent;
            yield createEvent("message", {
              message: ev.plan.message,
            }) as MessageEvent;
          }
          yield ev;
        }
        this.status = FlowStatus.EXECUTING;
        if (!this.plan || this.plan.steps.length === 0)
          this.status = FlowStatus.COMPLETED;
      } else if (this.status === FlowStatus.EXECUTING) {
        this.plan!.status = ExecutionStatus.RUNNING;
        step = getNextStep(this.plan!);
        if (!step) {
          this.status = FlowStatus.SUMMARIZING;
          continue;
        } // 没有下一步 → 去汇总
        let ev: Event;
        for await (ev of this.react.executeStep(this.plan!, step, message))
          yield ev;
        this.status = FlowStatus.UPDATING;
      } else if (this.status === FlowStatus.UPDATING) {
        // 重规划剩余步骤
        let ev: Event;
        for await (ev of this.planner.updatePlan(this.plan!, step!)) {
          yield ev;
        }
        this.status = FlowStatus.EXECUTING;
      } else if (this.status === FlowStatus.SUMMARIZING) {
        let ev: Event;
        for await (ev of this.react.summarize()) yield ev;
        this.status = FlowStatus.COMPLETED;
      } else if (this.status === FlowStatus.COMPLETED) {
        this.plan!.status = ExecutionStatus.COMPLETED;
        yield createEvent("plan", {
          plan: this.plan!,
          status: "completed",
        }) as PlanEvent;
        break;
      }
    }
    // stage 6：循环结束后 yield DoneEvent
    yield createEvent("done", {}) as DoneEvent;
  }
}
