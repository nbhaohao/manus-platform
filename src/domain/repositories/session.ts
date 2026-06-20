// Source: materials/mooc-manus/api/app/domain/repositories/session_repository.py
//   —— Python Protocol → TS interface；InMemorySessionRepository 用于单元测试（stage 2 核心手写）
import type { Event } from "../models/event.ts";
import type { File } from "../models/file.ts";
import { Memory } from "../memory.ts";
import {
  Session,
  SessionStatus,
  type SerializedMemory,
} from "../models/session.ts";

// ── 接口（AI 生成：Protocol → TS interface 结构映射）────────────────────────
export interface SessionRepository {
  save(session: Session): Promise<void>;
  getAll(): Promise<Session[]>;
  getById(sessionId: string): Promise<Session | null>;
  deleteById(sessionId: string): Promise<void>;
  updateTitle(sessionId: string, title: string): Promise<void>;
  updateLatestMessage(
    sessionId: string,
    message: string,
    at: Date,
  ): Promise<void>;
  updateUnreadMessageCount(sessionId: string, count: number): Promise<void>;
  incrementUnreadMessageCount(sessionId: string): Promise<void>;
  decrementUnreadMessageCount(sessionId: string): Promise<void>;
  updateStatus(sessionId: string, status: SessionStatus): Promise<void>;
  addEvent(sessionId: string, event: Event): Promise<void>;
  addFile(sessionId: string, file: File): Promise<void>;
  removeFile(sessionId: string, fileId: string): Promise<void>;
  getFileByPath(sessionId: string, filepath: string): Promise<File | null>;
  saveMemory(
    sessionId: string,
    agentName: string,
    memory: Memory,
  ): Promise<void>;
  getMemory(sessionId: string, agentName: string): Promise<Memory>;
}

// ── InMemorySessionRepository（stage 2 核心：实现下面 4 个 TODO 方法）───────
export class InMemorySessionRepository implements SessionRepository {
  private db = new Map<string, Session>();
  // sessionId → agentName → 序列化 memory
  private memDb = new Map<string, Map<string, SerializedMemory>>();

  async save(session: Session): Promise<void> {
    this.db.set(session.id, session);
  }

  async getById(sessionId: string): Promise<Session | null> {
    return this.db.get(sessionId) ?? null;
  }

  async saveMemory(
    sessionId: string,
    agentName: string,
    memory: Memory,
  ): Promise<void> {
    const memDb =
      this.memDb.get(sessionId) ?? new Map<string, SerializedMemory>();
    memDb.set(agentName, { messages: memory.getMessages() });
    this.memDb.set(sessionId, memDb);
  }

  async getMemory(sessionId: string, agentName: string): Promise<Memory> {
    const memDb = this.memDb.get(sessionId);
    const data = memDb?.get(agentName);
    const mem = new Memory();
    data?.messages.forEach((m) => mem.addMessage(m));
    return mem;
  }

  // ── gen：其余 stub 方法（不测，仅满足 SessionRepository 接口）────────────
  async getAll(): Promise<Session[]> {
    return [...this.db.values()];
  }
  async deleteById(id: string): Promise<void> {
    this.db.delete(id);
  }
  async updateTitle(id: string, title: string): Promise<void> {
    const s = this.db.get(id);
    if (s) s.title = title;
  }
  async updateLatestMessage(id: string, msg: string, at: Date): Promise<void> {
    const s = this.db.get(id);
    if (s) {
      s.latestMessage = msg;
      s.latestMessageAt = at;
    }
  }
  async updateUnreadMessageCount(id: string, count: number): Promise<void> {
    const s = this.db.get(id);
    if (s) s.unreadMessageCount = count;
  }
  async incrementUnreadMessageCount(id: string): Promise<void> {
    const s = this.db.get(id);
    if (s) s.unreadMessageCount++;
  }
  async decrementUnreadMessageCount(id: string): Promise<void> {
    const s = this.db.get(id);
    if (s) s.unreadMessageCount = Math.max(0, s.unreadMessageCount - 1);
  }
  async updateStatus(id: string, status: SessionStatus): Promise<void> {
    const s = this.db.get(id);
    if (s) s.status = status;
  }
  async addEvent(id: string, event: Event): Promise<void> {
    const s = this.db.get(id);
    if (s) s.events.push(event);
  }
  async addFile(id: string, file: File): Promise<void> {
    const s = this.db.get(id);
    if (s) s.files.push(file);
  }
  async removeFile(id: string, fileId: string): Promise<void> {
    const s = this.db.get(id);
    if (s) s.files = s.files.filter((f) => f.id !== fileId);
  }
  async getFileByPath(id: string, path: string): Promise<File | null> {
    return this.db.get(id)?.files.find((f) => f.filepath === path) ?? null;
  }
}
