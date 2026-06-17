import { describe, it, expect, vi, afterEach } from 'vitest'
import { OpenAICompatLLM } from '../src/infra/llm/openaiCompat.ts'
import { parseJSON } from '../src/infra/jsonParser.ts'
import { Memory } from '../src/domain/memory.ts'
import { addToMemory } from '../src/app/memory.ts'
import { runE2e } from '../scripts/e2e_m02.ts'
import { createApp } from '../src/app/server.ts'
import type { LLMConfig } from '../src/domain/models/appConfig.ts'
import type { LLMTool } from '../src/ports/llm.ts'

const baseCfg: LLMConfig = {
  baseUrl: 'https://api.example.com/v1',
  apiKey: 'test-key',
  modelName: 'test-model',
  temperature: 0.7,
  maxTokens: 4096,
}

// ─── stage 1 · OpenAI-compat adapter ─────────────────────────────────────────

describe('stage 1 · OpenAI-compat adapter', () => {
  afterEach(() => { vi.restoreAllMocks() })

  it('exposes modelName / temperature / maxTokens from config', () => {
    const llm = new OpenAICompatLLM(baseCfg)
    expect(llm.modelName).toBe('test-model')
    expect(llm.temperature).toBe(0.7)
    expect(llm.maxTokens).toBe(4096)
  })

  it('invoke calls fetch with correct endpoint and returns LLMResponse', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        choices: [{ message: { role: 'assistant', content: 'hello' } }],
      }),
    }))
    const llm = new OpenAICompatLLM(baseCfg)
    const res = await llm.invoke([{ role: 'user', content: 'hi' }])
    expect(res.role).toBe('assistant')
    expect(res.content).toBe('hello')
    const callArgs = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0]
    expect(callArgs[0]).toContain('/chat/completions')
    expect(callArgs[1].method).toBe('POST')
  })

  it('includes tools + parallel_tool_calls:false when tools provided', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        choices: [{ message: { role: 'assistant', content: null, tool_calls: [] } }],
      }),
    }))
    const llm = new OpenAICompatLLM(baseCfg)
    const tool: LLMTool = { type: 'function', function: { name: 'fn', description: 'd', parameters: {} } }
    await llm.invoke([{ role: 'user', content: 'hi' }], [tool])
    const body = JSON.parse((globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body as string)
    expect(body.tools).toBeDefined()
    expect(body.parallel_tool_calls).toBe(false)
  })
})

// ─── stage 2 · lenient JSON parser ───────────────────────────────────────────

describe('stage 2 · lenient JSON parser', () => {
  it('parses plain valid JSON', async () => {
    const result = await parseJSON('{"key":"value"}')
    expect((result as Record<string, string>).key).toBe('value')
  })

  it('extracts JSON from markdown code block', async () => {
    const result = await parseJSON('```json\n{"name":"test"}\n```')
    expect((result as Record<string, string>).name).toBe('test')
  })

  it('returns defaultValue on unparseable input', async () => {
    const result = await parseJSON('not json at all', [])
    expect(result).toEqual([])
  })
})

// ─── stage 3 · Memory model ───────────────────────────────────────────────────

describe('stage 3 · Memory model', () => {
  it('starts empty', () => {
    const m = new Memory()
    expect(m.empty).toBe(true)
    expect(m.getMessages()).toHaveLength(0)
  })

  it('addMessage / getLastMessage', () => {
    const m = new Memory()
    m.addMessage({ role: 'user', content: 'hi' })
    expect(m.empty).toBe(false)
    expect(m.getLastMessage()?.content).toBe('hi')
  })

  it('rollBack removes last message', () => {
    const m = new Memory()
    m.addMessages([
      { role: 'user', content: 'a' },
      { role: 'assistant', content: 'b' },
    ])
    m.rollBack()
    expect(m.getMessages()).toHaveLength(1)
    expect(m.getLastMessage()?.content).toBe('a')
  })
})

// ─── stage 4 · addToMemory ────────────────────────────────────────────────────

describe('stage 4 · addToMemory', () => {
  it('prepends system prompt on first call', async () => {
    const m = new Memory()
    await addToMemory(m, [{ role: 'user', content: 'hello' }], 'You are helpful.')
    expect(m.getMessages()[0].role).toBe('system')
    expect(m.getMessages()[0].content).toBe('You are helpful.')
    expect(m.getMessages()[1].role).toBe('user')
  })

  it('does not prepend system on subsequent calls', async () => {
    const m = new Memory()
    await addToMemory(m, [{ role: 'user', content: 'first' }], 'sys')
    await addToMemory(m, [{ role: 'assistant', content: 'reply' }], 'sys')
    expect(m.getMessages().filter(msg => msg.role === 'system')).toHaveLength(1)
    expect(m.getMessages()).toHaveLength(3)
  })

  it('calls saveHook when provided', async () => {
    const m = new Memory()
    const hook = vi.fn().mockResolvedValue(undefined)
    await addToMemory(m, [{ role: 'user', content: 'x' }], 'sys', hook)
    expect(hook).toHaveBeenCalledWith(m)
  })
})

// ─── stage 5 · e2e harness ────────────────────────────────────────────────────

describe('stage 5 · e2e harness', () => {
  it('runE2e returns ok/statusOk/memoryOk=true via injected fetch', async () => {
    const app = createApp()
    const mockFetch = (url: string) => app.fetch(new Request(url))
    const result = await runE2e('http://localhost', mockFetch as typeof fetch)
    expect(result.ok).toBe(true)
    expect(result.statusOk).toBe(true)
    expect(result.memoryOk).toBe(true)
  })
})
