// Source: materials/mooc-manus/api/app/domain/services/tools/file.py（接 sandbox 版）
//   m04 的 file 工具读写本机 workspace（带路径牢笼）；这一关把读写落到容器内，走 SandboxPort。
//   工具对 LLM 的契约跟 m04 一致，实现委派给 sandbox（底层是容器内 cat/base64/ls）。
import type { Tool } from "../../domain/tool.ts";
import type { SandboxPort } from "../../ports/sandbox.ts";

export function createSandboxFileTools(sandbox: SandboxPort): Tool[] {
  return [
    {
      name: "read_file",
      description: "读取沙箱容器内的文件内容。",
      parameters: {
        filepath: { type: "string", description: "容器内文件路径" },
      },
      required: ["filepath"],
      async execute(args) {
        const filepath = String(args.filepath ?? "");
        return await sandbox.readFile(filepath);
      },
    },
    {
      name: "write_file",
      description: "写入内容到沙箱容器内的文件。",
      parameters: {
        filepath: { type: "string", description: "容器内文件路径" },
        content: { type: "string", description: "写入内容" },
      },
      required: ["filepath", "content"],
      async execute(args) {
        const filepath = String(args.filepath ?? "");
        const content = String(args.content ?? "");
        return await sandbox.writeFile(filepath, content);
      },
    },
    {
      name: "list_files",
      description: "列出沙箱容器内某目录的文件。",
      parameters: {
        dirPath: { type: "string", description: "容器内目录路径" },
      },
      required: ["dirPath"],
      async execute(args) {
        const dirPath = String(args.dirPath ?? "");
        return await sandbox.listFiles(dirPath);
      },
    },
  ];
}
