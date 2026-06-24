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
  // TODO stage 1: 落盘并返回 File 元数据
  //   1. id = randomUUID()；extension = extname(filename)（含点，无扩展则 ""）
  //   2. key = id + extension（存储相对路径，将来即 COS object key）；filepath = join(baseDir, key)
  //   3. await mkdir(baseDir, { recursive:true })；await writeFile(filepath, bytes)
  //   4. file = createFile({ id, filename, filepath, key, extension, size: bytes.byteLength })
  //   5. this.index.set(id, file)；return file
  async save(filename: string, bytes: Uint8Array): Promise<File> {
    throw new Error("TODO: stage 1 — LocalFileStorage.save");
  }

  // ── Stage 1: 按 id 取回字节 + 元数据（不存在抛错）（核心手写）─────────────
  // TODO stage 1: 从内存索引找元数据 → 读盘
  //   1. file = this.index.get(fileId)；不存在 → throw new Error("文件不存在: " + fileId)
  //   2. bytes = await readFile(file.filepath)
  //   3. return { file, bytes }
  async load(fileId: string): Promise<{ file: File; bytes: Uint8Array }> {
    throw new Error("TODO: stage 1 — LocalFileStorage.load");
  }
}
