// 已就位（AI 生成）
// Source: materials/mooc-manus/api/app/domain/external/health_checker.py（HealthChecker Protocol）
// 每个依赖（redis/postgres/sandbox…）实现一个 checker；check() 自己吞异常、永远返回 HealthStatus 不抛。
import type { HealthStatus } from "../domain/models/healthStatus.ts";

export interface HealthChecker {
  check(): Promise<HealthStatus>;
}
