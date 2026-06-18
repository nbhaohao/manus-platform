// e2e_m03 —— 已就位（AI 生成）：m03 收尾手动集成测试（module_mastery_ritual）
// 跑法：pnpm e2e:m03   （完成 base.ts 6 关后再跑；之前会因 TODO 报错，属正常）
//
// 它不打 HTTP（agent 接 HTTP 在后续模块）：用 mock LLM + 假工具，端到端驱动一轮真实 ReAct——
//   用户问 → LLM 决定调 calculator → 执行工具 → 结果回填 → LLM 给出最终答案
// 断言：事件顺序、工具真被调用、记忆里留下完整的 tool 往返、最终文本答案正确。

import { BaseAgent, type AgentTool } from "../src/app/agent/base.ts";
import { Memory } from "../src/domain/memory.ts";
import { makeMockLLM } from "../src/ports/llm.ts";
import type { Event, ToolEvent, MessageEvent } from "../src/domain/models/event.ts";
import type { AgentConfig } from "../src/domain/models/appConfig.ts";

function assert(cond: boolean, msg: string): void {
  if (!cond) throw new Error("FAIL: " + msg);
  console.log("  ✅ " + msg);
}

// 一个会真的算加法的假工具
const calculator: AgentTool = {
  name: "calculator",
  getTools: () => [
    { type: "function", function: { name: "add", description: "两数相加", parameters: {} } },
  ],
  hasTool: (n) => n === "add",
  invoke: async (_n, args) => {
    const sum = Number(args.a) + Number(args.b);
    return { success: true, message: String(sum), data: { sum } };
  },
};

async function main(): Promise<void> {
  console.log("▶ e2e_m03 · 最小 ReAct Agent 端到端\n");

  const cfg: AgentConfig = { maxIterations: 5, maxRetries: 3, maxSearchResults: 5 };
  const mem = new Memory();

  // mock LLM 脚本：第一轮决定调 add(2,3)，拿到结果后第二轮给出最终答案
  const llm = makeMockLLM([
    {
      role: "assistant",
      content: null,
      tool_calls: [
        { id: "c1", type: "function", function: { name: "add", arguments: '{"a":2,"b":3}' } },
      ],
    },
    { role: "assistant", content: "2 加 3 等于 5。" },
  ]);

  const agent = new BaseAgent(llm, [calculator], cfg, "你是一个会用工具的助手。", mem);

  const events: Event[] = [];
  for await (const e of agent.invoke("帮我算 2 + 3")) events.push(e);

  // —— 断言：事件流 ——
  const tools = events.filter((e) => e.type === "tool") as ToolEvent[];
  assert(tools.length === 2, "产出 2 条 ToolEvent（calling + called）");
  assert(tools[0].status === "calling" && tools[1].status === "called", "ToolEvent 顺序 calling → called");
  assert(tools[1].functionResult !== undefined, "called 事件携带 functionResult");

  const msg = events[events.length - 1] as MessageEvent;
  assert(msg.type === "message" && msg.message.includes("5"), "最终 MessageEvent 给出正确答案");

  // —— 断言：记忆里留下完整的 ReAct 往返 ——
  const roles = mem.getMessages().map((m) => m.role);
  assert(roles[0] === "system", "记忆首条是 system prompt");
  assert(roles.includes("tool"), "记忆里回填了 role:tool 工具结果");

  console.log("\n✅✅ e2e_m03 PASS — ReAct 闭环跑通\n");
}

main().catch((e) => {
  console.error("\n❌ " + String(e?.message ?? e) + "\n");
  process.exit(1);
});
