// Source: materials/mooc-manus/api/app/domain/services/agent_task_runner.py
// m09 简化版：无 DB/session/文件同步，只做 MQ 双流桥接
import type { TaskPort } from "../ports/task.ts";
import type { PlannerReActFlow } from "./flows/plannerReact.ts";

export class AgentTaskRunner {
  constructor(private readonly flow: Pick<PlannerReActFlow, "invoke">) {}

  // TODO stage 4: input_stream → flow.invoke → output_stream
  // 1. 若 task.inputStream.isEmpty() 直接返回
  // 2. task.inputStream.pop() 取出消息 JSON 字符串
  // 3. 解析 JSON 取出 message 字段（消息文本）
  // 4. for await (const event of this.flow.invoke(message))
  // 5.   task.outputStream.put(JSON.stringify(event))
  async invoke(task: TaskPort): Promise<void> {
    if (await task.inputStream.isEmpty()) return;
    const [, msgStr] = await task.inputStream.pop();
    if (!msgStr) return;
    const { message } = JSON.parse(msgStr);
    for await (const event of this.flow.invoke(message)) {
      await task.outputStream.put(JSON.stringify(event));
    }
  }
}
