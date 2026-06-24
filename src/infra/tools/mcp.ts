// Source: materials/mooc-manus/api/app/domain/services/tools/mcp.py（MCPClientManager）
// 本课简化：只 stdio 一种传输；core 对 McpSdk port 编程（测试注入 fake，免装真 SDK）。
//   5 关：connect(s1) / getAllTools(s2) / toTools(s3) / invoke(s4) / initialize+cleanup(s5)
//   命题：本地工具与远端 MCP 工具经前缀命名空间并入同一张表，对 agent/registry 透明。
import type { Tool } from "../../domain/tool.ts";
import type { LLMTool } from "../../ports/llm.ts";
import type { ToolResult } from "../../domain/models/toolResult.ts";
import type {
  McpSdk,
  McpClientLike,
  McpServerConfig,
  McpToolDecl,
} from "../../ports/mcp.ts";

// 已就位：本课固定的 client 标识 + 前缀规则（前缀是 s2 写进、s4 拆出的命名空间）
const CLIENT_INFO = { name: "manus", version: "1.0.0" };
export function prefixed(server: string, tool: string): string {
  return "mcp_" + server + "_" + tool;
}

export class McpClientManager {
  // server 名 → 已连接 client；server 名 → 该 server 的工具声明缓存
  private readonly clients = new Map<string, McpClientLike>();
  private readonly toolDecls = new Map<string, McpToolDecl[]>();
  private initialized = false;

  constructor(
    private readonly sdk: McpSdk,
    private readonly servers: Record<string, McpServerConfig>,
  ) {}

  // 已就位：只读——当前已连接的 server 名（供测试/调试观察缓存，不算关卡）
  get connectedServers(): string[] {
    return [...this.clients.keys()];
  }

  // ── Stage 1: 连接单个 server + 缓存（核心手写）──────────────────────────
  // TODO stage 1: 用 SDK 建 transport+client、握手、成功才入缓存
  //   1. transport = this.sdk.newStdioTransport({ command: config.command, args: config.args })
  //   2. client = this.sdk.newClient(CLIENT_INFO)
  //   3. await client.connect(transport)         // 拉起子进程 + initialize 握手
  //   4. this.clients.set(name, client)          // ★ 成功后才入缓存（失败不留坏连接）
  async connect(name: string, config: McpServerConfig): Promise<void> {
    const transport = this.sdk.newStdioTransport({
      command: config.command,
      args: config.args,
    });
    const client = this.sdk.newClient(CLIENT_INFO);
    await client.connect(transport);
    this.clients.set(name, client);
  }

  // ── Stage 2: 工具发现 → LLMTool[]（加 mcp_<server>_ 前缀命名空间）（核心手写）─
  async getAllTools(): Promise<LLMTool[]> {
    const out: LLMTool[] = [];
    for (const [server, client] of this.clients) {
      const { tools } = await client.listTools();
      this.toolDecls.set(server, tools); // 缓存声明，供 s3/s4 复用
      for (const t of tools)
        out.push({
          type: "function",
          function: {
            name: prefixed(server, t.name),
            description: "[" + server + "] " + (t.description ?? t.name),
            parameters: t.inputSchema,
          },
        });
    }
    return out;
  }

  // ── Stage 3: 适配成本课 Tool[]（execute 转调 manager.invoke）（核心手写）──────
  // TODO stage 3: 把缓存的工具声明包成实现 Tool 接口的适配器，并入 registry 用
  //   if (this.toolDecls.size === 0) await this.getAllTools()    // 确保已发现
  //   const out: Tool[] = []
  //   for (const [server, decls] of this.toolDecls) {
  //     for (const d of decls) {
  //       const name = prefixed(server, d.name)
  //       out.push({
  //         name,
  //         description: d.description ?? d.name,
  //         parameters: (d.inputSchema.properties ?? {}) as Tool["parameters"],
  //         required: d.inputSchema.required ?? [],
  //         execute: (args) => this.invoke(name, args),        // ★ 调用收敛进 manager
  //       })
  //     }
  //   }
  //   return out
  async toTools(): Promise<Tool[]> {
    if (this.toolDecls.size === 0) await this.getAllTools();
    const out: Tool[] = [];
    for (const [server, decls] of this.toolDecls) {
      for (const d of decls) {
        const name = prefixed(server, d.name);
        out.push({
          name,
          description: d.description ?? d.name,
          parameters: (d.inputSchema.properties ?? {}) as Tool["parameters"],
          required: d.inputSchema.required ?? [],
          execute: (args) => this.invoke(name, args), // ★ 调用收敛进 manager
        });
      }
    }
    return out;
  }

  // ── Stage 4: 调用——拆前缀路由 + callTool + 错误收敛为 ToolResult（核心手写）──
  // TODO stage 4: 把前缀名拆回 server+原名、路由调用、失败都收敛成 success:false
  //   1. 找前缀命中的 server：在 Object.keys(this.servers) 里找
  //      name.startsWith(prefixed(server, "")) 的那个；original = name.slice(prefixed(server,"").length)
  //      没命中 → return { success:false, message:"未找到工具 " + name }
  //   2. const client = this.clients.get(server)
  //      不存在 → return { success:false, message: server + " 未连接" }
  //   3. try {
  //        const res = await client.callTool({ name: original, arguments: args })
  //        const text = res.content.map(c => c.text ?? "").filter(Boolean).join("\n")
  //        return { success:true, message:"", data: text }
  //      } catch (e) { return { success:false, message: String(e) } }
  async invoke(
    name: string,
    args: Record<string, unknown>,
  ): Promise<ToolResult> {
    throw new Error("TODO: stage 4");
  }

  // ── Stage 5: 生命周期——initialize 幂等连全部 / cleanup 幂等清全部（核心手写）──
  // TODO stage 5: 两者都幂等；cleanup 某连接关闭失败不阻断其余
  //   initialize:
  //     if (this.initialized) return
  //     for (const [name, cfg] of Object.entries(this.servers)) {
  //       try { await this.connect(name, cfg) } catch { /* 记错并跳过该 server */ }
  //     }
  //     this.initialized = true
  //   cleanup:
  //     if (!this.initialized) return
  //     for (const client of this.clients.values()) {
  //       try { await client.close() } catch { /* 某个失败不阻断其余 */ }
  //     }
  //     this.clients.clear(); this.toolDecls.clear(); this.initialized = false
  async initialize(): Promise<void> {
    throw new Error("TODO: stage 5");
  }
  async cleanup(): Promise<void> {
    throw new Error("TODO: stage 5");
  }
}
