// Source: materials/mooc-manus/api/app/domain/services/tools/base.py
//   —— BaseTool.get_tools / has_tool / invoke + _filter_parameters（防幻觉参数过滤）。
//   注册表对外实现 m03 已定的 AgentTool 契约，让 agent 把它当一个工具集消费。
import type { AgentTool } from "./agent/base.ts";
import type { LLMTool } from "../ports/llm.ts";
import type { ToolResult } from "../domain/models/toolResult.ts";
import { type Tool, toParam } from "../domain/tool.ts";

export class ToolRegistry implements AgentTool {
  readonly name = "registry";
  constructor(private tools: Tool[]) {}

  // ── stage 2 · schema 聚合 ──
  getTools(): LLMTool[] {
    // 把每个 tool 经 toParam 转成 LLMTool 列表（this.tools.map(toParam)）
    return this.tools.map(toParam);
  }

  hasTool(name: string): boolean {
    // this.tools 里是否存在 t.name === name
    return this.tools.some((t) => t.name === name);
  }

  // ── stage 3 · 按名分发 → 统一 ToolResult ──
  async invoke(
    name: string,
    args: Record<string, unknown>,
  ): Promise<ToolResult> {
    // 1. 按 name 找 tool；找不到 → return { success:false, message:`工具[${name}]未找到` }
    // 2. 防幻觉过滤：只保留 tool.parameters 声明过的键（LLM 可能塞多余参数）
    //    const allowed = new Set(Object.keys(tool.parameters)); 逐个筛 args
    // 3. try { return await tool.execute(filtered) }
    //    catch (e) { return { success:false, message:String(e) } }  // 工具报错不抛出，包成失败 ToolResult
    throw new Error("TODO: stage 3 — invoke 分发");
  }
}
