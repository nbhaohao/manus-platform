// Source: materials/mooc-manus/api/app/domain/repositories/uow.py + infrastructure/repositories/db_uow.py
//   —— Python IUnitOfWork(ABC) + DBUnitOfWork → TS interface + withUoW 工厂函数
//   Python `async with uow:` → TS `await withUoW(db, async (uow) => { ... })`
//   核心设计：session repo 和 file repo 共享同一个 tx（同一事务），要么全提交要么全回滚
import { PgSessionRepository } from "../../infra/repositories/pgSession.ts";
import { PgFileRepository } from "../../infra/repositories/pgFile.ts";

// ── UoW 内部上下文类型 ────────────────────────────────────────────────────────
export interface IUnitOfWork {
  session: PgSessionRepository;
  file: PgFileRepository;
}

// ── stage 5 核心：withUoW — drizzle transaction 等价于 async with uow ─────────
export async function withUoW<T>(
  db: { transaction: (fn: (tx: any) => Promise<T>) => Promise<T> },
  fn: (uow: IUnitOfWork) => Promise<T>,
): Promise<T> {
  // TODO: stage 5 — 在 drizzle transaction 回调里创建 repo，再调 fn(uow)
  // 1. return db.transaction(async (tx) => {
  // 2.   const uow: IUnitOfWork = {
  // 3.     session: new PgSessionRepository(tx as any),
  // 4.     file:    new PgFileRepository(tx as any),
  // 5.   }
  // 6.   return fn(uow)
  // 7. })
  return db.transaction(async (tx) => {
    const uow: IUnitOfWork = {
      session: new PgSessionRepository(tx as any),
      file: new PgFileRepository(tx as any),
    };
    return fn(uow);
  });
}
