// Source: materials/mooc-manus/api/app/domain/services/tools/file.py
//   —— 源码委托给 Sandbox；本课 m04 先跑本机（容器化留到 m06），
//      并新增「路径越狱校验」把读写限制在 workspace 根内（手写的安全核心）。
import { promises as fs } from "node:fs";
import { resolve, sep } from "node:path";
import type { Tool, ToolParam } from "../../domain/tool.ts";
import { ToolResult } from "../../domain/models/toolResult.js";

// 把外部传入路径锁进 workspace 根：解析后必须仍在根内，否则视为越权抛错
function resolveInRoot(root: string, p: string): string {
  const base = resolve(root);
  const full = resolve(base, p);
  if (full !== base && !full.startsWith(base + sep)) {
    throw new Error(`路径越权: ${p} 超出工作区`);
  }
  return full;
}

export function createFileTools(workspaceRoot: string): Tool[] {
  const filepath: ToolParam = {
    type: "string",
    description: "工作区内的文件路径",
  };
  return [
    {
      name: "read_file",
      description: "读取文件内容。",
      parameters: { filepath },
      required: ["filepath"],
      async execute(args) {
        // resolveInRoot 校验路径 → fs.readFile(full,'utf8') → { success:true, data:内容 }
        // 出错（越权/不存在）catch 成 { success:false, message }
        try {
          const full = resolveInRoot(workspaceRoot, args.filepath as string);
          const content = await fs.readFile(full, "utf8");
          return { success: true, data: content } as ToolResult;
        } catch (e) {
          return { success: false, message: String(e) };
        }
      },
    },
    {
      name: "write_file",
      description: "写入（覆盖）文件内容。",
      parameters: {
        filepath,
        content: { type: "string", description: "要写入的文本" },
      },
      required: ["filepath", "content"],
      async execute(args) {
        try {
          const full = resolveInRoot(workspaceRoot, args.filepath as string);
          await fs.writeFile(full, String(args.content), "utf8");
          return { success: true } as ToolResult;
        } catch (e) {
          return { success: false, message: String(e) };
        }
      },
    },
    {
      name: "list_files",
      description: "列出目录下的条目。",
      parameters: {
        dir_path: { type: "string", description: "工作区内的目录路径" },
      },
      required: ["dir_path"],
      async execute(args) {
        try {
          const full = resolveInRoot(workspaceRoot, args.dir_path as string);
          const entries = await fs.readdir(full);
          return { success: true, data: entries } as ToolResult;
        } catch (e) {
          return { success: false, message: String(e) };
        }
      },
    },
  ];
}
