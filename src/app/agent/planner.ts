// Source: materials/mooc-manus/api/app/domain/services/agents/planner.py
// PlannerAgent：把用户需求拆成原子步骤（createPlan），并按已完成结果重规划后续步骤（updatePlan）。
// 关键：用 format='json_object' + toolChoice='none' 逼 LLM 只产 JSON 文本（不调工具），
//       BaseAgent.invoke 因无 tool_calls 直接终态产 MessageEvent，这里解析成 Plan 再发 PlanEvent。
import { BaseAgent, type AgentTool } from "./base.ts";
import type { LLMPort } from "../../ports/llm.ts";
import type { AgentConfig } from "../../domain/models/appConfig.ts";
import { Memory } from "../../domain/memory.ts";
import { parseJSON } from "../../infra/jsonParser.ts";
import {
  createEvent,
  type Event,
  type PlanEvent,
} from "../../domain/models/event.ts";
import {
  type Plan,
  type Step,
  makePlan,
  makeStep,
} from "../../domain/plan.ts";
import {
  PLANNER_SYSTEM_PROMPT,
  CREATE_PLAN_PROMPT,
  UPDATE_PLAN_PROMPT,
  fillPrompt,
} from "../prompts/planner.ts";

// 已就位（AI 生成）：把 LLM 返回的 JSON 对象转成 Plan 领域对象（补默认值 + 包装 Step）
function planFromParsed(obj: Record<string, unknown>): Plan {
  const rawSteps = Array.isArray(obj.steps) ? obj.steps : [];
  const steps: Step[] = rawSteps.map((s) => {
    const o = s as Record<string, unknown>;
    return makeStep(String(o.description ?? ""), o.id ? String(o.id) : undefined);
  });
  return makePlan({
    title: String(obj.title ?? ""),
    goal: String(obj.goal ?? ""),
    language: String(obj.language ?? ""),
    message: String(obj.message ?? ""),
    steps,
  });
}

export class PlannerAgent extends BaseAgent {
  readonly name = "planner";

  constructor(
    llm: LLMPort,
    tools: AgentTool[],
    config: AgentConfig,
    memory: Memory = new Memory(),
  ) {
    super(llm, tools, config, PLANNER_SYSTEM_PROMPT, memory);
    this.format = "json_object";
    this.toolChoice = "none";
  }

  // ── stage 2 · createPlan ──────────────────────────────────────────────────
  // 根据用户消息生成计划：拼提示词 → invoke → 把 MessageEvent 的 JSON 解析成 Plan → 发 PlanEvent。
  async *createPlan(message: string): AsyncGenerator<Event> {
    // TODO: stage 2 — createPlan
    // 1. const query = fillPrompt(CREATE_PLAN_PROMPT, { message, attachments: "" })
    // 2. for await (const ev of this.invoke(query)) {
    //      // 因 format=json_object + toolChoice=none，正常会拿到 MessageEvent（content 是 JSON）
    //      if (ev.type === "message") {
    //        const parsed = await parseJSON(ev.message, {})        // 容错解析
    //        const plan = planFromParsed(parsed)                   // JSON → Plan 领域对象（已就位 helper）
    //        yield createEvent("plan", { plan, status: "created" }) as PlanEvent
    //      } else { yield ev }                                     // 其他事件透传
    //    }
    throw new Error("TODO: stage 2 — createPlan");
  }

  // ── stage 2 · updatePlan ──────────────────────────────────────────────────
  // 按"第一个未完成步骤之后全部重规划"的规则合并：保留已完成前缀 + 用新步骤替换其后。
  async *updatePlan(plan: Plan, step: Step): AsyncGenerator<Event> {
    // TODO: stage 2 — updatePlan（按"已完成前缀不动、其后重规划"合并）
    // 1. const query = fillPrompt(UPDATE_PLAN_PROMPT, { plan: JSON.stringify(plan), step: JSON.stringify(step) })
    // 2. for await (const ev of this.invoke(query)) {
    //      if (ev.type === "message") {
    //        const parsed = await parseJSON(ev.message, {})
    //        const newSteps = (Array.isArray(parsed.steps) ? parsed.steps : [])
    //          .map(o => makeStep(String(o.description ?? ""), o.id ? String(o.id) : undefined))
    //        // 找旧计划第一个「未完成」步骤下标 firstPending（用 stepDone 取反）
    //        // 若存在：plan.steps = [...已完成前缀(slice 0..firstPending), ...newSteps]
    //        //   —— 关键：不动已完成步骤，只替换其后，保持「重规划」语义
    //        yield createEvent("plan", { plan, status: "updated" }) as PlanEvent
    //      } else { yield ev }
    //    }
    throw new Error("TODO: stage 2 — updatePlan");
  }
}
