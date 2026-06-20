// m07 · 浏览器工具（Playwright/CDP）
// pnpm verify  →  vitest run tests/m07.test.ts
// pnpm v "stage N"  →  只跑当前关
import { describe, it, expect } from "vitest";
import { mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { launchChromium } from "../src/infra/browser/launcher.ts";
import { PlaywrightBrowser, _extractInteractiveElements } from "../src/infra/browser/playwright.ts";
import { createBrowserTools } from "../src/infra/tools/browser.ts";
import { saveSnapshot } from "../src/infra/browser/snapshot.ts";
import type { ContainerRuntime, ExecResult } from "../src/ports/containerRuntime.ts";
import type {
  BrowserPort,
  PlaywrightAPI,
  BrowserLike,
  ContextLike,
  PageLike,
  ElementLike,
} from "../src/ports/browser.ts";

// ── 测试替身 ──────────────────────────────────────────────────────────────────

function fakeRuntime() {
  const calls: string[] = [];
  const runtime: ContainerRuntime = {
    async create() { return { id: "c1" }; },
    async exec(_c, command): Promise<ExecResult> {
      calls.push(command);
      return { stdout: "", stderr: "", exitCode: 0 };
    },
    async destroy() {},
  };
  return { runtime, calls };
}

function fakeElement(): ElementLike {
  return {
    async click() {},
    async fill() {},
    async type() {},
  };
}

function fakePage(): PageLike {
  return {
    url: "https://example.com",
    async evaluate(_fn: string) {
      return [
        { index: 0, tag: "button", text: "Submit" },
        { index: 1, tag: "a", text: "Home" },
      ];
    },
    async goto() { return null; },
    async screenshot() { return Buffer.from("fake-png-bytes"); },
    async close() {},
    async querySelector(_sel: string) { return fakeElement(); },
    mouse: { async click() {} },
    keyboard: { async press() {}, async type() {} },
  };
}

function fakeBrowserPort() {
  const calls = {
    navigate: [] as string[],
    click: [] as Array<{ index?: number; x?: number; y?: number }>,
    input: [] as string[],
  };
  const browser: BrowserPort = {
    async viewPage() { return { success: true, message: "", data: { interactive_elements: [] } }; },
    async navigate(url) { calls.navigate.push(url); return { success: true, message: "ok" }; },
    async restart() { return { success: true, message: "" }; },
    async click(opts) { calls.click.push(opts); return { success: true, message: "ok" }; },
    async input(opts) { calls.input.push(opts.text); return { success: true, message: "ok" }; },
    async moveMouse() { return { success: true, message: "" }; },
    async pressKey() { return { success: true, message: "" }; },
    async selectOption() { return { success: true, message: "" }; },
    async scrollUp() { return { success: true, message: "" }; },
    async scrollDown() { return { success: true, message: "" }; },
    async screenshot() { return Buffer.from("png"); },
    async consoleExec() { return { success: true, message: "" }; },
    async consoleView() { return { success: true, message: "" }; },
    async cleanup() {},
  };
  return { browser, calls };
}

function fakeBrowserLike(page: PageLike): BrowserLike {
  const ctx: ContextLike = { pages: [page], async newPage() { return page; } };
  return { contexts: [ctx], async close() {} };
}

// ── stage 1 · launchChromium ──────────────────────────────────────────────────

describe("stage 1 · launchChromium", () => {
  it("在容器里跑 chromium headless，返回含端口号的 CDP URL，命令含 remote-debugging-port", async () => {
    const { runtime, calls } = fakeRuntime();
    const url = await launchChromium(runtime, { id: "c1" }, 9222);
    expect(url).toContain("9222");
    expect(calls.some(cmd => cmd.includes("remote-debugging-port=9222"))).toBe(true);
    expect(calls.some(cmd => cmd.includes("headless"))).toBe(true);
  });
});

// ── stage 2 · connect_over_cdp + retry ───────────────────────────────────────

describe("stage 2 · connect_over_cdp + retry", () => {
  it("CDP 成功连上时 isConnected() 返回 true", async () => {
    const page = fakePage();
    const fakePw: PlaywrightAPI = {
      chromium: { async connect_over_cdp() { return fakeBrowserLike(page); } },
    };
    const pb = new PlaywrightBrowser("http://localhost:9222", fakePw);
    await pb.connect();
    expect(pb.isConnected()).toBe(true);
  });

  it("connect_over_cdp 一直失败时，重试 maxRetries 次后抛错", async () => {
    let attempts = 0;
    const fakePw: PlaywrightAPI = {
      chromium: { async connect_over_cdp() { attempts++; throw new Error("ECONNREFUSED"); } },
    };
    const pb = new PlaywrightBrowser("http://localhost:9222", fakePw, { maxRetries: 3, retryDelay: 0 });
    await expect(pb.connect()).rejects.toThrow();
    expect(attempts).toBe(3);
  });
});

// ── stage 3 · _extractInteractiveElements ────────────────────────────────────

describe("stage 3 · 页面感知 — 可交互元素提取", () => {
  it('evaluate 注入 JS，结果格式化为 "index:<tag>text</tag>" 列表', async () => {
    const elements = await _extractInteractiveElements(fakePage());
    expect(elements[0]).toBe("0:<button>Submit</button>");
    expect(elements[1]).toBe("1:<a>Home</a>");
  });
});

// ── stage 4 · createBrowserTools ─────────────────────────────────────────────

describe("stage 4 · browser 工具", () => {
  it("browser_navigate 委派给 browser.navigate，success=true", async () => {
    const { browser, calls } = fakeBrowserPort();
    const tools = createBrowserTools(browser);
    const nav = tools.find(t => t.name === "browser_navigate")!;
    const r = await nav.execute({ url: "https://example.com" });
    expect(calls.navigate).toContain("https://example.com");
    expect(r.success).toBe(true);
  });

  it("browser_click 委派给 browser.click，带 index 参数", async () => {
    const { browser, calls } = fakeBrowserPort();
    const tools = createBrowserTools(browser);
    const click = tools.find(t => t.name === "browser_click")!;
    await click.execute({ index: 2 });
    expect(calls.click.some(o => o.index === 2)).toBe(true);
  });

  it("browser_input 委派给 browser.input，传入 text", async () => {
    const { browser, calls } = fakeBrowserPort();
    const tools = createBrowserTools(browser);
    const input = tools.find(t => t.name === "browser_input")!;
    await input.execute({ text: "hello world", press_enter: false });
    expect(calls.input).toContain("hello world");
  });
});

// ── stage 5 · 域名白名单 ──────────────────────────────────────────────────────

describe("stage 5 · 域名白名单", () => {
  it("允许域名正常通过，调用 browser.navigate", async () => {
    const { browser, calls } = fakeBrowserPort();
    const tools = createBrowserTools(browser, { allowedDomains: ["example.com"] });
    const nav = tools.find(t => t.name === "browser_navigate")!;
    const r = await nav.execute({ url: "https://example.com/page" });
    expect(r.success).toBe(true);
    expect(calls.navigate).toContain("https://example.com/page");
  });

  it("被封锁的域名返回 success=false，且不调用 browser.navigate", async () => {
    const { browser, calls } = fakeBrowserPort();
    const tools = createBrowserTools(browser, { allowedDomains: ["example.com"] });
    const nav = tools.find(t => t.name === "browser_navigate")!;
    const r = await nav.execute({ url: "https://evil.com/attack" });
    expect(r.success).toBe(false);
    expect(r.message).toMatch(/域名/);
    expect(calls.navigate).toHaveLength(0);
  });
});

// ── stage 6 · saveSnapshot ───────────────────────────────────────────────────

describe("stage 6 · 截图 + DOM 摘要落盘", () => {
  it("saveSnapshot 在 runsDir 里生成 .png 和 .txt 文件", async () => {
    const runsDir = await mkdtemp(join(tmpdir(), "m07-snap-"));
    try {
      await saveSnapshot(fakePage(), runsDir, "step-01");
      const files = await readdir(runsDir);
      expect(files).toContain("step-01.png");
      expect(files).toContain("step-01.txt");
    } finally {
      await rm(runsDir, { recursive: true, force: true });
    }
  });
});
