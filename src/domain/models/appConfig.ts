// 已就位（AI 生成）
// Source: materials/mooc-manus/api/app/domain/models/app_config.py

export interface LLMConfig {
  baseUrl: string
  apiKey: string
  modelName: string
  temperature: number
  maxTokens: number
}

export interface AgentConfig {
  maxIterations: number
  maxRetries: number
  maxSearchResults: number
}

export interface AppConfig {
  llm: LLMConfig
  agent: AgentConfig
  port: number
}
