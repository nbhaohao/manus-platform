// 已就位（AI 生成）
// Source: materials/mooc-manus/api/app/infrastructure/storage/redis.py

import { Redis } from 'ioredis'

let client: Redis | null = null

export function getRedisClient(): Redis {
  if (!client) {
    client = new Redis({
      host: process.env.REDIS_HOST ?? 'localhost',
      port: parseInt(process.env.REDIS_PORT ?? '6379'),
      lazyConnect: true,
    })
  }
  return client
}
