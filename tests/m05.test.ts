import { describe, it, expect, vi } from 'vitest'
import { SessionStatus, createSession } from '../src/domain/models/session.ts'
import { InMemorySessionRepository } from '../src/domain/repositories/session.ts'
import { Memory } from '../src/domain/memory.ts'
import { sessions, files } from '../src/infra/db/schema.ts'
import { PgSessionRepository, sessionToRow } from '../src/infra/repositories/pgSession.ts'
import { withUoW } from '../src/domain/repositories/uow.ts'
import { addToMemory, makeMemorySaveHook } from '../src/app/memory.ts'

// ── stage 1 · Session 领域模型 ───────────────────────────────────────────────
describe('stage 1 · Session 领域模型', () => {
  it('SessionStatus 四个枚举值', () => {
    expect(SessionStatus.PENDING).toBe('pending')
    expect(SessionStatus.RUNNING).toBe('running')
    expect(SessionStatus.WAITING).toBe('waiting')
    expect(SessionStatus.COMPLETED).toBe('completed')
  })
  it('createSession() 默认 status=pending，getLatestPlan() 无 plan 事件时返回 null', () => {
    const s = createSession()
    expect(s.status).toBe(SessionStatus.PENDING)
    expect(s.getLatestPlan()).toBeNull()
  })
})

// ── stage 2 · InMemorySessionRepository 契约 ────────────────────────────────
describe('stage 2 · InMemorySessionRepository', () => {
  it('save 后 getById 返回相同 id', async () => {
    const repo = new InMemorySessionRepository()
    const s = createSession()
    await repo.save(s)
    expect((await repo.getById(s.id))?.id).toBe(s.id)
  })
  it('getById 不存在 → null', async () => {
    const repo = new InMemorySessionRepository()
    expect(await repo.getById('ghost')).toBeNull()
  })
  it('saveMemory → getMemory 消息条数一致', async () => {
    const repo = new InMemorySessionRepository()
    const s = createSession()
    await repo.save(s)
    const mem = new Memory()
    mem.addMessage({ role: 'user', content: 'hello' })
    await repo.saveMemory(s.id, 'planner', mem)
    const got = await repo.getMemory(s.id, 'planner')
    expect(got.getMessages()).toHaveLength(1)
  })
  it('getMemory 无记忆时返回空 Memory', async () => {
    const repo = new InMemorySessionRepository()
    const s = createSession()
    await repo.save(s)
    const got = await repo.getMemory(s.id, 'react')
    expect(got.getMessages()).toHaveLength(0)
  })
})

// ── stage 3 · Drizzle schema ─────────────────────────────────────────────────
describe('stage 3 · Drizzle schema', () => {
  it('sessions schema 有 id / events / memories 列', () => {
    expect(sessions.id).toBeDefined()
    expect((sessions as any).events).toBeDefined()
    expect((sessions as any).memories).toBeDefined()
  })
  it('files schema 有 id / filename / size 列', () => {
    expect(files.id).toBeDefined()
    expect((files as any).filename).toBeDefined()
    expect((files as any).size).toBeDefined()
  })
})

// ── stage 4 · sessionToRow 序列化 ────────────────────────────────────────────
describe('stage 4 · sessionToRow 序列化', () => {
  it('sessionToRow 保留 id、status，events 为数组', () => {
    const s = createSession()
    s.status = SessionStatus.RUNNING
    const row = sessionToRow(s)
    expect(row.id).toBe(s.id)
    expect(row.status).toBe('running')
    expect(Array.isArray(row.events)).toBe(true)
  })
  it('PgSessionRepository 持有所有必要方法', () => {
    const repo = new PgSessionRepository({} as any)
    expect(typeof repo.save).toBe('function')
    expect(typeof repo.getById).toBe('function')
    expect(typeof repo.saveMemory).toBe('function')
    expect(typeof repo.getMemory).toBe('function')
    expect(typeof repo.addEvent).toBe('function')
    expect(typeof repo.updateStatus).toBe('function')
  })
})

// ── stage 5 · withUoW ────────────────────────────────────────────────────────
describe('stage 5 · withUoW', () => {
  it('callback 内 uow.session 和 uow.file 均可用', async () => {
    const mockTx = {
      select: () => ({ from: () => ({ where: () => Promise.resolve([]) }) }),
      insert: () => ({ values: () => Promise.resolve() }),
      update: () => ({ set: () => ({ where: () => Promise.resolve() }) }),
      delete: () => ({ where: () => Promise.resolve() }),
    }
    const mockDb = { transaction: (fn: any) => fn(mockTx) } as any

    let gotSession: any, gotFile: any
    await withUoW(mockDb, async (uow) => {
      gotSession = uow.session
      gotFile = uow.file
    })
    expect(typeof gotSession.save).toBe('function')
    expect(typeof gotFile.save).toBe('function')
  })
})

// ── stage 6 · makeMemorySaveHook ─────────────────────────────────────────────
describe('stage 6 · makeMemorySaveHook 接 repo', () => {
  it('hook 调用后 repo.getMemory 能取回相同消息', async () => {
    const repo = new InMemorySessionRepository()
    const s = createSession()
    await repo.save(s)

    const mem = new Memory()
    const hook = makeMemorySaveHook(repo, s.id, 'react')
    // addToMemory 会先注入 system，再追加 user → 共 2 条
    await addToMemory(mem, [{ role: 'user', content: 'hello' }], 'sys', hook)

    const saved = await repo.getMemory(s.id, 'react')
    expect(saved.getMessages()).toHaveLength(2)
  })
})
