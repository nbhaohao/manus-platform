// Source: materials/mooc-manus/api/app/domain/services/tools/base.py
//   —— Python 用 @tool 装饰器把 name/description/parameters/required 拼成 _tool_schema；
//      TS 没有方法级装饰器内省，改成「显式的 Tool 对象 + toParam() 构建 schema」。
import type { LLMTool } from "../ports/llm.ts";
import type { ToolResult } from "./models/toolResult.ts";

// 单个参数的 JSON schema 声明（OpenAI function-calling 的 properties 项）
export interface ToolParam {
  type: string;
  description?: string;
  enum?: string[];
  [key: string]: unknown;
}

// 单个自描述工具 = 一个可被 LLM 调用的函数：自带 schema + 执行体
export interface Tool {
  name: string;
  description: string;
  parameters: Record<string, ToolParam>; // 参数名 → schema 声明
  required: string[];
  execute(args: Record<string, unknown>): Promise<ToolResult>;
}

// 把 Tool 转成 OpenAI function schema（对标 base.py @tool 拼出的 tool_schema）
export function toParam(tool: Tool): LLMTool {
  return {
    type: "function",
    function: {
      name: tool.name,
      description: tool.description,
      parameters: {
        type: "object",
        properties: tool.parameters,
        required: tool.required,
      },
    },
  };
  // 1. 返回 { type:"function", function:{ name, description, parameters } }
  // 2. 其中 parameters = { type:"object", properties: tool.parameters, required: tool.required }
  //    这正是 base.py 里 @tool 装饰器拼出来的 tool_schema 的 TS 版
}
