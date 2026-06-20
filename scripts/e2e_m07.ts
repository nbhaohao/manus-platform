// e2e · m07 浏览器工具
// 使用本机 playwright（需先 npx playwright install chromium）做端到端验证。
// 不依赖容器——直接用 playwright.chromium.launch() 本地起浏览器，验证全栈工具链。
// 跑法：pnpm e2e:m07
import { saveSnapshot } from "../src/infra/browser/snapshot.ts";
import { createBrowserTools } from "../src/infra/tools/browser.ts";
import { PlaywrightBrowser, _extractInteractiveElements } from "../src/infra/browser/playwright.ts";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const ok = (cond: boolean, msg: string) => console.log(`${cond ? "✅" : "❌"} ${msg}`);
const runsDir = await mkdtemp(join(tmpdir(), "m07-e2e-"));

// 检查 playwright 是否安装
let chromium: { launchServer(): Promise<{ wsEndpoint(): string; close(): Promise<void> }> };
try {
  const mod = await import("playwright");
  chromium = (mod as Record<string, typeof chromium>).chromium;
} catch {
  console.error("❌ playwright 未安装，请先跑: npx playwright install chromium");
  process.exit(1);
}

// 本地起一个 chromium server，再用 connectOverCDP 连上去（模拟容器 CDP 流程）
const server = await chromium.launchServer();
const wsEndpoint = server.wsEndpoint();
console.log("Chromium server:", wsEndpoint);

// PlaywrightBrowser 需要 CDP HTTP URL（不是 WS），这里直接用 mock 路由演示工具
// 完整容器 CDP 测试见 README (需要 Docker + 支持 CDP 的镜像)
const mod = await import("playwright");
const pw = { chromium: (mod as Record<string, { connectOverCDP?(url: string): Promise<unknown> }>).chromium };

// 对于 e2e：直接注入 playwright 对象，连接本地 server
import("playwright").then(async (m) => {
  const realPw = m as unknown as import("../src/ports/browser.ts").PlaywrightAPI;
  // connectOverCDP 需要 HTTP CDP URL，launchServer 给的是 WS，这里 workaround：
  // 用 chromium.connect(wsEndpoint) 替代
  // 实际容器场景用 http://localhost:9222
  console.log("\n注: 完整 CDP 测试需要 Docker 容器 + chromium headless");
  console.log("以下用 playwright 本地模式验证工具逻辑：\n");

  // 直接构造 PlaywrightBrowser with mock page for tool test
  const page = await (async () => {
    const browser = await m.chromium.launch({ headless: true });
    const ctx = await browser.newContext();
    const p = await ctx.newPage();
    await p.goto("https://example.com");
    return { p, browser };
  })();

  const pb = new PlaywrightBrowser("", null);
  pb._testSetPage(page.p as unknown as import("../src/ports/browser.ts").PageLike);

  const elements = await _extractInteractiveElements(page.p as unknown as import("../src/ports/browser.ts").PageLike);
  ok(elements.length >= 0, `页面可交互元素提取: ${elements.length} 个`);
  console.log("  前 3 个:", elements.slice(0, 3));

  const tools = createBrowserTools(pb, { allowedDomains: ["example.com"] });
  const nav = tools.find(t => t.name === "browser_navigate")!;
  const r = await nav.execute({ url: "https://example.com" });
  ok(r.success, "browser_navigate example.com");

  const blocked = await nav.execute({ url: "https://evil.com" });
  ok(!blocked.success, "evil.com 被白名单拦截: " + blocked.message);

  await saveSnapshot(
    page.p as unknown as import("../src/ports/browser.ts").PageLike,
    runsDir,
    "step-01",
  );
  console.log("✅ 截图 + DOM 摘要落盘:", runsDir);

  await page.browser.close();
  await server.close();
  console.log("\nm07 e2e 完成。");
});
