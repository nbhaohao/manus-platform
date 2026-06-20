// 已就位（AI 生成）
// Source: materials/mooc-manus/api/app/domain/external/browser.py
// m07 扩充：InteractiveElement + Playwright 最小化接口（测试替身用，不依赖真实 playwright 包）

import type { ToolResult } from '../domain/models/toolResult.ts'

// JS 注入后 page.evaluate 返回的可交互元素条目
export interface InteractiveElement {
  index: number;
  tag: string;
  text: string;
}

export interface BrowserPort {
  viewPage(): Promise<ToolResult>
  navigate(url: string): Promise<ToolResult>
  restart(url: string): Promise<ToolResult>
  click(options: { index?: number; x?: number; y?: number }): Promise<ToolResult>
  input(options: { text: string; pressEnter: boolean; index?: number; x?: number; y?: number }): Promise<ToolResult>
  moveMouse(x: number, y: number): Promise<ToolResult>
  pressKey(key: string): Promise<ToolResult>
  selectOption(index: number, option: number): Promise<ToolResult>
  scrollUp(toTop?: boolean): Promise<ToolResult>
  scrollDown(toBottom?: boolean): Promise<ToolResult>
  screenshot(fullPage?: boolean): Promise<Buffer>
  consoleExec(javascript: string): Promise<ToolResult>
  consoleView(maxLines?: number): Promise<ToolResult>
  cleanup(): Promise<void>
}

// ── Playwright 最小化接口（测试替身；生产走 dynamic import("playwright")）──────

export interface ElementLike {
  click(opts?: { timeout?: number }): Promise<void>;
  fill(text: string): Promise<void>;
  type(text: string): Promise<void>;
}

export interface PageLike {
  url: string;
  evaluate(fn: string): Promise<unknown>;
  goto(url: string, opts?: Record<string, unknown>): Promise<unknown>;
  screenshot(opts?: { type?: string; fullPage?: boolean }): Promise<Buffer>;
  close(): Promise<void>;
  querySelector(sel: string): Promise<ElementLike | null>;
  mouse: { click(x: number, y: number): Promise<void> };
  keyboard: { press(key: string): Promise<void>; type(text: string): Promise<void> };
}

export interface ContextLike {
  pages: PageLike[];
  newPage(): Promise<PageLike>;
}

export interface BrowserLike {
  contexts: ContextLike[];
  close(): Promise<void>;
}

export interface PlaywrightAPI {
  chromium: {
    connectOverCDP(url: string): Promise<BrowserLike>;
  };
}
