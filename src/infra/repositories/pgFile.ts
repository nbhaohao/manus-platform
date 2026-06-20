// 已就位（AI 生成）
// Source: materials/mooc-manus/api/app/infrastructure/repositories/db_file_repository.py
import { eq } from 'drizzle-orm'
import type { Db } from '../db/index.ts'
import { files } from '../db/schema.ts'
import type { FileRepository } from '../../domain/repositories/file.ts'
import { createFile, type File } from '../../domain/models/file.ts'

export class PgFileRepository implements FileRepository {
  constructor(private db: Db) {}

  async save(file: File): Promise<void> {
    const existing = await this.db.select({ id: files.id }).from(files).where(eq(files.id, file.id))
    const row = {
      id: file.id,
      filename: file.filename,
      filepath: file.filepath,
      key: file.key,
      extension: file.extension,
      mime_type: file.mimeType,
      size: file.size,
    }
    if (!existing.length) {
      await this.db.insert(files).values(row as any)
    } else {
      await this.db.update(files).set(row as any).where(eq(files.id, file.id))
    }
  }

  async getById(fileId: string): Promise<File | null> {
    const rows = await this.db.select().from(files).where(eq(files.id, fileId))
    if (!rows.length) return null
    const r = rows[0] as any
    return createFile({
      id: r.id, filename: r.filename, filepath: r.filepath,
      key: r.key, extension: r.extension, mimeType: r.mime_type, size: r.size,
    })
  }
}
