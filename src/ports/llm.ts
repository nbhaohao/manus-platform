// Source: materials/mooc-manus/api/app/domain/external/llm.py
// Python Protocol → TypeScript interface（结构子类型，同等表达力）

export type LLMMessage = {
  role: 'user' | 'assistant' | 'system' | 'tool'
  content: string | null
  [key: string]: unknown
}

export type LLMTool = {
  type: 'function'
  function: { name: string; description: string; parameters: unknown }
}

export type LLMToolCall = {
  id: string
  type: string
  function: { name: string; arguments: string }
}

export type LLMResponse = {
  role: string
  content: string | null
  tool_calls?: LLMToolCall[]
  reasoning_content?: string
}

export interface LLMPort {
  // TODO: stage 1 — 根据 llm.py Protocol 翻译下列 4 个成员
  // 1. invoke(messages: LLMMessage[], tools?: LLMTool[],
  //          responseFormat?: string, toolChoice?: string): Promise<LLMResponse>
  // 2. readonly modelName: string
  // 3. readonly temperature: number
  // 4. readonly maxTokens: number
  // TODO: stage 1 — 取消注释并补全下列 4 个成员
  // invoke(messages: LLMMessage[], tools?: LLMTool[], responseFormat?: string, toolChoice?: string): Promise<LLMResponse>
  // readonly modelName: string
  // readonly temperature: number
  // readonly maxTokens: number
}

// 测试用 stub：让单元测试不依赖真 LLM（m02 起会有真实适配器）
export function makeMockLLM(responses: LLMResponse[] = []): LLMPort {
  // 1. let i = 0（游标）
  // 2. 返回满足 LLMPort 的对象：
  //    - invoke: 从 responses[i++] 取，耗尽后返回 { role:'assistant', content:'mock response' }
  //    - modelName: 'mock-model'
  //    - temperature: 0.7
  //    - maxTokens: 4096
  throw new Error('TODO: stage 1')
}
