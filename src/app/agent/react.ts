// Source: materials/mooc-manus/api/app/domain/services/agents/react.py
// ReActAgent：执行单个子步骤（executeStep）+ 全部完成后汇总（summarize）。
// 与 planner 不同：react 会真正调工具（tool_calls），直到 LLM 产出 JSON 结果文本（终态 MessageEvent）。
import { BaseAgent, type AgentTool } from "./base.ts";
import type { LLMPort } from "../../ports/llm.ts";
import type { AgentConfig } from "../../domain/models/appConfig.ts";
import { Memory } from "../../domain/memory.ts";
import { parseJSON } from "../../infra/jsonParser.ts";
import {
  createEvent,
  type Event,
  type StepEvent,
  type MessageEvent,
} from "../../domain/models/event.ts";
import { type Plan, type Step, ExecutionStatus } from "../../domain/plan.ts";
import {
  REACT_SYSTEM_PROMPT,
  EXECUTION_PROMPT,
  SUMMARIZE_PROMPT,
  fillPrompt,
} from "../prompts/react.ts";

export class ReActAgent extends BaseAgent {
  readonly name = "react";

  constructor(
    llm: LLMPort,
    tools: AgentTool[],
    config: AgentConfig,
    memory: Memory = new Memory(),
  ) {
    super(llm, tools, config, REACT_SYSTEM_PROMPT, memory);
    this.format = "json_object";
  }

  // ── stage 3 · executeStep ─────────────────────────────────────────────────
  // 执行单步：标 RUNNING 发 started → invoke（工具事件透传）→ 终态 MessageEvent 解析结果写回 step → 发 completed。
  async *executeStep(
    plan: Plan,
    step: Step,
    message: string,
  ): AsyncGenerator<Event> {
    // TODO: stage 3 — executeStep
    // 1. const query = fillPrompt(EXECUTION_PROMPT, { message, attachments:"", language: plan.language, step: step.description })
    // 2. step.status = RUNNING; yield createEvent("step", { step, status:"started" }) as StepEvent
    // 3. for await (const ev of this.invoke(query)) {
    //      if (ev.type === "message") {                 // 终态：LLM 产出 JSON 结果文本
    //        step.status = COMPLETED
    //        const parsed = await parseJSON(ev.message, {})
    //        step.success = Boolean(parsed.success)
    //        step.result  = parsed.result ? String(parsed.result) : undefined
    //        step.attachments = Array.isArray(parsed.attachments) ? parsed.attachments.map(String) : []
    //        yield createEvent("step", { step, status:"completed" }) as StepEvent
    //        if (step.result) yield createEvent("message", { role:"assistant", message: step.result, attachments:[] }) as MessageEvent
    //        continue
    //      } else if (ev.type === "error") {
    //        step.status = FAILED; step.error = ev.error
    //        yield createEvent("step", { step, status:"failed" }) as StepEvent
    //      }
    //      yield ev                                     // 工具事件等透传
    //    }
    // 4. step.status = COMPLETED
    throw new Error("TODO: stage 3 — executeStep");
  }

  // ── stage 3 · summarize ───────────────────────────────────────────────────
  // 全部步骤完成后，汇总历史生成最终回复。
  async *summarize(): AsyncGenerator<Event> {
    // TODO: stage 3 — summarize
    // 1. for await (const ev of this.invoke(SUMMARIZE_PROMPT)) {
    //      if (ev.type === "message") {
    //        const parsed = await parseJSON(ev.message, {})
    //        yield createEvent("message", {
    //          role:"assistant",
    //          message: String(parsed.message ?? ev.message),
    //          attachments: Array.isArray(parsed.attachments) ? parsed.attachments : [],
    //        }) as MessageEvent
    //      } else { yield ev }
    //    }
    throw new Error("TODO: stage 3 — summarize");
  }
}
