import { HttpException, HttpStatus } from '@nestjs/common';
import { tavily } from '@tavily/core'; // 引入 Tavily 客户端

export default async function getAttraction(city: string, weather: string): Promise<string> {
    // 2. 检查 API Key 是否存在
    const apiKey = process.env.TVLY_API_KEY;
    const tavilyClient = tavily({ apiKey });

    // 3. 构造查询  
    const query = `'${city}' 在 '${weather}' 天气下最值得去的旅游景点推荐及理由`;

    try {
        // 4. 调用 Tavily 搜索
        const response = await tavilyClient.search(query, {
            searchDepth: 'basic',
            includeAnswer: true,
        });

        // 5. 优先返回综合性的回答 (answer)
        if (response.answer) {
            return response.answer;
        }

        // 6. 如果没有 answer，手动格式化结果列表
        if (response.results && response.results.length > 0) {
            const formattedResults = response.results
                .map((result) => `- ${result.title}: ${result.content}`)
                .join('\n');
            return `根据搜索，为您找到以下信息:\n${formattedResults}`;
        }

        return '抱歉，没有找到相关的旅游景点推荐。';

    } catch (error) {
        // 处理搜索错误
        throw new HttpException(
            `执行 Tavily 搜索时出现问题: ${error.message}`,
            HttpStatus.INTERNAL_SERVER_ERROR,
        );
    }
}