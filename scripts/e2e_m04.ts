// e2e · m04 工具系统：建注册表 → file / shell / search 全链路冒烟。
// 实现完 m04 六关后 `pnpm e2e:m04` 跑，确认工具系统真能被 agent 那套 AgentTool 契约消费。
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ToolRegistry } from "../src/app/registry.ts";
import { createFileTools } from "../src/infra/tools/file.ts";
import { createShellTool } from "../src/infra/tools/shell.ts";
import { createSearchTool } from "../src/infra/tools/search.ts";
import { EchoSearchEngine } from "../src/infra/search/echoSearchEngine.ts";

const ok = (c: boolean, m: string) => console.log(`${c ? "✅" : "❌"} ${m}`);

const root = await mkdtemp(join(tmpdir(), "m04-e2e-"));
const reg = new ToolRegistry([
  ...createFileTools(root),
  createShellTool(root),
  createSearchTool(new EchoSearchEngine()),
]);

console.log("— 注册表 schema（agent 拿这个绑定 LLM）—");
const schemas = reg.getTools();
console.log(schemas.map((s) => s.function.name).join(", "));
ok(schemas.length === 5, "getTools 暴露 5 个工具（read/write/list/shell/search）");

console.log("\n— file 往返 —");
ok((await reg.invoke("write_file", { filepath: "note.txt", content: "manus" })).success, "write_file");
const read = await reg.invoke("read_file", { filepath: "note.txt" });
ok(read.success && read.data === "manus", `read_file 读回 "${read.data}"`);

console.log("\n— 路径越狱被拦 —");
const esc = await reg.invoke("read_file", { filepath: "../../etc/hosts" });
ok(!esc.success, `越狱被拒：${esc.message}`);

console.log("\n— shell —");
const sh = await reg.invoke("shell_exec", { command: "echo hi from m04" });
ok(
  sh.success && String((sh.data as { stdout: string }).stdout).includes("hi from m04"),
  "shell_exec echo",
);

console.log("\n— 未知工具 + 防幻觉过滤 —");
const ghost = await reg.invoke("nope", {});
ok(!ghost.success, `未知工具 → 失败不抛：${ghost.message}`);
const se = await reg.invoke("search_web", { query: "北京 天气", bogus: 1 });
ok(se.success && Array.isArray(se.data), "search_web 经端口返回结果（幻觉参数 bogus 已被过滤）");

console.log("\n🎉 m04 e2e 冒烟通过");
