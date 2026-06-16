import { Hono } from 'hono'
import type { HealthStatus } from '../domain/models/healthStatus.ts'

// Source: materials/mooc-manus/api/app/interfaces/endpoints/status_routes.py
// 纯函数返回 app 对象（不 .listen()），测试直接调 app.fetch() 无需真实 TCP。

export function createApp() {
  const app = new Hono()

  // GET /api/status — 平台健康检查
  // 1. 构建 checks: HealthStatus[] = [{ service: 'api', status: 'ok' }]
  // 2. 返回 c.json({ ok: true, data: checks })
  //
  // 来源锚点: mooc-manus status_routes.py → Response[List[HealthStatus]]
  app.get('/api/status', async (c) => {
    throw new Error('TODO: stage 3')
  })

  return app
}
