// Source: COURSE_SPEC m06 关1 —— sandbox/ 整体动机（演示本地工具的越狱面）
// m04 的 file 工具做了路径牢笼（resolveInRoot），但 shell 工具没有：
// shell_exec 直接 child_process.exec 任意命令，能 `cat /etc/passwd`、能读 workspace 之外的宿主文件。
// 这一关用一个探针函数把这个隔离缺口「坐实」——这就是「为什么需要真容器沙箱」的动机。
import type { Tool } from "../domain/tool.ts";

export interface EscapeReport {
  escaped: boolean; // 是否成功读到 workspace 之外的宿主内容
  evidence: string; // 读到的内容片段（证据，截断）
}

// 用 m04 的本地 shell 工具尝试读取一个 workspace 之外的宿主文件，
// 证明本地 shell 没有文件系统隔离 → 必须把命令关进容器。
export async function probeShellEscape(
  localShell: Tool,
  hostPath: string,
): Promise<EscapeReport> {
  const res = await localShell.execute({ command: "cat " + hostPath });
  const out = String((res.data as { stdout?: string })?.stdout ?? "");
  const escaped = res.success && out.trim().length > 0;
  return { escaped, evidence: out.slice(0, 80) };
  // TODO: stage 1
  // 1. 用本地 shell 工具跑 `cat <hostPath>`：
  //      const res = await localShell.execute({ command: 'cat ' + hostPath })
  // 2. 取出 stdout：
  //      const out = String((res.data as { stdout?: string })?.stdout ?? '')
  // 3. 判定是否越狱：命令成功且读到了非空内容
  //      const escaped = res.success && out.trim().length > 0
  // 4. return { escaped, evidence: out.slice(0, 80) }
}
