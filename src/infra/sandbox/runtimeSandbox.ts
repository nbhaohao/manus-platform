// 已就位（AI 生成）
// SandboxPort 的「进程内」实现：直接对着一个已创建的容器跑命令（不走 HTTP）。
// 与 HttpSandbox 对比 —— 同一个 SandboxPort 抽象，可换 in-process / over-HTTP 两种落地，
// 正是 ports 解耦的价值。CLI 体感用这个（容器生命周期由 withContainer 管，干净退出）；
// e2e_m06 演示完整的 HttpSandbox → 服务 → runtime 分布式路径。
import type {
  Container,
  ContainerRuntime,
  ExecResult,
} from "../../ports/containerRuntime.ts";
import type { SandboxPort } from "../../ports/sandbox.ts";
import type { ToolResult } from "../../domain/models/toolResult.ts";

export class RuntimeSandbox implements SandboxPort {
  constructor(
    private runtime: ContainerRuntime,
    private container: Container,
  ) {}

  async execCommand(
    _sessionId: string,
    execDir: string,
    command: string,
  ): Promise<ToolResult> {
    const r = await this.runtime.exec(this.container, command, {
      cwd: execDir || undefined,
    });
    return r.exitCode === 0
      ? { success: true, message: "执行完成", data: r }
      : { success: false, message: r.stderr || "命令失败", data: r };
  }

  async readFile(filepath: string): Promise<ToolResult> {
    const r = await this.execCommand("", "", "cat " + filepath);
    if (!r.success) return r;
    return { success: true, message: "读取成功", data: (r.data as ExecResult).stdout };
  }

  async writeFile(filepath: string, content: string): Promise<ToolResult> {
    const b64 = Buffer.from(content, "utf8").toString("base64");
    const r = await this.execCommand("", "", "echo " + b64 + " | base64 -d > " + filepath);
    return r.success ? { success: true, message: "写入成功" } : r;
  }

  async listFiles(dirPath: string): Promise<ToolResult> {
    const r = await this.execCommand("", "", "ls -1 " + dirPath);
    if (!r.success) return r;
    return { success: true, message: "列目录成功", data: (r.data as ExecResult).stdout };
  }

  async ensureSandbox(): Promise<void> {
    // 容器由外部（withContainer）创建并管理生命周期，这里无需操作。
  }

  async destroy(): Promise<boolean> {
    // 同上，销毁交给 withContainer 的 finally。
    return true;
  }
}
