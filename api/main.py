from fastapi import FastAPI, UploadFile, File, HTTPException, Body
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
import os
import tempfile
import sys
import shutil
from pydantic import BaseModel

# 添加当前目录到系统路径
current_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, current_dir)

# 导入DocProcessor和相关组件
from my_agent.utils.shared.doc_processor import DocProcessor
from my_agent.utils.shared.intent_classifier import IntentClassifier
from langchain_openai import ChatOpenAI
import os
from dotenv import load_dotenv

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

# 定义聊天请求和响应模型
class ChatRequest(BaseModel):
    message: str
    chat_history: list = []

class ChatResponse(BaseModel):
    response: str
    chat_history: list

# 定义渐进式纠错请求和响应模型
class ProgressiveCorrectionRequest(BaseModel):
    text: str
    step: str = "format"  # format, grammar, expression

class ProgressiveCorrectionResponse(BaseModel):
    corrected_text: str
    explanation: str
    next_step: str = None

def process_document(file_path):
    """处理文档内容"""
    # 加载文档
    content = DocProcessor.load_doc(file_path)
    
    # 调用纠错函数
    system_prompt = "你是一个专业的公文纠错助手。请对以下内容进行公文格式和语法纠错，指出错误并给出修改建议。在回复的开头添加标记[公文纠错专用模式-文档处理]，以表明这是使用专门的纠错功能处理的。"
    correction_messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": content}
    ]
    
    print("Calling model for document correction...")
    correction_response = llm.invoke(correction_messages)
    print(f"Document correction response received")
    
    return {
        "original_content": content,
        "corrected_content": correction_response.content
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
        print(f"Received chat request: {chat_request.message[:100]}...")
        
        # 准备消息历史
        messages = chat_request.chat_history.copy()
        # 添加用户新消息
        messages.append({"role": "user", "content": chat_request.message})
        
        # 使用意图分类器判断意图
        intent = IntentClassifier.classify(chat_request.message)
        print(f"Intent classified as: {intent}")
        
        # 基于意图处理消息
        if intent == "correction" or intent == "recorrection":
            print(f"Processing {intent} intent")
            
            # 检查是否是重新纠错请求
            is_recorrection = intent == "recorrection"
            
            # 如果是重新纠错，查找最近的纠错结果
            if is_recorrection:
                print("Detected request to improve previous correction")
                # 查找上一次纠错的结果和原始内容
                last_correction_result = None
                last_correction_text = None
                
                # 查找最近的助手回复中包含纠错标记的消息
                for i in range(len(chat_request.chat_history) - 1, -1, -1):
                    msg = chat_request.chat_history[i]
                    if msg["role"] == "assistant" and ("[公文纠错专用模式" in msg["content"]):
                        last_correction_result = msg["content"]
                        break
                
                # 查找与该纠错结果对应的原始文本
                if last_correction_result:
                    # 往前查找请求纠错的用户消息
                    for i in range(len(chat_request.chat_history) - 1, -1, -1):
                        msg = chat_request.chat_history[i]
                        if msg["role"] == "user" and (
                            "纠错" in msg["content"] or 
                            "修正" in msg["content"] or 
                            "修改" in msg["content"]):
                            # 提取原始文本
                            text_to_correct = msg["content"].replace("请将", "").replace("进行公文纠错", "").strip()
                            if not text_to_correct or text_to_correct == msg["content"]:
                                # 如果提取失败，使用整个消息
                                text_to_correct = msg["content"]
                            
                            last_correction_text = text_to_correct
                            break
                
                # 如果找到了前次纠错结果和原始文本
                if last_correction_text:
                    text_to_correct = last_correction_text
                    print(f"Found previous correction text: {text_to_correct[:100]}...")
                    
                    # 构建提示，指示模型提供更好的纠错结果
                    system_prompt = "你是一个专业的公文纠错助手。用户对之前的纠错结果不满意，请提供一个更好的公文纠错结果。请对以下内容进行更细致、更专业的公文格式和语法纠错，指出错误并给出修改建议。在回复的开头添加标记[公文纠错专用模式-改进版]，以表明这是改进后的纠错结果。"
                else:
                    # 如果没有找到前次纠错内容，则按普通纠错处理
                    print("No previous correction found, treating as regular correction")
                    is_recorrection = False
            
            # 如果不是重新纠错（或者没找到前次纠错内容）
            if not is_recorrection:
                # 检查是否是要纠错历史消息
                is_history_correction = IntentClassifier.is_history_correction(chat_request.message)
                
                if is_history_correction and len(chat_request.chat_history) >= 2:
                    print("Detected request to correct previous message")
                    # 查找最近的用户消息作为纠错内容
                    previous_user_messages = [msg for msg in chat_request.chat_history if msg["role"] == "user"]
                    if previous_user_messages:
                        # 使用最近一条用户消息作为纠错内容
                        text_to_correct = previous_user_messages[-1]["content"]
                        print(f"Using previous message for correction: {text_to_correct[:100]}...")
                    else:
                        # 如果没有找到历史用户消息，则使用当前消息
                        text_to_correct = chat_request.message
                else:
                    # 常规纠错，从当前消息中提取内容
                    user_message = chat_request.message
                    text_to_correct = user_message.replace("请将", "").replace("进行公文纠错", "").strip()
                    if not text_to_correct or text_to_correct == user_message:
                        # 如果提取失败，使用整个消息作为纠错内容
                        text_to_correct = user_message
                
                # 普通纠错的系统提示词
                system_prompt = "你是一个专业的公文纠错助手。请对以下内容进行公文格式和语法纠错，指出错误并给出修改建议。在回复的开头添加标记[公文纠错专用模式-聊天纠错]，以表明这是使用专门的纠错功能处理的。"
            
            print(f"Text to correct: {text_to_correct[:100]}...")
            
            # 构建对模型的请求
            correction_messages = [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": text_to_correct}
            ]
            
            # 如果是重新纠错，添加前次结果作为上下文
            if is_recorrection and last_correction_result:
                correction_messages.append({"role": "assistant", "content": last_correction_result})
                correction_messages.append({"role": "user", "content": "请改进上面的纠错结果，提供更好的公文纠错建议。"})
            
            # 调用模型进行纠错
            print("Calling model for correction...")
            correction_response = llm.invoke(correction_messages)
            print(f"Correction response received")
            
            response_content = correction_response.content
        else:
            # 常规聊天处理
            print("Processing regular chat intent")
            
            # 使用更适合聊天的系统提示词
            chat_system_prompt = "你是DeepSeek Chat开发的AI助手，正在与用户进行普通聊天对话。请用自然、友好的方式回答用户问题，无需使用公文格式。不要在回复中添加任何[公文纠错专用模式]的标记。"
            
            # 准备聊天消息，添加系统提示
            chat_messages = [{"role": "system", "content": chat_system_prompt}]
            # 添加历史消息
            for msg in messages:
                chat_messages.append(msg)
            
            # 调用模型进行聊天回复
            chat_response = llm.invoke(chat_messages)
            response_content = chat_response.content
            print(f"Chat response received")
        
        # 更新聊天历史
        messages.append({"role": "assistant", "content": response_content})
        
        print("Returning chat response")
        # 返回响应
        return ChatResponse(
            response=response_content,
            chat_history=messages
        )
    except Exception as e:
        import traceback
        print(f"Error in chat_endpoint: {str(e)}")
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"处理聊天时出错: {str(e)}")

@app.post("/api/progressive-correction")
async def progressive_correction(request: ProgressiveCorrectionRequest):
    """渐进式公文纠错，按步骤进行纠错"""
    try:
        step = request.step
        text = request.text
        
        system_prompts = {
            "format": "你是一个专业的公文格式纠错助手。请仅对以下内容的公文格式进行纠正，包括标题、发文字号、日期、正文结构等格式问题。不要修改内容或语法。给出格式方面的详细纠正建议。",
            "grammar": "你是一个专业的公文语法纠错助手。请对以下内容的语法和标点符号进行纠正，包括句式结构、主谓一致、时态、标点使用等问题。此步骤不修改内容或格式。给出语法方面的详细纠正建议。",
            "expression": "你是一个专业的公文表达润色助手。请对以下内容的表达方式进行优化，使其更加正式、清晰和准确。改进用词、消除歧义、提高语言的专业性和政策性。给出表达方面的详细改进建议。"
        }
        
        next_steps = {
            "format": "grammar",
            "grammar": "expression",
            "expression": None
        }
        
        # 构建提示
        system_prompt = system_prompts.get(step, system_prompts["format"])
        
        correction_messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": text}
        ]
        
        print(f"Processing progressive correction step: {step}")
        correction_response = llm.invoke(correction_messages)
        
        response_content = correction_response.content
        
        # 提取修改后的文本和解释（这里简化处理，实际应用可能需要更复杂的解析）
        parts = response_content.split("修改建议：", 1)
        explanation = parts[0].strip()
        corrected_text = parts[1].strip() if len(parts) > 1 else response_content
        
        return ProgressiveCorrectionResponse(
            corrected_text=corrected_text,
            explanation=explanation,
            next_step=next_steps[step]
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"渐进式纠错过程中出错: {str(e)}")

if __name__ == "__main__":
    import uvicorn
    # 更改端口为8003
    uvicorn.run(app, host="0.0.0.0", port=8003) 