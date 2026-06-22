// 交互式 agent CLI —— 敲 query，亲眼看 ReAct 循环跑。
// 把 m01~m05 的零件接成一个能玩的入口：
//   LLM 端口(m02) + ReAct 主循环(m03) + 工具系统(m04) + 跨轮记忆(m05 in-mem 版)
// 系统提示词锚定 materials/mooc-manus/.../prompts/react.py:REACT_SYSTEM_PROMPT，
//   裁掉 message_notify_user / message_ask_user（那些工具留到后续模块），只描述现有工具集。
//
// 用法：
//   pnpm agent              本机工具（file/shell 直接落本机 workspace/）
//   pnpm agent --sandbox    沙箱工具（m06：file/shell 进 Docker 容器，亲眼看命令进容器）
//                           需本机有 Docker；镜像默认 python:3.12-slim（SANDBOX_IMAGE 可改）
//   pnpm agent --plan       m08 plan-and-execute：PlannerReActFlow 先规划再逐步执行
//                           （本机工具；亲眼看 plan/step/done 事件流）
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
import type { AppConfig } from "./domain/models/appConfig.ts";

// m06 沙箱模式用到的零件
import { DockerodeRuntime } from "./infra/sandbox/dockerodeRuntime.ts";
import { withContainer } from "./infra/sandbox/docker.ts";
import { RuntimeSandbox } from "./infra/sandbox/runtimeSandbox.ts";
import { createSandboxShellTool } from "./infra/tools/sandboxShell.ts";
import { createSandboxFileTools } from "./infra/tools/sandboxFile.ts";

// m08 plan-and-execute 编排
import { PlannerReActFlow } from "./app/flows/plannerReact.ts";
import type { Event } from "./domain/models/event.ts";
// m09 异步任务双流
import { Task } from "./app/task.ts";
import { AgentTaskRunner } from "./app/agentTaskRunner.ts";

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
- read_file / write_file / list_files：读写文件。
- shell_exec：执行 shell 命令。
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

// 一段 REPL 会话：给定一个已装配好工具的 registry，跑交互循环。
async function runSession(
  config: AppConfig,
  registry: ToolRegistry,
  where: string,
) {
  const llm = new OpenAICompatLLM(config.llm);
  // 复用同一个 Memory 跨轮 → 你能亲眼看到「上一轮说过的内容」在下一轮还在
  const memory = new Memory();
  const agent = new BaseAgent(llm, [registry], config.agent, SYSTEM_PROMPT, memory);

  console.log(c.bold("\n  manus-platform · 交互式 Agent CLI"));
  console.log(c.dim("  ─────────────────────────────────────────"));
  console.log(`  模型    ${c.cyan(config.llm.modelName)}  @ ${config.llm.baseUrl}`);
  console.log(
    `  工具    ${registry.getTools().map((t) => t.function.name).join(", ")}`,
  );
  console.log(`  执行    ${where}`);
  if (!config.llm.apiKey) {
    console.log(c.yellow("  ⚠ 未配置 LLM_API_KEY —— 真正发起对话会失败。"));
    console.log(c.yellow("    复制 .env.example 为 .env 并填入 key（默认 DeepSeek）。"));
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

// m08：plan-and-execute REPL —— 跑 PlannerReActFlow，按事件类型分别上色打印。
async function runFlowSession(
  config: AppConfig,
  registry: ToolRegistry,
  where: string,
) {
  const llm = new OpenAICompatLLM(config.llm);

  console.log(c.bold("\n  manus-platform · Planner+ReAct Flow CLI"));
  console.log(c.dim("  ─────────────────────────────────────────"));
  console.log(`  模型    ${c.cyan(config.llm.modelName)}  @ ${config.llm.baseUrl}`);
  console.log(`  工具    ${registry.getTools().map((t) => t.function.name).join(", ")}`);
  console.log(`  执行    ${where}`);
  if (!config.llm.apiKey) {
    console.log(c.yellow("  ⚠ 未配置 LLM_API_KEY —— 真正发起对话会失败。"));
  }
  console.log(c.dim("  输入任务回车；先规划再逐步执行。exit / Ctrl-D 退出。\n"));

  const rl = createInterface({ input: stdin, output: stdout });
  while (true) {
    let query: string;
    try {
      query = (await rl.question(c.bold("> "))).trim();
    } catch {
      break;
    }
    if (!query) continue;
    if (query === "exit" || query === "quit") break;

    // 每个任务一个新 flow（独立 planner/react 记忆）
    const flow = new PlannerReActFlow(llm, config.agent, [registry]);
    try {
      for await (const ev of flow.invoke(query) as AsyncGenerator<Event>) {
        if (ev.type === "title") {
          console.log(c.bold(`\n  📋 ${ev.title}`));
        } else if (ev.type === "plan") {
          if (ev.status === "created") {
            console.log(c.cyan(`  计划 ${ev.plan.steps.length} 步：`));
            ev.plan.steps.forEach((s, i) =>
              console.log(c.dim(`    ${i + 1}. ${s.description}`)),
            );
          } else if (ev.status === "completed") {
            console.log(c.green("  ✓ 计划完成"));
          } else {
            console.log(c.dim("  ↻ 重规划剩余步骤"));
          }
        } else if (ev.type === "step") {
          if (ev.status === "started") {
            console.log(c.cyan(`  ▶ 执行：${truncate(ev.step.description, 80)}`));
          } else if (ev.status === "failed") {
            console.log(c.red(`    ✗ 步骤失败：${truncate(ev.step.error || "", 120)}`));
          }
        } else if (ev.type === "tool") {
          if (ev.status === "calling") {
            console.log(
              c.cyan(`    🔧 ${ev.functionName}`) +
                c.dim(`(${truncate(JSON.stringify(ev.functionArgs), 100)})`),
            );
          } else {
            console.log(`       ↳ ${fmtResult(ev.functionResult as ToolResult)}`);
          }
        } else if (ev.type === "message") {
          console.log(`\n  💬 ${ev.message}\n`);
        } else if (ev.type === "error") {
          console.log(c.red(`\n  ⚠ ${ev.error}\n`));
        } else if (ev.type === "done") {
          console.log(c.dim("  🏁 任务结束\n"));
        }
      }
    } catch (e) {
      console.log(c.red(`\n  ✗ 运行出错：${String(e)}\n`));
    }
  }
  rl.close();
  console.log(c.dim("\n  再见 👋\n"));
}

async function main() {
  const config = loadConfig();

  if (process.argv.includes("--task")) {
    // TODO stage 6: AgentTaskRunner 路径（双流解耦演示）
    // 1. Task.create() 创建任务
    // 2. 从 readline 读一条 query，put 进 task.inputStream
    // 3. new AgentTaskRunner(new PlannerReActFlow(...)).invoke(task)
    // 4. for await task.outputStream.getRange() 打印所有事件
    throw new Error("TODO: stage 6 -- --task 路径未实现");
  }

  if (process.argv.includes("--plan")) {
    // m08 plan-and-execute 模式：本机工具 + PlannerReActFlow
    const workspace = fileURLToPath(new URL("../workspace", import.meta.url));
    await mkdir(workspace, { recursive: true });
    const registry = new ToolRegistry([
      ...createFileTools(workspace),
      createShellTool(workspace),
      createSearchTool(new EchoSearchEngine()),
    ]);
    await runFlowSession(config, registry, `本机 workspace/  ${workspace}`);
    return;
  }

  if (process.argv.includes("--sandbox")) {
    // m06 沙箱模式：起一个 Docker 容器，file/shell 工具都进容器跑。
    // 容器生命周期交给 withContainer —— REPL 结束（exit）后 finally 必清，不留垃圾容器。
    const image = process.env.SANDBOX_IMAGE ?? "python:3.12-slim";
    const runtime = new DockerodeRuntime();
    console.log(
      c.yellow(`\n  🐳 沙箱模式：拉取/启动容器 ${image}（首次拉镜像稍慢）…`),
    );
    await withContainer(runtime, image, async (container) => {
      const sandbox = new RuntimeSandbox(runtime, container);
      const registry = new ToolRegistry([
        ...createSandboxFileTools(sandbox),
        createSandboxShellTool(sandbox),
        createSearchTool(new EchoSearchEngine()),
      ]);
      await runSession(config, registry, `🐳 容器 ${image}（${container.id.slice(0, 12)}）`);
    });
    console.log(c.dim("  容器已销毁。"));
    return;
  }

  // 本机模式：file/shell 落到本机 workspace/
  const workspace = fileURLToPath(new URL("../workspace", import.meta.url));
  await mkdir(workspace, { recursive: true });
  const registry = new ToolRegistry([
    ...createFileTools(workspace),
    createShellTool(workspace),
    createSearchTool(new EchoSearchEngine()),
  ]);
  await runSession(config, registry, `本机 workspace/  ${workspace}`);
}

main();
