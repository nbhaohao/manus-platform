// Source: materials/mooc-manus/api/app/sandbox/app/interfaces/endpoints/shell.py
//   源码沙箱是「跑在容器内」的独立 FastAPI 服务；本课简化为「跑在宿主」的 Hono 服务，
//   把请求经 ContainerRuntime（docker exec）转交给 stock 容器执行。
//   砍掉 session 化 shell（read/wait/kill），只留一次性 exec-command。
import { Hono } from "hono";
import type { ContainerRuntime, Container } from "../ports/containerRuntime.ts";

export interface SandboxServiceDeps {
  runtime: ContainerRuntime;
  image: string;
}

// 沙箱服务工厂：返回一个 Hono app。它懒创建一个容器，把 /shell 请求转成容器内命令。
export function createSandboxApp(deps: SandboxServiceDeps) {
  const app = new Hono();
  let container: Container | null = null;

  // 懒创建：第一次请求才起容器，之后复用同一个（容器创建慢，别每次 new）。
  async function ensure(): Promise<Container> {
    if (!container) {
      container = await deps.runtime.create(deps.image);
    }
    return container;
  }

  // POST /shell/exec-command  body: { command, execDir? }
  //   → 容器内 exec，回 { success: exitCode===0, data: { stdout, stderr, exitCode } }
  app.post("/shell/exec-command", async (c) => {
    // TODO: stage 2
    const body = (await c.req.json()) as { command?: string; execDir?: string };
    const box = await ensure();
    const r = await deps.runtime.exec(box, String(body.command ?? ""), {
      cwd: body.execDir,
    });
    return c.json({ success: r.exitCode === 0, data: r });
  });

  return app;
}
