import type { AppConfig } from "../domain/models/appConfig.ts";

// Source: materials/mooc-manus/api/app/domain/models/app_config.py LLMConfig / AgentConfig

export function loadConfig(): AppConfig {
  // 1. llm.baseUrl  = process.env.LLM_BASE_URL  ?? 'https://api.deepseek.com/v1'
  // 2. llm.apiKey   = process.env.LLM_API_KEY   ?? ''      ← 空字符串允许（测试场景不需真 key）
  // 3. llm.modelName= process.env.LLM_MODEL     ?? 'deepseek-chat'
  // 4. llm.temperature = 0.7, llm.maxTokens = 8192
  // 5. agent: maxIterations=100, maxRetries=3, maxSearchResults=10
  // 6. port = Number(process.env.PORT ?? '8000')
  // 7. return AppConfig 对象
  const appConfig: AppConfig = {
    llm: {
      baseUrl: process.env.LLM_BASE_URL ?? "https://api.deepseek.com",
      apiKey: process.env.LLM_API_KEY ?? "",
      modelName: process.env.LLM_MODEL ?? "deepseek-v4-flash",
      temperature: 0.7,
      maxTokens: 8192,
    },
    agent: {
      maxIterations: 100,
      maxRetries: 3,
      maxSearchResults: 10,
    },
    port: Number(process.env.PORT ?? "8000"),
  };
  return appConfig;
}
