// 已就位（AI 生成）
// Source: materials/mooc-manus/api/app/domain/external/message_queue.py

export interface MessageQueuePort<T = string> {
  put(message: T): Promise<string>
  get(startId?: string, blockMs?: number): Promise<[string, T] | [null, null]>
  pop(): Promise<[string, T] | [null, null]>
  clear(): Promise<void>
  isEmpty(): Promise<boolean>
  size(): Promise<number>
  deleteMessage(messageId: string): Promise<boolean>
}
