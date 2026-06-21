// Source: materials/mooc-manus/api/app/... sandbox/Dockerfile（CDP 部分，砍 VNC）
// 在已有容器里起 headless Chromium，把 CDP 端口（默认 9222）暴露出来。
// 不用 VNC 的替代方案：CDP 让 Playwright 远程控制浏览器，不需要 X 桌面。
import type {
  ContainerRuntime,
  Container,
} from "../../ports/containerRuntime.ts";

export const DEFAULT_CDP_PORT = 9222;

/**
 * 在容器里以 headless + CDP 模式启动 Chromium，返回 CDP URL（如 http://localhost:9222）。
 * 调用方需自己等待 CDP 就绪（PlaywrightBrowser.connect() 里有重试逻辑）。
 */
export async function launchChromium(
  runtime: ContainerRuntime,
  container: Container,
  port: number = DEFAULT_CDP_PORT,
): Promise<string> {
  // 1. 构造启动命令（& 后台异步，不阻塞等返回）：
  const cmd =
    [
      "chromium",
      "--no-sandbox",
      "--headless=new",
      "--disable-gpu",
      "--disable-dev-shm-usage",
      "--remote-debugging-port=" + port,
      "--remote-debugging-address=0.0.0.0",
    ].join(" ") + " &";
  await runtime.exec(container, cmd);
  return "http://localhost:" + port;
}
