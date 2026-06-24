// 已就位（AI 生成）
// Source: materials/mooc-manus/api/app/domain/external/file_storage.py（FileStorage Protocol）
// 本课简化：去掉 UploadFile/COS，端口只认 (filename, bytes) → File / fileId → bytes。
// 核心对这个接口编程：测试用内存假实现，生产用 LocalFileStorage（s1 手写），将来换 COS 只换适配器。
import type { File } from "../domain/models/file.ts";

export interface FileStorage {
  // 存一份字节流，返回带 id/size/key 的 File 元数据（id 由实现分配）
  save(filename: string, bytes: Uint8Array): Promise<File>;
  // 按 id 取回字节流 + File 元数据；不存在则抛错
  load(fileId: string): Promise<{ file: File; bytes: Uint8Array }>;
}
