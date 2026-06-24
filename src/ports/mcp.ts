// 已就位（AI 生成）
// Source: materials/mooc-manus/api/app/domain/services/tools/mcp.py（MCPClientManager 依赖的 mcp SDK）
// 把 @modelcontextprotocol/sdk 的能力收成本课的 port（duck-typed）：核心逻辑对这些接口编程，
// 测试注入假实现即可——真实 SDK 由 infra 适配器实现。同 m07 对 Playwright 的处理（ports/browser.ts）。
// ⚠️ 本课红测试用 tests/m11.test.ts 里的 fakeSdk，不需要装 @modelcontextprotocol/sdk。

// 拉起一个 stdio MCP server 的配置（对应 config.yaml 的 mcpServers 项）
export interface McpServerConfig {
  command: string; // 如 "npx"
  args: string[]; // 如 ["-y", "@modelcontextprotocol/server-filesystem", "/tmp"]
}

// server 自报的单个工具声明（对应 SDK list_tools 返回项）
export interface McpToolDecl {
  name: string;
  description?: string;
  inputSchema: { properties?: Record<string, unknown>; required?: string[] } & Record<
    string,
    unknown
  >; // JSON schema
}

// stdio 传输句柄——core 只透传给 client.connect，不解析内部
export interface McpTransportLike {}

// 一个 MCP 客户端会话（对应 SDK 的 Client）
export interface McpClientLike {
  connect(transport: McpTransportLike): Promise<void>;
  listTools(): Promise<{ tools: McpToolDecl[] }>;
  callTool(args: {
    name: string;
    arguments: Record<string, unknown>;
  }): Promise<{ content: Array<{ type: string; text?: string }> }>;
  close(): Promise<void>;
}

// SDK 工厂：core 用它造 transport + client。
// 真实实现（连真 server 时再装 SDK）：
//   newStdioTransport: (o) => new StdioClientTransport(o)
//   newClient:         (i) => new Client(i, { capabilities: {} })
export interface McpSdk {
  newStdioTransport(opts: { command: string; args: string[] }): McpTransportLike;
  newClient(info: { name: string; version: string }): McpClientLike;
}
