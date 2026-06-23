// e2e_m09: 验证「AgentTaskRunner 跑完后事件留在 output_stream，无需 SSE 消费方」
// 用法: pnpm e2e:m09
import { Task } from "../src/app/task.ts";
import { AgentTaskRunner } from "../src/app/agentTaskRunner.ts";
import type { Event } from "../src/domain/models/event.ts";

// TODO stage 6: 实现 runE2e
// 1. Task.create() 建任务
// 2. task.inputStream.put(JSON.stringify({ type:'message', role:'user', message:'hello', created_at:'' }))
// 3. 创建 mock flow（直接 yield 几个事件，不调真 LLM）
// 4. new AgentTaskRunner(mockFlow).invoke(task)
// 5. 断言 task.outputStream.size() > 0，打印所有事件验证有 done
export async function runE2e(): Promise<void> {
  const task = Task.create();
  task.inputStream.put(
    JSON.stringify({
      type: "message",
      role: "user",
      message: "hello",
      created_at: "",
    }),
  );
  const mockFlow = {
    async *invoke(_msg: string) {
      yield {
        type: "message",
        role: "assistant",
        message: "world",
        created_at: "",
      };
      yield { type: "done", role: "assistant", message: "", created_at: "" };
    },
  };
  await new AgentTaskRunner(mockFlow).invoke(task);
  const size = await task.outputStream.size();
  console.log(`output_stream size: ${size}`);
  if (size === 0) throw new Error("output_stream should not be empty");
  const events: Event[] = [];
  for await (const event of task.outputStream.getRange()) {
    events.push(JSON.parse(event[1]));
  }
  console.log("events:", events);
}

// ponytail: 只在直接运行时执行（被 import 时不触发 process.exit）
if (process.argv[1]?.endsWith("e2e_m09.ts")) {
  runE2e()
    .then(() => process.exit(0))
    .catch((e) => {
      console.error(e);
      process.exit(1);
    });
}
