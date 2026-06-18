// e2e_m02.ts — m02 全链路冒烟（/api/status 回归 + Memory 流水线）
// Run: pnpm tsx scripts/e2e_m02.ts [baseUrl]

import { fileURLToPath } from "url";
import { Memory } from "../src/domain/memory.ts";
import { addToMemory } from "../src/app/memory.ts";

export async function runE2e(
  baseUrl: string,
  fetchFn: typeof fetch = globalThis.fetch,
): Promise<{ ok: boolean; statusOk: boolean; memoryOk: boolean }> {
  // TODO: stage 5
  // 1. GET `${baseUrl}/api/status` → res.ok + body.ok （复用 m01 回归）
  //    if (!statusRes.ok || !body.ok) throw new Error('status endpoint failed')
  // 2. Memory 流水线冒烟：
  //    const m = new Memory()
  //    await addToMemory(m, [{ role: 'user', content: 'hello' }], 'You are helpful.')
  //    if (m.getMessages().length !== 2) throw new Error('memory pipeline failed')
  //    if (m.getMessages()[0].role !== 'system') throw new Error('system prompt missing')
  // 3. return { ok: true, statusOk: true, memoryOk: true }
  const statusRes = await fetchFn(`${baseUrl}/api/status`);
  const body = await statusRes.json();
  if (!statusRes.ok || !body.ok) throw new Error("status endpoint failed");

  const m = new Memory();
  await addToMemory(
    m,
    [{ role: "user", content: "hello" }],
    "You are helpful.",
  );
  if (m.getMessages().length !== 2) throw new Error("memory pipeline failed");
  if (m.getMessages()[0].role !== "system")
    throw new Error("system prompt missing");

  return { ok: true, statusOk: true, memoryOk: true };
}

const __filename = fileURLToPath(import.meta.url);
if (process.argv[1] === __filename) {
  const baseUrl = process.argv[2] ?? "http://localhost:8000";
  runE2e(baseUrl)
    .then((r) => {
      console.log(`m02 e2e OK — status:${r.statusOk} memory:${r.memoryOk}`);
      process.exit(0);
    })
    .catch((e: unknown) => {
      console.error((e as Error).message);
      process.exit(1);
    });
}
