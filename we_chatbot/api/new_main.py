from fastapi import FastAPI, UploadFile, File, HTTPException, Body, Request, Response
from fastapi.responses import FileResponse, StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
import os
import tempfile
import sys
import shutil
import json
from typing import List, Dict, Any, Optional
from pydantic import BaseModel
# 注释掉数据库导入
# from admin.auth.routes import router as auth_router
# from admin.database import Base, engine
# 导入DocProcessor和相关组件
from my_agent.utils.shared.doc_processor import DocProcessor
from my_agent.utils.shared.intent_classifier import IntentClassifier
from langchain_openai import ChatOpenAI
import os
from dotenv import load_dotenv
# 添加当前目录到系统路径
current_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, current_dir)
import re
import asyncio
from io import BytesIO
from datetime import datetime
from pathlib import Path
# 导入agent_tools中的MCP公文纠错模块 - 更新导入方式
from my_agent.agent_tools import csc as mcp_csc

# 全局变量，用于存储最近上传的文档
last_uploaded_document = None
# 全局变量，用于存储当前文件列表
file_list = []
# 全局变量，记录用户会话是否进入强制公文纠错模式
forced_correction_mode = {}

# 首先创建FastAPI应用实例
app = FastAPI(title="文档处理API")

# 配置CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # 允许所有源
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 定义临时文件路径
TEMP_DIR = tempfile.gettempdir()

# 加载环境变量和初始化模型
load_dotenv()
deepseek_api_key = os.getenv("DEEPSEEK_API_KEY")
deepseek_base_url = os.getenv("DEEPSEEK_API_BASE")
os.environ["OPENAI_API_KEY"] = deepseek_api_key
os.environ["OPENAI_API_BASE"] = deepseek_base_url
llm = ChatOpenAI(model="deepseek-chat")

# 闲聊计数器 - 全局变量
chat_counter = {}

# 定义请求和响应模型
class UploadDocumentResponse(BaseModel):
    document_id: str
    content: str
    message: str

class ChatRequest(BaseModel):
    message: str
    document_content: str = None  # 新增文档内容字段
    chat_history: list = []

class ChatResponse(BaseModel):
    response: str
    chat_history: list
    processed_document: str = None  # 新增处理后的文档内容字段

class SaveDocumentRequest(BaseModel):
    document_id: str
    content: str
    filename: str = "processed_document.docx"

# 添加登录请求和响应模型
class LoginRequest(BaseModel):
    userid: str
    password: str

class LoginResponseData(BaseModel):
    user: dict
    token: str

class LoginResponse(BaseModel):
    code: int
    data: LoginResponseData
    msg: str

# 定义路由
@app.get("/")
def read_root():
    return {"message": "Welcome to the User Management System"}

# 添加健康检查API
@app.get("/api/health-check")
async def health_check():
    """健康检查端点"""
    return {
        "code": 200,
        "data": {"status": "ok"},
        "msg": "服务器连接正常"
    }

# 添加简单的登录API端点
@app.post("/api/login", response_model=LoginResponse)
async def login(login_request: LoginRequest):
    """处理用户登录请求"""
    # 这里简化处理，只要提供了用户名和密码就认为登录成功
    if login_request.userid and login_request.password:
        # 返回模拟的用户信息和token，包装为前端期望的格式
        response_data = {
            "user": {
                "userid": login_request.userid,
                "username": login_request.userid,
                "role": "user"
            },
            "token": "mock_token_123456789"
        }
        
        # 包装为前端期望的格式
        return {
            "code": 200,
            "data": response_data,
            "msg": "登录成功"
        }
    else:
        raise HTTPException(status_code=401, detail="用户名或密码错误")

# 修改文档上传函数，添加对file为None的处理
@app.post("/api/upload-document")
async def upload_document(file: UploadFile = None):
    """上传Word文档并返回内容，不进行处理"""
    # 存储最近上传的文档内容
    global last_uploaded_document
    
    # 如果file为None，返回上次上传的文档内容
    if file is None:
        if not last_uploaded_document:
            raise HTTPException(status_code=404, detail="没有已上传的文档")
        return last_uploaded_document
    
    if not file.filename.endswith(('.docx')):
        raise HTTPException(status_code=400, detail="只支持.docx格式文件")
    
    try:
        # 读取文件内容到内存
        file_content = await file.read()
        
        # 直接从内存流读取文档，避免临时文件I/O开销
        content = DocProcessor.load_doc_stream(file_content, file.filename)
        
        # 生成唯一文档ID
        document_id = str(hash(content + file.filename))
        
        # 保存最近上传的文档
        last_uploaded_document = {
            "document_id": document_id,
            "content": content,
            "original_content": content,
            "filename": file.filename,
            "message": "文档上传成功，请在聊天框中输入处理指令"
        }
        
        return last_uploaded_document
        
    except Exception as e:
        print(f"处理文档时出错: {str(e)}")
        raise HTTPException(status_code=500, detail=f"处理文档时出错: {str(e)}")

@app.post("/api/process-document", deprecated=True)
async def process_document_api(file: UploadFile = File(...)):
    """上传并处理Word文档 (已弃用，保留兼容)"""
    return await upload_document(file)

# 修改聊天接口，处理带有文档内容的请求
@app.post("/api/chat", response_model=ChatResponse)
async def chat_endpoint(chat_request: ChatRequest, request: Request):
    """处理聊天请求，支持文档处理"""
    try:
        print(f"Received chat request: {chat_request.message[:100]}...")
        
        # 准备消息历史
        messages = chat_request.chat_history.copy()
        
        # 检查是否有文档内容，如果没有，尝试从最近上传的文档中获取
        document_content = chat_request.document_content
        if (document_content is None or document_content.strip() == "") and last_uploaded_document:
            document_content = last_uploaded_document["content"]
            print(f"使用最近上传的文档内容，长度: {len(document_content)}")
        
        has_document = document_content is not None and document_content.strip() != ""
        
        # 进行意图分类
        intent = IntentClassifier.classify(chat_request.message)
        print(f"Intent classified as: {intent}")
        
        # 获取客户端IP地址作为会话ID
        client_ip = request.client.host
        session_id = f"session_{client_ip}"
        print(f"Using session ID: {session_id}")
        
        # 初始化会话计数器
        if session_id not in chat_counter:
            chat_counter[session_id] = 0
            print(f"Initialized chat counter for {session_id}")
            
        # 如果是聊天意图，增加计数
        if intent == "chat":
            chat_counter[session_id] += 1
            print(f"Increased chat counter for {session_id} to {chat_counter[session_id]}")
            
        # 检查是否超过闲聊次数限制
        if intent == "chat" and chat_counter[session_id] > 3:
            # 重置意图为强制文档处理
            intent = "forced_correction"
            # 添加用户消息到历史
            messages.append({"role": "user", "content": chat_request.message})
            # 添加系统消息，引导用户回到公文纠错
            guidance_message = "您已经闲聊超过3次，请回到公文纠错相关任务。您可以尝试输入「纠错」、「润色」等指令来处理您的文档。"
            messages.append({"role": "assistant", "content": guidance_message})
            
            return {
                "response": guidance_message,
                "chat_history": messages,
                "processed_document": None
            }
            
        # 根据意图处理
        if intent in ["correction", "writing", "recorrection", "forced_correction"]:
            # 检查是否有文档内容
            if not has_document:
                # 文档内容缺失，提示用户上传文档
                messages.append({"role": "user", "content": chat_request.message})
                no_doc_message = "请先上传Word文档再进行公文纠错。您可以点击左侧面板的「上传文档」按钮上传文件。"
                messages.append({"role": "assistant", "content": no_doc_message})
                
                return {
                    "response": no_doc_message,
                    "chat_history": messages,
                    "processed_document": None
                }
            
            # 修改为使用MCP协议封装的CSC纠错服务
            print("使用MCP协议的CSC服务处理文档...")
            
            # 调用MCP服务进行文档纠错
            csc_result = mcp_csc(document_content)
            
            if csc_result["status"] == "success":
                # 获取处理后的文档内容
                if csc_result.get("modified", False):
                    processed_document = csc_result["corrected_text"]
                    processing_message = f"文档纠错完成，共进行了以下修改：\n{csc_result.get('changes', '未提供详细修改说明')}"
                else:
                    processed_document = document_content
                    processing_message = csc_result.get("message", "文档未发现需要纠错的内容，已保持原文。")
                
                # 将用户消息添加到聊天历史
                messages.append({"role": "user", "content": chat_request.message})
                
                # 将处理结果添加到聊天历史
                success_message = f"已完成文档纠错。{processing_message}"
                messages.append({"role": "assistant", "content": success_message})
                
                # 保存处理后的文档到全局变量
                if last_uploaded_document:
                    last_uploaded_document["processed_content"] = processed_document
                
                # 返回处理结果和更新后的聊天历史
                return {
                    "response": success_message,
                    "chat_history": messages,
                    "processed_document": processed_document
                }
            else:
                # 处理失败，回退到原始的LLM处理方式
                print("MCP服务处理失败，回退到LLM处理...")
                error_message = csc_result.get("message", "MCP服务处理失败")
                print(f"错误: {error_message}")
                
            # 构建包含文档内容的系统提示
            system_prompt = "你是一个专业的文档处理助手。请根据用户的指令处理以下文档内容。"
            
            # 将文档内容和用户指令组合成完整提示
            full_prompt = f"文档内容:\n{document_content}\n\n用户指令:\n{chat_request.message}"
            
            # 准备消息序列
            doc_messages = [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": full_prompt}
            ]
            
            # 调用模型处理文档
            print("转为调用大语言模型处理文档...")
            response = llm.invoke(doc_messages)
            
            # 将用户消息添加到聊天历史
            messages.append({"role": "user", "content": chat_request.message})
            
            # 将模型响应添加到聊天历史
            fallback_message = "MCP服务暂时不可用，已使用备用方法处理您的文档。处理结果已显示在中间区域。"
            messages.append({"role": "assistant", "content": fallback_message})
            
            # 保存处理后的文档到全局变量
            if last_uploaded_document:
                last_uploaded_document["processed_content"] = response.content
            
            # 返回处理结果和更新后的聊天历史
            return {
                    "response": fallback_message,
                "chat_history": messages,
                    "processed_document": response.content
            }
        else:
            # 普通聊天处理
            # 添加用户新消息
            messages.append({"role": "user", "content": chat_request.message})
            
            # 构建系统提示
            system_prompt = """你是小公，一个智能公文助手。
当用户询问你的身份、名字、是谁、介绍自己等类似问题时，必须回答：
"我是小公，您的智能公文助手！"

请以自然、友好的方式回答用户的其他问题。
记住，不要透露你是AI、大模型或DeepSeek Chat，而应始终以我是小公身份回答。"""
            
            # 添加系统消息到开始
            full_messages = [{"role": "system", "content": system_prompt}] + messages
            
            try:
                # 调用模型生成回复
                response = llm.invoke(full_messages)
                
                # 添加助手回复到历史
                messages.append({"role": "assistant", "content": response.content})
                
                # 返回结果
                return {
                    "response": response.content,
                    "chat_history": messages,
                    "processed_document": None
                }
            except Exception as e:
                print(f"模型调用出错: {str(e)}")
                error_message = "处理您的请求时出错，请稍后再试。"
                messages.append({"role": "assistant", "content": error_message})
                
            return {
                    "response": error_message,
                "chat_history": messages,
                    "processed_document": None
            }
            
    except Exception as e:
        print(f"Chat endpoint error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"处理聊天请求时出错: {str(e)}")

@app.get("/api/download-result")
async def download_result():
    """下载处理结果文件"""
    try:
        file_path = os.path.join(TEMP_DIR, "processed_document.docx")
        # 检查文件是否存在
        if not os.path.exists(file_path):
            raise HTTPException(status_code=404, detail="处理结果文件不存在")
        return FileResponse(
