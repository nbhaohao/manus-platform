// Source: materials/mooc-manus/api/app/domain/services/tools/file.py
//   —— 源码委托给 Sandbox；本课 m04 先跑本机（容器化留到 m06），
//      并新增「路径越狱校验」把读写限制在 workspace 根内（手写的安全核心）。
import { promises as fs } from "node:fs";
import { resolve, sep } from "node:path";
import type { Tool, ToolParam } from "../../domain/tool.ts";

// 把外部传入路径锁进 workspace 根：解析后必须仍在根内，否则视为越权抛错
function resolveInRoot(root: string, p: string): string {
  // 1. const base = resolve(root); const full = resolve(base, p)
  // 2. 若 full !== base 且 !full.startsWith(base + sep) → throw new Error(`路径越权: ${p} 超出工作区`)
  // 3. 否则 return full
  throw new Error("TODO: stage 4 — resolveInRoot 路径越狱校验");
}

export function createFileTools(workspaceRoot: string): Tool[] {
  const filepath: ToolParam = { type: "string", description: "工作区内的文件路径" };
  return [
    {
      name: "read_file",
      description: "读取文件内容。",
      parameters: { filepath },
      required: ["filepath"],
      async execute(args) {
        // resolveInRoot 校验路径 → fs.readFile(full,'utf8') → { success:true, data:内容 }
        // 出错（越权/不存在）catch 成 { success:false, message }
        throw new Error("TODO: stage 4 — read_file");
      },
    },
    {
      name: "write_file",
      description: "写入（覆盖）文件内容。",
      parameters: { filepath, content: { type: "string", description: "要写入的文本" } },
      required: ["filepath", "content"],
      async execute(args) {
        // resolveInRoot 校验 → fs.writeFile(full, String(args.content), 'utf8') → { success:true }
        throw new Error("TODO: stage 4 — write_file");
      },
    },
    {
      name: "list_files",
      description: "列出目录下的条目。",
      parameters: { dir_path: { type: "string", description: "工作区内的目录路径" } },
      required: ["dir_path"],
      async execute(args) {
        // resolveInRoot 校验 → fs.readdir(full) → { success:true, data:条目数组 }
        throw new Error("TODO: stage 4 — list_files");
      },
    },
  ];
}
