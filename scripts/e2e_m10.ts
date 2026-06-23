// ★ marquee e2e_m10：把「SSE 断了要不要重带模型已生成内容」那个困惑变成能跑绿的断言。
//   首连读一条事件就 kill（模拟客户端断开）→ 带 latest_event_id 重连续读剩余 →
//   断言：① 续传到 done；② flow（=LLM）调用计数全程只有 1，重连没有重跑模型。
// 用法: pnpm e2e:m10
import { AgentService } from "../src/app/agentService.ts";
import { Session } from "../src/domain/models/session.ts";
import { InMemorySessionRepository } from "../src/domain/repositories/session.ts";
import type { Event } from "../src/domain/models/event.ts";

// TODO ★ stage marquee: 实现 runMarquee
//   1. repo = new InMemorySessionRepository(); session = new Session(); await repo.save(session)
//   2. state = { calls: 0 }; flow = { async *invoke(){ state.calls++; yield 两条 message; yield done } }
//   3. svc = new AgentService(repo, flow)
//   4. 首连：for await (e of svc.chat(session.id, 'hello')) { lastId = e.id; break }   // 读一条就断
//   5. 重连：for await (e of svc.chat(session.id, undefined, lastId)) resumed.push(e)  // 无 message
//   6. return { llmCalls: state.calls, resumed }
export async function runMarquee(): Promise<{
  llmCalls: number;
  resumed: Event[];
}> {
  throw new Error("TODO: marquee — 见上方步骤注释");
}

// ponytail: 只在直接运行时执行（被 import 时不触发 process.exit）
if (process.argv[1]?.endsWith("e2e_m10.ts")) {
  runMarquee()
    .then(({ llmCalls, resumed }) => {
      console.log(`首连断开后，重连续传到了 ${resumed.length} 条事件:`);
      console.log(resumed.map((e) => `  ${e.id} ${e.type} ${(e as any).message ?? ""}`).join("\n"));
      console.log(`\nflow(=LLM) 全程调用次数: ${llmCalls}`);
      if (llmCalls !== 1) throw new Error(`期望 LLM 只调一次，实际 ${llmCalls}`);
      if (resumed[resumed.length - 1]?.type !== "done")
        throw new Error("重连未续传到 done");
      console.log("✅ 重连只挂回游标，模型从未被重新调用");
      process.exit(0);
    })
    .catch((e) => {
      console.error(e);
      process.exit(1);
    });
}
