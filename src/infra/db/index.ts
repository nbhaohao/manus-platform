// 已就位（AI 生成）
// postgres.js + drizzle-orm 连接入口
import postgres from 'postgres'
import { drizzle } from 'drizzle-orm/postgres-js'
import * as schema from './schema.ts'

export function createDb(connectionString: string) {
  const sql = postgres(connectionString, { max: 10 })
  return drizzle(sql, { schema })
}

export type Db = ReturnType<typeof createDb>
