import { describe, it, expect, beforeEach } from 'vitest'
import { makeMockLLM } from '../src/ports/llm.ts'
import { loadConfig } from '../src/infra/config.ts'
import { createApp } from '../src/app/server.ts'
import { createEvent } from '../src/domain/models/event.ts'
import { runE2e } from '../scripts/e2e_m01.ts'

// ─── stage 1 · LLM port interface ────────────────────────────────────────────

describe('stage 1 · LLM port interface', () => {
  it('makeMockLLM returns object with invoke + 3 readonly props', () => {
    const mock = makeMockLLM()
    expect(typeof mock.invoke).toBe('function')
    expect(mock.modelName).toBe('mock-model')
    expect(mock.temperature).toBe(0.7)
    expect(mock.maxTokens).toBe(4096)
  })

  it('invoke returns default assistant message when no preset responses', async () => {
    const mock = makeMockLLM()
    const result = await mock.invoke([{ role: 'user', content: 'hi' }])
    expect(result.role).toBe('assistant')
    expect(typeof result.content).toBe('string')
  })

  it('invoke consumes preset responses in order', async () => {
    const responses = [
      { role: 'assistant' as const, content: 'first', tool_calls: undefined },
      { role: 'assistant' as const, content: 'second', tool_calls: undefined },
    ]
    const mock = makeMockLLM(responses)
    const r1 = await mock.invoke([])
    const r2 = await mock.invoke([])
    const r3 = await mock.invoke([])
    expect(r1.content).toBe('first')
    expect(r2.content).toBe('second')
    expect(r3.content).toBe('mock response')  // fallback after exhausting
  })
})

// ─── stage 2 · config loading ────────────────────────────────────────────────

describe('stage 2 · config loading', () => {
  beforeEach(() => {
    delete process.env.LLM_BASE_URL
    delete process.env.LLM_API_KEY
    delete process.env.LLM_MODEL
    delete process.env.PORT
  })

  it('returns defaults when env is not set', () => {
    const config = loadConfig()
    expect(config.llm.baseUrl).toBeTruthy()
    expect(config.llm.apiKey).toBe('')
    expect(config.agent.maxIterations).toBe(100)
    expect(config.agent.maxRetries).toBe(3)
    expect(typeof config.port).toBe('number')
  })

  it('picks up LLM_API_KEY from env', () => {
    process.env.LLM_API_KEY = 'test-key-abc'
    const config = loadConfig()
    expect(config.llm.apiKey).toBe('test-key-abc')
  })

  it('PORT env string becomes a number', () => {
    process.env.PORT = '9000'
    const config = loadConfig()
    expect(config.port).toBe(9000)
    expect(typeof config.port).toBe('number')
  })
})

// ─── stage 3 · HTTP /api/status ──────────────────────────────────────────────

describe('stage 3 · HTTP /api/status', () => {
  it('GET /api/status returns 200', async () => {
    const app = createApp()
    const res = await app.fetch(new Request('http://localhost/api/status'))
    expect(res.status).toBe(200)
  })

  it('response body has ok=true and data array', async () => {
    const app = createApp()
    const res = await app.fetch(new Request('http://localhost/api/status'))
    const body = await res.json() as { ok: boolean; data: unknown[] }
    expect(body.ok).toBe(true)
    expect(Array.isArray(body.data)).toBe(true)
    expect(body.data.length).toBeGreaterThanOrEqual(1)
  })
})

// ─── stage 4 · event discriminated union ─────────────────────────────────────

describe('stage 4 · event discriminated union', () => {
  it('createEvent("message") returns MessageEvent with correct type', () => {
    const e = createEvent('message', { role: 'assistant', message: 'hi', attachments: [] })
    expect(e.type).toBe('message')
    expect((e as { message: string }).message).toBe('hi')
  })

  it('createEvent("error") returns ErrorEvent with error field', () => {
    const e = createEvent('error', { error: 'something went wrong' })
    expect(e.type).toBe('error')
    expect((e as { error: string }).error).toBe('something went wrong')
  })

  it('id is a non-empty string and createdAt is a Date', () => {
    const e = createEvent('done', {})
    expect(typeof e.id).toBe('string')
    expect(e.id.length).toBeGreaterThan(0)
    expect(e.createdAt).toBeInstanceOf(Date)
  })
})

// ─── stage 5 · e2e harness ───────────────────────────────────────────────────

describe('stage 5 · e2e harness', () => {
  it('runE2e returns ok=true and servicesCount via injected fetch', async () => {
    const app = createApp()
    const mockFetch = (url: string) => app.fetch(new Request(url))
    const result = await runE2e('http://localhost', mockFetch as typeof fetch)
    expect(result.ok).toBe(true)
    expect(result.servicesCount).toBeGreaterThanOrEqual(1)
  })

  it('runE2e throws on non-200 response', async () => {
    const badFetch = async () => new Response('Not Found', { status: 404 })
    await expect(runE2e('http://localhost', badFetch as typeof fetch)).rejects.toThrow('404')
  })
})
