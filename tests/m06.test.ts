import { describe, it, expect } from "vitest";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { createShellTool } from "../src/infra/tools/shell.ts";
import { probeShellEscape } from "../src/sandbox/isolation.ts";
import { createSandboxApp } from "../src/sandbox/service.ts";
import { withContainer } from "../src/infra/sandbox/docker.ts";
import { HttpSandbox } from "../src/infra/sandbox/httpSandbox.ts";
import { createSandboxShellTool } from "../src/infra/tools/sandboxShell.ts";
import { createSandboxFileTools } from "../src/infra/tools/sandboxFile.ts";
import type {
  ContainerRuntime,
  ExecResult,
} from "../src/ports/containerRuntime.ts";
import type { SandboxPort } from "../src/ports/sandbox.ts";

// ── 测试替身 ────────────────────────────────────────────────────────────────
function fakeRuntime(exec: () => ExecResult = () => ({
  stdout: "hi\n",
  stderr: "",
  exitCode: 0,
})) {
  const calls = { created: 0, execs: [] as string[], destroyed: 0 };
  const runtime: ContainerRuntime = {
    async create() {
      calls.created++;
      return { id: "c1" };
    },
    async exec(_c, command) {
      calls.execs.push(command);
      return exec();
    },
    async destroy() {
      calls.destroyed++;
    },
  };
  return { runtime, calls };
}

function fakeSandbox() {
  const calls = {
    exec: [] as string[],
    read: [] as string[],
    write: [] as [string, string][],
    list: [] as string[],
  };
  const sandbox: SandboxPort = {
    async execCommand(_s, _d, command) {
      calls.exec.push(command);
      return {
        success: true,
        message: "",
        data: { stdout: "in-container", stderr: "", exitCode: 0 },
      };
    },
    async readFile(p) {
      calls.read.push(p);
      return { success: true, message: "", data: "rc" };
    },
    async writeFile(p, c) {
      calls.write.push([p, c]);
      return { success: true, message: "" };
    },
    async listFiles(d) {
      calls.list.push(d);
      return { success: true, message: "", data: "a\nb" };
    },
    async ensureSandbox() {},
    async destroy() {
      return true;
    },
  };
  return { sandbox, calls };
}

// ── stage 1 · 越狱面 demo ─────────────────────────────────────────────────────
describe("stage 1 · 越狱面 demo", () => {
  it("本地 shell 工具能读到 workspace 之外的宿主文件（隔离缺口 → 需要容器）", async () => {
    const ws = await mkdtemp(join(tmpdir(), "m06-ws-"));
    const hostFile = join(tmpdir(), "m06-secret-" + Date.now() + ".txt");
    await writeFile(hostFile, "TOP_SECRET_HOST_DATA");
    const shell = createShellTool(ws); // cwd 锁 workspace，但 shell 命令本身不受限
    const report = await probeShellEscape(shell, hostFile);
    expect(report.escaped).toBe(true);
    expect(report.evidence).toContain("TOP_SECRET");
    await rm(hostFile, { force: true });
  });
});

// ── stage 2 · 沙箱服务 ────────────────────────────────────────────────────────
describe("stage 2 · 沙箱服务", () => {
  it("POST /shell/exec-command 把命令交给容器运行时，回 stdout", async () => {
    const { runtime, calls } = fakeRuntime();
    const app = createSandboxApp({ runtime, image: "alpine" });
    const res = await app.request("/shell/exec-command", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ command: "echo hi" }),
    });
    expect(res.status).toBe(200);
    const json = (await res.json()) as {
      success: boolean;
      data: ExecResult;
    };
    expect(json.success).toBe(true);
    expect(json.data.stdout).toContain("hi");
    expect(calls.execs).toContain("echo hi");
  });
  it("懒创建：多次请求只起一个容器并复用", async () => {
    const { runtime, calls } = fakeRuntime();
    const app = createSandboxApp({ runtime, image: "alpine" });
    const req = () =>
      app.request("/shell/exec-command", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ command: "ls" }),
      });
    await req();
    await req();
    expect(calls.created).toBe(1);
  });
});

// ── stage 3 · 容器生命周期 ────────────────────────────────────────────────────
describe("stage 3 · 容器生命周期", () => {
  it("fn 正常：create → fn → destroy，返回 fn 结果", async () => {
    const order: string[] = [];
    const runtime: ContainerRuntime = {
      async create() {
        order.push("create");
        return { id: "c1" };
      },
      async exec() {
        return { stdout: "", stderr: "", exitCode: 0 };
      },
      async destroy() {
        order.push("destroy");
      },
    };
    const out = await withContainer(runtime, "alpine", async (c) => {
      order.push("fn:" + c.id);
      return 42;
    });
    expect(out).toBe(42);
    expect(order).toEqual(["create", "fn:c1", "destroy"]);
  });
  it("fn 抛错：destroy 仍被调用（try-finally 必清），错误向上抛", async () => {
    const order: string[] = [];
    const runtime: ContainerRuntime = {
      async create() {
        return { id: "c1" };
      },
      async exec() {
        return { stdout: "", stderr: "", exitCode: 0 };
      },
      async destroy() {
        order.push("destroy");
      },
    };
    await expect(
      withContainer(runtime, "alpine", async () => {
        throw new Error("boom");
      }),
    ).rejects.toThrow("boom");
    expect(order).toEqual(["destroy"]);
  });
});

// ── stage 4 · HttpSandbox 客户端 ─────────────────────────────────────────────
describe("stage 4 · HttpSandbox 客户端", () => {
  it("execCommand POST 到 /shell/exec-command，成功回包映射成 ToolResult", async () => {
    const seen: { url?: string; body?: { command: string; execDir: string } } =
      {};
    const fakeFetch = async (url: string, init: RequestInit) => {
      seen.url = url;
      seen.body = JSON.parse(String(init.body));
      return new Response(
        JSON.stringify({
          success: true,
          data: { stdout: "ok\n", stderr: "", exitCode: 0 },
        }),
        { headers: { "content-type": "application/json" } },
      );
    };
    const sb = new HttpSandbox("http://sandbox:8080", fakeFetch);
    const r = await sb.execCommand("", "/tmp", "echo ok");
    expect(seen.url).toBe("http://sandbox:8080/shell/exec-command");
    expect(seen.body?.command).toBe("echo ok");
    expect(r.success).toBe(true);
    expect((r.data as ExecResult).stdout).toContain("ok");
  });
  it("readFile 复用 execCommand 跑 cat（file ops 委派给 shell）", async () => {
    const seen: string[] = [];
    const fakeFetch = async (_url: string, init: RequestInit) => {
      seen.push(JSON.parse(String(init.body)).command);
      return new Response(
        JSON.stringify({
          success: true,
          data: { stdout: "file-content", stderr: "", exitCode: 0 },
        }),
        { headers: { "content-type": "application/json" } },
      );
    };
    const sb = new HttpSandbox("http://sandbox:8080", fakeFetch);
    const r = await sb.readFile("/work/a.txt");
    expect(seen[0]).toBe("cat /work/a.txt");
    expect(r.data).toBe("file-content");
  });
});

// ── stage 5 · sandbox shell 工具 ─────────────────────────────────────────────
describe("stage 5 · sandbox shell 工具", () => {
  it("shell_exec 走 sandbox.execCommand（命令进容器，不走本机）", async () => {
    const { sandbox, calls } = fakeSandbox();
    const tool = createSandboxShellTool(sandbox);
    expect(tool.name).toBe("shell_exec");
    const r = await tool.execute({ command: "whoami" });
    expect(calls.exec).toContain("whoami");
    expect(r.success).toBe(true);
  });
});

// ── stage 6 · sandbox file 工具 ──────────────────────────────────────────────
describe("stage 6 · sandbox file 工具", () => {
  it("read/write/list 三个工具各自委派给 sandbox 对应方法", async () => {
    const { sandbox, calls } = fakeSandbox();
    const tools = createSandboxFileTools(sandbox);
    const byName = Object.fromEntries(tools.map((t) => [t.name, t]));
    await byName.write_file.execute({ filepath: "/w/a.txt", content: "hi" });
    await byName.read_file.execute({ filepath: "/w/a.txt" });
    await byName.list_files.execute({ dirPath: "/w" });
    expect(calls.write[0]).toEqual(["/w/a.txt", "hi"]);
    expect(calls.read).toContain("/w/a.txt");
    expect(calls.list).toContain("/w");
  });
});
