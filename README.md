# Hello Agents

这是一个基于 NestJS 和 LangChain.js 开发的 AI 智能体 (Agents) 演示项目。项目展示了如何实现多种智能体设计模式，包括 ReAct、Planner-Executor 以及具有记忆和逻辑反思能力的垂直领域助手。

## 🌟 核心特性

### 1. ReAct 搜索智能体 (Search Agent)
*   **模块位置**: `src/search`
*   **设计模式**: ReAct (Reasoning and Acting)
*   **核心功能**: 结合 `Thought` (思考) 和 `Action` (行动) 循环，通过调用外部搜索工具获取实时信息并回答问题。
*   **集成工具**: 基于 SerpApi 的谷歌搜索。

### 2. 规划-执行智能体 (Plan-and-Solve Agent)
*   **模块位置**: `src/planSolve`
*   **设计模式**: Planner-Executor
*   **核心功能**: 
    1.  **Planner (规划器)**: 将用户的复杂请求拆解为一系列有序的子任务（行动计划）。
    2.  **Executor (执行器)**: 严格按照计划顺序执行，每一步的结果都会作为下一步的上下文。
*   **优势**: 能够有效处理逻辑复杂、步骤众多的长链任务。

### 3. 智能旅行助手 (Travel Agent)
*   **模块位置**: `src/app.service.ts`
*   **功能亮点**:
    *   **垂直领域工具**: 注册了天气查询 (`get_weather`) 和景点搜索 (`get_attraction`)。
    *   **长期记忆**: 模拟系统从数据库读取用户偏好，并作为上下文注入。
    *   **反思机制 (Reflection)**: 当连续尝试失败或用户拒绝建议时，触发反思逻辑，转而询问更精准的需求。

## 🛠️ 技术栈
*   **后端框架**: [NestJS](https://nestjs.com/)
*   **AI 调度**: [LangChain.js](https://js.langchain.com/)
*   **模型支持**: OpenAI 兼容协议
*   **包管理**: pnpm

## 🚀 快速开始

### 1. 环境配置
在项目根目录创建 `.env` 文件，并填写相关配置：

```env
# 大模型配置
LLM_API_KEY=sk-xxxx
LLM_BASE_URL=https://api.openai.com/v1
LLM_MODEL_ID=gpt-4o
LLM_TEMPERATURE=0.7

# 外部工具 API
SERPAPI_API_KEY=your_serpapi_key
TVLY_API_KEY=your_tavily_key
```

### 2. 安装与运行
```bash
# 安装依赖
pnpm install

# 启动开发服务器
pnpm run start:dev
```

## 📡 API 测试接口

| 功能 | 路由 | 参数 | 示例 |
| :--- | :--- | :--- | :--- |
| **旅行助手** | `GET /test` | `prompt` | `/test?prompt=帮我规划北京三日游` |
| **ReAct 搜索** | `GET /search/react` | `q` | `/search/react?q=英伟达最新发布的显卡参数` |
| **规划执行** | `GET /plane/test` | `prompt` | `/plane/test?prompt=对比上海和杭州的旅游景点并选一个` |

## 📂 项目结构
```text
src/
├── search/          # ReAct 搜索智能体模块
├── planSolve/       # 规划-执行智能体模块
├── toolbox/         # 工具箱服务 (管理工具注册与调用)
├── tools/           # 具体工具函数实现 (天气、搜索等)
├── app.module.ts    # 全局模块配置
└── main.ts         # 应用入口
```

## 📝 License
MIT
