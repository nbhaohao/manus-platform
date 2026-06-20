// Source: materials/mooc-manus/api/app/infrastructure/external/sandbox/docker_sandbox.py
//   源码 create/destroy 散在类里且无强清理保证；本课把「借容器→用完必还」收成一个
//   try-finally 编排函数 withContainer——容器是稀缺资源，泄漏会堆满宿主，必须保证 destroy。
import type {
  ContainerRuntime,
  Container,
} from "../../ports/containerRuntime.ts";

// 借一个容器跑 fn，无论 fn 成功还是抛错，结束都 destroy（try-finally 必清）。
// 返回 fn 的结果。这是「容器生命周期」的核心：申请—使用—释放收口在一处。
export async function withContainer<T>(
  runtime: ContainerRuntime,
  image: string,
  fn: (container: Container) => Promise<T>,
): Promise<T> {
  const conatiner = await runtime.create(image);
  try {
    return await fn(conatiner);
  } finally {
    await runtime.destroy(conatiner);
  }
}
