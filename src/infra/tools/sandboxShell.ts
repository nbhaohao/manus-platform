// Source: materials/mooc-manus/api/app/domain/services/tools/shell.py（接 sandbox 版）
//   m04 的 shell 工具直接 child_process.exec（本机、无隔离，正是 stage 1 的越狱面）；
//   这一关把它改成走 SandboxPort —— 工具对 LLM 的契约（name/参数）跟 m04 一致，
//   只是执行落到容器里。宿主文件从此读不到了。
import type { Tool } from "../../domain/tool.ts";
import type { SandboxPort } from "../../ports/sandbox.ts";

export function createSandboxShellTool(sandbox: SandboxPort): Tool {
  return {
    name: "shell_exec",
    description: "在沙箱容器内执行一条 shell 命令并返回输出。",
    parameters: {
      command: { type: "string", description: "要执行的 shell 命令" },
    },
    required: ["command"],
    async execute(args) {
      const command = String(args.command ?? "");
      return await sandbox.execCommand("", "", command);
    },
  };
}
