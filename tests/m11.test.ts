// m11 · MCP 集成（工具池统一分发）
// pnpm verify  →  vitest run tests/m11.test.ts
// pnpm v "stage N"  →  只跑当前关
import { describe, it, expect } from "vitest";
import { McpClientManager } from "../src/infra/tools/mcp.ts";
import { ToolRegistry } from "../src/app/registry.ts";
import type { McpSdk, McpClientLike, McpToolDecl } from "../src/ports/mcp.ts";

// ── 测试替身：fakeSdk（免装真 @modelcontextprotocol/sdk）─────────────────────
// 每个 client 都返回同一份 tools；记录 connect/close 次数与 callTool 入参。
function fakeSdk(opts: { tools: McpToolDecl[]; throwOnCall?: boolean }) {
  const log = { connects: 0, closes: 0, calls: [] as Array<{ name: string; arguments: Record<string, unknown> }> };
  const sdk: McpSdk = {
    newStdioTransport(o) {
      return { o };
    },
    newClient(_info): McpClientLike {
      return {
        async connect() {
          log.connects++;
        },
        async listTools() {
          return { tools: opts.tools };
        },
        async callTool(a) {
          log.calls.push(a);
          if (opts.throwOnCall) throw new Error("boom");
          return { content: [{ type: "text", text: "RESULT:" + a.name }] };
        },
        async close() {
          log.closes++;
        },
      };
    },
  };
  return { sdk, log };
}

const cfg = { command: "x", args: [] as string[] };
const readTool: McpToolDecl = {
  name: "read",
  description: "读文件",
  inputSchema: { type: "object", properties: { path: { type: "string" } }, required: ["path"] },
};

describe("stage 1: connect 建连接 + 缓存", () => {
  it("connect 后该 server 已连接并入缓存（握手调用一次）", async () => {
    const { sdk, log } = fakeSdk({ tools: [] });
    const m = new McpClientManager(sdk, { fs: cfg });
    await m.connect("fs", cfg);
    expect(log.connects).toBe(1);
    expect(m.connectedServers).toEqual(["fs"]);
  });
});

describe("stage 2: getAllTools 工具发现 + 前缀命名空间", () => {
  it("两 server 同名工具加前缀后不冲突，schema 形状正确", async () => {
    const { sdk } = fakeSdk({ tools: [readTool] });
    const m = new McpClientManager(sdk, { fs: cfg, web: cfg });
    await m.connect("fs", cfg);
    await m.connect("web", cfg);
    const tools = await m.getAllTools();
    expect(tools.map((t) => t.function.name).sort()).toEqual(["mcp_fs_read", "mcp_web_read"]);
    expect(tools[0].type).toBe("function");
    expect(tools[0].function.parameters).toMatchObject({ properties: { path: { type: "string" } } });
  });
});

describe("stage 3: toTools 适配为本课 Tool 并入 registry", () => {
  it("Tool 名带前缀、parameters/required 取自 inputSchema、可并入 ToolRegistry", async () => {
    const { sdk } = fakeSdk({ tools: [readTool] });
    const m = new McpClientManager(sdk, { fs: cfg });
    await m.connect("fs", cfg);
    const tools = await m.toTools();
    expect(tools.map((t) => t.name)).toEqual(["mcp_fs_read"]);
    expect(tools[0].required).toEqual(["path"]);
    expect(tools[0].parameters).toMatchObject({ path: { type: "string" } });
    const reg = new ToolRegistry(tools);
    expect(reg.hasTool("mcp_fs_read")).toBe(true);
    expect(reg.getTools()[0].function.name).toBe("mcp_fs_read");
  });
});

describe("stage 4: invoke 拆前缀路由 + 错误收敛", () => {
  it("成功：拆前缀路由到原工具名，返回文本 data", async () => {
    const { sdk, log } = fakeSdk({ tools: [readTool] });
    const m = new McpClientManager(sdk, { fs: cfg });
    await m.connect("fs", cfg);
    const r = await m.invoke("mcp_fs_read", { path: "/a" });
    expect(r.success).toBe(true);
    expect(r.data).toContain("RESULT:read");
    expect(log.calls[0]).toEqual({ name: "read", arguments: { path: "/a" } });
  });
  it("未知前缀 / 未连接 / callTool 抛错 → 都 success:false 且不抛异常", async () => {
    const { sdk } = fakeSdk({ tools: [readTool], throwOnCall: true });
    const m = new McpClientManager(sdk, { fs: cfg });
    expect((await m.invoke("nope_x", {})).success).toBe(false); // 拆不出前缀
    expect((await m.invoke("mcp_fs_read", {})).success).toBe(false); // 已配置未连接
    await m.connect("fs", cfg);
    expect((await m.invoke("mcp_fs_read", {})).success).toBe(false); // callTool 抛错被收敛
  });
});

describe("stage 5: 生命周期 initialize/cleanup 幂等", () => {
  it("initialize 连好所有配置的 server，调两次只连一次量", async () => {
    const { sdk, log } = fakeSdk({ tools: [] });
    const m = new McpClientManager(sdk, { fs: cfg, web: cfg });
    await m.initialize();
    expect(m.connectedServers.sort()).toEqual(["fs", "web"]);
    expect(log.connects).toBe(2);
    await m.initialize();
    expect(log.connects).toBe(2); // 幂等
  });
  it("cleanup 关闭所有连接 + 清空缓存，且幂等", async () => {
    const { sdk, log } = fakeSdk({ tools: [] });
    const m = new McpClientManager(sdk, { fs: cfg });
    await m.initialize();
    await m.cleanup();
    expect(log.closes).toBe(1);
    expect(m.connectedServers).toEqual([]);
    await m.cleanup();
    expect(log.closes).toBe(1); // 幂等：未初始化不重复关
  });
});
