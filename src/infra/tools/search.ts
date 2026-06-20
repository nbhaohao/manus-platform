// Source: materials/mooc-manus/api/app/domain/services/tools/search.py
//   —— SearchTool 不自己实现搜索，而是包装注入的 SearchEngine 端口（依赖倒置）。
import type { Tool } from "../../domain/tool.ts";
import type { SearchEnginePort } from "../../ports/search.ts";

export function createSearchTool(engine: SearchEnginePort): Tool {
  return {
    name: "search_web",
    description:
      "全网搜索引擎工具。需要实时信息（突发新闻、天气）或事实核查时使用，返回网页摘要与链接。",
    parameters: {
      query: {
        type: "string",
        description:
          "搜索查询，提取核心关键词（3-5 个），别用整句自然语言问句。",
      },
      date_range: {
        type: "string",
        enum: [
          "all",
          "past_hour",
          "past_day",
          "past_week",
          "past_month",
          "past_year",
        ],
        description: "（可选）时间范围过滤，默认 all。",
      },
    },
    required: ["query"],
    async execute(args) {
      // 工具不自己搜索，委托给注入的 engine 端口：
      return engine.invoke(
        String(args.query ?? ""),
        args.date_range as string | undefined,
      );
    },
  };
}
