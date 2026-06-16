// 已就位（AI 生成）
// Source: materials/mooc-manus/api/app/domain/external/sandbox.py

import type { ToolResult } from '../domain/models/toolResult.ts'
import type { BrowserPort } from './browser.ts'

export interface SandboxPort {
  readonly id: string
  readonly cdpUrl: string

  execCommand(sessionId: string, execDir: string, command: string): Promise<ToolResult>
  readShellOutput(sessionId: string, console?: boolean): Promise<ToolResult>
  waitProcess(sessionId: string, seconds?: number): Promise<ToolResult>
  writeShellInput(sessionId: string, inputText: string, pressEnter?: boolean): Promise<ToolResult>
  killProcess(sessionId: string): Promise<ToolResult>

  writeFile(filepath: string, content: string, options?: { append?: boolean; sudo?: boolean }): Promise<ToolResult>
  readFile(filepath: string, options?: { startLine?: number; endLine?: number; maxLength?: number }): Promise<ToolResult>
  checkFileExists(filepath: string): Promise<ToolResult>
  deleteFile(filepath: string): Promise<ToolResult>
  listFiles(dirPath: string): Promise<ToolResult>

  ensureSandbox(): Promise<void>
  destroy(): Promise<boolean>
  getBrowser(): Promise<BrowserPort>
}
