// 已就位（AI 生成）
// drizzle-kit migration config — 运行 `pnpm drizzle-kit generate` 生成 SQL
import type { Config } from 'drizzle-kit'

export default {
  schema: './src/infra/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL ?? 'postgresql://localhost:5432/manus_platform',
  },
} satisfies Config
