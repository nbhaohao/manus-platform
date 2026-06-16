// e2e_m01.ts — m01 全链路冒烟测试（CLI harness）
// Run: pnpm tsx scripts/e2e_m01.ts [baseUrl]
// Source: 本课 e2e 纪律（COURSE_SPEC.md）

import { fileURLToPath } from 'url'

export async function runE2e(
  baseUrl: string,
  fetchFn: typeof fetch = globalThis.fetch,
): Promise<{ ok: boolean; servicesCount: number }> {
  // 1. res = await fetchFn(`${baseUrl}/api/status`)
  // 2. if (!res.ok) throw new Error(`HTTP ${res.status}`)
  // 3. const body = await res.json() as { ok: boolean; data: unknown[] }
  // 4. if (!body.ok) throw new Error('API 报告服务异常')
  // 5. return { ok: true, servicesCount: body.data.length }
  throw new Error('TODO: stage 5')
}

// CLI 入口 — 直接运行时打真实服务器
const __filename = fileURLToPath(import.meta.url)
if (process.argv[1] === __filename) {
  const baseUrl = process.argv[2] ?? 'http://localhost:8000'
  runE2e(baseUrl)
    .then(r => { console.log(`status OK - ${r.servicesCount} service(s) healthy`); process.exit(0) })
    .catch((e: unknown) => { console.error((e as Error).message); process.exit(1) })
}
