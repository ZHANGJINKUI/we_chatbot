from fastapi import FastAPI, UploadFile, File, HTTPException, Body
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
import os
import tempfile
import sys
import shutil
from pydantic import BaseModel
from admin.auth.routes import router as auth_router
from admin.database import Base, engine
# 导入DocProcessor和相关组件
from my_agent.utils.shared.doc_processor import DocProcessor
from my_agent.utils.shared.intent_classifier import IntentClassifier
from langchain_openai import ChatOpenAI
import os
from dotenv import load_dotenv
# 添加当前目录到系统路径
current_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, current_dir)

app = FastAPI(title="文档处理API")
Base.metadata.create_all(bind=engine)
app.include_router(auth_router)
@app.get("/")
def read_root():
    return {"message": "Welcome to the User Management System"}
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

# 定义文档上传请求响应模型
class UploadDocumentResponse(BaseModel):
    document_id: str
    content: str
    message: str

# 定义聊天请求和响应模型
class ChatRequest(BaseModel):
    message: str
    document_content: str = None  # 新增文档内容字段
    chat_history: list = []

class ChatResponse(BaseModel):
    response: str
    chat_history: list
    processed_document: str = None  # 新增处理后的文档内容字段

# 保存文档内容的模型
class SaveDocumentRequest(BaseModel):
    document_id: str
    content: str
    filename: str = "processed_document.docx"

# 简化的文档上传接口，只读取内容不处理
@app.post("/api/upload-document")
async def upload_document(file: UploadFile = File(...)):
    """上传Word文档并返回内容，不进行处理"""
    if not file.filename.endswith(('.docx')):
        raise HTTPException(status_code=400, detail="只支持.docx格式文件")
    
    try:
        # 读取文件内容到内存
        file_content = await file.read()
        
        # 直接从内存流读取文档，避免临时文件I/O开销
        content = DocProcessor.load_doc_stream(file_content, file.filename)
        
        # 生成唯一文档ID
        document_id = str(hash(content + file.filename))
        
        return {
            "document_id": document_id,
            "content": content,
            "original_content": content,  # 添加原始内容字段以兼容前端
            "message": "文档上传成功，请在聊天框中输入处理指令"
        }
        
    except Exception as e:
        print(f"处理文档时出错: {str(e)}")
        raise HTTPException(status_code=500, detail=f"处理文档时出错: {str(e)}")

@app.post("/api/process-document", deprecated=True)
async def process_document_api(file: UploadFile = File(...)):
    """上传并处理Word文档 (已弃用，保留兼容)"""
    return await upload_document(file)

# 修改聊天接口，处理带有文档内容的请求
@app.post("/api/chat", response_model=ChatResponse)
async def chat_endpoint(chat_request: ChatRequest):
    """处理聊天请求，支持文档处理"""
    try:
        print(f"Received chat request: {chat_request.message[:100]}...")
        
        # 准备消息历史
        messages = chat_request.chat_history.copy()
        
        # 检查是否有文档内容
        has_document = chat_request.document_content is not None and chat_request.document_content.strip() != ""
        
        # 如果包含文档内容，构建包含文档的提示
        if has_document:
            # 构建包含文档内容的系统提示
            system_prompt = "你是一个专业的文档处理助手。请根据用户的指令处理以下文档内容。"
            
            # 将文档内容和用户指令组合成完整提示
            full_prompt = f"文档内容:\n{chat_request.document_content}\n\n用户指令:\n{chat_request.message}"
            
            # 准备消息序列
            doc_messages = [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": full_prompt}
            ]
            
            # 调用模型处理文档
            print("Calling model for document processing...")
            response = llm.invoke(doc_messages)
            
            # 将用户消息添加到聊天历史
            messages.append({"role": "user", "content": chat_request.message})
            
            # 将模型响应添加到聊天历史
            messages.append({"role": "assistant", "content": f"已根据您的指令处理文档，处理结果已显示在中间区域。"})
            
            # 返回处理结果和更新后的聊天历史
            return {
                "response": f"已根据您的指令处理文档，处理结果已显示在中间区域。",
                "chat_history": messages,
                "processed_document": response.content  # 返回处理后的文档内容
            }
        else:
            # 普通聊天处理
            # 添加用户新消息
            messages.append({"role": "user", "content": chat_request.message})
            
            # 基于意图分类处理消息
            intent = IntentClassifier.classify(chat_request.message)
            print(f"Intent classified as: {intent}")
            
            # 调用现有的处理逻辑
            # ... 现有的处理代码 ...
            
            # 构建系统提示
            system_prompt = "你是DeepSeek Chat开发的AI助手，正在与用户进行普通聊天对话。请用自然、友好的方式回答用户问题。"
            
            # 准备聊天消息
            chat_messages = [
                {"role": "system", "content": system_prompt},
            ] + messages
            
            # 调用模型进行聊天
            chat_response = llm.invoke(chat_messages)
            
            # 将模型回复添加到聊天历史
            messages.append({"role": "assistant", "content": chat_response.content})
            
            # 返回聊天结果
            return {
                "response": chat_response.content,
                "chat_history": messages,
                "processed_document": None  # 普通聊天没有处理后的文档
            }
            
    except Exception as e:
        print(f"Error processing chat request: {str(e)}")
        raise HTTPException(status_code=500, detail=f"处理聊天请求时出错: {str(e)}")

@app.get("/api/download-result")
async def download_result():
    """下载处理后的文档"""
    temp_output_path = os.path.join(TEMP_DIR, "output.docx")
    
    if not os.path.exists(temp_output_path):
        raise HTTPException(status_code=404, detail="处理结果不存在，请先处理文档")
    
    return FileResponse(
        path=temp_output_path, 
        filename="processed_document.docx",
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    )

# 添加保存文档接口
@app.post("/api/save-document")
async def save_document(request: SaveDocumentRequest):
    """保存处理后的文档内容，覆盖文档历史"""
    try:
        # 保存到临时文件，用于下载
        temp_output_path = os.path.join(TEMP_DIR, "output.docx")
        
        # 检查内容是否有效
        if not request.content or not request.content.strip():
            raise ValueError("文档内容不能为空")
        
        # 保存文档
        DocProcessor.save_doc(request.content, temp_output_path)
        
        # 返回成功消息
        return {
            "success": True,
            "document_id": request.document_id,
            "message": "文档保存成功"
        }
        
    except ValueError as e:
        print(f"保存文档参数错误: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        print(f"保存文档时出错: {str(e)}")
        raise HTTPException(status_code=500, detail=f"保存文档时出错: {str(e)}")


# 添加健康检查接口
@app.get("/api/health-check")
async def health_check():
    """健康检查接口，用于前端检测服务器连接状态"""
    return {"status": "ok", "message": "服务器连接正常"}

if __name__ == "__main__":
    import uvicorn
    # 更改端口为8003
    uvicorn.run(app, host="0.0.0.0", port=8003) 