// 已就位（AI 生成）
// Source: materials/mooc-manus/api/app/domain/repositories/file_repository.py
import type { File } from '../models/file.ts'

export interface FileRepository {
  save(file: File): Promise<void>
  getById(fileId: string): Promise<File | null>
}
