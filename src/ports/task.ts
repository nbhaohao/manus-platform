// 已就位（AI 生成）
// Source: materials/mooc-manus/api/app/domain/external/task.py
import type { MessageQueuePort } from './messageQueue.ts'

export interface TaskPort {
  readonly id: string
  readonly inputStream: MessageQueuePort<string>
  readonly outputStream: MessageQueuePort<string>
}
