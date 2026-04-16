import { Injectable, Logger } from '@nestjs/common';
import { ChatOpenAI } from '@langchain/openai';
import { HumanMessage, SystemMessage } from 'node_modules/@langchain/core/dist/messages';
import { ConfigService } from '@nestjs/config';

/**
 * 一个基于SerpApi的实战网页搜索引擎工具。
    它会智能地解析搜索结果，优先返回直接答案或知识图谱信息。
 * **/
@Injectable()
export class PlaneService {
  model: ChatOpenAI;
  private readonly logger = new Logger(PlaneService.name);
  private readonly PLANNER_PROMPT_TEMPLATE = `
    你是一个顶级的AI规划专家。你的任务是将用户提出的复杂问题分解成一个由多个简单步骤组成的行动计划。
    请确保计划中的每个步骤都是一个独立的、可执行的子任务，并且严格按照逻辑顺序排列。
    你的输出必须是一个Python列表，其中每个元素都是一个描述子任务的字符串。

    问题: \${question}

    请严格按照以下格式输出你的计划, \`\`\`js 与 \`\`\` 作为前后缀是必要的:
    \`\`\`js
    ["步骤1", "步骤2", "步骤3", ...]
    \`\`\`
`;

  private readonly EXECUTOR_PROMPT_TEMPLATE = `
    你是一位顶级的AI执行专家。你的任务是严格按照给定的计划，一步步地解决问题。
    你将收到原始问题、完整的计划、以及到目前为止已经完成的步骤和结果。
    请你专注于解决“当前步骤”，并仅输出该步骤的最终答案，不要输出任何额外的解释或对话。

    # 原始问题:
    {question}

    # 完整计划:
    {plan}

    # 历史步骤与结果:
    {history}

    # 当前步骤:
    {current_step}

    请仅输出针对“当前步骤”的回答:
  `;

  constructor(private configService: ConfigService) {

    this.model = new ChatOpenAI({
      apiKey: this.configService.get<string>("LLM_API_KEY"),
      configuration: {
        baseURL: this.configService.get<string>("LLM_BASE_URL"),
      },
      modelName: this.configService.get<string>("LLM_MODEL_ID"),
      temperature: Number(this.configService.get<number>("LLM_TEMPERATURE")),
    })

  }
  /**
     * 根据用户问题生成一个行动计划。
     */
  async plan(question: string): Promise<string[]> {
    // 1. 构建 Prompt
    const prompt = this.PLANNER_PROMPT_TEMPLATE.replace('${question}', question);

    const messages = [
      new HumanMessage(prompt)];

    this.logger.log('--- 正在生成计划 ---');

    try {
      // 2. 调用 LLM 
      const responseText = await this.model.invoke(messages) || '';
      const rawContent =
        typeof responseText.content === 'string'
          ? responseText.content
          : JSON.stringify(responseText.content);
      this.logger.log(`✅ 计划已生成:\n${rawContent}`);

      // 3. 解析 LLM 输出的列表字符串

      return this.parsePlan(rawContent);

    } catch (error) {
      this.logger.error(`❌ 解析计划时发生未知错误: ${error.message}`);
      return [];
    }
  }

  /**
   * 根据计划，逐步执行并解决问题。
   */
  async execute(question: string, plan: string[]): Promise<string> {
    let history = ''; // 用于存储历史步骤和结果的字符串
    let responseText = '';

    this.logger.log('\n--- 正在执行计划 ---');

    // 使用 for...of 循环确保步骤是严格串行（顺序）执行的
    for (const [index, step] of plan.entries()) {
      const stepNumber = index + 1;
      this.logger.log(`\n-> 正在执行步骤 ${stepNumber}/${plan.length}: ${step}`);

      // 构建 Prompt
      const prompt = this.EXECUTOR_PROMPT_TEMPLATE
        .replace('{question}', question)
        .replace('{plan}', JSON.stringify(plan))
        .replace('{history}', history || '无')
        .replace('{current_step}', step);

      const messages = [{ role: 'user', content: prompt }];

      try {
        // 调用 LLM
        const reslut = await this.model.invoke(messages) || '';
        responseText =
          typeof reslut.content === 'string'
            ? reslut.content
            : JSON.stringify(reslut.content);
        // 更新历史记录，为下一步做准备
        history += `步骤 ${stepNumber}: ${step}\n结果: ${responseText}\n\n`;

        this.logger.log(`✅ 步骤 ${stepNumber} 已完成`);
      } catch (error) {
        this.logger.error(`❌ 执行步骤 ${stepNumber} 时出错: ${error.message}`);
        // 可以根据业务需求决定是 break 还是 continue
        throw error;
      }
    }

    // 循环结束后，最后一步的响应就是最终答案
    const finalAnswer = responseText;
    return finalAnswer;
  }

  /**
   * 运行智能体的完整流程: 先规划，后执行。
   */
  async run(question: string): Promise<string | null> {
    this.logger.log(`\n--- 开始处理问题 ---\n问题: ${question}`);

    // 1. 调用规划器生成计划
    const plan = await this.plan(question);

    // 检查计划是否成功生成
    if (!plan || plan.length === 0) {
      this.logger.warn('\n--- 任务终止 --- \n无法生成有效的行动计划。');
      return null;
    }

    // 2. 调用执行器执行计划
    try {
      const finalAnswer = await this.execute(question, plan);

      this.logger.log(`\n--- 任务完成 ---\n最终答案: ${finalAnswer}`);
      return finalAnswer;
    } catch (error) {
      this.logger.error(`执行过程中发生错误: ${error.message}`);
      return null;
    }
  }

  /**
   * 解析逻辑：提取 ```js 代码块并解析 JSON/Array
   */
  private parsePlan(responseText: string): string[] {
    try {
      // 使用正则表达式匹配 ```js 和 ``` 之间的内容
      const match = responseText.match(/```js([\s\S]*?)```/);

      if (!match || !match[1]) {
        throw new Error('未找到 js 代码块');
      }

      const planStr = match[1].trim();

      // 在 JS/TS 中，js 列表的格式通常与 JSON 数组一致
      // 如果 LLM 输出的是严格的 ["a", "b"] 格式，JSON.parse 可以直接处理
      const plan = JSON.parse(planStr);

      if (Array.isArray(plan)) {
        return plan;
      } else {
        this.logger.warn('解析结果不是有效的数组');
        return [];
      }
    } catch (e) {
      this.logger.error(`❌ 解析计划时出错: ${e.message}`);
      this.logger.debug(`原始响应: ${responseText}`);
      return [];
    }
  }
}





