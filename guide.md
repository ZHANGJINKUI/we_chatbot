---
最后更新日期: [待填写 YYYY-MM-DD]
---

# 政务公文写作智能体 - 管理员手册

## 快速上手

本部分提供快速运行项目的最小步骤：

1.  **克隆仓库**:
    ```bash
    git clone [your-repository-url]
    cd [project-directory]
    ```
2.  **配置后端**:
    - 复制 `we_chatbot/.env.example` (如果存在) 或手动创建 `we_chatbot/.env` 文件。
    - 根据需要填入环境变量，特别是 LLM API 密钥（如 `QWEN_API_KEY`）和 Base URL（如 `QWEN_BASE_URL`）。请参考"配置管理"章节获取详细信息。
    - (可选) 创建并激活 Python 虚拟环境。
    - 安装后端依赖:
      ```bash
      cd we_chatbot
      pip install -r requirements.txt
      ```
3.  **配置前端**:
    - (可选) 前端环境变量通常在 `VUE/vue3-init-demo/.env` 中配置，默认配置可能已足够运行。
    - 安装前端依赖:
      ```bash
      cd ../VUE/vue3-init-demo
      npm install
      ```
4.  **启动服务**:
    - **启动后端服务**:
      ```bash
      # 切换回 we_chatbot 目录
      cd ../../we_chatbot
      # (如果使用了虚拟环境) source venv/bin/activate 或 venv\Scripts\activate
      python -m api.main
      ```
      (后端默认运行在 http://127.0.0.1:8000)
    - **启动前端服务**:
      ```bash
      # 切换回 VUE/vue3-init-demo 目录
      cd ../VUE/vue3-init-demo
      npm run dev
      ```
      (前端默认运行在 http://localhost:3000 或其他端口)
5.  **访问应用**: 在浏览器中打开前端服务地址。

## 项目概述

政务公文写作智能体（原名：智能公文助手）是一个集成了文档处理和智能问答功能的系统，支持公文纠错、内容优化以及智能问答等功能。系统由后端API服务（FastAPI）和前端界面（Vue3）组成。

## 系统架构

项目包含两个主要部分：
- **后端服务** (`we_chatbot` 目录)：基于FastAPI的后端API服务
- **前端界面** (`VUE/vue3-init-demo` 目录)：基于Vue3的用户界面

## 核心工作流

以下是用户与系统交互的一个典型工作流程：

1.  **用户上传文档**: 用户通过前端界面的"上传文件"按钮选择一个 `.docx` 文件。
2.  **前端发送请求**: 前端将文件发送到后端 `/api/upload-document` 接口。
3.  **后端存储与准备**: 后端接收文件，为其生成唯一 ID，将原始文件保存到 `we_chatbot/api/data/documents/` 目录，并将文件元数据（如 ID、文件名）存储在 `we_chatbot/api/data/document_storage.json` 中，同时更新内存中的文件列表。
4.  **用户发起处理指令**: 用户在聊天界面输入指令，例如"请帮我纠正这篇公文的错误"。
5.  **前端发送聊天请求**: 前端识别用户意图（如"纠错"），将用户消息、聊天历史和当前活动的文档 ID 发送到后端 `/api/stream-chat` 或 `/api/mcp/correction` 等接口。
6.  **后端调用核心服务**: 后端根据用户意图，调用相应的处理逻辑。通常是调用 `call_mcp_service` 函数，该函数通过 `subprocess` 启动 `we_chatbot/simple-csc/csc_server.py` 脚本，并通过 JSON-RPC 协议传递文本内容进行处理（如纠错、润色、总结）。
7.  **核心服务处理**: `csc_server.py` 脚本执行具体的 NLP 任务（可能依赖配置的 LLM API，如 Qwen）并返回处理结果（如修改后的文本、修改说明）。
8.  **后端处理结果**: 后端接收处理结果。如果文本被修改，它会调用 `process_document_with_format_preservation` 等函数尝试将修改后的文本应用回原始文档格式，并将处理后的文档二进制内容保存到 `we_chatbot/api/data/processed/` 目录，同时更新 `document_storage.json` 中的元数据。
9.  **后端返回响应**: 后端通过聊天接口（可能是流式响应）将处理结果信息（如"文档纠错完成"、"主要修改：xxx"）返回给前端。
10. **前端展示结果**: 前端在聊天界面显示助手的响应。如果文档被修改，前端会更新状态（如显示"下载文档"按钮），并允许用户通过 `/api/get-processed-content` 或类似接口获取处理后的文档进行预览或下载。

## 核心模块说明

### 1. 文件上传模块

#### 功能描述
负责用户文档（.docx格式）的上传、验证和存储。支持文件大小检测和格式验证，将有效文件保存到服务器并生成唯一标识。

#### 实现位置
**前端：**
- `VUE/vue3-init-demo/src/components/Page/FilePage.vue` - 文件上传组件和界面
- `VUE/vue3-init-demo/src/api/document.js` - 文件上传API调用

**后端：**
- `we_chatbot/api/main.py` - 文件上传接口实现（`upload_document`函数）
- `we_chatbot/api/main.py` - DocumentStorage类负责文档存储管理

#### 依赖关系
- 前端：Ant Design Vue的Upload组件
- 后端：python-docx (解析Word文档)、FastAPI (文件上传处理)

#### 注意事项
- 支持的文件格式限制为.docx，最大文件大小为10MB
- 文件上传路径配置在`we_chatbot/api/main.py`中的DocumentStorage类
- 上传目录需要适当的写入权限，如出现"Permission denied"错误，需要调整目录权限

### 2. 文档解析与处理模块

#### 功能描述
将上传的Word文档解析为文本内容，提取段落、表格等结构化内容，为后续智能处理提供基础数据。

#### 实现位置
**后端：**
- `we_chatbot/api/main.py` - DocumentStorage类中的方法处理文档解析
- `we_chatbot/my_agent/utils/shared/doc_processor.py` - DocProcessor类负责解析Word文档

#### 依赖关系
- python-docx - Word文档解析库
- 自定义文本处理函数

#### 注意事项
- 解析过程中可能出现编码问题，特别是对于包含特殊字符的文档
- 文档的格式越复杂，解析难度越大，可能需要额外处理
- 系统当前主要支持文本内容，对于复杂表格和图片的支持有限

### 3. 错误检测与纠错功能

#### 功能描述
分析文档内容，检测并修正包括拼写错误、语法错误、标点符号错误和格式规范问题。该模块是系统的核心功能之一，也支持润色、总结等其他文本处理任务。

#### 实现位置
**后端：**
- `we_chatbot/api/main.py` - 包含 `/api/mcp/correction`, `/api/chat`, `/api/stream-chat` 等API端点，接收前端请求。
- `we_chatbot/my_agent/agent_tools.py` - 包含核心的 `call_mcp_service` 函数，负责调用外部处理服务。
- `we_chatbot/simple-csc/csc_server.py` - 这是实际执行文本处理（纠错、润色、总结）的 Python 脚本，被 `call_mcp_service` 通过 `subprocess` 启动。
- `we_chatbot/mcp/` - 此目录可能包含辅助性的 MCP 客户端代码，但核心调用逻辑在 `agent_tools.py`。

#### 调用协议 (MCP)
MCP (可能代表"模型调用协议" Model Call Protocol 或类似概念) 在本项目中指代一种通过 JSON-RPC 格式与子进程 (`csc_server.py`) 通信的机制。`call_mcp_service` 函数构造 JSON-RPC 请求，通过标准输入发送给子进程，并从标准输出读取 JSON-RPC 响应。

#### 依赖关系
- **核心处理服务**: 依赖 `we_chatbot/simple-csc/csc_server.py` 脚本的正确执行，该脚本可能进一步依赖配置的 **大型语言模型 (LLM) API**。
- **LLM API**: 根据 `we_chatbot/.env` 文件中的配置，系统当前似乎主要配置为使用 **Qwen (通义千问) API** (`QWEN_API_KEY`, `QWEN_BASE_URL`)。DeepSeek API 的配置 (`DEEPSEEK_API_KEY`, `DEEPSEEK_API_BASE`) 目前被注释掉了。请确保所选用的 LLM API Key 配置正确且有效。
- **LangChain/Tavily**: `we_chatbot/.env` 文件也包含 LangChain 和 Tavily 的配置，表明这些服务也可能被用于某些处理流程。

#### 注意事项
- 处理效果（纠错、润色、总结）高度依赖于 `csc_server.py` 脚本的实现以及其调用的 LLM API 的质量。
- 确保 `we_chatbot/.env` 中配置的 LLM API (如 Qwen) 密钥有效，并注意相关服务的调用限制和费用。
- `csc_server.py` 的具体实现细节（使用了哪些模型、处理逻辑）可能需要直接查看该文件来了解。
- 如果 MCP 调用失败，可以检查后端日志 (`we_chatbot/backend.log`) 和 `csc_server.py` 可能产生的输出或错误信息。

### 4. 对话交互模块

#### 功能描述
处理用户输入的自然语言指令，识别用户意图，将指令转化为系统动作，如文档处理、问答等，并返回响应结果。

#### 实现位置
**前端：**
- `VUE/vue3-init-demo/src/components/Page/ChatPage.vue` - 聊天界面实现
- `VUE/vue3-init-demo/src/services/weChatbotService.ts` - 聊天服务API交互

**后端：**
- `we_chatbot/api/main.py` - 包含`stream_chat`和`chat_endpoint`等API端点
- `we_chatbot/my_agent/utils/shared/intent_classifier.py` - 意图分类器

#### 依赖关系
- 前端：@kousum/semi-ui-vue (Chat组件)
- 后端：DeepSeek API、SSE (服务器发送事件)

#### 注意事项
- 系统初始提示(system prompt)定义在 `ChatPage.vue` 的 `initializeChat` 函数中
- 聊天历史记录存储在浏览器本地存储中
- 意图识别逻辑在 `weChatbotService.ts` 的 `getMessageIntent` 函数中
- 对话消息传输使用SSE实现流式响应，支持实时更新
- 智能体("assistant")的名称和头像配置在 `ChatPage.vue` 的 `roleInfo` 对象中

### 5. 文件存储与状态管理逻辑

#### 功能描述
管理系统中的文档存储，处理文档状态跟踪、版本控制和处理结果的保存与恢复功能。

#### 实现位置
**前端：**
- `VUE/vue3-init-demo/src/stores/file.ts` - 文件状态管理
- `VUE/vue3-init-demo/src/services/weChatbotService.ts` - 文件处理服务

**后端：**
- `we_chatbot/api/main.py` - DocumentStorage类负责文档存储管理
- `we_chatbot/api/data/` - 数据存储目录
  - `documents/` - 原始文档存储
  - `processed/` - 处理后文档存储
  - `document_storage.json` - 文档元数据存储

#### 依赖关系
- 前端：Pinia (状态管理库)
- 后端：文件系统存储

#### 注意事项
- 文档元数据和二进制内容分开存储
- 文档存储路径位于 `we_chatbot/api/data/` 目录中
- 文档存储需要足够的磁盘空间和适当的权限
- 修改后的文档状态会通过前端事件系统通知其他组件
- 文档切换时会重置处理状态，这在2024年4月更新中进行了修复

### 6. 简易认证与用户管理

#### 功能描述
提供简单的用户登录功能。目前的实现非常简化：**后端 `/api/login` 端点仅检查是否提供了用户名和密码，不进行任何实际验证，只要提供了这两个字段，就返回固定的模拟 Token (`mock_token_123456789`) 表示成功。** 这主要是为了满足前端登录流程的需要，没有实际的安全保障。后期可扩展为数据库支持的完整用户系统。

#### 实现位置
**前端：**
- `VUE/vue3-init-demo/src/components/LoginForm.vue` - 登录表单
- `VUE/vue3-init-demo/src/stores/auth.ts` - 认证状态管理 (存储模拟 Token)
- `VUE/vue3-init-demo/src/router/index.ts` - 路由守卫 (检查是否存在 Token)

**后端：**
- `we_chatbot/api/main.py` - 包含 `/api/login` API端点（约在662行），实现上述模拟登录逻辑。
- `LoginRequest` 和 `LoginResponse` 等模型类用于定义请求和响应结构。

#### 依赖关系
- 前端：Vue Router, Pinia (状态管理)
- 后端：无外部依赖（仅 FastAPI 基础功能）

#### 注意事项
- **安全警告**: 当前认证方式极不安全，仅适用于开发或内部演示环境。生产环境**必须**替换为安全的认证机制，如 OAuth2 或 JWT，并结合数据库验证用户凭据。
- 登录相关代码直接在 `main.py` 中，没有单独的 `auth` 模块。
- 前端仅验证是否存在 Token，不验证 Token 本身的有效性。

### 7. 系统配置与界面定制

#### 功能描述
系统的全局配置和UI定制，包括系统名称、消息弹窗、图标等。

#### 实现位置
**前端：**
- `VUE/vue3-init-demo/index.html` - 页面标题设置
- `VUE/vue3-init-demo/src/main.ts` - 全局配置
- `VUE/vue3-init-demo/src/components/Sider/TitleHeader.vue` - 左上角系统名称
- `VUE/vue3-init-demo/src/assets/` - 系统图标资源:
  - `robot.png` - 智能体头像
  - `user-avatar.png` - 用户头像
  - `system.png` - 系统消息图标

#### 依赖关系
- Ant Design Vue - UI组件库
- Vite - 开发服务器和构建工具

#### 注意事项
- 系统名称"政务公文写作智能体"在 `TitleHeader.vue` 中定义
- 消息提示配置在 `main.ts` 中，可调整显示时间或完全禁用
- 修改配置文件后需要重新启动服务

## 配置管理

系统配置主要通过 `.env` 文件管理，分为后端和前端两部分。

### 后端配置 (`we_chatbot/.env`)

此文件位于 `we_chatbot` 目录下，包含后端服务运行所需的敏感信息和关键配置。**请勿将此文件提交到版本控制系统。**

关键环境变量示例及其用途：

-   `QWEN_API_KEY`: (必需) 通义千问 (Qwen) 大模型的 API Key，用于核心的文本处理任务（纠错、润色、总结等）。
-   `QWEN_BASE_URL`: (必需) Qwen API 的服务地址。
-   `LANGCHAIN_TRACING_V2`: (可选) 是否启用 LangSmith 追踪。
-   `LANGCHAIN_API_KEY`: (可选) LangSmith API Key。
-   `LANGSMITH_ENDPOINT`: (可选) LangSmith 服务地址。
-   `LANGSMITH_PROJECT`: (可选) LangSmith 项目名称。
-   `TAVILY_API_KEY`: (可选) Tavily 搜索引擎 API Key，可能用于需要外部信息查询的功能。
-   `# DEEPSEEK_API_KEY`: (已注释) DeepSeek API Key (当前未使用)。
-   `# DEEPSEEK_API_BASE`: (已注释) DeepSeek API 服务地址 (当前未使用)。

**注意**: 必须提供有效的 LLM API 配置（当前为 Qwen）才能使核心功能正常工作。

### 前端配置 (`VUE/vue3-init-demo/.env`)

此文件位于 `VUE/vue3-init-demo` 目录下，主要用于 Vite 构建和前端应用本身。

关键环境变量示例及其用途：

-   `VITE_APP_TITLE`: 设置浏览器标签页和应用内的标题。
-   `VITE_BASE_URL`: 配置前端请求后端的 API 基础路径。通常留空以使用 Vite 的代理配置（在 `vite.config.ts` 中设置），或在需要时指定完整的后端 API 地址。
-   `VITE_OPENROUTER_API_KEY`: (可能未使用) OpenRouter API Key，可能用于前端直接调用 LLM 的测试或特定场景。
-   `VITE_OPENAI_MODEL`: (可能未使用) 指定用于 OpenRouter 或类似服务的模型名称。

## 系统运维

### 启动服务

#### 后端服务
```bash
cd we_chatbot
# 激活虚拟环境
source venv/bin/activate  # Linux/Mac
# 或 venv\Scripts\activate  # Windows
# 启动服务
python -m api.main
```

#### 前端服务
```bash
cd VUE/vue3-init-demo
# 安装依赖
npm install
# 启动开发服务器
npm run dev
# 或直接使用node执行vite (如有权限问题)
node node_modules/vite/bin/vite.js
```

### 常见问题排查

1.  **权限问题**：确保后端服务对数据目录 (`we_chatbot/api/data/`) 及其子目录 (`documents/`, `processed/`) 有读写权限。
    ```bash
    # 示例：将所有权赋予当前用户 (请替换 <用户名>)
    sudo chown -R <用户名>:<用户组> /mnt/nvme0n1/public/my_chatbotv0.11/we_chatbot/api/data/
    # 或赋予更宽松的权限 (可能不安全)
    # sudo chmod -R 777 /mnt/nvme0n1/public/my_chatbotv0.11/we_chatbot/api/data/
    ```

2.  **前端服务启动失败**：
    *   **端口占用**: 检查默认端口（如 3000）是否已被其他进程占用 (`netstat -tulnp | grep 3000`)。如果被占用，可以尝试使用其他端口启动：
        ```bash
        npm run dev -- --port=3001
        ```
    *   **Node/Vite 问题**: 尝试删除 `node_modules` 和 `package-lock.json` 后重新安装依赖 (`rm -rf node_modules package-lock.json && npm install`)。或尝试直接用 node 执行 vite：
        ```bash
        node node_modules/vite/bin/vite.js
        ```

3.  **大模型(LLM) API 问题**: 核心功能（纠错、润色、总结）依赖 LLM API。
    *   **检查配置**: 确保 `we_chatbot/.env` 文件中配置的 LLM API Key (如 `QWEN_API_KEY`) 和 Base URL (如 `QWEN_BASE_URL`) 正确无误且未被注释。
    *   **网络问题**: 确认后端服务器可以访问配置的 LLM API Base URL。
    *   **API Key 无效/额度不足**: 检查 API Key 是否有效、账户是否有足够额度。相关错误信息通常会出现在后端日志中。

4.  **MCP 服务调用失败**: 如果聊天时提示"MCP 服务处理失败"或类似错误：
    *   **检查后端日志**: 查看 `we_chatbot/backend.log` 或 FastAPI 的控制台输出，查找 `call_mcp_service` 函数或 `csc_server.py` 相关的错误信息 (Error, TimeoutExpired, JSONDecodeError 等)。
    *   **检查 `simple-csc/csc_server.py`**: 确认该脚本可以独立运行，并且其依赖（可能包括 LLM SDK）已正确安装在后端 Python 环境中。
    *   **超时**: 如果是超时错误 (`TimeoutExpired`)，可能表示 LLM API 响应缓慢或处理任务耗时过长。可以尝试增加 `agent_tools.py` 中 `process.communicate` 的 `timeout` 参数值。

5.  **文件上传/处理相关问题**: 
    *   **文件大小/格式**: 确认上传的文件是 `.docx` 格式且未超过大小限制 (默认为 10MB，可在 `FilePage.vue` 的 `beforeUpload` 检查)。
    *   **预览失败**: 如果文档上传成功但预览失败，检查浏览器控制台和后端日志，确认 `/api/get-processed-content` 或相关预览接口是否正常返回数据以及是否存在格式错误。
    *   **处理后无变化**: 如果执行纠错等操作后文档内容没有变化，可能是 LLM 判断无需修改，或者处理过程中出现未捕获的错误。检查后端日志中关于 MCP 调用和 LLM API 响应的详细信息。

6.  **资源文件缺失**: 如果前端界面图标等资源显示不正常，确保 `VUE/vue3-init-demo/src/assets/` 目录中包含必要的图片文件（如 `robot.png`, `user-avatar.png`, `system.png`）。

## 系统扩展

### 添加新功能
1. 在`we_chatbot/api/main.py`中添加新API端点
2. 在前端添加相应UI组件
3. 更新意图识别逻辑以支持新指令

### 自定义模型
可以通过修改DeepSeek API配置和MCP服务调用来切换或定制大语言模型。

## 维护与升级

### 日志监控
系统日志主要包含在 FastAPI 的标准输出（控制台）以及可能写入的 `we_chatbot/backend.log` 文件中。前端日志可以在浏览器的开发者工具控制台中查看。定期检查日志有助于发现潜在问题。

### 依赖更新
定期检查和更新依赖库版本，确保系统安全性和性能：
```bash
# 后端 (在 we_chatbot 目录下)
pip install -U pip  # 更新pip
pip install -U -r requirements.txt
# 检查过时包
pip list --outdated

# 前端 (在 VUE/vue3-init-demo 目录下)
npm update # 或使用 npm outdated 查看并手动更新
```

## 核心依赖

以下是项目运行所依赖的关键技术和库：

**后端 (`we_chatbot`)**

-   **Python**: 核心编程语言。
-   **FastAPI**: 高性能 Web 框架，用于构建 API。
-   **Uvicorn**: ASGI 服务器，用于运行 FastAPI 应用。
-   **python-docx**: 用于读取和写入 Microsoft Word (.docx) 文件。
-   **LLM SDK**: 根据 `.env` 配置，可能需要对应的 Python SDK (如 `dashscope` 用于 Qwen)。
-   **LangChain/LangSmith**: (可选) 用于构建和追踪 LLM 应用。
-   **subprocess**: Python 内置模块，用于调用 `simple-csc/csc_server.py`。

**前端 (`VUE/vue3-init-demo`)**

-   **Node.js & npm**: JavaScript 运行时和包管理器。
-   **Vue 3**: 核心前端框架。
-   **Vite**: 前端构建工具和开发服务器。
-   **TypeScript**: 用于前端代码开发。
-   **Ant Design Vue**: UI 组件库。
-   **@kousum/semi-ui-vue**: 提供聊天界面的核心组件 (`Chat`)。
-   **Pinia**: Vue 的状态管理库。
-   **Axios**: 用于发起 HTTP 请求与后端 API 交互。
-   **Vue Router**: 用于处理前端路由。

---

本手册提供了政务公文写作智能体系统的核心模块和管理信息。如有进一步问题，请联系系统开发团队。 