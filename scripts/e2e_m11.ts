// e2e_m11：MCP 工具池统一分发的烟囱测试（用 fakeSdk，不连真 server / 不需装 SDK）。
//   initialize → getAllTools → toTools 并入 ToolRegistry → 经 registry.invoke 调到 MCP 工具 → cleanup
//   断言：agent 经统一的 registry 调 "mcp_fs_read"，调用透明路由到 MCP（registry 不含任何 MCP 特判）。
// 用法: pnpm e2e:m11
import { McpClientManager } from "../src/infra/tools/mcp.ts";
import { ToolRegistry } from "../src/app/registry.ts";
import type { McpSdk, McpClientLike, McpToolDecl } from "../src/ports/mcp.ts";

function fakeSdk(tools: McpToolDecl[]) {
  const log = { connects: 0, closes: 0 };
  const sdk: McpSdk = {
    newStdioTransport: (o) => ({ o }),
    newClient: (): McpClientLike => ({
      async connect() {
        log.connects++;
      },
      async listTools() {
        return { tools };
      },
      async callTool(a) {
        return { content: [{ type: "text", text: "读到了 " + (a.arguments.path ?? "?") }] };
      },
      async close() {
        log.closes++;
      },
    }),
  };
  return { sdk, log };
}

export async function runSmoke(): Promise<{ toolNames: string[]; viaRegistry: string; connects: number; closes: number }> {
  const tools: McpToolDecl[] = [
    { name: "read", description: "读文件", inputSchema: { type: "object", properties: { path: { type: "string" } }, required: ["path"] } },
  ];
  const { sdk, log } = fakeSdk(tools);
  const mgr = new McpClientManager(sdk, { fs: { command: "npx", args: ["-y", "server-filesystem", "/tmp"] } });

  await mgr.initialize();
  const llmTools = await mgr.getAllTools();
  const registry = new ToolRegistry(await mgr.toTools()); // MCP 工具与本地工具同一张表
  const res = await registry.invoke("mcp_fs_read", { path: "/etc/hosts" }); // agent 视角：只认 registry
  await mgr.cleanup();

  return {
    toolNames: llmTools.map((t) => t.function.name),
    viaRegistry: String(res.data ?? res.message),
    connects: log.connects,
    closes: log.closes,
  };
}

if (process.argv[1]?.endsWith("e2e_m11.ts")) {
  runSmoke()
    .then((r) => {
      console.log("发现的 MCP 工具（带前缀）:", r.toolNames.join(", "));
      console.log("经 ToolRegistry 统一分发调用 mcp_fs_read →", r.viaRegistry);
      console.log(`连接子进程 ${r.connects} 个，cleanup 关闭 ${r.closes} 个`);
      if (r.toolNames[0] !== "mcp_fs_read") throw new Error("工具未加前缀命名空间");
      if (!r.viaRegistry.includes("读到了")) throw new Error("registry 未透明路由到 MCP 工具");
      if (r.connects !== 1 || r.closes !== 1) throw new Error("生命周期未对称启停");
      console.log("✅ 本地与 MCP 工具经前缀并入同一 registry，调用对 agent 透明，启停对称");
      process.exit(0);
    })
    .catch((e) => {
      console.error(e);
      process.exit(1);
    });
}
