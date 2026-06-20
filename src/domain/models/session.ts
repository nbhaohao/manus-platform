// Source: materials/mooc-manus/api/app/domain/models/session.py
//   —— Session 聚合根：持有 events / files / memories（序列化存储）+ 状态枚举
import { randomUUID } from "node:crypto";
import type { Event, PlanEvent } from "./event.ts";
import type { File } from "./file.ts";
import type { LLMMessage } from "../../ports/llm.ts";

// Memory 在 Session 里以序列化形式存储，避免持有类实例造成序列化困难
export type SerializedMemory = { messages: LLMMessage[] };

// 对标 session.py SessionStatus(str, Enum)
export enum SessionStatus {
  PENDING = "pending",
  RUNNING = "running",
  WAITING = "waiting",
  COMPLETED = "completed",
}

export class Session {
  id: string;
  sandboxId: string | null;
  taskId: string | null;
  title: string;
  unreadMessageCount: number;
  latestMessage: string;
  latestMessageAt: Date | null;
  events: Event[];
  files: File[];
  memories: Record<string, SerializedMemory>;
  status: SessionStatus;
  updatedAt: Date;
  createdAt: Date;

  constructor(
    data: {
      id?: string;
      sandboxId?: string | null;
      taskId?: string | null;
      title?: string;
      unreadMessageCount?: number;
      latestMessage?: string;
      latestMessageAt?: Date | null;
      events?: Event[];
      files?: File[];
      memories?: Record<string, SerializedMemory>;
      status?: SessionStatus;
      updatedAt?: Date;
      createdAt?: Date;
    } = {},
  ) {
    this.id = data.id ?? randomUUID();
    this.sandboxId = data.sandboxId ?? null;
    this.taskId = data.taskId ?? null;
    this.title = data.title ?? "";
    this.unreadMessageCount = data.unreadMessageCount ?? 0;
    this.latestMessage = data.latestMessage ?? "";
    this.latestMessageAt = data.latestMessageAt ?? null;
    this.events = data.events ?? [];
    this.files = data.files ?? [];
    this.memories = data.memories ?? {};
    this.status = data.status ?? SessionStatus.PENDING;
    this.updatedAt = data.updatedAt ?? new Date();
    this.createdAt = data.createdAt ?? new Date();
  }

  getLatestPlan(): unknown | null {
    //逆序遍历 this.events
    for (let i = this.events.length - 1; i >= 0; i--) {
      if (this.events[i].type === "plan")
        return (this.events[i] as PlanEvent).plan;
    }
    return null;
  }
}

export function createSession(
  data?: ConstructorParameters<typeof Session>[0],
): Session {
  return new Session(data);
}
