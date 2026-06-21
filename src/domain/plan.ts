// Source: materials/mooc-manus/api/app/domain/models/plan.py
// 规划领域模型：把用户消息拆出的子任务/子步骤存为 Plan + Step[]。
// 类型/工厂为「已就位」样板；谓词 stepDone / planDone / getNextStep 是 stage 1 你来实现。
import { randomUUID } from "crypto";

// 已就位（AI 生成）：执行状态枚举（规划与单步共用）
export enum ExecutionStatus {
  PENDING = "pending", // 空闲 or 等待中
  RUNNING = "running", // 执行中
  COMPLETED = "completed", // 执行完成
  FAILED = "failed", // 失败
}

// 已就位（AI 生成）：计划中的每个子步骤
export interface Step {
  id: string;
  description: string;
  status: ExecutionStatus;
  result?: string;
  error?: string;
  success: boolean;
  attachments: string[];
}

// 已就位（AI 生成）：规划领域模型
export interface Plan {
  id: string;
  title: string;
  goal: string;
  language: string;
  steps: Step[];
  message: string;
  status: ExecutionStatus;
  error?: string;
}

// 已就位（AI 生成）：工厂——补默认值，对标 pydantic 的 Field(default_factory=...)
export function makeStep(description: string, id?: string): Step {
  return {
    id: id ?? randomUUID(),
    description,
    status: ExecutionStatus.PENDING,
    success: false,
    attachments: [],
  };
}

export function makePlan(init: Partial<Plan> = {}): Plan {
  return {
    id: init.id ?? randomUUID(),
    title: init.title ?? "",
    goal: init.goal ?? "",
    language: init.language ?? "",
    steps: init.steps ?? [],
    message: init.message ?? "",
    status: init.status ?? ExecutionStatus.PENDING,
    error: init.error,
  };
}

// ── stage 1 · 谓词（plan-and-execute 的"取下一步"靠它）────────────────────────
// Source: plan.py Step.done / Plan.done / Plan.get_next_step

/** 步骤是否结束（完成或失败都算结束）。 */
export function stepDone(step: Step): boolean {
  // TODO: stage 1 —— status 为 COMPLETED 或 FAILED 时返回 true
  throw new Error("TODO: stage 1 — stepDone");
}

/** 计划是否结束。 */
export function planDone(plan: Plan): boolean {
  // TODO: stage 1 —— 同 stepDone，判断 plan.status 是否 COMPLETED/FAILED
  throw new Error("TODO: stage 1 — planDone");
}

/** 取下一个需要执行的步骤（第一个未结束的）；全部结束返回 undefined。 */
export function getNextStep(plan: Plan): Step | undefined {
  // TODO: stage 1 —— 返回 plan.steps 中第一个「未结束」的步骤（用 stepDone 判断），没有则 undefined
  throw new Error("TODO: stage 1 — getNextStep");
}
