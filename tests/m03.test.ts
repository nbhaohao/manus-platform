import { describe, it, expect } from 'vitest'
import { BaseAgent, type AgentTool } from '../src/app/agent/base.ts'
import { Memory } from '../src/domain/memory.ts'
import { makeMockLLM } from '../src/ports/llm.ts'
import type { LLMMessage, LLMPort, LLMResponse, LLMToolCall } from '../src/ports/llm.ts'
import type { AgentConfig } from '../src/domain/models/appConfig.ts'
import type { Event, ToolEvent, MessageEvent, ErrorEvent } from '../src/domain/models/event.ts'

const cfg: AgentConfig = { maxIterations: 5, maxRetries: 3, maxSearchResults: 5 }

// 一个会回显参数的假工具（m04 才有真工具系统）
function makeEchoTool(): AgentTool & { calls: Record<string, unknown>[] } {
  const calls: Record<string, unknown>[] = []
  return {
    name: 'echo',
    calls,
    getTools: () => [{ type: 'function', function: { name: 'echo', description: 'echo', parameters: {} } }],
    hasTool: (n: string) => n === 'echo',
    invoke: async (_n: string, args: Record<string, unknown>) => {
      calls.push(args)
      return { success: true, message: 'echoed ' + String(args.text) }
    },
  }
}

function toolCallMsg(name: string, args: string): LLMResponse {
  const tc: LLMToolCall = { id: 'call-1', type: 'function', function: { name, arguments: args } }
  return { role: 'assistant', content: null, tool_calls: [tc] }
}

async function collect(gen: AsyncGenerator<Event>): Promise<Event[]> {
  const out: Event[] = []
  for await (const e of gen) out.push(e)
  return out
}

// stage 1 用：覆盖 invokeLlm 做 seam，让主循环可以脱离真实 LLM 实现被测
class ScriptedAgent extends BaseAgent {
  private scripted: LLMMessage[]
  private idx = 0
  constructor(scripted: LLMMessage[], config: AgentConfig) {
    super(makeMockLLM([]), [makeEchoTool()], config, '', new Memory())
    this.scripted = scripted
  }
  protected async invokeLlm(): Promise<LLMMessage> {
    const m = this.scripted[Math.min(this.idx, this.scripted.length - 1)]
    this.idx++
    return m
  }
}

// stage 2/3 用：把 protected invokeLlm 暴露出来直接测
class ProbeAgent extends BaseAgent {
  callLlm(messages: LLMMessage[], format?: string): Promise<LLMMessage> {
    return this.invokeLlm(messages, format)
  }
}

// ─── stage 1 · invoke 主循环（终态 / 最大迭代）────────────────────────────────

describe('stage 1 · invoke main loop', () => {
  it('无 tool_calls 即终态：直接产出一条 MessageEvent', async () => {
    const agent = new ScriptedAgent([{ role: 'assistant', content: '最终答案' }], cfg)
    const events = await collect(agent.invoke('hi'))
    expect(events).toHaveLength(1)
    expect(events[0].type).toBe('message')
    expect((events[0] as MessageEvent).message).toBe('最终答案')
  })

  it('始终返回 tool_calls 时，超过 maxIterations 产出 ErrorEvent', async () => {
    const loopMsg: LLMMessage = { role: 'assistant', content: null, tool_calls: [{ id: 'x', type: 'function', function: { name: 'echo', arguments: '{}' } }] }
    const agent = new ScriptedAgent([loopMsg], { ...cfg, maxIterations: 3 })
    const events = await collect(agent.invoke('hi'))
    const last = events[events.length - 1]
    expect(last.type).toBe('error')
    expect((last as ErrorEvent).error).toContain('最大次数')
  })
})

// ─── stage 2 · _invoke_llm 重试与空回复 ──────────────────────────────────────

describe('stage 2 · invokeLlm retry & empty handling', () => {
  it('空回复（无 content 无 tool_calls）会注入「请继续」并重试到有效回复', async () => {
    const llm = makeMockLLM([
      { role: 'assistant', content: null },          // 空回复 → 重试
      { role: 'assistant', content: '第二次有了' },   // 有效
    ])
    const agent = new ProbeAgent(llm, [], cfg, 'sys', new Memory())
    const msg = await agent.callLlm([{ role: 'user', content: 'q' }])
    expect(msg.content).toBe('第二次有了')
  })

  it('重试耗尽仍无有效响应则抛错', async () => {
    // 永远返回空回复的 LLM
    const alwaysEmpty: LLMPort = {
      invoke: async () => ({ role: 'assistant', content: null }),
      modelName: 'm', temperature: 0, maxTokens: 1,
    }
    const agent = new ProbeAgent(alwaysEmpty, [], { ...cfg, maxRetries: 2 }, 'sys', new Memory())
    await expect(agent.callLlm([{ role: 'user', content: 'q' }])).rejects.toThrow('最大重试次数')
  })
})

// ─── stage 3 · 单工具限制 ─────────────────────────────────────────────────────

describe('stage 3 · single tool limit', () => {
  it('LLM 返回多个 tool_calls 时只保留第一个', async () => {
    const llm = makeMockLLM([{
      role: 'assistant', content: null,
      tool_calls: [
        { id: 'a', type: 'function', function: { name: 'echo', arguments: '{}' } },
        { id: 'b', type: 'function', function: { name: 'echo', arguments: '{}' } },
      ],
    }])
    const agent = new ProbeAgent(llm, [], cfg, 'sys', new Memory())
    const msg = await agent.callLlm([{ role: 'user', content: 'q' }])
    expect((msg.tool_calls as LLMToolCall[]).length).toBe(1)
    expect((msg.tool_calls as LLMToolCall[])[0].id).toBe('a')
  })
})

// ─── stage 4 · 工具调用→结果回填 ─────────────────────────────────────────────

describe('stage 4 · tool execution & backfill', () => {
  it('解析工具调用、执行工具并把结果回填为 role:tool 消息', async () => {
    const mem = new Memory()
    const tool = makeEchoTool()
    const llm = makeMockLLM([
      toolCallMsg('echo', '{"text":"hi"}'),
      { role: 'assistant', content: '完成' },
    ])
    const agent = new BaseAgent(llm, [tool], cfg, 'sys', mem)
    const events = await collect(agent.invoke('q'))

    // 工具被真的调用，参数解析正确
    expect(tool.calls).toEqual([{ text: 'hi' }])
    // 记忆里出现一条回填的 role:tool 消息，内容携带工具结果
    const toolMsg = mem.getMessages().find((m) => m.role === 'tool')
    expect(toolMsg).toBeDefined()
    expect(String(toolMsg!.content)).toContain('echoed hi')
    // 最终仍产出文本答案
    expect((events[events.length - 1] as MessageEvent).message).toBe('完成')
  })
})

// ─── stage 5 · 事件流产出 ─────────────────────────────────────────────────────

describe('stage 5 · event stream', () => {
  it('一次工具调用产出 ToolEvent(calling) → ToolEvent(called) → MessageEvent', async () => {
    const llm = makeMockLLM([
      toolCallMsg('echo', '{"text":"hi"}'),
      { role: 'assistant', content: '完成' },
    ])
    const agent = new BaseAgent(llm, [makeEchoTool()], cfg, 'sys', new Memory())
    const events = await collect(agent.invoke('q'))

    const tools = events.filter((e) => e.type === 'tool') as ToolEvent[]
    expect(tools.map((t) => t.status)).toEqual(['calling', 'called'])
    expect(tools[1].functionResult).toBeDefined()
    expect(events[events.length - 1].type).toBe('message')
  })
})

// ─── stage 6 · roll_back 状态修正 ────────────────────────────────────────────

describe('stage 6 · rollBack', () => {
  function agentWith(mem: Memory): BaseAgent {
    return new BaseAgent(makeMockLLM([]), [], cfg, '', mem)
  }

  it('末条是普通工具调用时直接删除该消息', async () => {
    const mem = new Memory()
    mem.addMessage({ role: 'assistant', content: null, tool_calls: [{ id: 'c', type: 'function', function: { name: 'shell', arguments: '{}' } }] })
    await agentWith(mem).rollBack()
    expect(mem.getMessages()).toHaveLength(0)
  })

  it('message_ask_user 特判：不删消息，改为回填一条 role:tool 挂上用户答复', async () => {
    const mem = new Memory()
    mem.addMessage({ role: 'assistant', content: null, tool_calls: [{ id: 'c', type: 'function', function: { name: 'message_ask_user', arguments: '{}' } }] })
    await agentWith(mem).rollBack('我的答复')
    expect(mem.getMessages()).toHaveLength(2)
    const last = mem.getLastMessage()!
    expect(last.role).toBe('tool')
    expect(String(last.content)).toContain('我的答复')
  })

  it('末条不是 tool_calls 时不动记忆', async () => {
    const mem = new Memory()
    mem.addMessage({ role: 'assistant', content: '普通回复' })
    await agentWith(mem).rollBack()
    expect(mem.getMessages()).toHaveLength(1)
  })
})
