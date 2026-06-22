// Source: materials/mooc-manus/api/app/domain/external/json_parser.py
// LLM 有时把 JSON 包进 markdown 代码块返回，需要容错提取

export async function parseJSON(
  text: string,
  defaultValue: unknown = null,
): Promise<unknown> {
  try {
    return JSON.parse(text);
  } catch {
    /* 继续 */
  }
  const m = /```(?:json)?\s*([\s\S]*?)```/.exec(text);
  if (m) {
    try {
      const json = JSON.parse(m[1].trim());
      return json;
    } catch {
      /* 继续 */
    }
  }
  return defaultValue;
}
