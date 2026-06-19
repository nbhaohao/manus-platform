// 已就位（AI 生成）
// Source: materials/mooc-manus/api/app/domain/external/search.py（SearchEngine Protocol）
//        + domain/models/search.py（SearchResults）
import type { ToolResult } from "../domain/models/toolResult.ts";

export interface SearchResultItem {
  title: string;
  url: string;
  snippet: string;
}

// 搜索引擎端口：search 工具依赖它，可注入不同实现（真实 API / 测试假实现）
export interface SearchEnginePort {
  invoke(query: string, dateRange?: string): Promise<ToolResult>;
}
