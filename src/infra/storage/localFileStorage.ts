// Source: materials/mooc-manus/api/app/infrastructure/external/file_storage/cos_file_storage.py
//   把 COS 换成本地磁盘：save 落 baseDir、load 读回。File 元数据存内存索引（本课不接 DB）。
//   命题：核心对 FileStorage 端口编程，本地实现只是其中一个适配器——换 COS 不动上层。
import { randomUUID } from "node:crypto";
import { extname, join } from "node:path";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import type { FileStorage } from "../../ports/fileStorage.ts";
import { createFile, type File } from "../../domain/models/file.ts";

export class LocalFileStorage implements FileStorage {
  // 内存索引：fileId → File 元数据（生产里这会落 DB，本课用 Map 够了）
  private readonly index = new Map<string, File>();
  constructor(private readonly baseDir: string) {}

  // ── Stage 1: 存字节 → 写盘 + 建 File 元数据（核心手写）────────────────────
  async save(filename: string, bytes: Uint8Array): Promise<File> {
    const id = randomUUID();
    const extension = extname(filename);
    const key = id + extension;
    const filepath = join(this.baseDir, key);
    await mkdir(this.baseDir, { recursive: true });
    await writeFile(filepath, bytes);
    const file = createFile({
      id,
      filename,
      filepath,
      key,
      extension,
      size: bytes.byteLength,
    });
    this.index.set(id, file);
    return file;
  }

  // ── Stage 1: 按 id 取回字节 + 元数据（不存在抛错）（核心手写）─────────────
  async load(fileId: string): Promise<{ file: File; bytes: Uint8Array }> {
    const file = this.index.get(fileId);
    if (!file) throw new Error("文件不存在: " + fileId);
    const bytes = await readFile(file.filepath);
    return { file, bytes };
  }
}
