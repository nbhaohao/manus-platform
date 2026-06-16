// 已就位（AI 生成）
// Source: materials/mooc-manus/api/app/domain/external/browser.py

import type { ToolResult } from '../domain/models/toolResult.ts'

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
}
