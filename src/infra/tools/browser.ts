// Source: materials/mooc-manus/api/app/domain/services/tools/browser.py
// 把 BrowserPort 能力包成 agent 可调用的 Tool 接口。
// stage 4: navigate / click / input 工具委派给 BrowserPort
// stage 5: checkDomain — 域名白名单校验（手写 URL 解析，不依赖额外库）
import type { Tool } from "../../domain/tool.ts";
import type { BrowserPort } from "../../ports/browser.ts";

export interface BrowserToolsOptions {
  allowedDomains?: string[]; // 空 = 不限制
}

/**
 * 检查 url 的 hostname 是否在白名单内。
 * 返回 null = 通过；返回字符串 = 拦截理由（含域名，供 ToolResult.message 用）。
 */
function checkDomain(url: string, allowedDomains: string[]): string | null {
  // TODO: stage 5
  // if (allowedDomains.length === 0) return null          ← 无白名单不限制
  // let host: string
  // try { host = new URL(url).hostname }
  // catch { return "URL 格式错误: " + url }
  // const ok = allowedDomains.some(d => host === d || host.endsWith("." + d))
  // if (!ok) return "域名 " + host + " 不在白名单内（允许: " + allowedDomains.join(", ") + "）"
  // return null
  return null; // stage 4 先不限制，stage 5 实现白名单
}

export function createBrowserTools(
  browser: BrowserPort,
  opts: BrowserToolsOptions = {},
): Tool[] {
  const domains = opts.allowedDomains ?? [];

  return [
    {
      name: "browser_navigate",
      description: "将浏览器导航至指定 URL，返回页面可交互元素列表。",
      parameters: {
        url: { type: "string", description: "完整 URL（含 https://）" },
      },
      required: ["url"],
      async execute(args) {
        const url = String(args.url ?? "");
        const err = checkDomain(url, domains);
        if (err) return { success: false, message: err };
        return await browser.navigate(url);
      },
    },

    {
      name: "browser_click",
      description:
        "点击页面中 index 对应的可交互元素（由 browser_navigate/browser_view 返回的 index）。",
      parameters: {
        index: {
          type: "integer",
          description: "元素索引（来自 interactive_elements 列表）",
        },
      },
      required: ["index"],
      async execute(args) {
        return await browser.click({ index: Number(args.index) });
      },
    },

    {
      name: "browser_input",
      description:
        "在 index 对应的输入框里输入文本，press_enter 控制是否回车提交。",
      parameters: {
        text: { type: "string", description: "输入内容" },
        press_enter: { type: "boolean", description: "输入后是否按回车" },
        index: { type: "integer", description: "（可选）目标输入元素的索引" },
      },
      required: ["text", "press_enter"],
      async execute(args) {
        return await browser.input({
          text: String(args.text),
          pressEnter: Boolean(args.press_enter),
          index: args.index !== undefined ? Number(args.index) : undefined,
        });
      },
    },

    {
      name: "browser_view",
      description: "查看当前页面的可交互元素列表，无需导航。",
      parameters: {},
      required: [],
      async execute() {
        // 已就位（AI 生成）
        return await browser.viewPage();
      },
    },

    {
      name: "browser_screenshot",
      description: "对当前页面截图，返回 base64 PNG。",
      parameters: {},
      required: [],
      async execute() {
        // 已就位（AI 生成）
        try {
          const buf = await browser.screenshot();
          return {
            success: true,
            message: "截图成功",
            data: { base64: buf.toString("base64") },
          };
        } catch (e) {
          return { success: false, message: "截图失败: " + String(e) };
        }
      },
    },
  ];
}
