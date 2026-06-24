// Source: materials/mooc-manus/api/app/domain/services/external/health_checker（聚合多个 checker）
//   把若干 HealthChecker 跑一遍，汇总成一个总状态：任一 error → 整体 error。
//   命题：聚合器必须「永不抛」——单个 checker 真的炸了也要收敛成 error 状态码，否则 /health 端点本身会 500。
import type { HealthChecker } from "../ports/healthChecker.ts";
import type { HealthStatus } from "../domain/models/healthStatus.ts";

export interface HealthReport {
  status: "ok" | "error"; // 整体：全 ok 才 ok
  services: HealthStatus[]; // 各依赖逐条明细
}

// ── Stage 2: 并发跑所有 checker、收敛异常、汇总总状态（核心手写）────────────
// TODO stage 2: 跑全部 checker → 汇总，且整个函数永不抛
//   1. services = await Promise.all(checkers.map(...))，每个 checker：
//        try { return await c.check() }
//        catch (e) { return { service:"unknown", status:"error", details:String(e) } }  ← 最后防线
//   2. status = services.every(s => s.status === "ok") ? "ok" : "error"
//   3. return { status, services }
export async function aggregateHealth(
  checkers: HealthChecker[],
): Promise<HealthReport> {
  throw new Error("TODO: stage 2 — aggregateHealth");
}
