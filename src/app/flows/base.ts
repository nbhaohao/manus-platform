// Source: materials/mooc-manus/api/app/domain/services/flows/base.py
// Flow 抽象：把"多 agent 编排"和"单个 agent"解耦。Flow 持有状态机 status，驱动 planner/react 协作。
import type { Event } from "../../domain/models/event.ts";

// 已就位（AI 生成）：流状态枚举（plan-and-execute 状态机的各阶段）
export enum FlowStatus {
  IDLE = "idle", // 空闲（未开始）
  PLANNING = "planning", // 规划中（调 planner.createPlan）
  EXECUTING = "executing", // 执行中（调 react.executeStep）
  UPDATING = "updating", // 更新中（调 planner.updatePlan 重规划）
  SUMMARIZING = "summarizing", // 汇总中（调 react.summarize）
  COMPLETED = "completed", // 已完成
}

export abstract class BaseFlow {
  // 状态机当前所处阶段；子类在 invoke 里推进它
  status: FlowStatus = FlowStatus.IDLE;

  // 流的入口：传入用户消息，迭代产出事件
  abstract invoke(message: string): AsyncGenerator<Event>;

  // ── stage 4 · done 谓词 ───────────────────────────────────────────────────
  // 只读属性：流是否已结束（状态机走到 COMPLETED）。
  get done(): boolean {
    return this.status === FlowStatus.COMPLETED;
  }
}
