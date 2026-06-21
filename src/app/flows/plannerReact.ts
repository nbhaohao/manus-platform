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
    // ── stage 5：状态机主循环（先把这层写绿）────────────────────────────────
    // this.status = PLANNING; let step: Step | undefined
    // while (true) {
    //   if (IDLE)        → this.status = PLANNING
    //   else if (PLANNING) {
    //     for await (ev of this.planner.createPlan(message)) {
    //       if (ev.type==="plan" && ev.status==="created") this.plan = ev.plan
    //       //  ↑↑ stage 6 在这里补发 TitleEvent + MessageEvent(ev.plan.message)
    //       yield ev
    //     }
    //     this.status = EXECUTING
    //     if (!this.plan || this.plan.steps.length === 0) this.status = COMPLETED
    //   }
    //   else if (EXECUTING) {
    //     this.plan!.status = RUNNING
    //     step = getNextStep(this.plan!)
    //     if (!step) { this.status = SUMMARIZING; continue }   // 没有下一步 → 去汇总
    //     for await (ev of this.react.executeStep(this.plan!, step, message)) yield ev
    //     this.status = UPDATING
    //   }
    //   else if (UPDATING) {                                   // 重规划剩余步骤
    //     for await (ev of this.planner.updatePlan(this.plan!, step!)) yield ev
    //     this.status = EXECUTING
    //   }
    //   else if (SUMMARIZING) {
    //     for await (ev of this.react.summarize()) yield ev
    //     this.status = COMPLETED
    //   }
    //   else if (COMPLETED) {
    //     this.plan!.status = ExecutionStatus.COMPLETED
    //     //  ↑↑ stage 6 在这里补发 PlanEvent(status:"completed")
    //     break
    //   }
    // }
    //
    // ── stage 6：在上面 3 处「↑↑」加顶层 framing 事件 ──────────────────────────
    //   ① PLANNING：plan created 时 yield TitleEvent(plan.title) + MessageEvent(plan.message)
    //   ② COMPLETED：break 前 yield PlanEvent({ plan, status:"completed" })
    //   ③ 循环结束后（while 之外）：yield DoneEvent()
    throw new Error("TODO: stage 5/6 — PlannerReActFlow.invoke");
  }
}
