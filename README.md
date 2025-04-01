# 文档处理与智能问答系统

基于FastAPI和Next.js构建的文档处理与智能问答系统，支持公文纠错、内容优化以及智能问答功能。

## 功能特点

- **文档处理**：上传.docx文件进行处理，支持公文纠错和格式优化
- **原文与纠错对比**：清晰展示原始内容和纠错后的内容对比，方便用户查看修改
- **智能问答**：基于大模型的聊天问答系统，能够解答文档内容相关问题
- **多版本纠错**：提供多种纠错风格可选，包括标准格式、简明扼要和详细解释
- **渐进式纠错**：支持分步骤纠错，包括格式、语法和表达优化

## 技术栈

- **后端**：FastAPI + Python + LangChain
- **前端**：Next.js + React + TurboRepo
- **AI模型**：DeepSeek Chat 或其他大语言模型
- **文档处理**：python-docx, docx2txt

## 安装与使用

### 环境要求

- Python 3.8+
- Node.js 18+
- Conda (可选)

### 后端设置

```bash
# 创建并激活环境
conda create -n my_chat python=3.10
conda activate my_chat

# 安装依赖
pip install -r requirements.txt

# 设置环境变量
export DEEPSEEK_API_KEY=your_api_key
export DEEPSEEK_API_BASE=your_api_base_url

# 启动后端服务
python -m api.main
```

### 前端设置

```bash
# 进入前端目录
cd doc-frontend

# 安装依赖
npm install

# 启动开发服务器
npm run dev
```

## 使用指南

1. 打开浏览器访问前端页面 (默认为 http://localhost:3000)
2. 选择"文档处理"标签，上传.docx文件
3. 系统将自动进行处理，并显示纠错结果
4. 查看原文与纠错对比，下载处理后的文档
5. 可切换到"聊天问答"标签进行内容相关提问

## 许可证

MIT 