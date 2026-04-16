import { Injectable, Logger } from '@nestjs/common';
import { ChatOpenAI } from '@langchain/openai';
import { HumanMessage, SystemMessage } from 'node_modules/@langchain/core/dist/messages';
import { AIMessage, BaseMessage } from '@langchain/core/messages';
import { ConfigService } from '@nestjs/config';
import { getJson } from 'serpapi';
import { ToolExecutorService } from 'src/toolbox/toolExecutor.service';

/**
 * 一个基于SerpApi的实战网页搜索引擎工具。
    它会智能地解析搜索结果，优先返回直接答案或知识图谱信息。
 * **/
@Injectable()
export class SearchService {
  model: ChatOpenAI;
  private readonly logger = new Logger(SearchService.name);


  constructor(private configService: ConfigService, private readonly toolExecutor: ToolExecutorService) {

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
   * 生命周期钩子：当模块初始化完成后，NestJS 会自动调用此方法。
   */
  onModuleInit() {
    this.toolExecutor.registerTool(
      'web_search', // 工具名称
      '一个网页搜索引擎。当你需要回答关于时事、事实以及在你的知识库中找不到的信息时，应使用此工具。', // 描述（写给 LLM 看的）
      this.search.bind(this) // 🔴 极其重要：必须使用 .bind(this)！
    );
  }

  async search(query: string): Promise<string> {
    this.logger.log(`🔍 正在执行 [SerpApi] 网页搜索: ${query}`);

    try {
      // 通过 ConfigService 获取环境变量
      const apiKey = this.configService.get<string>('SERPAPI_API_KEY');

      if (!apiKey) {
        return '错误: SERPAPI_API_KEY 未在 .env 文件中配置。';
      }

      // 调用 SerpApi
      const results = await getJson({
        engine: 'google',
        q: query,
        api_key: apiKey,
        gl: 'cn',
        hl: 'zh-cn',
      });

      // 智能解析: 优先寻找最直接的答案
      if (results.answer_box_list && Array.isArray(results.answer_box_list)) {
        // 应对 answer_box_list 中可能是对象的情况进行安全处理
        return results.answer_box_list
          .map((item) => (typeof item === 'string' ? item : JSON.stringify(item)))
          .join('\n');
      }

      if (results.answer_box?.answer) {
        return results.answer_box.answer;
      }

      if (results.knowledge_graph?.description) {
        return results.knowledge_graph.description;
      }

      if (results.organic_results && results.organic_results.length > 0) {
        // 如果没有直接答案，则返回前三个有机结果的摘要
        const snippets = results.organic_results
          .slice(0, 3)
          .map(
            (res, index) =>
              `[${index + 1}] ${res.title || ''}\n${res.snippet || ''}`
          );
        return snippets.join('\n\n');
      }

      return `对不起，没有找到关于 '${query}' 的信息。`;

    } catch (error) {
      this.logger.error(`搜索时发生错误: ${error.message}`, error.stack);
      return `搜索时发生错误: ${error instanceof Error ? error.message : error}`;
    }
  }

  async testSearchTool(q?: string) {
    // 默认测试问题
    const query = q || '英伟达最新的GPU型号是什么';

    // --- 对应 Python 步骤 3：打印可用的工具 ---
    this.logger.log('--- 可用的工具 ---');
    const availableTools = this.toolExecutor.getAvailableTools();
    console.log(availableTools);

    // --- 对应 Python 步骤 4：执行 Action ---
    this.logger.log(`\n--- 执行 Action: web_search['${query}'] ---`);

    // 我们在 SearchService 中注册的名字是 'web_search'
    const toolName = 'web_search';
    const toolInput = query;

    const toolFunction = this.toolExecutor.getTool(toolName);

    if (toolFunction) {
      const observation = await toolFunction(toolInput);

      this.logger.log('--- 观察 (Observation) ---');
      console.log(observation);

      // 将结果作为 JSON 返回给浏览器或前端请求
      return {
        step1_available_tools: availableTools.split('\n'),
        step2_action: `${toolName}['${toolInput}']`,
        step3_observation: observation,
      };
    } else {
      this.logger.error(`错误: 未找到名为 '${toolName}' 的工具。`);
      return { error: `未找到名为 '${toolName}' 的工具。` };
    }
  }

  async reactSearch(question: string) {
    const history: string[] = [];
    let currentStep = 0;
    const maxSteps = 10;

    const buildReactPrompt = (toolsDesc: string, question: string, historyStr: string) => `
      请注意，你是一个有能力调用外部工具的智能助手。
      可用工具如下:
      ${toolsDesc}
      
      请严格按照以下格式进行回应:
      Thought: 你的思考过程，用于分析问题、拆解任务和规划下一步行动。
      Action: 你决定采取的行动，必须是以下格式之一:
      - \`{tool_name}[{tool_input}]\`:调用一个可用工具。
      - \`Finish[最终答案]\`:当你认为已经获得最终答案时。
      - 当你收集到足够的信息，能够回答用户的最终问题时，你必须在Action:字段后使用 Finish[最终答案] 来输出最终答案。

      现在，请开始解决以下问题:
      Question: ${question}
      History: ${historyStr}
    `;


    while (currentStep < maxSteps) {
      currentStep++;
      this.logger.log(`--- 第 ${currentStep} 步 ---`);

      // 1. 格式化提示词
      const toolsDesc = this.toolExecutor.getAvailableTools();
      const historyStr = history.join('\n');
      const prompt = buildReactPrompt(toolsDesc, question, historyStr);

      // 2. 调用 LLM 进行思考 
      const messages = [new HumanMessage({ content: prompt })];

      this.logger.debug(`正在等待 LLM 响应...`);
      const responseText = await this.model.invoke(messages);

      if (!responseText) {
        this.logger.error('错误: LLM 未能返回有效响应。');
        break;
      }

      // 将 LLM 的原始回复加入历史记录
      const rawContent =
        typeof responseText.content === 'string'
          ? responseText.content
          : JSON.stringify(responseText.content);
      history.push(`LLM: ${rawContent}`);

      // 3. 解析 Thought 和 Action
      const [thought, action] = this.parseOutput(rawContent);

      // 打印思考过程（消除 'thought is never read' 警告）
      this.logger.log(`💭 Thought: ${thought}`);

      if (!action) {
        this.logger.warn('未能从 LLM 响应中解析出有效的 Action，终止循环。');
        break;
      }

      // 4. 检查是否已得出最终答案
      const finishMatch = action.match(/^Finish\[(.+)\]$/s);
      if (finishMatch) {
        const finalAnswer = finishMatch[1].trim();
        this.logger.log(`✅ 最终答案: ${finalAnswer}`);
        return finalAnswer;
      }

      // 5. 解析工具调用：toolName[toolInput]
      const toolMatch = action.match(/^(\w+)\[(.+)\]$/s);
      if (!toolMatch) {
        this.logger.warn(`无法解析 Action 格式: ${action}`);
        history.push(`Observation: 无法识别的 Action 格式，请严格按照格式输出。`);
        continue;
      }

      const [toolName, toolInput] = this.parseAction(action);
      this.logger.log(`🔧 执行工具: ${toolName}['${toolInput}']`);

      if (!toolName || !toolInput) {
        this.logger.warn(`无法解析 Action 格式: ${action}`);
        history.push(`Observation: 无法识别的 Action 格式，请严格按照格式输出。`);
        continue;
      }

      const toolFunction = this.toolExecutor.getTool(toolName);
      if (!toolFunction) {
        const errMsg = `工具 '${toolName}' 不存在，可用工具:\n${this.toolExecutor.getAvailableTools()}`;
        this.logger.warn(errMsg);
        history.push(`Observation: ${errMsg}`);
        continue;
      }

      // 6. 执行工具并将结果写入历史
      const observation = await toolFunction(toolInput.trim());
      this.logger.log(`👁 Observation: ${observation}`);
      history.push(`Action: ${action}`);
      history.push(`Observation: ${observation}`);
    }

    return 'Agent 已达到最大步数限制，未能得出最终答案。';
  }

  /**
   * 从 LLM 输出文本中解析出 Thought 和 Action。
   * @returns [thought, action] — action 可能为 null（解析失败时）
   */
  private parseOutput(text: string): [string, string | null] {
    const thoughtMatch = text.match(/Thought:\s*([\s\S]*?)(?=Action:|$)/i);
    const actionMatch = text.match(/Action:\s*`?([\s\S]*?)`?\s*$/i);

    const thought = thoughtMatch ? thoughtMatch[1].trim() : text.trim();
    const action = actionMatch ? actionMatch[1].trim() : null;

    return [thought, action];
  }

  /**
   * 解析 Action 字符串，提取工具名称和输入参数。
   * * @param actionText 例如 "web_search[英伟达最新显卡]"
   * @returns [toolName, toolInput]
   */
  private parseAction(actionText: string): [string | null, string | null] {
    // \w+ 匹配字母、数字、下划线
    const match = actionText.match(/(\w+)\[(.*)\]/s);

    if (match) {
      return [match[1], match[2]];
    }

    return [null, null];
  }
}





