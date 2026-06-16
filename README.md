# manus-platform

TS 复刻 [mooc-manus](../materials/mooc-manus/)（生产级通用 Agent 平台），去 UI、保留 agent 内核 + 全部后端基建。mini-manus 的工程化升级版。

> 课程宪法见 [`../COURSE_SPEC.md`](../COURSE_SPEC.md)。12 模块 ≈ 60–70 关。

## 技术栈

- TypeScript + pnpm + tsx + vitest
- **hono**（HTTP）+ SSE
- **drizzle** + Postgres（m05 起）
- **ioredis** + Redis Streams（m09 起）
- **playwright**（CDP）+ **dockerode**（沙箱容器，m06/m07 起）
- **@modelcontextprotocol/sdk**（MCP，m11）

## 分层（DDD-lite）

```
src/
  domain/   # 领域模型 + 仓储接口（✍️ 手写核心）
  app/      # 用例编排：agent 循环 / flow / registry（✍️ 手写核心）
  ports/    # 外部依赖接口（LLM / Sandbox / Browser / MessageQueue）
  infra/    # 端口实现 + 样板（🤖 AI 生成落盘）
tests/      # vitest，按 mXX 分文件，mock 注入不调真 LLM
scripts/    # e2e_mXX.ts —— 每模块收尾全链路冒烟（CLI 客户端）
```

## 运行

```bash
pnpm install
cp .env.example .env   # 填 LLM_API_KEY
pnpm verify            # 跑当前模块测试（第一个红的就是当前关）
```
