// 交互式 agent CLI —— 敲 query，亲眼看 ReAct 循环跑。
// 把 m01~m05 的零件接成一个能玩的入口：
//   LLM 端口(m02) + ReAct 主循环(m03) + 工具系统(m04) + 跨轮记忆(m05 in-mem 版)
// 系统提示词锚定 materials/mooc-manus/.../prompts/react.py:REACT_SYSTEM_PROMPT，
//   裁掉 message_notify_user / message_ask_user（那些工具留到后续模块），只描述现有工具集。
//
// 用法：  pnpm agent            （需要 .env 里配 LLM_API_KEY，默认打 DeepSeek）
// 退出：  exit / quit / Ctrl-D
import { createInterface } from "node:readline/promises";
import { mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { stdin, stdout } from "node:process";

import { loadConfig } from "./infra/config.ts";
import { OpenAICompatLLM } from "./infra/llm/openaiCompat.ts";
import { ToolRegistry } from "./app/registry.ts";
import { createFileTools } from "./infra/tools/file.ts";
import { createShellTool } from "./infra/tools/shell.ts";
import { createSearchTool } from "./infra/tools/search.ts";
import { EchoSearchEngine } from "./infra/search/echoSearchEngine.ts";
import { BaseAgent } from "./app/agent/base.ts";
import { Memory } from "./domain/memory.ts";
import type { ToolResult } from "./domain/models/toolResult.ts";

// ── 极简 ANSI 上色（不引依赖）──────────────────────────────────────────────
const c = {
  dim: (s: string) => `\x1b[2m${s}\x1b[0m`,
  green: (s: string) => `\x1b[32m${s}\x1b[0m`,
  red: (s: string) => `\x1b[31m${s}\x1b[0m`,
  cyan: (s: string) => `\x1b[36m${s}\x1b[0m`,
  yellow: (s: string) => `\x1b[33m${s}\x1b[0m`,
  bold: (s: string) => `\x1b[1m${s}\x1b[0m`,
};

const SYSTEM_PROMPT = `你是一个任务执行智能体（Agent），按以下步骤完成任务：
1. 分析需求：理解用户最新消息和上一步的执行结果。
2. 选择工具：每轮原则上只选一个工具调用，用工具去「做」而不是告诉用户「怎么做」。
3. 循环迭代：拿到工具结果后继续，直到任务完成。
4. 提交结果：完成后用一句自然语言把最终结果回复用户（此时不要再调用工具）。

可用工具：
- read_file / write_file / list_files：在工作区内读写文件（越权路径会被拒绝）。
- shell_exec：在工作区内执行 shell 命令。
- search_web：检索（当前为 echo 占位引擎，仅回显查询）。

必须使用用户消息所用的语言来回复。`;

function truncate(s: string, n = 200): string {
  const flat = s.replace(/\s+/g, " ").trim();
  return flat.length > n ? flat.slice(0, n) + "…" : flat;
}

function fmtResult(r: ToolResult): string {
  if (!r.success) return c.red(`✗ ${truncate(r.message || "失败")}`);
  if (r.data === undefined) return c.green(`✓ ${truncate(r.message || "ok")}`);
  const data = typeof r.data === "string" ? r.data : JSON.stringify(r.data);
  return c.green(`✓ ${truncate(data)}`);
}

async function main() {
  const config = loadConfig();

  // 工作区：所有 file/shell 操作锁在这个目录里，跑完可以自己进去翻
  const workspace = fileURLToPath(new URL("../workspace", import.meta.url));
  await mkdir(workspace, { recursive: true });

  const llm = new OpenAICompatLLM(config.llm);
  const registry = new ToolRegistry([
    ...createFileTools(workspace),
    createShellTool(workspace),
    createSearchTool(new EchoSearchEngine()),
  ]);

  // 复用同一个 Memory 跨轮 → 你能亲眼看到「上一轮说过的内容」在下一轮还在
  const memory = new Memory();
  const agent = new BaseAgent(
    llm,
    [registry],
    config.agent,
    SYSTEM_PROMPT,
    memory,
  );

  // ── 开场横幅 ──────────────────────────────────────────────────────────
  console.log(c.bold("\n  manus-platform · 交互式 Agent CLI"));
  console.log(c.dim("  ─────────────────────────────────────────"));
  console.log(
    `  模型    ${c.cyan(config.llm.modelName)}  @ ${config.llm.baseUrl}`,
  );
  console.log(
    `  工具    ${registry
      .getTools()
      .map((t) => t.function.name)
      .join(", ")}`,
  );
  console.log(`  工作区  ${workspace}`);
  if (!config.llm.apiKey) {
    console.log(c.yellow("  ⚠ 未配置 LLM_API_KEY —— 真正发起对话会失败。"));
    console.log(
      c.yellow("    复制 .env.example 为 .env 并填入 key（默认 DeepSeek）。"),
    );
  }
  console.log(c.dim("  输入 query 回车；exit / Ctrl-D 退出。记忆跨轮保留。\n"));

  const rl = createInterface({ input: stdin, output: stdout });

  while (true) {
    let query: string;
    try {
      query = (await rl.question(c.bold("> "))).trim();
    } catch {
      break; // Ctrl-D
    }
    if (!query) continue;
    if (query === "exit" || query === "quit") break;

    try {
      for await (const ev of agent.invoke(query)) {
        if (ev.type === "tool") {
          if (ev.status === "calling") {
            console.log(
              c.cyan(`  🔧 ${ev.functionName}`) +
                c.dim(`(${truncate(JSON.stringify(ev.functionArgs), 120)})`),
            );
          } else {
            console.log(`     ↳ ${fmtResult(ev.functionResult as ToolResult)}`);
          }
        } else if (ev.type === "message") {
          console.log(`\n  💬 ${ev.message}\n`);
        } else if (ev.type === "error") {
          console.log(c.red(`\n  ⚠ ${ev.error}\n`));
        }
      }
    } catch (e) {
      // 未知工具 / LLM 报错等：打印后保持 REPL 存活
      console.log(c.red(`\n  ✗ 运行出错：${String(e)}\n`));
    }
  }

  rl.close();
  console.log(c.dim("\n  再见 👋\n"));
}

main();
