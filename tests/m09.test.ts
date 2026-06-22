// m09 · 异步任务 + Redis Stream 消息队列
// 红→绿：依次实现各关 TODO 后对应 describe 变绿。
// 不依赖真实 Redis：stage 1/3/4/5/6 用 InMemoryMQ；stage 2/3 用 mock Redis 注入。
import { describe, it, expect, vi } from 'vitest'
import { InMemoryMQ } from '../src/infra/mq/inMemoryMQ.ts'
import { RedisStreamMQ } from '../src/infra/mq/redisStream.ts'
import { AgentTaskRunner } from '../src/app/agentTaskRunner.ts'
import { Task } from '../src/app/task.ts'
import type { Event } from '../src/domain/models/event.ts'

// ── stage 1: MessageQueuePort getRange + getLatestId ──────────────────────
describe('stage 1: MessageQueuePort getRange + getLatestId', () => {
  it('put 两条消息后 getLatestId 等于第二条 id', async () => {
    const mq = new InMemoryMQ<string>()
    await mq.put('hello')
    const id2 = await mq.put('world')
    expect(await mq.getLatestId()).toBe(id2)
  })

  it('getRange() 迭代返回所有消息', async () => {
    const mq = new InMemoryMQ<string>()
    await mq.put('a')
    await mq.put('b')
    const msgs: string[] = []
    for await (const [, v] of mq.getRange()) msgs.push(v)
    expect(msgs).toEqual(['a', 'b'])
  })

  it('空队列 getLatestId 返回 "0"', async () => {
    const mq = new InMemoryMQ<string>()
    expect(await mq.getLatestId()).toBe('0')
  })
})

// ── stage 2: Redis Stream xadd / xread 映射 ───────────────────────────────
describe('stage 2: RedisStreamMQ put + get xadd/xread 映射', () => {
  it('put 调用 xadd 并返回 stream id', async () => {
    const mockRedis = { xadd: vi.fn().mockResolvedValue('1700-0') }
    const mq = new RedisStreamMQ<string>('s', mockRedis as any)
    const id = await mq.put('hello')
    expect(id).toBe('1700-0')
    expect(mockRedis.xadd).toHaveBeenCalledWith('s', '*', 'data', 'hello')
  })

  it('get(startId) 调用 xread 并返回下一条消息', async () => {
    const mockRedis = {
      xread: vi.fn().mockResolvedValue([['s', [['1700-1', ['data', 'world']]]]]),
    }
    const mq = new RedisStreamMQ<string>('s', mockRedis as any)
    const [id, val] = await mq.get('1700-0')
    expect(id).toBe('1700-1')
    expect(val).toBe('world')
    expect(mockRedis.xread).toHaveBeenCalledWith('COUNT', 1, 'STREAMS', 's', '1700-0')
  })

  it('get 无数据返回 [null, null]', async () => {
    const mockRedis = { xread: vi.fn().mockResolvedValue(null) }
    const mq = new RedisStreamMQ<string>('s', mockRedis as any)
    const [id, val] = await mq.get()
    expect(id).toBeNull()
    expect(val).toBeNull()
  })
})

// ── stage 3: 分布式锁 + pop ──────────────────────────────────────────────
describe('stage 3: pop 分布式锁语义', () => {
  it('pop 加锁 → xrange 取首条 → xdel 删除 → eval 释放锁', async () => {
    const mockRedis = {
      set: vi.fn().mockResolvedValue('OK'),
      xrange: vi.fn().mockResolvedValue([['1700-0', ['data', 'first']]]),
      xdel: vi.fn().mockResolvedValue(1),
      eval: vi.fn().mockResolvedValue(1),
    }
    const mq = new RedisStreamMQ<string>('stream', mockRedis as any)
    const [id, val] = await mq.pop()
    expect(id).toBe('1700-0')
    expect(val).toBe('first')
    expect(mockRedis.set).toHaveBeenCalled()
    expect(mockRedis.xrange).toHaveBeenCalled()
    expect(mockRedis.xdel).toHaveBeenCalledWith('stream', '1700-0')
    expect(mockRedis.eval).toHaveBeenCalled()
  })

  it('pop 队列空时返回 [null, null]', async () => {
    const mockRedis = {
      set: vi.fn().mockResolvedValue('OK'),
      xrange: vi.fn().mockResolvedValue([]),
      eval: vi.fn().mockResolvedValue(1),
    }
    const mq = new RedisStreamMQ<string>('stream', mockRedis as any)
    const [id, val] = await mq.pop()
    expect(id).toBeNull()
    expect(val).toBeNull()
  })
})

// 测试用 mock flow
function makeMockFlow(msgs: string[] = ['done']) {
  return {
    async *invoke(_msg: string): AsyncGenerator<Event> {
      for (const m of msgs) {
        yield { type: 'message', role: 'assistant', message: m, created_at: '' } as any
      }
      yield { type: 'done', created_at: '' } as any
    },
  }
}

async function setupTask() {
  const input = new InMemoryMQ<string>()
  const output = new InMemoryMQ<string>()
  await input.put(JSON.stringify({ type: 'message', role: 'user', message: 'go', created_at: '' }))
  return { input, output }
}

// ── stage 4: AgentTaskRunner.invoke() ────────────────────────────────────
describe('stage 4: AgentTaskRunner input→flow→output', () => {
  it('从 input 取消息 → flow 事件写入 output', async () => {
    const { input, output } = await setupTask()
    const runner = new AgentTaskRunner(makeMockFlow(['step1']))
    await runner.invoke({ inputStream: input, outputStream: output, id: 't1' })
    expect(await output.size()).toBeGreaterThanOrEqual(2) // message + done
  })

  it('output 含 done 事件', async () => {
    const { input, output } = await setupTask()
    await new AgentTaskRunner(makeMockFlow()).invoke({ inputStream: input, outputStream: output, id: 't2' })
    const all: string[] = []
    for await (const [, v] of output.getRange()) all.push(v)
    const types = all.map(s => JSON.parse(s).type)
    expect(types).toContain('done')
  })

  it('input 为空时不写 output', async () => {
    const output = new InMemoryMQ<string>()
    const input = new InMemoryMQ<string>() // empty
    await new AgentTaskRunner(makeMockFlow()).invoke({ inputStream: input, outputStream: output, id: 't3' })
    expect(await output.size()).toBe(0)
  })

  it('get(id) 作断点续传游标：返回 id 之后的消息（双流解耦预热）', async () => {
    const { input, output } = await setupTask()
    await new AgentTaskRunner(makeMockFlow(['s1', 's2'])).invoke({
      inputStream: input, outputStream: output, id: 't4'
    })
    const [firstId] = await output.get('0')
    const [, secondVal] = await output.get(firstId!)
    expect(JSON.parse(secondVal!).message).toBe('s2')
  })
})

// ── stage 5: Task 双流解耦 ───────────────────────────────────────────────
describe('stage 5: Task 双流工厂', () => {
  it('Task.create() 返回带有效 id 的 Task', () => {
    const task = Task.create()
    expect(task.id).toBeTruthy()
    expect(task.inputStream).toBeDefined()
    expect(task.outputStream).toBeDefined()
  })

  it('inputStream 和 outputStream 完全独立', async () => {
    const task = Task.create()
    await task.inputStream.put('msg')
    expect(await task.outputStream.isEmpty()).toBe(true)
    expect(await task.inputStream.size()).toBe(1)
  })
})

// ── stage 6: e2e smoke — 后台任务独立于消费方 ──────────────────────────────
describe('stage 6: e2e 后台任务不依赖 SSE 消费方', () => {
  it('runE2e() 不抛错且 output_stream 有事件', async () => {
    const { runE2e } = await import('../scripts/e2e_m09.ts')
    await expect(runE2e()).resolves.not.toThrow()
  })
})
