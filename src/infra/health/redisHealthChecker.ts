// 已就位（AI 生成）
// Source: materials/mooc-manus/api/app/infrastructure/external/health_checker/redis_health_checker.py
// ping 一次：通=ok，否则把异常收敛成 error 状态（绝不向上抛——s2 的聚合器才好统一处理）。
import type { Redis } from "ioredis";
import type { HealthChecker } from "../../ports/healthChecker.ts";
import type { HealthStatus } from "../../domain/models/healthStatus.ts";

export class RedisHealthChecker implements HealthChecker {
  constructor(private readonly client: Redis) {}
  async check(): Promise<HealthStatus> {
    try {
      const pong = await this.client.ping();
      return pong
        ? { service: "redis", status: "ok" }
        : { service: "redis", status: "error", details: "ping 无响应" };
    } catch (e) {
      return { service: "redis", status: "error", details: String(e) };
    }
  }
}
