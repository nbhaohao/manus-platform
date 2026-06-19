import { describe, it, expect } from 'vitest'
import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { toParam, type Tool } from '../src/domain/tool.ts'
import { ToolRegistry } from '../src/app/registry.ts'
import { createFileTools } from '../src/infra/tools/file.ts'
import { createShellTool } from '../src/infra/tools/shell.ts'
import { createSearchTool } from '../src/infra/tools/search.ts'
import type { SearchEnginePort } from '../src/ports/search.ts'

function sampleTool(calls: Record<string, unknown>[] = []): Tool {
  return {
    name: 'echo',
    description: 'echo back',
    parameters: { text: { type: 'string', description: 't' } },
    required: ['text'],
    async execute(args) {
      calls.push(args)
      return { success: true, message: 'ok', data: args.text }
    },
  }
}

describe('stage 1 · Tool 自描述 schema', () => {
  it('toParam 生成 OpenAI function schema', () => {
    expect(toParam(sampleTool())).toEqual({
      type: 'function',
      function: {
        name: 'echo',
        description: 'echo back',
        parameters: {
          type: 'object',
          properties: { text: { type: 'string', description: 't' } },
          required: ['text'],
        },
      },
    })
  })
})

describe('stage 2 · 注册表 schema 聚合', () => {
  it('getTools 聚合所有工具 schema；hasTool 判存在', () => {
    const reg = new ToolRegistry([sampleTool()])
    const tools = reg.getTools()
    expect(tools).toHaveLength(1)
    expect(tools[0].function.name).toBe('echo')
    expect(reg.hasTool('echo')).toBe(true)
    expect(reg.hasTool('nope')).toBe(false)
  })
})

describe('stage 3 · 分发 → 统一 ToolResult', () => {
  it('按名分发到对应工具的 execute', async () => {
    const r = await new ToolRegistry([sampleTool()]).invoke('echo', { text: 'hi' })
    expect(r.success).toBe(true)
    expect(r.data).toBe('hi')
  })
  it('未知工具 → 失败 ToolResult 而非抛错', async () => {
    const r = await new ToolRegistry([sampleTool()]).invoke('ghost', {})
    expect(r.success).toBe(false)
  })
  it('过滤幻觉参数：只保留工具声明过的键', async () => {
    const calls: Record<string, unknown>[] = []
    await new ToolRegistry([sampleTool(calls)]).invoke('echo', { text: 'hi', hallucinated: 123 })
    expect(calls[0]).toEqual({ text: 'hi' })
  })
  it('工具内部抛错 → 包成失败 ToolResult', async () => {
    const boom: Tool = {
      name: 'boom', description: 'b', parameters: {}, required: [],
      async execute() { throw new Error('炸了') },
    }
    const r = await new ToolRegistry([boom]).invoke('boom', {})
    expect(r.success).toBe(false)
    expect(r.message).toContain('炸了')
  })
})

describe('stage 4 · file 工具（本机 + 路径越狱校验）', () => {
  it('写入后能读回', async () => {
    const root = await mkdtemp(join(tmpdir(), 'm04-'))
    const tools = createFileTools(root)
    const write = tools.find((t) => t.name === 'write_file')!
    const read = tools.find((t) => t.name === 'read_file')!
    expect((await write.execute({ filepath: 'a.txt', content: 'hello' })).success).toBe(true)
    const r = await read.execute({ filepath: 'a.txt' })
    expect(r.success).toBe(true)
    expect(r.data).toBe('hello')
  })
  it('../ 越狱被拒（success:false）', async () => {
    const root = await mkdtemp(join(tmpdir(), 'm04-'))
    const read = createFileTools(root).find((t) => t.name === 'read_file')!
    const r = await read.execute({ filepath: '../../../../etc/hosts' })
    expect(r.success).toBe(false)
    expect(r.message).toContain('越权')
  })
})

describe('stage 5 · shell 工具（本机执行）', () => {
  it('echo 命令拿到 stdout', async () => {
    const r = await createShellTool().execute({ command: 'echo hi' })
    expect(r.success).toBe(true)
    expect((r.data as { stdout: string }).stdout).toContain('hi')
  })
  it('失败命令（非零退出）→ success:false', async () => {
    const r = await createShellTool().execute({ command: 'exit 3' })
    expect(r.success).toBe(false)
  })
})

describe('stage 6 · search 工具（端口 + 实现）', () => {
  it('search_web 调注入的引擎并透传结果；schema required=[query]', async () => {
    const fake: SearchEnginePort = {
      async invoke(q) { return { success: true, message: 'ok', data: [{ q }] } },
    }
    const tool = createSearchTool(fake)
    expect(tool.required).toEqual(['query'])
    const r = await tool.execute({ query: '北京 天气' })
    expect(r.success).toBe(true)
    expect(r.data).toEqual([{ q: '北京 天气' }])
  })
})
