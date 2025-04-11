# 文档处理与智能问答系统

基于FastAPI和Next.js构建的文档处理与智能问答系统，支持公文纠错、内容优化以及智能问答功能。

## 功能特点

- **文档处理**：上传.docx文件进行处理，支持公文纠错和格式优化
- **原文与纠错对比**：清晰展示原始内容和纠错后的内容对比，方便用户查看修改
- **智能问答**：基于大模型的聊天问答系统，能够解答文档内容相关问题
- **纠错反馈**：对纠错结果提供满意度反馈，支持重新纠错
- **文档管理**：支持上传多个文档，维护文档历史记录，随时查看和删除历史文档
- **文档迭代处理**：选择文档对话后，可将处理结果保存回文档，支持在已处理文档上持续迭代优化
- **高效文档读取**：采用异步文档读取技术，提高大文档的处理速度和响应效率

## 系统工作流程

| 功能模块 | 工作流程步骤 | 技术实现 | 用户交互 |
|---------|------------|----------|---------|
| **文档处理** | 1. 用户上传.docx文件<br>2. 提取文档内容<br>3. 大模型分析与纠错<br>4. 生成纠错结果<br>5. 提供对比视图<br>6. 导出处理后文档 | • DocProcessor.load_doc()<br>• DeepSeek Chat模型<br>• API: /api/process-document<br>• API: /api/download-result<br>• 异步文档读取 | • 上传公文按钮<br>• 原文与纠错对比界面<br>• 下载纠错结果按钮 |
| **文档管理** | 1. 维护文档历史<br>2. 提供文档列表<br>3. 支持删除文档<br>4. 选择历史文档<br>5. 保存处理结果 | • 本地存储文档历史<br>• API: /api/save-document<br>• 版本时间戳管理 | • 文档历史列表<br>• 文档选择功能<br>• 文档删除按钮<br>• 更新文档按钮 |
| **智能问答** | 1. 用户提交问题<br>2. 意图分类<br>3. 根据意图选择处理流程<br>4. 生成回复<br>5. 维护对话历史 | • IntentClassifier.classify()<br>• 大模型处理<br>• API: /api/chat<br>• 意图类型: chat/correction/recorrection | • 聊天输入框<br>• 对话界面<br>• 历史消息记录 |
| **意图识别** | 1. 接收用户输入<br>2. 正则匹配意图模式<br>3. 返回意图类型<br>4. 特殊类型识别(历史纠错等) | • 正则表达式匹配<br>• 多模式分类<br>• IntentClassifier类的方法 | • 自动识别无需用户选择<br>• 根据用户自然语言推断意图 |
| **文件管理** | 1. 上传文件处理<br>2. 临时文件存储<br>3. 结果文件生成<br>4. 提供下载 | • UploadFile处理<br>• tempfile模块<br>• FileResponse返回<br>• python-docx处理 | • 文件上传界面<br>• 下载按钮<br>• 处理状态指示 |

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
# docker 中下载 mysql
```bash
docker pull mysql

#启动
docker run --name mysql -p 3306:3306 -e MYSQL_ROOT_PASSWORD=Lzslov123! -d mysql （你的密码）

#进入容器
docker exec -it mysql bash

#登录mysql
mysql -u root -p
ALTER USER 'root'@'localhost' IDENTIFIED BY 'Lzslov123!';（你的密码）
#建数据库
CREATE DATABASE IF NOT EXISTS user_management;
USE user_management;

CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    password VARCHAR(100) NOT NULL,
    email VARCHAR(100) NOT NULL UNIQUE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE
);
#插入
INSERT INTO users (username, password, email, created_at, is_active) VALUES
('alice_jan', 'pass123', 'alice@example.com', '2025-01-15 10:30:00', TRUE),
('bob_feb', 'secret456', 'bob@example.com', '2025-02-10 14:22:00', TRUE),
('charlie_mar', 'mypwd789', 'charlie@example.com', '2025-03-05 09:10:00', FALSE),
('diana_apr', 'pwd321', 'diana@example.com', '2025-04-01 18:45:00', TRUE),
('edward_may', 'abc987', 'edward@example.com', '2025-05-03 11:11:00', TRUE);
#查看
SELECT * FROM users;
```
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

## 常见问题与解决方案

### Windows PowerShell执行策略限制

在Windows PowerShell中可能会遇到执行策略限制的问题:

```
无法加载文件，因为在此系统上禁止运行脚本。有关详细信息，请参阅 about_Execution_Policies。
```

**解决方案**:
1. 以管理员身份运行PowerShell
2. 执行以下命令修改执行策略:
   ```
   Set-ExecutionPolicy RemoteSigned
   ```
3. 输入"Y"确认更改

### PowerShell命令分隔符问题

在PowerShell中，`&&`不是有效的命令分隔符，会出现如下错误:

```
标记"&&"不是此版本中的有效语句分隔符。
```

**解决方案**:
- 在PowerShell中使用分号`;`代替`&&`分隔命令:
  ```
  conda activate my_chat; python -m api.main
  ```

### 依赖模块缺失

启动时可能遇到依赖模块缺失的问题:

```
ModuleNotFoundError: No module named 'fastapi'
```

**解决方案**:
1. 确保已激活正确的虚拟环境:
   ```
   conda activate my_chat
   ```
2. 安装必要的依赖包:
   ```
   pip install -r requirements.txt
   ```
3. 如果使用Conda但命令不可用，可尝试:
   ```
   D:\Anaconda\condabin\conda.bat activate my_chat
   ```

### API密钥设置

**解决方案**:
- 在PowerShell中设置环境变量使用`$env:`前缀:
  ```
  $env:DEEPSEEK_API_KEY="your_api_key"
  $env:DEEPSEEK_API_BASE="https://api.deepseek.com"
  ```

## 使用指南

1. 打开浏览器访问前端页面 (默认为 http://localhost:3000)
2. 选择"文档处理"标签，上传.docx文件
3. 系统将自动进行处理，并显示纠错结果
4. 查看原文与纠错对比，下载处理后的文档
5. 可在左侧文档历史中选择之前上传的文档
6. 对文档进行处理后，可点击"更新文档"保存处理结果
7. 可切换到"聊天问答"标签进行内容相关提问

## 许可证

MIT 
