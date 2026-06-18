// Source: materials/mooc-manus/api/app/domain/models/memory.py
// Memory = Agent 的消息历史容器；m05 起换 DB 持久化，接口不变

import type { LLMMessage } from "../ports/llm.ts";

export class Memory {
  private _messages: LLMMessage[] = [];

  // TODO: stage 3 — 实现下列 6 个成员（对标 memory.py 同名方法）
  // get empty(): boolean                         — _messages.length === 0
  // addMessage(msg: LLMMessage): void            — push 单条
  // addMessages(msgs: LLMMessage[]): void        — push 多条（用 ... 展开）
  // getMessages(): LLMMessage[]                  — 返回全部
  // getLastMessage(): LLMMessage | null          — 最后一条，空时 null
  // rollBack(): void                             — 删最后一条（slice 0 -1）

  get empty(): boolean {
    return this._messages.length === 0;
  }
  addMessage(msg: LLMMessage): void {
    this._messages.push(msg);
  }
  addMessages(msgs: LLMMessage[]): void {
    this._messages.push(...msgs);
  }

  getMessages(): LLMMessage[] {
    return this._messages;
  }
  getLastMessage(): LLMMessage | null {
    if (!this._messages.length) {
      return null;
    }
    ``;
    return this._messages[this._messages.length - 1];
  }
  rollBack(): void {
    this._messages = this._messages.slice(0, -1);
  }
}
