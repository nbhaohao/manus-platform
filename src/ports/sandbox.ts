// 已就位（AI 生成）
// Source: materials/mooc-manus/api/app/domain/external/sandbox.py
//   源码 Sandbox 协议很宽（shell session / 全套 file ops / browser / cdp / vnc）。
//   m06 大幅精简，只留实际用到的：容器内 shell + 三个 file ops + 生命周期。
//   browser/cdp 留到 m07；session 化 shell（read_shell_output/wait/kill）暂不做（YAGNI）。
import type { ToolResult } from "../domain/models/toolResult.ts";

export interface SandboxPort {
  // 在沙箱（容器）里执行命令。sessionId/execDir 沿用源码签名，m06 先做无状态一次性 exec。
  execCommand(
    sessionId: string,
    execDir: string,
    command: string,
  ): Promise<ToolResult>;
  readFile(filepath: string): Promise<ToolResult>;
  writeFile(filepath: string, content: string): Promise<ToolResult>;
  listFiles(dirPath: string): Promise<ToolResult>;
  // 确保沙箱就绪（容器存在）；销毁沙箱。
  ensureSandbox(): Promise<void>;
  destroy(): Promise<boolean>;
}
