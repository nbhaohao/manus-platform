// m12 · 收口 capstone（文件存储 / 健康检查 / compose / 示例任务评估 / 自查）
// pnpm verify        →  vitest run tests/m12.test.ts
// pnpm v "stage N"   →  只跑当前关
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { LocalFileStorage } from "../src/infra/storage/localFileStorage.ts";
import { aggregateHealth } from "../src/app/health.ts";
import { runEval, type EvalCase } from "../src/app/eval.ts";
import { m12Cases } from "../scripts/fixtures/m12Cases.ts";
import { createEvent } from "../src/domain/models/event.ts";
import type { HealthChecker } from "../src/ports/healthChecker.ts";
import type { Event } from "../src/domain/models/event.ts";

const tmp = () => join(tmpdir(), "manus-m12-" + Math.random().toString(36).slice(2));

describe("stage 1: LocalFileStorage 本地文件存储", () => {
  it("save 落盘并返回带 id/size/extension 的 File 元数据", async () => {
    const fs = new LocalFileStorage(tmp());
    const bytes = new TextEncoder().encode("hello");
    const file = await fs.save("note.txt", bytes);
    expect(file.id).toBeTruthy();
    expect(file.size).toBe(5);
    expect(file.extension).toBe(".txt");
    expect(file.key).toContain(".txt");
  });
  it("load 按 id 往返取回同样的字节；未知 id 抛错", async () => {
    const fs = new LocalFileStorage(tmp());
    const bytes = new TextEncoder().encode("round-trip");
    const file = await fs.save("a.bin", bytes);
    const got = await fs.load(file.id);
    expect(Buffer.from(got.bytes).equals(Buffer.from(bytes))).toBe(true);
    await expect(fs.load("nope")).rejects.toThrow();
  });
});

describe("stage 2: aggregateHealth 健康聚合", () => {
  const checker = (service: string, status: "ok" | "error"): HealthChecker => ({
    async check() {
      return { service, status };
    },
  });
  it("全 ok → 整体 ok，逐条明细齐全", async () => {
    const r = await aggregateHealth([checker("redis", "ok"), checker("postgres", "ok")]);
    expect(r.status).toBe("ok");
    expect(r.services.map((s) => s.service).sort()).toEqual(["postgres", "redis"]);
  });
  it("任一 error → 整体 error", async () => {
    const r = await aggregateHealth([checker("redis", "ok"), checker("postgres", "error")]);
    expect(r.status).toBe("error");
  });
  it("checker 自己抛异常也收敛成 error，聚合器永不抛", async () => {
    const boom: HealthChecker = {
      async check() {
        throw new Error("connection refused");
      },
    };
    const r = await aggregateHealth([boom]);
    expect(r.status).toBe("error");
    expect(r.services[0].status).toBe("error");
  });
});

describe("stage 3: docker-compose.yml 四件套编排", () => {
  const yml = readFileSync(join(import.meta.dirname, "../docker-compose.yml"), "utf8");
  it("声明了 redis / postgres / sandbox / api 四个服务", () => {
    for (const svc of ["redis:", "postgres:", "sandbox:", "api:"]) {
      expect(yml).toContain(svc);
    }
  });
  it("api 依赖 redis/postgres 且配了 healthcheck 探活", () => {
    expect(yml).toContain("depends_on");
    expect(yml).toContain("healthcheck");
    expect(yml).toContain("service_healthy");
  });
});

describe("stage 4: runEval 示例任务评估回归", () => {
  it("3 个固化示例任务全部通过", async () => {
    const report = await runEval(m12Cases);
    expect(report.total).toBe(3);
    expect(report.passed).toBe(3);
    expect(report.failed).toBe(0);
  });
  it("断言不满足的 case 记为 failed 且不中断其余", async () => {
    const failing: EvalCase = {
      name: "always-fail",
      async *run(): AsyncGenerator<Event> {
        yield createEvent("done", {});
      },
      check: () => "故意失败",
    };
    const report = await runEval([failing, ...m12Cases]);
    expect(report.failed).toBe(1);
    expect(report.passed).toBe(3);
    expect(report.results.find((r) => r.name === "always-fail")?.reason).toBe("故意失败");
  });
});

describe("stage 5: capstone smoke 端到端", () => {
  it("runCapstone 串起存储/健康/评估三段全绿", async () => {
    const { runCapstone } = await import("../scripts/e2e_m12.ts");
    const s = await runCapstone();
    expect(s.storageRoundTrip).toBe(true);
    expect(s.health).toBe("ok");
    expect(s.evalPassed).toBe(s.evalTotal);
  });
});
