// Source: 本课设计（砍 VNC 决策）
// 替代 VNC：每次浏览器动作后调用 saveSnapshot，截图 + 当前 URL 落到 runsDir/{name}.png|.txt。
// 事后回看完整执行轨迹，不需要实时画面。
import { writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import type { PageLike } from "../../ports/browser.ts";

/**
 * 对当前页面截图并记录 URL，写到 runsDir/{name}.png 和 {name}.txt。
 */
export async function saveSnapshot(
  page: PageLike,
  runsDir: string,
  name: string,
): Promise<void> {
  await mkdir(runsDir, { recursive: true });
  const png = await page.screenshot({ type: "png" });
  await writeFile(join(runsDir, name + ".png"), png);
  const summary = "URL: " + page.url + "\n";
  await writeFile(join(runsDir, name + ".txt"), summary, "utf8");
}
