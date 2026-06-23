// Source: materials/mooc-manus/api/app/domain/external/task.py
// ponytail: m09 用 InMemoryMQ，m10 换成 RedisStreamMQ（只改 create()）
import { randomUUID } from "node:crypto";
import { InMemoryMQ } from "../infra/mq/inMemoryMQ.ts";
import type { TaskPort } from "../ports/task.ts";

export class Task implements TaskPort {
  // TODO stage 5: 构造函数存储 id / inputStream / outputStream
  constructor(
    readonly id: string,
    readonly inputStream: InMemoryMQ<string>,
    readonly outputStream: InMemoryMQ<string>,
  ) {}

  // TODO stage 5: 工厂方法 — randomUUID() + 两个 new InMemoryMQ<string>()
  static create(): Task {
    const id = randomUUID();
    const inputStream = new InMemoryMQ<string>();
    const outputStream = new InMemoryMQ<string>();
    return new Task(id, inputStream, outputStream);
  }
}
