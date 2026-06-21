// 已就位（AI 生成）接口定义；createEvent 工厂函数 = 你来（stage 4）
// Source: materials/mooc-manus/api/app/domain/models/event.py

import { randomUUID } from "crypto";
import type { Plan, Step } from "../plan.ts"; // m08：Plan/Step 事件携带领域对象

export type EventType =
  | "message"
  | "tool"
  | "plan"
  | "title"
  | "step"
  | "wait"
  | "error"
  | "done";

export interface BaseEvent {
  id: string;
  type: EventType;
  createdAt: Date;
}

export interface MessageEvent extends BaseEvent {
  type: "message";
  role: "user" | "assistant";
  message: string;
  attachments: unknown[];
}

export interface ToolEvent extends BaseEvent {
  type: "tool";
  toolCallId: string;
  toolName: string;
  functionName: string;
  functionArgs: Record<string, unknown>;
  functionResult?: unknown;
  status: "calling" | "called";
}

export interface ErrorEvent extends BaseEvent {
  type: "error";
  error: string;
}

export interface DoneEvent extends BaseEvent {
  type: "done";
}

export interface WaitEvent extends BaseEvent {
  type: "wait";
}

export interface PlanEvent extends BaseEvent {
  type: "plan";
  plan: Plan; // m08：携带规划领域对象
  status: "created" | "updated" | "completed";
}

export interface TitleEvent extends BaseEvent {
  type: "title";
  title: string;
}

// m08：单步执行事件（react agent 执行子步骤时产出）
export interface StepEvent extends BaseEvent {
  type: "step";
  step: Step;
  status: "started" | "completed" | "failed";
}

// 判别联合：TypeScript 的 discriminator 字段是 'type'
export type Event =
  | MessageEvent
  | ToolEvent
  | ErrorEvent
  | DoneEvent
  | WaitEvent
  | PlanEvent
  | TitleEvent
  | StepEvent;

// 工厂函数：自动填 id + createdAt（你来实现）
export function createEvent(
  type: EventType,
  data: Record<string, unknown>,
): Event {
  const id = randomUUID();
  const createdAt = new Date();
  return {
    id,
    type,
    createdAt,
    ...data,
  } as Event;

  // 1. id = randomUUID()
  // 2. createdAt = new Date()
  // 3. return { id, type, createdAt, ...data } as Event
}
