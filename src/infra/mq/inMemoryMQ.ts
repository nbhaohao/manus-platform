// 已就位（AI 生成）+ Stage 1：getRange / getLatestId 留给你来实现
// Source: 契约参考 domain/external/message_queue.py + redis_stream_message_queue.py
import type { MessageQueuePort } from '../../ports/messageQueue.ts'

type Entry<T> = { id: string; data: T }

export class InMemoryMQ<T = string> implements MessageQueuePort<T> {
  private entries: Entry<T>[] = []
  private seq = 0

  private nextId(): string {
    return `${Date.now()}-${this.seq++}`
  }

  async put(message: T): Promise<string> {
    const id = this.nextId()
    this.entries.push({ id, data: message })
    return id
  }

  async get(startId = '0'): Promise<[string, T] | [null, null]> {
    const idx = this.entries.findIndex(e => e.id > startId)
    if (idx === -1) return [null, null]
    const { id, data } = this.entries[idx]
    return [id, data]
  }

  async pop(): Promise<[string, T] | [null, null]> {
    if (this.entries.length === 0) return [null, null]
    const { id, data } = this.entries.shift()!
    return [id, data]
  }

  async clear(): Promise<void> {
    this.entries = []
  }

  async isEmpty(): Promise<boolean> {
    return this.entries.length === 0
  }

  async size(): Promise<number> {
    return this.entries.length
  }

  async deleteMessage(messageId: string): Promise<boolean> {
    const idx = this.entries.findIndex(e => e.id === messageId)
    if (idx === -1) return false
    this.entries.splice(idx, 1)
    return true
  }

  // TODO stage 1: 实现 getRange
  // 1. 遍历 this.entries
  // 2. 跳过 id < startId 的（startId === '-' 则不跳）
  // 3. 遇到 id > endId 时停（endId === '+' 则不停）
  // 4. 最多 yield count 条
  async *getRange(_startId = '-', _endId = '+', _count = 100): AsyncGenerator<[string, T]> {
    throw new Error('TODO: stage 1')
  }

  // TODO stage 1: 实现 getLatestId
  // 1. entries 为空返回 '0'
  // 2. 否则返回最后一条 entry.id
  async getLatestId(): Promise<string> {
    throw new Error('TODO: stage 1')
  }
}
