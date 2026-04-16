import { Injectable, Logger } from '@nestjs/common';
import getWeather from './tools/getWeatch';
import getAttraction from './tools/getSearchAttraction';
import { ChatOpenAI } from '@langchain/openai';
import { HumanMessage, SystemMessage } from 'node_modules/@langchain/core/dist/messages';
import { AIMessage, BaseMessage } from '@langchain/core/messages';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AppService {
  model: ChatOpenAI;
  private readonly logger = new Logger(AppService.name);

  private readonly availableTools = {
    "get_weather": getWeather,
    "get_attraction": getAttraction
  };

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

  getHello(): string {
    return 'Hello World!';
  }



  private readonly AGENT_SYSTEM_PROMPT = `
      你是一个智能旅行助手。你的任务是分析用户的请求，并使用可用工具一步步地解决问题。


      # 可用工具:
      - get_weather(city: str): 查询指定城市的实时天气。
      - get_attraction(city: str, weather: str): 根据城市和天气搜索推荐的旅游景点。

      # 输出格式要求:
      你的每次回复必须严格遵循以下格式，包含一对Thought和Action：

      Thought: [你的思考过程和下一步计划]
      Action: [你要执行的具体行动]

      Action的格式必须是以下之一：
      1. 调用工具：function_name(arg_name="arg_value")
      2. 结束任务：Finish[最终答案]

      # 重要提示:
      - 每次只输出一对Thought-Action
      - Action必须在同一行，不要换行
      - 当收集到足够信息可以回答用户问题时，必须使用 Action: Finish[最终答案] 格式结束

      请开始吧！
    `;

  // 用户偏好
  async getLongTermMemory(userId: string): Promise<string> {
    // 模拟从数据库读取，实际可以接入 Redis 或数据库
    return "用户偏好：喜欢历史文化建筑，避开自然风光；预算范围：中等；旅行节奏：慢节奏。";
  }

  async runTravelAgent(userPrompt: string): Promise<string> {
    this.logger.log(`用户输入: ${userPrompt}`);

    const memory = await this.getLongTermMemory('test');

    // 1. 初始化对话历史
    // 注意：LangChain 推荐使用对象数组而非纯字符串拼接
    const messageHistory: BaseMessage[] = [
      new SystemMessage(`${this.AGENT_SYSTEM_PROMPT}\n\n当前已知用户信息：${memory}`),
      new HumanMessage(`用户请求: ${userPrompt}`),
    ];

    let rejectionCount = 0; // 拒绝计数器

    // 2. 运行主循环
    for (let i = 0; i < 8; i++) {
      this.logger.log(`--- 循环 ${i + 1} ---`);

      // 3.1 & 3.2 调用大模型获取思考过程
      const response = await this.model.invoke(messageHistory);
      let llmOutput = response.content as string;
      console.log(`第${i}轮，${llmOutput}`)
      // 正则截断多余的输出 
      const truncateRegex = /(Thought:.*?Action:.*?)(?=\n\s*(?:Thought:|Action:|Observation:)|\Z)/s;
      const match = llmOutput.match(truncateRegex);
      if (match) {
        llmOutput = match[1].trim();
      }

      this.logger.log(`模型输出:\n${llmOutput}`);
      messageHistory.push(new AIMessage(llmOutput));

      if (llmOutput.includes("用户表示不喜欢") || llmOutput.includes("拒绝")) {
        rejectionCount++;
      }

      if (rejectionCount >= 3) {
        this.logger.warn("用户已连续拒绝3次，触发反思逻辑...");
        const reflectionPrompt = "【系统指令】你已连续推荐失败3次。请停止当前推荐，反思用户可能的潜在需求（如预算、风格），并直接询问用户更具体的要求，不要再次尝试调用工具。";
        messageHistory.push(new HumanMessage(reflectionPrompt));
        rejectionCount = 0; // 重置
      }

      // 3.3 解析 Action
      const actionMatch = llmOutput.match(/Action:\s*(.*)/s);
      if (!actionMatch) {
        const observation = "错误: 未能解析到 Action 字段。请严格遵循格式。";
        messageHistory.push(new HumanMessage(`Observation: ${observation}`));
        continue;
      }

      const actionStr = actionMatch[1].trim();

      // 检查是否结束
      if (actionStr.startsWith('Finish')) {
        const finishMatch = actionStr.match(/Finish\[(.*)\]/s);
        const finalAnswer = finishMatch ? finishMatch[1] : actionStr;
        this.logger.warn(`任务完成，最终答案: ${finalAnswer}`);
        return finalAnswer;
      }

      // 解析工具名和参数
      try {
        const toolNameMatch = actionStr.match(/(\w+)\(/);
        const argsMatch = actionStr.match(/\((.*)\)/);

        if (!toolNameMatch || !argsMatch) throw new Error("格式错误");

        const toolName = toolNameMatch[1];
        const argsStr = argsMatch[1];

        // 提取参数：city="北京" -> { city: "北京" }
        const kwargs = {};
        const paramRegex = /(\w+)="([^"]*)"/g;
        let p;
        while ((p = paramRegex.exec(argsStr)) !== null) {
          kwargs[p[1]] = p[2];
        }

        // 执行工具
        let observation: string;
        if (this.availableTools[toolName]) {
          this.logger.debug(`执行工具 ${toolName}，参数: ${JSON.stringify(kwargs)}`);
          // 适配 Python 的 **kwargs 写法
          // 假设你的工具函数接收一个对象作为参数，或者按顺序接收
          if (toolName === 'get_weather') {
            observation = await this.availableTools[toolName](kwargs['city']);
          } else {
            observation = await this.availableTools[toolName](kwargs['city'], kwargs['weather']);
          }
        } else {
          observation = `错误: 未定义的工具 '${toolName}'`;
        }

        // 3.4 记录观察结果
        this.logger.log(`Observation: ${observation}`);
        // 增加明确的提示，引导模型进行下一轮 Thought
        messageHistory.push(new HumanMessage(`执行结果（Observation）: ${observation}。如果此路不通，请根据用户偏好尝试备选方案。`));

      } catch (e) {
        const errorMsg = `解析 Action 参数失败: ${e.message}`;
        this.logger.error(errorMsg);
        messageHistory.push(new HumanMessage(`Observation: ${errorMsg}`));
      }
    }

    return "达到最大循环次数，任务未完成。";
  }

  async getWather(prompt: string): Promise<string> {
    this.logger.log('正在通过 LangChain 调用模型...', prompt);

    try {
      // LangChain 使用 Message 对象数组
      const response = await this.runTravelAgent(prompt);

      return response;

    } catch (error) {
      this.logger.error(`LangChain 调用出错: ${error.message}`);
      return `错误: ${error.message}`;
    }
  }
}





