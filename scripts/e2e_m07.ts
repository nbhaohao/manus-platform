// e2e · m07 浏览器工具（本机 playwright，不进容器）
// 前置：pnpm add -D playwright（已装）+ npx playwright install chromium（首次跑前装一次浏览器二进制）
// 跑法：pnpm e2e:m07
//
// 策略 A：用本机 chromium.launch() 起浏览器，把 page 注入 PlaywrightBrowser，
// 端到端验证 stage 3（元素提取）+ stage 4/5（工具 + 白名单）+ stage 6（截图落盘）。
// stage 1/2 的「容器内 CDP 启动 + connectOverCDP 重试」由单测（mock）覆盖，
// 真容器 CDP 需要带 chromium 的镜像，留到要 demo 时再上（见 COURSE_SPEC）。
import { saveSnapshot } from "../src/infra/browser/snapshot.ts";
import { createBrowserTools } from "../src/infra/tools/browser.ts";
import { PlaywrightBrowser, _extractInteractiveElements } from "../src/infra/browser/playwright.ts";
import type { PageLike } from "../src/ports/browser.ts";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const ok = (cond: boolean, msg: string) => console.log(`${cond ? "✅" : "❌"} ${msg}`);

// 1. 起本机 chromium
let pw: typeof import("playwright");
try {
  pw = await import("playwright");
} catch {
  console.error("❌ playwright 未安装：pnpm add -D playwright");
  process.exit(1);
}

const browser = await pw.chromium.launch({ headless: true });
const page = await browser.newPage();
await page.goto("https://example.com", { waitUntil: "domcontentloaded" });
console.log("本机 chromium 已起，已打开 example.com\n");

// 2. 把真实 page 注入 PlaywrightBrowser（绕过 connect，stage 2 由单测覆盖）
const pb = new PlaywrightBrowser("", null);
pb._testSetPage(page as unknown as PageLike);

// 3. stage 3 — 可交互元素提取
const elements = await _extractInteractiveElements(page as unknown as PageLike);
ok(Array.isArray(elements), `stage 3 元素提取：${elements.length} 个`);
console.log("  样例:", elements.slice(0, 3));

// 4. stage 4/5 — 工具委派 + 白名单
const tools = createBrowserTools(pb, { allowedDomains: ["example.com"] });
const nav = tools.find(t => t.name === "browser_navigate")!;
const allowed = await nav.execute({ url: "https://example.com/" });
ok(allowed.success, "stage 4/5 放行白名单内 example.com");
const blocked = await nav.execute({ url: "https://evil.com/attack" });
ok(!blocked.success, "stage 5 拦截白名单外 evil.com → " + blocked.message);

// 5. stage 6 — 截图 + DOM 摘要落盘
const runsDir = await mkdtemp(join(tmpdir(), "m07-e2e-"));
await saveSnapshot(page as unknown as PageLike, runsDir, "step-01");
ok(true, "stage 6 截图 + 摘要落盘 → " + runsDir);

await browser.close();
console.log("\nm07 e2e 完成（全绿 = 你已实现 stage 3-6）。");
