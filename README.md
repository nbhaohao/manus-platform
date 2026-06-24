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

## 一键起全栈（m12 capstone）

```bash
docker compose up         # redis + postgres + sandbox + api，依赖就绪后才起 api
# 仅冒烟核心组件（不依赖真服务，确定性）：
pnpm e2e:m12              # 文件存储往返 + 健康聚合 + 示例任务评估
```

需要的环境变量：`LLM_API_KEY`（必填）、`LLM_BASE_URL` / `LLM_MODEL`（可选）、`REDIS_HOST` / `DATABASE_URL`（compose 已注入）。

### 扩展工具

<!-- TODO: 补「怎么加一个本地工具 / 接一个 MCP server」的两三步说明（参照 m04 ToolRegistry / m11 McpClientManager） -->

### 已知限制

- 砍掉了 mooc-manus 的 VNC / A2A（COURSE_SPEC 既定裁剪）。
- 文件存储元数据用内存 Map，未接 DB / 对象存储（m12-s1 有意简化，端口已留）。
<!-- TODO: 补充你实现中其余的简化点，给接手人避坑 -->

## 验收清单（capstone 交付前逐条过）

- [ ] `pnpm test` 全模块测试绿（m01–m12）
- [ ] `pnpm e2e:m12` 冒烟链路绿（存储 / 健康 / 评估三段）
- [ ] `docker compose up` 能拉起四件套，api 等依赖 healthy 后才启动
- [ ] README 的 clone 即跑 / key 配置 / 扩展工具 / 已知限制四问都答清
- [ ] 出口口试：能讲清文件存储为何抽端口、健康聚合为何永不抛、compose 就绪依赖、评估为何要确定性
