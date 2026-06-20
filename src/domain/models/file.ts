// 已就位（AI 生成）
// Source: materials/mooc-manus/api/app/domain/models/file.py
import { randomUUID } from 'node:crypto'

export interface File {
  id: string
  filename: string
  filepath: string
  key: string        // 云存储路径（本课暂不用 COS，留空即可）
  extension: string
  mimeType: string
  size: number
}

export function createFile(data: Partial<Omit<File, 'id'>> & { id?: string } = {}): File {
  return {
    id: data.id ?? randomUUID(),
    filename: data.filename ?? '',
    filepath: data.filepath ?? '',
    key: data.key ?? '',
    extension: data.extension ?? '',
    mimeType: data.mimeType ?? '',
    size: data.size ?? 0,
  }
}
