// Source: materials/mooc-manus/api/app/infrastructure/models/{session,file}.py
//   —— SQLAlchemy ORM 模型 → Drizzle pgTable 定义
//   events / files / memories 用 jsonb：只随 session 整体读写，无跨 session 筛选需求，省 JOIN
import { pgTable, varchar, text, integer, timestamp, jsonb } from 'drizzle-orm/pg-core'

// ── sessions 表（stage 3 核心：补全所有列）──────────────────────────────────
export const sessions = pgTable('sessions', {
  id: varchar('id', { length: 255 }).primaryKey(),
  // TODO: stage 3 — 补全以下列（对标 infrastructure/models/session.py SessionModel）
  // sandbox_id  varchar(255) nullable
  // task_id     varchar(255) nullable
  // title       varchar(255) not null default ''
  // unread_message_count  integer not null default 0
  // latest_message  text not null default ''
  // latest_message_at  timestamp nullable
  // events      jsonb not null default []
  // files       jsonb not null default []
  // memories    jsonb not null default {}
  // status      varchar(255) not null default 'pending'
  // updated_at  timestamp not null defaultNow()
  // created_at  timestamp not null defaultNow()
})

// ── files 表（stage 3 核心：补全所有列）─────────────────────────────────────
export const files = pgTable('files', {
  id: varchar('id', { length: 255 }).primaryKey(),
  // TODO: stage 3 — 补全以下列（对标 infrastructure/models/file.py FileModel）
  // filename   varchar(255) not null default ''
  // filepath   varchar(255) not null default ''
  // key        varchar(255) not null default ''
  // extension  varchar(255) not null default ''
  // mime_type  varchar(255) not null default ''
  // size       integer not null default 0
  // updated_at timestamp not null defaultNow()
  // created_at timestamp not null defaultNow()
})
