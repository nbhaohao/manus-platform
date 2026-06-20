// e2e · m06 沙箱：完整走 HttpSandbox → 沙箱服务(Hono) → 容器运行时(dockerode) → Docker 容器。
// 这条路径单测只 mock 了，这里用真容器端到端冒烟 + 隔离断言。
// 需要本机 Docker。镜像默认 python:3.12-slim（SANDBOX_IMAGE 可改）。
// 跑：实现完 m06 六关后 `pnpm e2e:m06`。
import { serve } from "@hono/node-server";
import { writeFile, rm, mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { DockerodeRuntime } from "../src/infra/sandbox/dockerodeRuntime.ts";
import { withContainer } from "../src/infra/sandbox/docker.ts";
import { createSandboxApp } from "../src/sandbox/service.ts";
import { HttpSandbox } from "../src/infra/sandbox/httpSandbox.ts";
import { createSandboxShellTool } from "../src/infra/tools/sandboxShell.ts";
import { createSandboxFileTools } from "../src/infra/tools/sandboxFile.ts";
import type { ContainerRuntime, ExecResult } from "../src/ports/containerRuntime.ts";

const ok = (cond: boolean, m: string) => console.log(`${cond ? "✅" : "❌"} ${m}`);
const PORT = 8099;
const image = process.env.SANDBOX_IMAGE ?? "python:3.12-slim";
const stdoutOf = (r: { data?: unknown }) =>
  String((r.data as ExecResult | undefined)?.stdout ?? "");

const runtime = new DockerodeRuntime();
console.log(`🐳 起容器 ${image}（首次拉镜像稍慢）…\n`);

await withContainer(runtime, image, async (container) => {
  // 让沙箱服务复用我们这一个容器（生命周期由 withContainer 的 finally 兜底清理）
  const shared: ContainerRuntime = {
    create: async () => container,
    exec: (cc, cmd, opts) => runtime.exec(cc, cmd, opts),
    destroy: async () => {},
  };
  const server = serve({
    fetch: createSandboxApp({ runtime: shared, image }).fetch,
    port: PORT,
  });
  const sandbox = new HttpSandbox(`http://localhost:${PORT}`);

  console.log("— 沙箱 shell 工具：命令在容器里跑 —");
  const shell = createSandboxShellTool(sandbox);
  const os = await shell.execute({ command: "cat /etc/os-release | head -1" });
  console.log("   容器 os:", JSON.stringify(stdoutOf(os).trim()));
  const osLower = stdoutOf(os).toLowerCase();
  ok(os.success && (osLower.includes("linux") || osLower.includes("debian")), "shell 在 Linux 容器内执行");

  console.log("\n— 隔离验证：宿主文件在容器里读不到 —");
  const hostDir = await mkdtemp(join(tmpdir(), "m06-host-"));
  const hostFile = join(hostDir, "host-only.txt");
  await writeFile(hostFile, "HOST_ONLY_SECRET");
  const leak = await shell.execute({ command: "cat " + hostFile });
  ok(!stdoutOf(leak).includes("HOST_ONLY_SECRET"), `宿主文件在容器内读不到（隔离成立）`);
  await rm(hostDir, { recursive: true, force: true });

  console.log("\n— 沙箱 file 工具：写读往返都在容器里 —");
  const tools = Object.fromEntries(createSandboxFileTools(sandbox).map((t) => [t.name, t]));
  await tools.write_file.execute({ filepath: "/tmp/e2e.txt", content: "from-agent" });
  const back = await tools.read_file.execute({ filepath: "/tmp/e2e.txt" });
  ok(back.success && String(back.data).includes("from-agent"), "write_file → read_file 容器内往返一致");

  server.close();
});

console.log("\n沙箱 e2e 完成，容器已清理。");
