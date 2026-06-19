// 已就位（AI 生成）：SearchEnginePort 的占位实现。
//   m04 聚焦工具系统骨架，不接真实搜索 API——返回一条占位结果，后续模块可替换成真实引擎。
import type { SearchEnginePort, SearchResultItem } from "../../ports/search.ts";
import type { ToolResult } from "../../domain/models/toolResult.ts";

export class EchoSearchEngine implements SearchEnginePort {
  async invoke(query: string): Promise<ToolResult> {
    const items: SearchResultItem[] = [
      {
        title: `关于「${query}」的占位结果`,
        url: "https://example.com",
        snippet: "这是占位搜索引擎，接真实 API 后替换。",
      },
    ];
    return { success: true, message: "ok", data: items };
  }
}
