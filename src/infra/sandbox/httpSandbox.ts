// Source: materials/mooc-manus/api/app/infrastructure/external/sandbox/docker_sandbox.py
//   源码 DockerSandbox 用 httpx 打容器内的沙箱服务；本课 HttpSandbox 用 fetch 打 stage 2 的
//   宿主沙箱服务。fetchFn 可注入 → 测试塞 mock，不需要起真服务。
//   file ops 复用 execCommand（cat / base64 写 / ls），不另开 HTTP 端点。
import type { SandboxPort } from "../../ports/sandbox.ts";
import type { ToolResult } from "../../domain/models/toolResult.ts";

type FetchFn = (url: string, init: RequestInit) => Promise<Response>;

interface ExecData {
  stdout: string;
  stderr: string;
  exitCode: number;
}

export class HttpSandbox implements SandboxPort {
  constructor(
    private baseUrl: string,
    private fetchFn: FetchFn = fetch,
  ) {}

  // ── stage 4 核心：把命令 POST 给沙箱服务，回包映射成 ToolResult ──────────────
  async execCommand(
    sessionId: string,
    execDir: string,
    command: string,
  ): Promise<ToolResult> {
    // TODO: stage 4
    // 1. const res = await this.fetchFn(this.baseUrl + "/shell/exec-command", {
    //      method: "POST",
    //      headers: { "content-type": "application/json" },
    //      body: JSON.stringify({ command, execDir }),
    //    })
    // 2. const json = (await res.json()) as { success: boolean; data: ExecData }
    // 3. return json.success
    //      ? { success: true, message: "执行完成", data: json.data }
    //      : { success: false, message: json.data?.stderr || "命令失败", data: json.data }
    throw new Error("TODO: stage 4 — execCommand 未实现");
  }

  // ── 已就位（AI 生成）：file ops 都翻译成容器内 shell 命令，复用 execCommand ──────
  async readFile(filepath: string): Promise<ToolResult> {
    const r = await this.execCommand("", "", "cat " + filepath);
    if (!r.success) return r;
    return { success: true, message: "读取成功", data: (r.data as ExecData).stdout };
  }

  async writeFile(filepath: string, content: string): Promise<ToolResult> {
    // base64 绕开引号转义：echo <b64> | base64 -d > filepath
    const b64 = Buffer.from(content, "utf8").toString("base64");
    const r = await this.execCommand(
      "",
      "",
      "echo " + b64 + " | base64 -d > " + filepath,
    );
    return r.success ? { success: true, message: "写入成功" } : r;
  }

  async listFiles(dirPath: string): Promise<ToolResult> {
    const r = await this.execCommand("", "", "ls -1 " + dirPath);
    if (!r.success) return r;
    return { success: true, message: "列目录成功", data: (r.data as ExecData).stdout };
  }

  async ensureSandbox(): Promise<void> {
    // 服务端懒创建容器，这里无需预热。
  }

  async destroy(): Promise<boolean> {
    return true;
  }
}
