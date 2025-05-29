# we_chatbot 项目 API 文档

## 目录

- [概述](#概述)
- [API 接口](#api-接口)
  - [用户认证](#用户认证)
  - [文档管理](#文档管理)
  - [聊天接口](#聊天接口)
  - [纠错接口](#纠错接口)
- [MCP 协议接口](#mcp-协议接口)
  - [纠错工具](#纠错工具)
  - [润色工具](#润色工具)
  - [总结工具](#总结工具)
  - [写作工具](#写作工具)
- [客户端接口](#客户端接口)
- [错误处理](#错误处理)
- [使用示例](#使用示例)

## 概述

we_chatbot 项目提供了一系列 API 接口，用于实现文档处理、聊天和纠错功能。主要包括 FastAPI 实现的 RESTful API 和基于 MCP 协议的工具接口。

## API 接口

### 用户认证

#### 登录

```
POST /api/login
```

**请求参数**

```json
{
  "userid": "用户ID",
  "password": "密码"
}
```

**响应**

```json
{
  "code": 200,
  "data": {
    "user": {
      "userid": "用户ID",
      "name": "用户名称"
    },
    "token": "认证令牌"
  },
  "msg": "登录成功"
}
```

### 文档管理

#### 上传文档

```
POST /api/upload-document
```

**请求参数**

- `file`: 文件对象（multipart/form-data）

**响应**

```json
{
  "document_id": "文档ID",
  "content": "文档内容",
  "message": "上传成功"
}
```

#### 获取文档列表

```
POST /api/list
```

**响应**

```json
{
  "code": 200,
  "data": {
    "list": [
      {
        "id": "文档ID",
        "filename": "文件名",
        "created_at": "创建时间"
      }
    ]
  },
  "msg": "获取成功"
}
```

#### 预览文档

```
GET /api/preview?id={document_id}
```

**响应**

文档二进制内容，Content-Type 为 application/vnd.openxmlformats-officedocument.wordprocessingml.document

#### 下载文档

```
POST /api/download
```

**请求参数**

```json
{
  "id": "文档ID"
}
```

**响应**

文档二进制内容，Content-Type 为 application/vnd.openxmlformats-officedocument.wordprocessingml.document

#### 删除文档

```
DELETE /api/delete/{id}
```

**响应**

```json
{
  "code": 200,
  "msg": "删除成功"
}
```

#### 获取文档内容

```
GET /api/file/content?file_id={file_id}&include_processed={true|false}
```

**响应**

```json
{
  "content": "文档内容",
  "processed_content": "处理后的内容（如果include_processed为true）"
}
```

#### 切换文档

```
POST /api/document/switch
```

**请求参数**

```json
{
  "document_id": "文档ID"
}
```

**响应**

```json
{
  "status": "success",
  "document": {
    "id": "文档ID",
    "filename": "文件名",
    "content": "文档内容"
  }
}
```

### 聊天接口

#### 发送聊天消息

```
POST /api/chat
```

**请求参数**

```json
{
  "message": "用户消息",
  "document_content": "文档内容（可选）",
  "chat_history": [
    {"role": "user", "content": "历史消息1"},
    {"role": "assistant", "content": "历史回复1"}
  ]
}
```

**响应**

```json
{
  "response": "助手回复",
  "chat_history": [
    {"role": "user", "content": "历史消息1"},
    {"role": "assistant", "content": "历史回复1"},
    {"role": "user", "content": "用户消息"},
    {"role": "assistant", "content": "助手回复"}
  ],
  "processed_document": "处理后的文档内容（如果有）"
}
```

#### 流式聊天

```
GET /api/stream-chat?message={message}&document_content={document_content}&chat_history={chat_history}
```

**响应**

Server-Sent Events (SSE) 格式的流式响应

### 纠错接口

#### MCP 协议纠错

```
POST /api/mcp/correction
```

**请求参数**

```json
{
  "file_id": "文件ID",
  "type": "correction|polish|summary"
}
```

**响应**

```json
{
  "status": "success",
  "message": "文档已完成纠错",
  "changes": "修改说明",
  "modified": true
}
```

#### 获取处理后的文档内容

```
GET /api/get-processed-content?file_id={file_id}
```

或

```
GET /api/mcp/get-processed-content?file_id={file_id}
```

**响应**

处理后的文档二进制内容，Content-Type 为 application/vnd.openxmlformats-officedocument.wordprocessingml.document

#### 预览修改后的文档

```
POST /api/preview-modified
```

或

```
GET /api/preview-modified?file_id={file_id}
```

**请求参数**

```json
{
  "file_id": "文件ID"
}
```

**响应**

修改后的文档二进制内容，Content-Type 为 application/vnd.openxmlformats-officedocument.wordprocessingml.document

## MCP 协议接口

MCP (Model-Call Protocol) 是一种简单的 JSON-RPC 协议，用于调用模型服务。

### 纠错工具

```
方法名: 纠错算法
```

**请求参数**

```json
{
  "jsonrpc": "2.0",
  "id": "请求ID",
  "method": "纠错算法",
  "params": {
    "text": "需要纠错的文本"
  }
}
```

**响应**

```json
{
  "jsonrpc": "2.0",
  "id": "请求ID",
  "result": {
    "corrected_text": "纠错后的文本",
    "modifications": "修改说明",
    "status": "success"
  }
}
```

### 润色工具

```
方法名: 润色工具
```

**请求参数**

```json
{
  "jsonrpc": "2.0",
  "id": "请求ID",
  "method": "润色工具",
  "params": {
    "text": "需要润色的文本"
  }
}
```

**响应**

```json
{
  "jsonrpc": "2.0",
  "id": "请求ID",
  "result": {
    "polished_text": "润色后的文本",
    "modifications": "修改说明",
    "status": "success"
  }
}
```

### 总结工具

```
方法名: 总结工具
```

**请求参数**

```json
{
  "jsonrpc": "2.0",
  "id": "请求ID",
  "method": "总结工具",
  "params": {
    "text": "需要总结的文本"
  }
}
```

**响应**

```json
{
  "jsonrpc": "2.0",
  "id": "请求ID",
  "result": {
    "summary": "总结后的文本",
    "key_points": "关键点",
    "status": "success"
  }
}
```

### 写作工具

```
方法名: 写作工具
```

**请求参数**

```json
{
  "jsonrpc": "2.0",
  "id": "请求ID",
  "method": "写作工具",
  "params": {
    "text": "写作提示"
  }
}
```

**响应**

```json
{
  "jsonrpc": "2.0",
  "id": "请求ID",
  "result": {
    "writing_content": "生成的文档内容",
    "reply_message": "回复消息",
    "status": "success"
  }
}
```

## 客户端接口

### SimpleMCPTool

`SimpleMCPTool` 类提供了一个简单的 MCP 客户端接口，用于调用 MCP 服务。

#### 初始化

```python
from mcp.client import SimpleMCPTool

# 初始化客户端
client = SimpleMCPTool(endpoint="http://localhost:8000")  # 可选，如果不提供则使用子进程调用
```

#### 调用方法

```python
# 异步调用
result = await client.call("纠错算法", text="需要纠错的文本")

# 同步调用纠错
result = client.correct_text("需要纠错的文本")

# 同步调用润色
result = client.polish_text("需要润色的文本")

# 同步调用总结
result = client.summarize_text("需要总结的文本")

# 同步调用写作
result = client.writing_text("写作提示")
```

## 错误处理

所有 API 接口在发生错误时都会返回相应的错误信息：

### HTTP 错误

- 400 Bad Request: 请求参数错误
- 401 Unauthorized: 未授权
- 404 Not Found: 资源不存在
- 500 Internal Server Error: 服务器内部错误

### MCP 错误

```json
{
  "jsonrpc": "2.0",
  "id": "请求ID",
  "error": {
    "code": 错误码,
    "message": "错误信息"
  }
}
```

## 使用示例

### 使用 FastAPI 接口进行文档纠错

```python
import requests

# 上传文档
files = {"file": open("document.docx", "rb")}
response = requests.post("http://localhost:8000/api/upload-document", files=files)
document_id = response.json()["document_id"]

# 进行纠错
correction_data = {"file_id": document_id, "type": "correction"}
response = requests.post("http://localhost:8000/api/mcp/correction", json=correction_data)

# 获取处理后的文档
response = requests.get(f"http://localhost:8000/api/get-processed-content?file_id={document_id}")
with open("corrected_document.docx", "wb") as f:
    f.write(response.content)
```

### 使用 MCP 客户端进行文本纠错

```python
from mcp.client import SimpleMCPTool
import asyncio

async def correct_document():
    client = SimpleMCPTool()
    result = await client.call("纠错算法", text="需要纠错的文本内容")
    print(f"纠错结果: {result}")

asyncio.run(correct_document()) 