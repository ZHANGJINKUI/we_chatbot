# 政务公文写作智能体 - 管理员手册

## 项目概述

政务公文写作智能体（原名：智能公文助手）是一个集成了文档处理和智能问答功能的系统，支持公文纠错、内容优化以及智能问答等功能。系统由后端API服务（FastAPI）和前端界面（Vue3）组成。

## 系统架构

项目包含两个主要部分：
- **后端服务** (`we_chatbot` 目录)：基于FastAPI的后端API服务
- **前端界面** (`VUE/vue3-init-demo` 目录)：基于Vue3的用户界面

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
分析文档内容，检测并修正包括拼写错误、语法错误、标点符号错误和格式规范问题。该模块是系统的核心功能之一。

#### 实现位置
**后端：**
- `we_chatbot/my_agent/agent_tools.py` - 包含MCP调用实现
- `we_chatbot/api/main.py` - 包含`mcp_correction`等API端点
- `we_chatbot/mcp/` - MCP协议实现目录
- `we_chatbot/simple-csc/` - 简单中文拼写检查实现

#### 依赖关系
- DeepSeek API (大型语言模型)
- 自定义纠错规则和算法

#### 注意事项
- 纠错效果依赖DeepSeek API的质量，确保API密钥配置正确
- API访问限制和费用需要考虑
- 纠错功能可通过添加自定义规则来增强
- 系统文档交互使用了MCP协议，可在日志中查看详细处理过程

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
提供简单的用户登录功能，目前使用硬编码的方式实现基本认证，后期可扩展为数据库支持的完整用户系统。

#### 实现位置
**前端：**
- `VUE/vue3-init-demo/src/components/LoginForm.vue` - 登录表单
- `VUE/vue3-init-demo/src/stores/auth.ts` - 认证状态管理
- `VUE/vue3-init-demo/src/router/index.ts` - 路由守卫

**后端：**
- `we_chatbot/api/main.py` - 包含`login`API端点（约在635行）
- `LoginRequest`和`LoginResponse`等模型类

#### 依赖关系
- 前端：Vue Router, Pinia (状态管理)
- 后端：简单的内存存储

#### 注意事项
- 目前采用简单认证方式，没有使用数据库
- 登录相关代码在main.py中，没有单独的auth模块
- 生产环境应考虑更安全的认证机制，如OAuth或JWT
- 用户信息可在future_version分支中扩展为完整用户系统

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

1. **权限问题**：确保数据目录有正确的权限
   ```bash
   sudo chown -R <用户名> /mnt/nvme0n1/public/base0423/we_chatbot/api/data/
   ```

2. **前端服务启动失败**：检查端口占用情况或使用不同方法启动
   ```bash
   # 方法1: 直接使用Node执行
   cd VUE/vue3-init-demo
   node node_modules/vite/bin/vite.js
   
   # 方法2: 指定不同端口
   npm run dev -- --port=3002
   ```

3. **大模型API问题**：检查 `.env` 文件中的API配置
   ```
   DEEPSEEK_API_KEY=your_api_key_here
   DEEPSEEK_API_BASE=your_api_base_url_here
   ```

4. **资源文件缺失**：确保assets目录中包含必要的图标文件
   ```bash
   # 检查资源文件
   ls -la VUE/vue3-init-demo/src/assets/
   # 确保包含 robot.png, user-avatar.png, system.png
   ```

## 系统扩展

### 添加新功能
1. 在`we_chatbot/api/main.py`中添加新API端点
2. 在前端添加相应UI组件
3. 更新意图识别逻辑以支持新指令

### 自定义模型
可以通过修改DeepSeek API配置和MCP服务调用来切换或定制大语言模型。

## 维护与升级

### 日志监控
系统日志包含在FastAPI的输出中，包含运行时信息和错误报告。

### 依赖更新
定期检查和更新依赖库版本，确保系统安全性和性能：
```bash
# 后端
pip freeze > requirements.txt
pip install -U -r requirements.txt

# 前端
npm outdated
npm update
```

---

本手册提供了政务公文写作智能体系统的核心模块和管理信息。如有进一步问题，请联系系统开发团队。 