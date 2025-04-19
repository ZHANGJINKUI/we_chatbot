# 智能公文助手项目

这个项目是一个集成了文档处理和智能问答功能的系统，支持公文纠错、内容优化以及智能问答等功能。

## 项目结构

项目包含两个主要部分：
- 后端服务 (`we_chatbot` 目录)：基于FastAPI的后端API服务
- 前端界面 (Vue项目)：基于Vue3的用户界面

## 系统要求

- Python 3.8+
- Node.js 16+
- npm 或 yarn
- MongoDB (可选，如启用用户管理功能)

## 安装与设置

### 从备份文件恢复项目

1. 从GitHub仓库获取项目备份：
   ```bash
   git clone https://github.com/ZHANGJINKUI/we_chatbot.git
   cd we_chatbot
   git checkout vue-backup
   ```

2. 解压备份文件：
   ```bash
   tar -xzvf vue_backup.tar.gz
   ```

### 后端设置

1. 进入后端项目目录：
   ```bash
   cd we_chatbot
   ```

2. 创建并激活Python虚拟环境：
   ```bash
   python -m venv venv
   # Windows:
   venv\Scripts\activate
   # Linux/Mac:
   source venv/bin/activate
   ```

3. 安装依赖：
   ```bash
   pip install -r requirements.txt
   ```

4. 配置环境变量：
   创建或编辑`.env`文件，添加以下内容（根据实际情况修改）：
   ```
   DEEPSEEK_API_KEY=your_api_key_here
   DEEPSEEK_API_BASE=your_api_base_url_here
   ```

### 前端设置

1. 进入前端项目目录：
   ```bash
   # 原始版本
   cd VUE/vue3-init-demo
   ```

2. 安装依赖：
   ```bash
   npm install
   # 或使用yarn
   yarn install
   ```

## 运行项目

### 启动后端服务

1. 确保你在后端项目目录并且虚拟环境已激活：
   ```bash
   cd we_chatbot
   # 如果虚拟环境未激活，请激活它
   ```

2. 启动FastAPI服务：
   ```bash
   python -m api.main
   ```
   服务将在 `http://localhost:8003` 上运行。

### 启动前端服务

1. 确保你在前端项目目录中：
   ```bash
   cd VUE/vue3-init-demo 
   ```

2. 启动开发服务器：
   ```bash
   npm run dev
   # 或使用yarn
   yarn dev
   ```
   
3. 浏览器会自动打开或你可以访问：
   ```
   http://localhost:5173
   ```

## 使用指南

1. **登录系统**：使用默认账号或注册新账号
2. **上传文档**：点击左侧面板的"上传新文件"按钮上传Word文档
3. **处理文档**：
   - 在聊天框中输入"公文纠错"进行基本纠错
   - 输入"润色文档"进行表达优化
   - 输入其他具体指令进行特定处理
4. **查看历史**：左侧面板显示历史对话，可以点击任意历史对话继续之前的会话
5. **下载处理后的文档**：处理完成后，可以下载修改后的文档

## 历史记录功能

历史记录功能流程如下：
1. 用户点击"新对话"后，当前对话保存为历史对话，显示在左侧栏中
2. 创建全新的空白对话供用户使用
3. 用户可以随时点击左侧历史记录中的任一对话，继续之前的对话

## 常见问题

1. **服务连接问题**：如果前端无法连接后端，请检查后端服务是否正常运行，以及`.env`文件中的配置是否正确。

2. **文件上传失败**：确保上传的是.docx格式文件，且文件大小不超过系统限制。

3. **依赖安装错误**：尝试清除缓存后重新安装
   ```bash
   # 后端
   pip uninstall -r requirements.txt -y
   pip install -r requirements.txt
   
   # 前端
   npm cache clean --force
   npm install
   ```

4. **AI响应速度慢**：确保您的API密钥配置正确，且网络连接稳定。

## 贡献与支持

如有问题或建议，请通过GitHub Issues提交反馈。 
