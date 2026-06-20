// Source: materials/mooc-manus/api/app/infrastructure/repositories/db_session_repository.py
//   —— DBSessionRepository → PgSessionRepository（drizzle + postgres.js）
//   核心手写：sessionToRow（stage 4）+ save() upsert（stage 4）
import { eq } from 'drizzle-orm'
import type { Db } from '../db/index.ts'
import { sessions } from '../db/schema.ts'
import type { SessionRepository } from '../../domain/repositories/session.ts'
import { Session, SessionStatus, type SerializedMemory } from '../../domain/models/session.ts'
import { Memory } from '../../domain/memory.ts'
import type { Event } from '../../domain/models/event.ts'
import type { File } from '../../domain/models/file.ts'
import type { LLMMessage } from '../../ports/llm.ts'

// ── stage 4 核心：Domain → DB 行序列化 ──────────────────────────────────────
export function sessionToRow(session: Session): Record<string, unknown> {
  // TODO: stage 4 — 把 Session 各字段映射到 DB 列名（snake_case）
  // 注意：events 里的 Date 需序列化（createdAt → ISO string）
  // return {
  //   id, sandbox_id: session.sandboxId, task_id: session.taskId,
  //   title, unread_message_count: session.unreadMessageCount,
  //   latest_message: session.latestMessage, latest_message_at: session.latestMessageAt,
  //   events: session.events.map(e => ({ ...e, createdAt: e.createdAt?.toISOString?.() ?? e.createdAt })),
  //   files: session.files,
  //   memories: session.memories,
  //   status: session.status,
  //   updated_at: new Date(),
  //   created_at: session.createdAt,
  // }
  throw new Error('TODO: stage 4 — sessionToRow')
}

// ── DB 行 → Domain 反序列化（AI 生成）────────────────────────────────────────
function rowToSession(row: Record<string, unknown>): Session {
  return new Session({
    id:                 row.id                   as string,
    sandboxId:          (row.sandbox_id           as string | null) ?? null,
    taskId:             (row.task_id              as string | null) ?? null,
    title:              (row.title                as string) ?? '',
    unreadMessageCount: (row.unread_message_count as number) ?? 0,
    latestMessage:      (row.latest_message       as string) ?? '',
    latestMessageAt:    row.latest_message_at ? new Date(row.latest_message_at as string) : null,
    events:             (row.events               as Event[])  ?? [],
    files:              (row.files                as File[])   ?? [],
    memories:           (row.memories             as Record<string, SerializedMemory>) ?? {},
    status:             (row.status               as SessionStatus) ?? SessionStatus.PENDING,
    updatedAt:          row.updated_at ? new Date(row.updated_at as string) : new Date(),
    createdAt:          row.created_at ? new Date(row.created_at as string) : new Date(),
  })
}

export class PgSessionRepository implements SessionRepository {
  constructor(private db: Db) {}

  // ── stage 4 核心：upsert ─────────────────────────────────────────────────
  async save(session: Session): Promise<void> {
    // TODO: stage 4 — select-first upsert（对标 db_session_repository.py:save）
    // 1. const existing = await this.db.select({ id: sessions.id })
    //      .from(sessions).where(eq(sessions.id, session.id))
    // 2. const row = sessionToRow(session)
    // 3. if (existing.length === 0) → await this.db.insert(sessions).values(row as any)
    //    else → await this.db.update(sessions).set(row as any).where(eq(sessions.id, session.id))
    throw new Error('TODO: stage 4 — PgSessionRepository.save')
  }

  // ── 已就位（AI 生成）────────────────────────────────────────────────────────
  async getAll(): Promise<Session[]> {
    const rows = await this.db.select().from(sessions)
    return rows.map(r => rowToSession(r as Record<string, unknown>))
  }

  async getById(sessionId: string): Promise<Session | null> {
    const rows = await this.db.select().from(sessions).where(eq(sessions.id, sessionId))
    return rows.length ? rowToSession(rows[0] as Record<string, unknown>) : null
  }

  async deleteById(sessionId: string): Promise<void> {
    await this.db.delete(sessions).where(eq(sessions.id, sessionId))
  }

  async updateTitle(sessionId: string, title: string): Promise<void> {
    await this.db.update(sessions).set({ title } as any).where(eq(sessions.id, sessionId))
  }

  async updateLatestMessage(sessionId: string, message: string, at: Date): Promise<void> {
    await this.db.update(sessions)
      .set({ latest_message: message, latest_message_at: at } as any)
      .where(eq(sessions.id, sessionId))
  }

  async updateUnreadMessageCount(sessionId: string, count: number): Promise<void> {
    await this.db.update(sessions)
      .set({ unread_message_count: count } as any)
      .where(eq(sessions.id, sessionId))
  }

  async incrementUnreadMessageCount(sessionId: string): Promise<void> {
    const rows = await this.db.select({ c: (sessions as any).unread_message_count }).from(sessions).where(eq(sessions.id, sessionId))
    if (!rows.length) return
    await this.db.update(sessions)
      .set({ unread_message_count: ((rows[0] as any).c ?? 0) + 1 } as any)
      .where(eq(sessions.id, sessionId))
  }

  async decrementUnreadMessageCount(sessionId: string): Promise<void> {
    const rows = await this.db.select({ c: (sessions as any).unread_message_count }).from(sessions).where(eq(sessions.id, sessionId))
    if (!rows.length) return
    await this.db.update(sessions)
      .set({ unread_message_count: Math.max(0, ((rows[0] as any).c ?? 0) - 1) } as any)
      .where(eq(sessions.id, sessionId))
  }

  async updateStatus(sessionId: string, status: SessionStatus): Promise<void> {
    await this.db.update(sessions).set({ status } as any).where(eq(sessions.id, sessionId))
  }

  async addEvent(sessionId: string, event: Event): Promise<void> {
    const rows = await this.db.select({ events: (sessions as any).events }).from(sessions).where(eq(sessions.id, sessionId))
    if (!rows.length) return
    const existing = ((rows[0] as any).events ?? []) as unknown[]
    const eventData = { ...event, createdAt: event.createdAt instanceof Date ? event.createdAt.toISOString() : event.createdAt }
    await this.db.update(sessions).set({ events: [...existing, eventData] } as any).where(eq(sessions.id, sessionId))
  }

  async addFile(sessionId: string, file: File): Promise<void> {
    const rows = await this.db.select({ files: (sessions as any).files }).from(sessions).where(eq(sessions.id, sessionId))
    if (!rows.length) return
    const existing = ((rows[0] as any).files ?? []) as unknown[]
    await this.db.update(sessions).set({ files: [...existing, file] } as any).where(eq(sessions.id, sessionId))
  }

  async removeFile(sessionId: string, fileId: string): Promise<void> {
    const rows = await this.db.select({ files: (sessions as any).files }).from(sessions).where(eq(sessions.id, sessionId))
    if (!rows.length) return
    const existing = ((rows[0] as any).files ?? []) as Array<{ id: string }>
    await this.db.update(sessions)
      .set({ files: existing.filter(f => f.id !== fileId) } as any)
      .where(eq(sessions.id, sessionId))
  }

  async getFileByPath(sessionId: string, filepath: string): Promise<File | null> {
    const rows = await this.db.select({ files: (sessions as any).files }).from(sessions).where(eq(sessions.id, sessionId))
    if (!rows.length) return null
    const list = ((rows[0] as any).files ?? []) as Array<File & { filepath: string }>
    return list.find(f => f.filepath === filepath) ?? null
  }

  async saveMemory(sessionId: string, agentName: string, memory: Memory): Promise<void> {
    const rows = await this.db.select({ memories: (sessions as any).memories }).from(sessions).where(eq(sessions.id, sessionId))
    if (!rows.length) return
    const existing = ((rows[0] as any).memories ?? {}) as Record<string, unknown>
    const patch = { ...existing, [agentName]: { messages: memory.getMessages() } }
    await this.db.update(sessions).set({ memories: patch } as any).where(eq(sessions.id, sessionId))
  }

  async getMemory(sessionId: string, agentName: string): Promise<Memory> {
    const rows = await this.db.select({ memories: (sessions as any).memories }).from(sessions).where(eq(sessions.id, sessionId))
    const memories = (rows[0] as any)?.memories as Record<string, { messages: LLMMessage[] }> | undefined
    const data = memories?.[agentName]
    const mem = new Memory()
    data?.messages.forEach(m => mem.addMessage(m))
    return mem
  }
}
