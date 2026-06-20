// 已就位（AI 生成）
// Source: materials/mooc-manus/api/app/infrastructure/external/sandbox/docker_sandbox.py
//   真·容器运行时：dockerode 起一个 stock 容器（默认 python:3.12-slim），容器以
//   `sleep infinity` 常驻，exec 走 docker exec，destroy 强删（force）。
// dockerode 用动态 import：测试只注入 fake ContainerRuntime，不碰这个文件，就不要求装 dockerode。
// 仅在 CLI / e2e 的体感路径（真 Docker）才会用到本类。
import type {
  Container,
  ContainerRuntime,
  ExecResult,
} from "../../ports/containerRuntime.ts";

// dockerode 的多路复用流：stdout/stderr 混在一条流里，用 modem.demuxStream 拆开收集。
function collect(
  modem: { demuxStream: (s: unknown, o: unknown, e: unknown) => void },
  stream: unknown,
): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const out: Buffer[] = [];
    const err: Buffer[] = [];
    const w = (arr: Buffer[]) => ({ write: (d: Buffer) => arr.push(d) });
    modem.demuxStream(stream, w(out), w(err));
    (stream as NodeJS.ReadableStream).on("end", () =>
      resolve({
        stdout: Buffer.concat(out).toString("utf8"),
        stderr: Buffer.concat(err).toString("utf8"),
      }),
    );
    (stream as NodeJS.ReadableStream).on("error", reject);
  });
}

export class DockerodeRuntime implements ContainerRuntime {
  // eslint 友好的延迟初始化：第一次用到才连 docker。
  private docker: any;

  private async client(): Promise<any> {
    if (!this.docker) {
      const Docker = (await import("dockerode")).default;
      this.docker = new Docker();
    }
    return this.docker;
  }

  async create(image: string): Promise<Container> {
    const docker = await this.client();
    // 镜像不在本地则先 pull（stock 镜像，首次拉取）
    await new Promise<void>((res, rej) =>
      docker.pull(image, (err: unknown, stream: unknown) => {
        if (err) return rej(err);
        docker.modem.followProgress(stream, (e: unknown) =>
          e ? rej(e) : res(),
        );
      }),
    );
    const c = await docker.createContainer({
      Image: image,
      Cmd: ["sleep", "infinity"],
      Tty: false,
      HostConfig: { AutoRemove: true },
    });
    await c.start();
    return { id: c.id as string };
  }

  async exec(
    container: Container,
    command: string,
    opts?: { cwd?: string },
  ): Promise<ExecResult> {
    const docker = await this.client();
    const c = docker.getContainer(container.id);
    const exec = await c.exec({
      Cmd: ["sh", "-c", command],
      WorkingDir: opts?.cwd,
      AttachStdout: true,
      AttachStderr: true,
    });
    const stream = await exec.start({});
    const { stdout, stderr } = await collect(docker.modem, stream);
    const info = await exec.inspect();
    return { stdout, stderr, exitCode: (info.ExitCode as number) ?? 0 };
  }

  async destroy(container: Container): Promise<void> {
    const docker = await this.client();
    try {
      await docker.getContainer(container.id).remove({ force: true });
    } catch {
      // 容器可能已随 AutoRemove 退出，忽略
    }
  }
}
