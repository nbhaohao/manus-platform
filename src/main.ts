// 已就位（AI 生成）
// Source: materials/mooc-manus/api/app/main.py（简化版，无生命周期依赖）
import { serve } from '@hono/node-server'
import { fileURLToPath } from 'node:url'
import { createApp } from './app/server.ts'
import { loadConfig } from './infra/config.ts'

export function startServer(port: number) {
  const app = createApp()
  return serve({ fetch: app.fetch, port })
}

const __filename = fileURLToPath(import.meta.url)
if (process.argv[1] === __filename) {
  const { port } = loadConfig()
  startServer(port)
  console.log(`manus-platform listening on :${port}`)
}
