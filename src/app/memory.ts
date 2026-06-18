// Source: materials/mooc-manus/api/app/domain/services/agents/base.py:_add_to_memory
// 独立函数：首次注入 system prompt，后续追加，可选持久化 hook（m05 传 repo.save）

import type { LLMMessage } from "../ports/llm.ts";
import { Memory } from "../domain/memory.ts";

export async function addToMemory(
  memory: Memory,
  messages: LLMMessage[],
  systemPrompt: string,
  saveHook?: (m: Memory) => Promise<void>,
): Promise<void> {
  // TODO: stage 4
  // 1. if (memory.empty) → memory.addMessage({ role: 'system', content: systemPrompt })
  // 2. memory.addMessages(messages)
  // 3. if (saveHook) → await saveHook(memory)
  if (memory.empty) {
    memory.addMessage({
      role: "system",
      content: systemPrompt,
    });
  }
  memory.addMessages(messages);
  if (saveHook) {
    await saveHook(memory);
  }
}
