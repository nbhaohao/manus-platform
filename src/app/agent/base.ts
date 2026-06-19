// Source: materials/mooc-manus/api/app/domain/services/agents/base.py:BaseAgent
// m03 最小 ReAct Agent —— invoke 主循环 / _invoke_llm / 单工具限制 / 工具回填 / 事件流 / roll_back
// 精简：m03 无 DB（记忆走 m02 in-mem addToMemory，无 saveHook）、工具系统留到 m04（这里只声明 agent 消费工具的最小契约）

import { randomUUID } from "crypto";
import type {
  LLMMessage,
  LLMPort,
  LLMTool,
  LLMToolCall,
} from "../../ports/llm.ts";
import type { AgentConfig } from "../../domain/models/appConfig.ts";
import type { ToolResult } from "../../domain/models/toolResult.ts";
import {
  createEvent,
  type Event,
  type ToolEvent,
  type MessageEvent,
  type ErrorEvent,
} from "../../domain/models/event.ts";
import { Memory } from "../../domain/memory.ts";
import { addToMemory } from "../memory.ts";
import { parseJSON } from "../../infra/jsonParser.ts";

// 已就位（AI 生成）：m03 只需 agent 消费工具的最小契约；m04 建完整工具系统（domain/tool.ts：注册表/自描述 schema）
// 对标 base.py 用到的 BaseTool 成员：name / get_tools / has_tool / invoke
export interface AgentTool {
  readonly name: string;
  getTools(): LLMTool[];
  hasTool(name: string): boolean;
  invoke(name: string, args: Record<string, unknown>): Promise<ToolResult>;
}

export class BaseAgent {
  protected systemPrompt: string;
  protected format?: string;
  protected toolChoice?: string;

  constructor(
    protected llm: LLMPort,
    protected tools: AgentTool[],
    protected config: AgentConfig,
    systemPrompt = "",
    protected memory: Memory = new Memory(),
  ) {
    this.systemPrompt = systemPrompt;
  }

  // 已就位（AI 生成）：工具调度小helper，对标 base.py:_get_available_tools / _get_tool / _invoke_tool
  private getAvailableTools(): LLMTool[] {
    return this.tools.flatMap((t) => t.getTools());
  }

  private getTool(name: string): AgentTool {
    const tool = this.tools.find((t) => t.hasTool(name));
    if (!tool) throw new Error(`未知工具: ${name}`);
    return tool;
  }

  private async invokeTool(
    tool: AgentTool,
    name: string,
    args: Record<string, unknown>,
  ): Promise<ToolResult> {
    // 工具自身报错不抛出，包成失败的 ToolResult 让 LLM 自行处理（源码 _invoke_tool 还带重试，m03 先省略）
    try {
      return await tool.invoke(name, args);
    } catch (e) {
      return { success: false, message: String(e) };
    }
  }

  // ── stage 2/3 · _invoke_llm ───────────────────────────────────────────────
  protected async invokeLlm(
    messages: LLMMessage[],
    format?: string,
  ): Promise<LLMMessage> {
    // TODO: stage 2 —— 调用 LLM + 最大重试 + 空回复处理
    // 1. await addToMemory(this.memory, messages, this.systemPrompt)   // 首轮注入 system
    // 2. for (let r = 0; r < this.config.maxRetries; r++) {
    //      try {
    //        const resp = await this.llm.invoke(
    //          this.memory.getMessages(), this.getAvailableTools(), format, this.toolChoice)
    //        // 空回复(无 content 且无 tool_calls) → 注入「请继续」再 continue：
    //        //   await addToMemory(this.memory,
    //        //     [{role:'assistant',content:''},{role:'user',content:'AI 无响应内容，请继续。'}],
    //        //     this.systemPrompt); continue
    //        const filtered: LLMMessage = { role:'assistant', content: resp.content }
    //        if (resp.reasoning_content) filtered.reasoning_content = resp.reasoning_content
    //        if (resp.tool_calls?.length) filtered.tool_calls = resp.tool_calls
    //                                  // ↑ 本关原样保留全部；stage 3 会在此加「单工具限制」
    //        await addToMemory(this.memory, [filtered], this.systemPrompt)
    //        return filtered
    //      } catch (e) { lastErr = String(e); continue }
    //    }
    // 3. 重试耗尽 → throw new Error(`...已达最大重试次数(${this.config.maxRetries})...`)
    await addToMemory(this.memory, messages, this.systemPrompt);
    let lastErr: string | undefined;
    for (let i = 0; i < this.config.maxRetries; i++) {
      try {
        const resp = await this.llm.invoke(
          this.memory.getMessages(),
          this.getAvailableTools(),
          format,
          this.toolChoice,
        );
        if (!resp.content && !resp.tool_calls) {
          await addToMemory(
            this.memory,
            [
              {
                role: "assistant",
                content: "",
              },
              {
                role: "user",
                content: "AI 无响应内容，请继续。",
              },
            ],
            this.systemPrompt,
          );
          continue;
        }
        const filtered: LLMMessage = {
          role: "assistant",
          content: resp.content,
        };
        if (resp.reasoning_content) {
          filtered.reasoning_content = resp.reasoning_content;
        }
        if (resp.tool_calls?.length) {
          filtered.tool_calls = resp.tool_calls;
        }
        await addToMemory(this.memory, [filtered], this.systemPrompt);
        return filtered;
      } catch (e) {
        lastErr = String(e);
        continue;
      }
    }
    throw new Error(`...已达最大重试次数(${this.config.maxRetries})...`);
  }

  // ── stage 6 · roll_back ───────────────────────────────────────────────────
  async rollBack(askUserResponse = ""): Promise<void> {
    // TODO: stage 6 —— 状态修正，保证 memory 不残留「半执行」的 tool_calls
    // 1. const last = this.memory.getLastMessage()
    //    const toolCalls = last?.tool_calls as LLMToolCall[] | undefined
    //    if (!last || !toolCalls || toolCalls.length === 0) return   // 末条非 tool_calls → 不动
    // 2. const tc = toolCalls[0]
    //    if (tc.function?.name === 'message_ask_user')
    //      → this.memory.addMessage({ role:'tool', tool_call_id: tc.id, content: askUserResponse })
    //        （特判：不回滚，把用户答复回填成 tool 结果）
    //    else
    //      → this.memory.rollBack()   // 普通工具调用被中断，直接删这条
    throw new Error("TODO: stage 6");
  }

  // ── stage 1/4/5 · invoke 主循环 ───────────────────────────────────────────
  async *invoke(query: string, format?: string): AsyncGenerator<Event> {
    // TODO: stage 1 —— ReAct 主循环骨架（无 tool_calls 即终态 / 最大迭代）
    // 1. const fmt = format ?? this.format
    // 2. let message = await this.invokeLlm([{ role:'user', content: query }], fmt)
    // 3. let i = 0
    //    for (; i < this.config.maxIterations; i++) {
    //      const tcs = message.tool_calls as LLMToolCall[] | undefined
    //      if (!tcs || tcs.length === 0) break          // 终态：LLM 给了文本答案
    //      const toolMessages: LLMMessage[] = []
    //      // —— 本关(stage 1)循环体先留空 —— 工具执行 + 事件产出留到 stage 4/5（见各关卡页）
    //      message = await this.invokeLlm(toolMessages)   // 带工具结果再问，进入下一轮
    //    }
    // 4. 超过最大迭代且仍在调用工具 → yield createEvent('error', {...}) as ErrorEvent; return
    // 5. 终态：message.content != null
    //      → yield createEvent('message', { role:'assistant', message: message.content, attachments: [] }) as MessageEvent
    //    否则 → yield createEvent('error', { error:'Agent 未能生成有效回复内容' }) as ErrorEvent
    //
    // 提示：stage 1 只搭循环控制——循环体先留空（toolMessages=[] + 再次 invokeLlm），
    //       「终态」「最大迭代」两条断言即可变绿；工具执行/事件留到 stage 4/5。
    const fmt = format ?? this.format;
    let message = await this.invokeLlm([{ role: "user", content: query }], fmt);
    let i = 0;
    for (; i < this.config.maxIterations; i++) {
      const tcs = message.tool_calls as LLMToolCall[] | undefined;
      if (!tcs || tcs.length === 0) break; // 终态：LLM 给了文本答案
      const toolMessages: LLMMessage[] = [];
      // —— 本关(stage 1)循环体先留空 —— 工具执行 + 事件产出留到 stage 4/5（见各关卡页）
      message = await this.invokeLlm(toolMessages, fmt); // 带工具结果再问，进入下一轮
    }
    const remainingToolCalls = message.tool_calls as LLMToolCall[] | undefined;
    if (remainingToolCalls && remainingToolCalls.length > 0) {
      yield createEvent("error", {
        error: `已达最大次数(${this.config.maxIterations})，仍在调用工具`,
      }) as ErrorEvent;
      return;
    }
    if (message.content != null) {
      yield createEvent("message", {
        role: "assistant",
        message: message.content,
        attachments: [],
      }) as MessageEvent;
    } else {
      yield createEvent("error", {
        error: "Agent 未能生成有效回复内容",
      }) as ErrorEvent;
    }
  }
}
