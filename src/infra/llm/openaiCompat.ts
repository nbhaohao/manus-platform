// Source: materials/mooc-manus/api/app/infrastructure/external/llm/openai_llm.py
// Python AsyncOpenAI → TS native fetch（不依赖 openai SDK，任何 OpenAI-compat 端点通用）

import type { LLMPort, LLMMessage, LLMTool, LLMResponse } from '../../ports/llm.ts'
import type { LLMConfig } from '../../domain/models/appConfig.ts'

export class OpenAICompatLLM implements LLMPort {
  private readonly _modelName: string
  private readonly _temperature: number
  private readonly _maxTokens: number
  private readonly _baseUrl: string
  private readonly _apiKey: string

  constructor(config: LLMConfig) {
    // TODO: stage 1 — 存储 config 五个字段
    // 1. this._modelName = config.modelName
    // 2. this._temperature = config.temperature
    // 3. this._maxTokens = config.maxTokens
    // 4. this._baseUrl = config.baseUrl.replace(/\/$/, '')（去尾部斜杠）
    // 5. this._apiKey = config.apiKey
    throw new Error('TODO: stage 1')
  }

  get modelName() { return this._modelName }
  get temperature() { return this._temperature }
  get maxTokens() { return this._maxTokens }

  async invoke(
    messages: LLMMessage[],
    tools?: LLMTool[],
    responseFormat?: string,
    toolChoice?: string,
  ): Promise<LLMResponse> {
    // TODO: stage 1 — fetch → OpenAI-compat /chat/completions
    // 1. body = { model: this._modelName, temperature, max_tokens, messages }
    //    若 responseFormat → 追加 response_format: { type: responseFormat }
    //    若 tools → 追加 { tools, tool_choice: toolChoice ?? 'auto', parallel_tool_calls: false }
    // 2. res = await fetch(`${this._baseUrl}/chat/completions`, {
    //      method: 'POST',
    //      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + this._apiKey },
    //      body: JSON.stringify(body),
    //    })
    // 3. if (!res.ok) throw new Error(`LLM API error: ${res.status}`)
    // 4. data = await res.json() as { choices: { message: Record<string, unknown> }[] }
    // 5. const msg = data.choices[0].message
    // 6. return { role: msg.role as string, content: (msg.content ?? null) as string | null,
    //             tool_calls: msg.tool_calls as LLMResponse['tool_calls'],
    //             reasoning_content: msg.reasoning_content as string | undefined }
    throw new Error('TODO: stage 1')
  }
}
