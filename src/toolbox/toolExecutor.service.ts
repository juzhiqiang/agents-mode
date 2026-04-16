import { Injectable, Logger } from '@nestjs/common';

// 1. 定义工具配置的接口，利用 TypeScript 提供严格的类型检查
export interface ToolConfig {
    description: string;
    // 定义通用函数类型，支持任意参数和任意返回值。
    // 在实际业务中，如果工具都是异步的，可以写成 (...args: any[]) => Promise<any>
    func: (...args: any[]) => any;
}

@Injectable()
export class ToolExecutorService {
    private readonly logger = new Logger(ToolExecutorService.name);

    // 3. Map 在 TypeScript/JavaScript 中处理动态键值对时性能更好，且内置方法更丰富
    private readonly tools: Map<string, ToolConfig> = new Map();

    /**
     * 向工具箱中注册一个新工具。
     * @param name 工具的唯一名称
     * @param description 工具的用途描述，通常给 LLM 看
     * @param func 工具的具体执行逻辑（函数）
     */
    registerTool(name: string, description: string, func: (...args: any[]) => any): void {
        if (this.tools.has(name)) {
            this.logger.warn(`警告: 工具 '${name}' 已存在，将被覆盖。`);
        }

        // 将工具存入 Map
        this.tools.set(name, { description, func });
        this.logger.log(`工具 '${name}' 已注册。`);
    }

    /**
     * 根据名称获取一个工具的执行函数。
     * @param name 工具名称
     * @returns 返回函数本身，如果找不到对应的工具则返回 undefined
     */
    getTool(name: string): ((...args: any[]) => any) | undefined {
        const tool = this.tools.get(name);
        return tool ? tool.func : undefined;
    }

    /**
     * 获取所有可用工具的格式化描述字符串。
     * 通常用于将当前环境支持的工具列表拼接进 Prompt 中发给 LLM。
     * @returns 格式化后的字符串
     */
    getAvailableTools(): string {
        const toolDescriptions: string[] = [];

        // 遍历 Map 获取所有工具的名称和详情
        for (const [name, info] of this.tools.entries()) {
            toolDescriptions.push(`- ${name}: ${info.description}`);
        }

        return toolDescriptions.join('\n');
    }
}