// 已就位（AI 生成）
// Source: materials/mooc-manus/api/app/infrastructure/external/health_checker/postgres_health_checker.py
// 跑一条 SELECT 1 探活；同样吞异常返回 error 状态。db 是 m05 的 drizzle 句柄。
import { sql } from "drizzle-orm";
import type { Db } from "../db/index.ts";
import type { HealthChecker } from "../../ports/healthChecker.ts";
import type { HealthStatus } from "../../domain/models/healthStatus.ts";

export class PgHealthChecker implements HealthChecker {
  constructor(private readonly db: Db) {}
  async check(): Promise<HealthStatus> {
    try {
      await this.db.execute(sql`SELECT 1`);
      return { service: "postgres", status: "ok" };
    } catch (e) {
      return { service: "postgres", status: "error", details: String(e) };
    }
  }
}
