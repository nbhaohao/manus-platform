// e2e_m12 · capstone 收口冒烟：把 s1 文件存储 + s2 健康聚合 + s4 评估回归串成一条端到端链路。
//   不连真 redis/pg（用假 checker），不调真 LLM（用 fixtures）——纯确定性，CI 可跑。
//   用法: pnpm e2e:m12
import { tmpdir } from "node:os";
import { join } from "node:path";
import { LocalFileStorage } from "../src/infra/storage/localFileStorage.ts";
import { aggregateHealth } from "../src/app/health.ts";
import { runEval } from "../src/app/eval.ts";
import { m12Cases } from "./fixtures/m12Cases.ts";
import type { HealthChecker } from "../src/ports/healthChecker.ts";

// 假 checker：capstone smoke 不依赖真 redis/pg
const okChecker = (service: string): HealthChecker => ({
  async check() {
    return { service, status: "ok" };
  },
});

export interface CapstoneSummary {
  storageRoundTrip: boolean; // 存进去再读出来字节一致
  health: "ok" | "error"; // 依赖聚合状态
  evalPassed: number; // 通过的示例任务数
  evalTotal: number;
}

// ── Stage 5: 串起三段、各取一个可断言信号、汇总（核心手写）───────────────────
// TODO stage 5: 把前四关的成果接成一条端到端链路
//   1. 文件存储往返：new LocalFileStorage(join(tmpdir(), "manus-capstone-"+Date.now()))
//      payload = new TextEncoder().encode("hello capstone")
//      saved = await storage.save("note.txt", payload)；{ bytes } = await storage.load(saved.id)
//      storageRoundTrip = Buffer.from(bytes).equals(Buffer.from(payload))
//   2. 健康聚合：report = await aggregateHealth([okChecker("redis"), okChecker("postgres")])
//   3. 评估回归：evalReport = await runEval(m12Cases)
//   4. return { storageRoundTrip, health: report.status, evalPassed: evalReport.passed, evalTotal: evalReport.total }
export async function runCapstone(): Promise<CapstoneSummary> {
  const storage = new LocalFileStorage(
    join(tmpdir(), "manus-capstone-" + Date.now()),
  );
  const payload = new TextEncoder().encode("hello capstone");
  const saved = await storage.save("note.txt", payload);
  const { bytes } = await storage.load(saved.id);
  const storageRoundTrip = Buffer.from(bytes).equals(Buffer.from(payload));
  const report = await aggregateHealth([
    okChecker("redis"),
    okChecker("postgres"),
  ]);
  const evalReport = await runEval(m12Cases);
  return {
    storageRoundTrip,
    health: report.status,
    evalPassed: evalReport.passed,
    evalTotal: evalReport.total,
  };
}

if (process.argv[1]?.endsWith("e2e_m12.ts")) {
  runCapstone()
    .then((s) => {
      console.log("文件存储往返一致:", s.storageRoundTrip);
      console.log("依赖健康聚合:", s.health);
      console.log(`示例任务评估: ${s.evalPassed}/${s.evalTotal} 通过`);
      if (!s.storageRoundTrip) throw new Error("文件存储往返字节不一致");
      if (s.health !== "ok") throw new Error("健康聚合非 ok");
      if (s.evalPassed !== s.evalTotal) throw new Error("有示例任务未通过");
      console.log("✅ capstone 三段链路全绿：存储 / 健康 / 评估");
      process.exit(0);
    })
    .catch((e) => {
      console.error(e);
      process.exit(1);
    });
}
