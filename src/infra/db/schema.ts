// Source: materials/mooc-manus/api/app/infrastructure/models/{session,file}.py
//   —— SQLAlchemy ORM 模型 → Drizzle pgTable 定义
//   events / files / memories 用 jsonb：只随 session 整体读写，无跨 session 筛选需求，省 JOIN
import {
  pgTable,
  varchar,
  text,
  integer,
  timestamp,
  jsonb,
} from "drizzle-orm/pg-core";

// ── sessions 表（stage 3 核心：补全所有列）──────────────────────────────────
export const sessions = pgTable("sessions", {
  id: varchar("id", { length: 255 }).primaryKey(),
  sandboxId: varchar("sandbox_id", { length: 255 }),
  taskId: varchar("task_id", { length: 255 }),
  title: varchar("title", { length: 255 }),
  unreadMessageCount: integer("unread_message_count"),
  latestMessage: text("latest_message"),
  latestMessageAt: timestamp("latest_message_at"),
  events: jsonb("events"),
  files: jsonb("files"),
  memories: jsonb("memories"),
  status: varchar("status", { length: 255 }),
  updatedAt: timestamp("updated_at"),
  createdAt: timestamp("created_at"),
});

// ── files 表（stage 3 核心：补全所有列）─────────────────────────────────────
export const files = pgTable("files", {
  id: varchar("id", { length: 255 }).primaryKey(),
  filename: varchar("filename", { length: 255 }),
  filepath: varchar("filepath", { length: 255 }),
  key: varchar("key", { length: 255 }),
  extension: varchar("extension", { length: 255 }),
  mime_type: varchar("mime_type", { length: 255 }),
  size: integer("size"),
  updatedAt: timestamp("updated_at"),
  createdAt: timestamp("created_at"),
});
