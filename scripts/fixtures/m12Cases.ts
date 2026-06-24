// 已就位（AI 生成）：3 个固化的示例任务集（确定性 fixtures，不调真 LLM）。
//   每个 case 用脚本化的假 flow 产出一段事件流，再用 check 做确定性断言。
//   s4 的 runEval 消费这批 case；s5 的 capstone smoke 也用它当回归基线。
import type { Event } from "../../src/domain/models/event.ts";
import { createEvent } from "../../src/domain/models/event.ts";
import type { EvalCase } from "../../src/app/eval.ts";

// 把一串脚本化事件包成 async generator（模拟 flow.invoke 的产出）
async function* scripted(events: Event[]): AsyncGenerator<Event> {
  for (const ev of events) yield ev;
}

export const m12Cases: EvalCase[] = [
  {
    // 任务①：问答类——assistant 回了消息并正常收尾
    name: "qa-greeting",
    run: () =>
      scripted([
        createEvent("message", { role: "assistant", message: "你好，我能帮你什么？", attachments: [] }),
        createEvent("done", {}),
      ]),
    check: (events) => {
      const hasMsg = events.some((e) => e.type === "message");
      const ended = events.at(-1)?.type === "done";
      if (!hasMsg) return "缺少 assistant 消息事件";
      if (!ended) return "未以 done 收尾";
      return null;
    },
  },
  {
    // 任务②：工具调用类——调了一次工具且拿到 called 状态
    name: "tool-call-once",
    run: () =>
      scripted([
        createEvent("tool", { toolCallId: "t1", toolName: "registry", functionName: "shell", functionArgs: { cmd: "ls" }, status: "calling" }),
        createEvent("tool", { toolCallId: "t1", toolName: "registry", functionName: "shell", functionArgs: { cmd: "ls" }, functionResult: "ok", status: "called" }),
        createEvent("done", {}),
      ]),
    check: (events) => {
      const called = events.filter((e) => e.type === "tool" && (e as { status: string }).status === "called");
      if (called.length !== 1) return "期望恰好 1 次工具 called，实际 " + called.length;
      return null;
    },
  },
  {
    // 任务③：规划类——产出了 plan 事件再收尾
    name: "plan-then-done",
    run: () =>
      scripted([
        createEvent("plan", { plan: { id: "p1", title: "t", goal: "g", steps: [] }, status: "created" }),
        createEvent("done", {}),
      ]),
    check: (events) => {
      if (!events.some((e) => e.type === "plan")) return "缺少 plan 事件";
      return null;
    },
  },
];
