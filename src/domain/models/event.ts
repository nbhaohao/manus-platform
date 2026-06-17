// 已就位（AI 生成）接口定义；createEvent 工厂函数 = 你来（stage 4）
// Source: materials/mooc-manus/api/app/domain/models/event.py

import { randomUUID } from "crypto";

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
  plan: unknown; // m08 会替换为 Plan 类型
  status: "created" | "updated" | "completed";
}

export interface TitleEvent extends BaseEvent {
  type: "title";
  title: string;
}

// 判别联合：TypeScript 的 discriminator 字段是 'type'
export type Event =
  | MessageEvent
  | ToolEvent
  | ErrorEvent
  | DoneEvent
  | WaitEvent
  | PlanEvent
  | TitleEvent;

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
