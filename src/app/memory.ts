// Source: materials/mooc-manus/api/app/domain/services/agents/base.py:_add_to_memory / _ensure_memory
// addToMemory：首次注入 system prompt，后续追加，可选持久化 hook（m05 传 makeMemorySaveHook）
// makeMemorySaveHook（m05 新增）：把 3 参 repo.saveMemory 偏应用为 1 参 saveHook

import type { LLMMessage } from "../ports/llm.ts";
import { Memory } from "../domain/memory.ts";

export async function addToMemory(
  memory: Memory,
  messages: LLMMessage[],
  systemPrompt: string,
  saveHook?: (m: Memory) => Promise<void>,
): Promise<void> {
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

// ── stage 6 核心：把 repo.saveMemory(sessionId, agentName, memory) 包成 1-arg hook ─
type MemoryRepo = {
  saveMemory(
    sessionId: string,
    agentName: string,
    memory: Memory,
  ): Promise<void>;
};

export function makeMemorySaveHook(
  repo: MemoryRepo,
  sessionId: string,
  agentName: string,
): (memory: Memory) => Promise<void> {
  return (memory: Memory) => repo.saveMemory(sessionId, agentName, memory);
}
