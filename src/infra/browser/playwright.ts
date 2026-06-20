// Source: materials/mooc-manus/api/app/infrastructure/external/browser/playwright_browser.py
// PlaywrightBrowser：通过 CDP 控制容器内 Chromium，实现 BrowserPort 接口。
// 依赖注入：构造函数接受可选 PlaywrightAPI，测试时注入 mock；生产时动态 import("playwright")。
import type {
  BrowserPort,
  InteractiveElement,
  PageLike,
  ElementLike,
  BrowserLike,
  ContextLike,
  PlaywrightAPI,
} from "../../ports/browser.ts";
import type { ToolResult } from "../../domain/models/toolResult.ts";
import { GET_INTERACTIVE_ELEMENTS_FUNC } from "./elementFuncs.ts";

// ── stage 3 · 可交互元素提取（独立导出，方便单测）──────────────────────────────
// Source: playwright_browser_fun.py + playwright_browser.py:104-123
//
// 注入 GET_INTERACTIVE_ELEMENTS_FUNC JS，给每个可交互元素打 data-manus-id 属性，
// 返回格式化列表如 ["0:<button>Submit</button>", "1:<a>Home</a>"]。
// LLM 看内容理解意图，用 index 数字下令点击（click_by_index），不用猜 CSS 选择器。
export async function _extractInteractiveElements(page: PageLike): Promise<string[]> {
  // TODO: stage 3
  // 1. const raw = await page.evaluate(GET_INTERACTIVE_ELEMENTS_FUNC) as InteractiveElement[]
  // 2. return raw.map(e => e.index + ":<" + e.tag + ">" + e.text + "</" + e.tag + ">")
  throw new Error("TODO: stage 3 — _extractInteractiveElements 未实现");
}

// ── PlaywrightBrowser ──────────────────────────────────────────────────────────

export interface ConnectOptions {
  maxRetries?: number;
  retryDelay?: number; // ms，指数退避基数
}

export class PlaywrightBrowser implements BrowserPort {
  private _pw: PlaywrightAPI | null;
  private _browser: BrowserLike | null = null;
  private _page: PageLike | null = null;

  constructor(
    private readonly cdpUrl: string,
    pw: PlaywrightAPI | null = null,
    private readonly opts: ConnectOptions = {},
  ) {
    this._pw = pw;
  }

  private async _getPlaywright(): Promise<PlaywrightAPI> {
    if (!this._pw) {
      // 生产路径：动态导入真实 playwright（不在构造时导入，让测试无需安装包）
      const mod = await import("playwright");
      this._pw = mod as unknown as PlaywrightAPI;
    }
    return this._pw;
  }

  // ── stage 2 · connect_over_cdp + 指数退避重试 ───────────────────────────────
  // Source: playwright_browser.py:196-240 (initialize)
  //
  // Chromium 刚收到启动命令不会立刻监听 CDP 端口（需要几百毫秒）。
  // 不能用 await 等「命令返回」——launchChromium 发的是后台命令（&）。
  // 解法：主动重试轮询，指数退避避免在 Chromium 未就绪时密集请求。
  async connect(): Promise<void> {
    // TODO: stage 2
    // const pw = await this._getPlaywright()
    // const maxRetries = this.opts.maxRetries ?? 5
    // const baseDelay = this.opts.retryDelay ?? 1000
    // let lastErr: unknown
    // for (let i = 0; i < maxRetries; i++) {
    //   try {
    //     this._browser = await pw.chromium.connect_over_cdp(this.cdpUrl)
    //     const ctx: ContextLike = this._browser.contexts[0]
    //     this._page = ctx?.pages[0] ?? await ctx?.newPage()
    //     return   ← 成功就立刻返回
    //   } catch (e) {
    //     lastErr = e
    //     if (i < maxRetries - 1) await new Promise(r => setTimeout(r, baseDelay * Math.pow(2, i)))
    //   }
    // }
    // throw lastErr
    throw new Error("TODO: stage 2 — connect 未实现");
  }

  isConnected(): boolean {
    return this._browser !== null;
  }

  // ─── BrowserPort 实现（已就位，内部调 _extractInteractiveElements）────────────

  async viewPage(): Promise<ToolResult> {
    if (!this._page) return { success: false, message: "未连接" };
    try {
      const elements = await _extractInteractiveElements(this._page);
      return { success: true, message: "查看成功", data: { interactive_elements: elements } };
    } catch (e) {
      return { success: false, message: "viewPage 失败: " + String(e) };
    }
  }

  async navigate(url: string): Promise<ToolResult> {
    if (!this._page) return { success: false, message: "未连接" };
    try {
      await this._page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
      const elements = await _extractInteractiveElements(this._page);
      return { success: true, message: "导航成功", data: { url, interactive_elements: elements } };
    } catch (e) {
      return { success: false, message: "导航失败: " + String(e) };
    }
  }

  async restart(url: string): Promise<ToolResult> {
    return this.navigate(url);
  }

  async click(options: { index?: number; x?: number; y?: number }): Promise<ToolResult> {
    if (!this._page) return { success: false, message: "未连接" };
    try {
      if (options.index !== undefined) {
        const selector = '[data-manus-id="manus-element-' + options.index + '"]';
        const el: ElementLike | null = await this._page.querySelector(selector);
        if (!el) return { success: false, message: "元素 " + options.index + " 不存在" };
        await el.click({ timeout: 5000 });
      } else if (options.x !== undefined && options.y !== undefined) {
        await this._page.mouse.click(options.x, options.y);
      }
      return { success: true, message: "点击成功" };
    } catch (e) {
      return { success: false, message: "点击失败: " + String(e) };
    }
  }

  async input(options: { text: string; pressEnter: boolean; index?: number }): Promise<ToolResult> {
    if (!this._page) return { success: false, message: "未连接" };
    try {
      if (options.index !== undefined) {
        const selector = '[data-manus-id="manus-element-' + options.index + '"]';
        const el: ElementLike | null = await this._page.querySelector(selector);
        if (!el) return { success: false, message: "元素 " + options.index + " 不存在" };
        await el.fill(options.text);
      }
      if (options.pressEnter) await this._page.keyboard.press("Enter");
      return { success: true, message: "输入成功" };
    } catch (e) {
      return { success: false, message: "输入失败: " + String(e) };
    }
  }

  async moveMouse(x: number, y: number): Promise<ToolResult> {
    if (!this._page) return { success: false, message: "未连接" };
    await this._page.mouse.click(x, y);
    return { success: true, message: "鼠标移动成功" };
  }

  async pressKey(key: string): Promise<ToolResult> {
    if (!this._page) return { success: false, message: "未连接" };
    await this._page.keyboard.press(key);
    return { success: true, message: "按键成功" };
  }

  async selectOption(_index: number, _option: number): Promise<ToolResult> {
    return { success: false, message: "selectOption 未实现（可扩展）" };
  }

  async scrollUp(): Promise<ToolResult> {
    if (!this._page) return { success: false, message: "未连接" };
    await this._page.keyboard.press("PageUp");
    return { success: true, message: "向上滚动" };
  }

  async scrollDown(): Promise<ToolResult> {
    if (!this._page) return { success: false, message: "未连接" };
    await this._page.keyboard.press("PageDown");
    return { success: true, message: "向下滚动" };
  }

  async screenshot(fullPage = false): Promise<Buffer> {
    if (!this._page) throw new Error("未连接");
    return this._page.screenshot({ type: "png", fullPage });
  }

  async consoleExec(javascript: string): Promise<ToolResult> {
    if (!this._page) return { success: false, message: "未连接" };
    try {
      const result = await this._page.evaluate(javascript);
      return { success: true, message: "执行成功", data: result };
    } catch (e) {
      return { success: false, message: "控制台执行失败: " + String(e) };
    }
  }

  async consoleView(): Promise<ToolResult> {
    return { success: false, message: "consoleView 未实现（可扩展）" };
  }

  async cleanup(): Promise<void> {
    try {
      if (this._page) await this._page.close().catch(() => {});
      if (this._browser) await this._browser.close().catch(() => {});
    } finally {
      this._page = null;
      this._browser = null;
    }
  }

  // 测试辅助：直接注入 page，绕过 connect()
  _testSetPage(page: PageLike): void {
    this._page = page;
  }
}
