// Source: materials/mooc-manus/api/app/infrastructure/external/message_queue/redis_stream_message_queue.py
import { randomUUID } from "node:crypto";
import type { Redis } from "ioredis";
import type { MessageQueuePort } from "../../ports/messageQueue.ts";
import { getRedisClient } from "./redisClient.ts";

export class RedisStreamMQ<T = string> implements MessageQueuePort<T> {
  private readonly lockExpireSeconds = 10;
  // Lua 脚本：原子比对 + 删除，防止误删他人锁
  private readonly releaseLua = `
    if redis.call("GET", KEYS[1]) == ARGV[1] then
      return redis.call("DEL", KEYS[1])
    else
      return 0
    end
  `;

  constructor(
    private readonly streamName: string,
    // ponytail: 默认 getRedisClient()，测试时注入 mock
    private readonly redis: Redis = getRedisClient(),
  ) {}

  // TODO stage 2: xadd 写入消息并返回 stream ID
  // 1. this.redis.xadd(this.streamName, '*', 'data', String(message))
  // 2. 返回 xadd 的返回值（stream ID 字符串，如 '1700000000000-0'）
  async put(message: T): Promise<string> {
    return (
      (await this.redis.xadd(this.streamName, "*", "data", String(message))) ??
      ""
    );
  }

  // TODO stage 2: xread 按游标取一条消息
  // 1. blockMs > 0 时在 xread 前加 'BLOCK' blockMs 参数，否则不加
  // 2. (this.redis as any).xread('COUNT', 1, 'STREAMS', streamName, startId)
  // 3. result 结构：[[streamName, [[id, ['data', value]]]]] 或 null
  // 4. 解析 result[0][1][0] → [id, fields]，fields[1] 是 data 值
  async get(
    startId = "0",
    blockMs?: number,
  ): Promise<[string, T] | [null, null]> {
    const result = await (this.redis as any).xread(
      ...(blockMs ? ["BLOCK", blockMs] : []),
      "COUNT",
      1,
      "STREAMS",
      this.streamName,
      startId,
    );
    return result?.[0]?.[1]?.[0]
      ? [result[0][1][0][0], result[0][1][0][1][1] as T]
      : [null, null];
  }

  // TODO stage 2: xrange 批量范围读（SSE 历史回放用）
  // 1. (this.redis as any).xrange(streamName, startId, endId, 'COUNT', count)
  // 2. 遍历结果 [id, fields]，fields[1] 是 data 值，yield [id, value]
  async *getRange(
    startId = "-",
    endId = "+",
    count = 100,
  ): AsyncGenerator<[string, T]> {
    const result = await (this.redis as any).xrange(
      this.streamName,
      startId,
      endId,
      "COUNT",
      count,
    );
    for (const [id, fields] of result) {
      yield [id, fields[1] as T];
    }
  }

  // TODO stage 2: xrevrange 取最新 ID（SSE 初始化游标用）
  async getLatestId(): Promise<string> {
    const result = await (this.redis as any).xrevrange(
      this.streamName,
      "+",
      "-",
      "COUNT",
      1,
    );
    return result?.[0]?.[0] ?? "0";
  }

  private async _acquireLock(
    lockKey: string,
    timeoutSeconds = 5,
  ): Promise<string | null> {
    const lockValue = randomUUID();
    const deadline = Date.now() + timeoutSeconds * 1000;
    while (Date.now() < deadline) {
      const result = await this.redis.set(
        lockKey,
        lockValue,
        "EX",
        this.lockExpireSeconds,
        "NX",
      );
      if (result === "OK") return lockValue;
      await new Promise((r) => setTimeout(r, 100));
    }
    return null;
  }

  // TODO stage 3: Lua 脚本原子释放锁（防止误删他人锁）
  private async _releaseLock(
    lockKey: string,
    lockValue: string,
  ): Promise<boolean> {
    const result = await (this.redis as any).eval(
      this.releaseLua,
      1,
      lockKey,
      lockValue,
    );
    return result === 1;
  }

  // TODO stage 3: 原子 pop（加锁 → 取首条 → 删除 → 解锁）
  async pop(): Promise<[string, T] | [null, null]> {
    const lockKey = `lock:${this.streamName}:pop`;
    const lockValue = await this._acquireLock(lockKey);
    if (lockValue === null) return [null, null];
    try {
      const messages = await (this.redis as any).xrange(
        this.streamName,
        "-",
        "+",
        "COUNT",
        1,
      );
      if (messages.length === 0) return [null, null];
      const [id, fields] = messages[0];
      await this.redis.xdel(this.streamName, id);
      return [id, fields[1] as T];
    } finally {
      await this._releaseLock(lockKey, lockValue);
    }
  }

  async clear(): Promise<void> {
    await (this.redis as any).xtrim(this.streamName, "MAXLEN", 0);
  }

  async isEmpty(): Promise<boolean> {
    return (await this.size()) === 0;
  }

  async size(): Promise<number> {
    return this.redis.xlen(this.streamName);
  }

  async deleteMessage(messageId: string): Promise<boolean> {
    const count = await this.redis.xdel(this.streamName, messageId);
    return count > 0;
  }
}
