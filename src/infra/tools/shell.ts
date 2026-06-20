// Source: materials/mooc-manus/api/app/domain/services/tools/shell.py
//   —— 源码是带 session 的沙箱 shell；本课 m04 简化为「本机单次命令执行」抽象，
//      容器化与会话留到 m06。命令出错（非零退出）包成失败 ToolResult，不抛。
import { exec } from "node:child_process";
import { promisify } from "node:util";
import type { Tool } from "../../domain/tool.ts";

const execAsync = promisify(exec);

export function createShellTool(cwd?: string): Tool {
  return {
    name: "shell_exec",
    description: "在本机执行一条 shell 命令并返回输出。",
    parameters: {
      command: { type: "string", description: "要执行的 shell 命令" },
    },
    required: ["command"],
    async execute(args) {
      try {
        const command = String(args.command ?? "");
        const { stdout, stderr } = await execAsync(command, {
          cwd,
          timeout: 30000,
        });
        return {
          success: true,
          message: "执行完成",
          data: { stdout, stderr },
        };
      } catch (e) {
        return { success: false, message: String(e) };
      }
    },
  };
}
