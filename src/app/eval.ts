// 本课设计（衔接 agent-eval）：把「跑一个任务 + 断言结果」固化成确定性回归。
//   每个 EvalCase 自带一段事件流（fixtures 里用脚本化假 flow 产出，不调真 LLM）+ 一个 check 断言。
//   runEval 把事件收集齐、逐条跑 check、汇总成报告——任一 case 内部炸了也要记成 fail 不中断其余。
import type { Event } from "../domain/models/event.ts";

export interface EvalCase {
  name: string;
  run(): AsyncGenerator<Event>; // 产出事件流（fixture 内部驱动假 flow）
  check(events: Event[]): string | null; // 返回 null=通过，字符串=失败原因
}

export interface EvalResult {
  name: string;
  ok: boolean;
  reason?: string;
}

export interface EvalReport {
  total: number;
  passed: number;
  failed: number;
  results: EvalResult[];
}

// ── Stage 4: 跑全部 case、收集事件、跑 check、汇总（核心手写）────────────────
// TODO stage 4: 逐个 case 跑成报告，单个炸了记 fail 不中断
//   results: EvalResult[] = []
//   for (const c of cases) {
//     try {
//       events = []; for await (const ev of c.run()) events.push(ev)   // 收集事件流
//       reason = c.check(events)                                       // null=过
//       results.push(reason === null ? {name:c.name, ok:true} : {name:c.name, ok:false, reason})
//     } catch (e) { results.push({name:c.name, ok:false, reason:String(e)}) }
//   }
//   passed = results.filter(r => r.ok).length
//   return { total: cases.length, passed, failed: cases.length - passed, results }
export async function runEval(cases: EvalCase[]): Promise<EvalReport> {
  throw new Error("TODO: stage 4 — runEval");
}
