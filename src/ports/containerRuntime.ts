// 已就位（AI 生成）
// Source: materials/mooc-manus/api/app/infrastructure/external/sandbox/docker_sandbox.py
//   把「容器运行时」从那个庞大的 DockerSandbox 里抽出最小可注入端口：
//   测试塞 fake（不依赖 Docker），生产用 dockerode 实现。
// m06 简化：用 stock 镜像（python:3.12-slim / alpine），不自建镜像；exec 一次性命令（砍 session 状态）。

export interface Container {
  readonly id: string;
}

export interface ExecResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

// 容器运行时：create 起容器 / exec 在容器里跑命令 / destroy 清掉容器。
// 这是 stage 3 docker.ts 真实现的契约，也是 stage 2 沙箱服务注入的依赖。
export interface ContainerRuntime {
  create(image: string): Promise<Container>;
  exec(
    container: Container,
    command: string,
    opts?: { cwd?: string },
  ): Promise<ExecResult>;
  destroy(container: Container): Promise<void>;
}
