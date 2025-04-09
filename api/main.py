from fastapi import FastAPI, UploadFile, File, HTTPException, Body
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
import os
import tempfile
import sys
import shutil
from pydantic import BaseModel
<<<<<<< HEAD
from admin.auth.routes import router as auth_router
from admin.database import Base, engine
=======
import time
import json

# 添加当前目录到系统路径
current_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, current_dir)

>>>>>>> 1a274f1 (Add MCP protocol integration with CSC service, improve frontend UI and error correction functionality)
# 导入DocProcessor和相关组件
from my_agent.utils.shared.doc_processor import DocProcessor
from my_agent.utils.shared.intent_classifier import IntentClassifier
from my_agent.utils.tools import SimpleMCPTool
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
deepseek_api_key = os.getenv("DEEPSEEK_API_KEY", "")
deepseek_base_url = os.getenv("DEEPSEEK_API_BASE", "https://api.deepseek.com/v1")

# 确保API密钥和基础URL不为空
if not deepseek_api_key:
    print("警告：DEEPSEEK_API_KEY环境变量未设置或为空")
    
# 设置环境变量供其他库使用
os.environ["OPENAI_API_KEY"] = deepseek_api_key
os.environ["OPENAI_API_BASE"] = deepseek_base_url
llm = ChatOpenAI(model="deepseek-chat")

# 初始化MCP工具
csc_tool = SimpleMCPTool()

# 定义聊天请求和响应模型
class ChatRequest(BaseModel):
    message: str
    chat_history: list = []

class ChatResponse(BaseModel):
    response: str
    chat_history: list

def process_document(file_path):
    """处理文档内容"""
    print(f"处理文档: {file_path}")
    content = DocProcessor.load_doc(file_path)
    
    # 使用MCP中的CSC进行初步拼写纠错
    try:
        print("使用MCP协议的CSC功能进行拼写纠错...")
        start_time = time.time()
        
        # 使用langgraph中的工具调用CSC功能
        correction_result = csc_tool.correct_text(content)
        elapsed_time = time.time() - start_time
        print(f"CSC调用耗时: {elapsed_time:.2f}秒")
        
        # 解析纠错结果
        if "纠错后的文本" in correction_result and "主要修改" in correction_result:
            # MCP工具返回的结果是字符串，需要解析
            corrected_parts = correction_result.split("\n主要修改:")
            corrected_content = corrected_parts[0].replace("纠错后的文本:", "").strip()
            modifications = corrected_parts[1].strip() if len(corrected_parts) > 1 else ""
            
            if modifications and "文本未发现明显拼写错误" not in modifications:
                print(f"CSC修正成功: {modifications}")
                
                # 构建回复内容 - 直接使用CSC的结果
                response_content = f"""【MCP协议公文纠错专用模式已启用】

修改后的文本：
{corrected_content}

主要修改：
{modifications}
"""
            else:
                print("CSC未发现需要修改的内容")
                # 如果CSC未找到错误，使用大模型进行纠错
                system_prompt = "你是一个专业的公文纠错助手。请对以下内容进行公文格式和语法纠错，指出错误并给出修改建议。在回复的开头添加标记[公文纠错专用模式-文档处理]，以表明这是使用专门的纠错功能处理的。"
                correction_messages = [
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": content}
                ]
                
                print("调用大模型进行文档纠错...")
                correction_response = llm.invoke(correction_messages)
                
                # 添加特定前缀
                response_content = correction_response.content
                if not response_content.startswith("[公文纠错专用模式") and not response_content.startswith("【公文纠错专用模式"):
                    response_content = f"""【公文纠错专用模式-聊天纠错已启用】

{response_content}
"""
        else:
            # 处理无法解析的情况
            print("CSC返回结果格式异常，使用大模型进行文档纠错...")
            system_prompt = "你是一个专业的公文纠错助手。请对以下内容进行公文格式和语法纠错，指出错误并给出修改建议。在回复的开头添加标记[公文纠错专用模式-文档处理]，以表明这是使用专门的纠错功能处理的。"
            correction_messages = [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": content}
            ]
            
            correction_response = llm.invoke(correction_messages)
            
            # 添加特定前缀
            response_content = correction_response.content
            if not response_content.startswith("[公文纠错专用模式") and not response_content.startswith("【公文纠错专用模式"):
                response_content = f"""【公文纠错专用模式-聊天纠错已启用】

{response_content}
"""
    except Exception as e:
        print(f"CSC纠错过程中出错: {e}")
        
        # 如果CSC出错，使用大模型进行纠错
        system_prompt = "你是一个专业的公文纠错助手。请对以下内容进行公文格式和语法纠错，指出错误并给出修改建议。在回复的开头添加标记[公文纠错专用模式-文档处理]，以表明这是使用专门的纠错功能处理的。"
        correction_messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": content}
        ]
        
        print("调用大模型进行文档纠错...")
        correction_response = llm.invoke(correction_messages)
        
        # 添加特定前缀
        response_content = correction_response.content
        if not response_content.startswith("[公文纠错专用模式") and not response_content.startswith("【公文纠错专用模式"):
            response_content = f"""【公文纠错专用模式-聊天纠错已启用】

{response_content}
"""
    
    return {
        "original_content": content,
        "corrected_content": response_content
    }

@app.post("/api/process-document")
async def process_document_api(file: UploadFile = File(...)):
    """上传并处理Word文档"""
    if not file.filename.endswith(('.docx')):
        raise HTTPException(status_code=400, detail="只支持.docx格式文件")
    
    # 保存上传的文件
    temp_input_path = os.path.join(TEMP_DIR, "input.docx")
    temp_output_path = os.path.join(TEMP_DIR, "output.docx")
    
    try:
        # 保存上传的文件
        with open(temp_input_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        
        # 处理文档
        result = process_document(temp_input_path)
        
        # 保存处理结果
        DocProcessor.save_doc(result["corrected_content"], temp_output_path)
        
        # 返回处理后的文本内容和原始内容
        return {
            "original_content": result["original_content"],
            "content": result["corrected_content"]
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"处理文档时出错: {str(e)}")

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

@app.post("/api/chat", response_model=ChatResponse)
async def chat_endpoint(chat_request: ChatRequest):
    """处理聊天请求"""
    try:
        print(f"收到聊天请求: {chat_request.message[:50]}...")
        
        # 准备消息历史
        messages = chat_request.chat_history.copy()
        
        # 检查是否是反馈消息 (通过JSON字符串发送的特殊格式)
        try:
            if chat_request.message.startswith('{') and '"type":"correction_feedback"' in chat_request.message:
                feedback_data = json.loads(chat_request.message)
                print(f"检测到纠错反馈消息: 用户{'' if feedback_data.get('satisfied') else '不'}满意")
                
                # 创建反馈消息对象
                feedback_message = {
                    "role": "user",
                    "content": "用户反馈",
                    "type": "correction_feedback",
                    "satisfied": feedback_data.get("satisfied", False),
                    "original_text": feedback_data.get("original_text", "")
                }
                
                # 添加反馈消息到历史
                messages.append(feedback_message)
                
                # 根据反馈决定下一步操作
                if not feedback_data.get("satisfied", False):
                    # 检查重新纠错次数
                    current_count = 0
                    # 从会话历史中查找之前的重新纠错次数
                    for msg in messages:
                        if msg.get("content") == "用户反馈" and msg.get("type") == "correction_feedback" and not msg.get("satisfied", True):
                            current_count += 1
                    
                    # 检查是否超过最大尝试次数(3次)
                    if current_count > 3:
                        print(f"已达到最大重新纠错次数(3次)，提示用户")
                        limit_message = "抱歉，我已尝试多次但似乎无法很好地满足您的纠错需求。可能我无法很好地修改您的公文，能请您换一种表达方式让我来修正吗？或者您可以更具体地描述您对纠错的期望。"
                        messages.append({"role": "assistant", "content": limit_message})
                        return ChatResponse(
                            response=limit_message,
                            chat_history=messages
                        )
                    
                    # 不满意，添加系统回复
                    system_reply = f"收到您的反馈，我将重新纠错。（第{current_count}次尝试）"
                    messages.append({"role": "assistant", "content": system_reply})
                    
                    # 准备重新纠错的文本
                    original_text = feedback_data.get("original_text", "")
                    if original_text:
                        print(f"将重新纠错文本: {original_text[:50]}...（第{current_count}次尝试）")
                        
                        # 检查上一条助手消息是否为CSC未发现错误的提示
                        last_assistant_msg = None
                        for i in range(len(messages)-2, -1, -1):
                            if messages[i].get("role") == "assistant":
                                last_assistant_msg = messages[i].get("content", "")
                                break
                        
                        # 如果上一条消息是CSC未发现错误的提示，则直接调用大模型进行润色
                        if last_assistant_msg and "CSC检查结果：未发现明显语法或拼写错误" in last_assistant_msg:
                            print("💬 用户请求进一步润色，调用大模型...")
                            # 使用特定的提示词进行润色
                            system_prompt = """你是一个专业的公文润色助手。CSC工具已经检查过文本的基础语法和拼写，未发现明显错误。
现在请你从以下方面对文本进行进一步润色和优化：
1. 公文格式规范性检查
2. 表达方式的专业性和正式性
3. 语言流畅度和逻辑性
4. 政策用语的准确性
5. 段落结构和排版建议

请在回复的开头添加标记[公文纠错专用模式-润色建议]，并明确说明这是在基础检查无误的基础上进行的进一步优化。
"""
                            correction_messages = [
                                {"role": "system", "content": system_prompt},
                                {"role": "user", "content": original_text}
                            ]
                            
                            print("🤖 调用大模型进行公文润色...")
                            correction_response = llm.invoke(correction_messages)
                            
                            # 添加特定前缀
                            response_content = correction_response.content
                            if not response_content.startswith("[公文纠错专用模式") and not response_content.startswith("【公文纠错专用模式"):
                                response_content = f"""【公文纠错专用模式-润色建议】

{response_content}
"""
                            # 添加回复
                            messages.append({"role": "assistant", "content": response_content})
                            
                            return ChatResponse(
                                response=response_content,
                                chat_history=messages
                            )
                        else:
                            # 非CSC未发现错误的情况，继续使用原有的重新纠错流程
                            # 重新纠错处理 - 与正常纠错流程一致
                            # 使用MCP中的CSC进行拼写纠错
                            print("使用MCP协议的CSC功能进行拼写纠错...")
                            try:
                                start_time = time.time()
                                correction_result = csc_tool.correct_text(original_text)
                                elapsed_time = time.time() - start_time
                                print(f"CSC调用耗时: {elapsed_time:.2f}秒")
                                
                                # 与普通纠错流程一致的处理逻辑...
                                # 此处简化为直接使用大模型处理
                                system_prompt = f"你是一个专业的公文纠错助手。用户对上一次的纠错结果不满意，请重新对以下内容进行更详细的公文格式和语法纠错，指出所有可能的错误并给出详尽的修改建议。在回复的开头添加标记[公文纠错专用模式-改进版]，以表明这是对上次纠错的改进。（请注意，这是第{current_count}次尝试纠错，用户之前不满意）"
                                correction_messages = [
                                    {"role": "system", "content": system_prompt},
                                    {"role": "user", "content": original_text}
                                ]
                                
                                print("调用大模型进行重新纠错...")
                                correction_response = llm.invoke(correction_messages)
                                
                                # 添加特定前缀
                                response_content = correction_response.content
                                if not response_content.startswith("[公文纠错专用模式") and not response_content.startswith("【公文纠错专用模式"):
                                    response_content = f"""【公文纠错专用模式-聊天纠错已启用】

{response_content}
"""
                                # 添加回复
                                messages.append({"role": "assistant", "content": response_content})
                                
                            except Exception as e:
                                print(f"重新纠错过程中出错: {e}")
                                messages.append({"role": "assistant", "content": f"抱歉，重新纠错过程中出现错误。错误信息: {str(e)}"})
                    else:
                        # 找不到原始文本
                        messages.append({"role": "assistant", "content": "抱歉，我找不到需要重新纠错的文本。请再次提供您需要纠错的内容。"})
                else:
                    # 满意，添加简单回复
                    messages.append({"role": "assistant", "content": "感谢您的反馈！我很高兴能够帮助到您。"})
                
                return ChatResponse(
                    response=messages[-1]["content"],
                    chat_history=messages
                )
        except (json.JSONDecodeError, KeyError) as e:
            # 不是有效的JSON或不包含必要字段，按普通消息处理
            print(f"不是反馈消息，按普通消息处理: {e}")
        
        # 添加用户新消息 - 如果不是反馈消息
        if not (chat_request.message.startswith('{') and '"type":"correction_feedback"' in chat_request.message):
            messages.append({"role": "user", "content": chat_request.message})
        
        # 使用意图分类器判断意图
        intent = IntentClassifier.classify(chat_request.message)
        print(f"意图分类结果: {intent}")
        
        # 基于意图处理消息
        if intent == "correction" or intent == "recorrection":
            print(f"处理{intent}纠错意图")
            
            # 提取需要纠错的文本
            user_message = chat_request.message
            text_to_correct = user_message.replace("请将", "").replace("进行公文纠错", "").strip()
            if not text_to_correct or text_to_correct == user_message:
                text_to_correct = user_message
            
            # 使用MCP中的CSC进行拼写纠错
            try:
                print("📝 使用MCP协议的CSC功能进行拼写纠错...")
                start_time = time.time()
                
                # 使用langgraph中的工具调用CSC功能
                correction_result = csc_tool.correct_text(text_to_correct)
                elapsed_time = time.time() - start_time
                print(f"CSC调用耗时: {elapsed_time:.2f}秒")
                
                # 解析纠错结果
                if "纠错后的文本" in correction_result and "主要修改" in correction_result:
                    # MCP工具返回的结果是字符串，需要解析
                    corrected_parts = correction_result.split("\n主要修改:")
                    corrected_text = corrected_parts[0].replace("纠错后的文本:", "").strip()
                    modifications = corrected_parts[1].strip() if len(corrected_parts) > 1 else ""
                    
                    if modifications and "文本未发现明显拼写错误" not in modifications:
                        print(f"✅ CSC修正成功: {modifications}")
                        
                        # 构建回复内容 - 直接使用CSC的结果
                        response_content = f"""【MCP协议公文纠错专用模式已启用】

修改后的文本：
{corrected_text}

主要修改：
{modifications}
"""
                    else:
                        print("❌ CSC未发现需要修改的内容")
                        
                        # 添加提示信息，告知用户没有发现语法错误，但可以进行润色
                        intermediate_message = """【MCP协议公文纠错专用模式已启用】

CSC检查结果：未发现明显语法或拼写错误。

是否需要对文本进行进一步润色和改进？我可以通过大模型提供更细致的建议，包括格式规范、表达优化等方面的建议。

如需进行进一步润色，请点击"不满意"按钮。
如果您仅需检查基础语法并对结果满意，请点击"满意"按钮。
"""
                        
                        messages.append({"role": "assistant", "content": intermediate_message})
                        
                        return ChatResponse(
                            response=intermediate_message,
                            chat_history=messages
                        )
                else:
                    # 处理无法解析的情况
                    print("CSC返回结果格式异常，使用大模型进行纠错...")
                    system_prompt = "你是一个专业的公文纠错助手。请对以下内容进行公文格式和语法纠错，指出错误并给出修改建议。在回复的开头添加标记[公文纠错专用模式-聊天纠错]，以表明这是使用专门的纠错功能处理的。"
                    correction_messages = [
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": text_to_correct}
                    ]
                    
                    print("🤖 调用大模型进行纠错...")
                    correction_response = llm.invoke(correction_messages)
                    
                    # 添加特定前缀
                    response_content = correction_response.content
                    if not response_content.startswith("[公文纠错专用模式") and not response_content.startswith("【公文纠错专用模式"):
                        response_content = f"""【公文纠错专用模式-聊天纠错已启用】

{response_content}
"""
            except Exception as e:
                print(f"CSC纠错过程中出错: {e}")
                # 如果CSC出错，使用大模型进行纠错
                system_prompt = "你是一个专业的公文纠错助手。请对以下内容进行公文格式和语法纠错，指出错误并给出修改建议。在回复的开头添加标记[公文纠错专用模式-聊天纠错]，以表明这是使用专门的纠错功能处理的。"
                correction_messages = [
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": text_to_correct}
                ]
                
                print("🤖 调用大模型进行纠错...")
                correction_response = llm.invoke(correction_messages)
                
                # 添加特定前缀
                response_content = correction_response.content
                if not response_content.startswith("[公文纠错专用模式") and not response_content.startswith("【公文纠错专用模式"):
                    response_content = f"""【公文纠错专用模式-聊天纠错已启用】

{response_content}
"""
        else:
            # 常规聊天处理
            print("处理常规聊天意图")
            
            # 使用更适合聊天的系统提示词
            chat_system_prompt = """你是一个名为"小公"的AI助手。请注意：
1. 当用户询问你的名字、身份或类似问题时，你必须回答："我是小公，您的智能公文助手。"
2. 请用自然、友好的方式回答用户问题
3. 回答应简洁明了，不要过于冗长
4. 无需使用公文格式
5. 不要在回复中添加任何[公文纠错专用模式]的标记"""
            
            # 准备聊天消息，添加系统提示
            chat_messages = [{"role": "system", "content": chat_system_prompt}]
            # 添加历史消息
            for msg in messages:
                chat_messages.append(msg)
                
            # 调用聊天模型
            print("调用大模型进行聊天回复...")
            chat_response = llm.invoke(chat_messages)
            
            response_content = chat_response.content
        
        # 更新消息历史
        messages.append({"role": "assistant", "content": response_content})
        
        return ChatResponse(
            response=response_content,
            chat_history=messages
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"处理聊天请求时出错: {str(e)}")

if __name__ == "__main__":
    import uvicorn
    print("\n🚀 启动文档处理和聊天API服务...")
    print("✅ 文档处理功能: http://0.0.0.0:8003/api/process-document")
    print("✅ 聊天功能: http://0.0.0.0:8003/api/chat")
    # 端口保持为8003
    uvicorn.run(app, host="0.0.0.0", port=8003) 