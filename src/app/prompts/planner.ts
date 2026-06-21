// 已就位（AI 生成）
// Source: materials/mooc-manus/api/app/domain/services/prompts/planner.py
// 规划 Agent 的系统提示 + 创建/更新计划提示模板。占位符 {message}/{attachments}/{plan}/{step}
// 用 fillPrompt 替换（不依赖 Python str.format）。

export const PLANNER_SYSTEM_PROMPT = `你是一个任务规划智能体 (Task Planner Agent)，你需要为任务创建或更新计划：
1. 分析用户的消息并理解用户的需求；
2. 确定完成任务需要使用哪些工具；
3. 根据用户的消息确定工作语言；
4. 生成计划的目标和步骤；`;

export const CREATE_PLAN_PROMPT = `你现在正在根据用户的消息创建一个计划：
{message}

注意：
- **你必须使用用户消息中使用的语言来执行任务**
- 你的计划必须简洁明了，不要添加任何不必要的细节
- 你的步骤必须是原子性且独立的，以便下一个执行者可以使用工具逐一执行它们
- 你需要判断任务是否可以拆分为多个步骤，如果可以，返回多个步骤；否则，返回单个步骤

返回格式要求：
- 必须返回符合以下 TypeScript 接口定义的 JSON 格式
- 如果判定任务不可行，则 "steps" 返回空数组，"goal" 返回空字符串

TypeScript 接口定义：
\`\`\`typescript
interface CreatePlanResponse {
  message: string;   // 对用户消息的回复以及对任务的思考（用用户的语言）
  language: string;  // 根据用户消息确定的工作语言
  steps: Array<{ id: string; description: string }>;  // 原子步骤数组
  goal: string;      // 计划目标
  title: string;     // 计划标题
}
\`\`\`

JSON 输出示例：
{
  "message": "用户回复消息",
  "goal": "目标描述",
  "title": "任务标题",
  "language": "zh",
  "steps": [{ "id": "1", "description": "步骤1描述" }]
}

用户消息：
{message}

附件：
{attachments}`;

export const UPDATE_PLAN_PROMPT = `你正在更新计划，你需要根据步骤的执行结果来更新计划：
{step}

注意：
- 你可以删除、添加或者修改计划步骤，但不要改变计划目标 (goal)
- 仅重新规划后续**未完成**的步骤，不要更改已完成的步骤
- 输出的步骤 ID 应以第一个未完成步骤的 ID 开始，重新规划其后的步骤
- 如果步骤已完成或者不再必要，请将其删除
- 仔细阅读步骤结果以确定是否成功，如果不成功，请更改后续步骤

返回格式要求：
- 必须返回符合以下 TypeScript 接口定义的 JSON 格式

TypeScript 接口定义：
\`\`\`typescript
interface UpdatePlanResponse {
  steps: Array<{ id: string; description: string }>;  // 更新后的未完成步骤数组
}
\`\`\`

JSON 输出示例：
{ "steps": [{ "id": "1", "description": "步骤1描述" }] }

步骤 (step)：
{step}

计划 (plan)：
{plan}`;

/** 把 {key} 占位符替换为给定值（替代 Python str.format，避免对 JSON 大括号误伤）。 */
export function fillPrompt(
  template: string,
  vars: Record<string, string>,
): string {
  let out = template;
  for (const [k, v] of Object.entries(vars)) {
    out = out.split("{" + k + "}").join(v);
  }
  return out;
}
