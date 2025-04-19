from .state import State
from dotenv import load_dotenv
import os
from langchain_openai import ChatOpenAI
from .shared.intent_classifier import IntentClassifier
from .tools import SimpleMCPTool

# 加载API
load_dotenv()
deepseek_api_key = os.getenv("DEEPSEEK_API_KEY")
deepseek_base_url = os.getenv("DEEPSEEK_API_BASE")
os.environ["OPENAI_API_KEY"] = deepseek_api_key
os.environ["OPENAI_API_BASE"] = deepseek_base_url
llm = ChatOpenAI(model="deepseek-chat")

# 初始化工具
csc_tool = SimpleMCPTool()

# 路由节点：根据意图分类结果确定下一个节点
def router(state: State):
    # 获取用户最后一条消息
    user_message = state["messages"][-1]["content"]
    # 使用意图分类器判断意图
    intent = IntentClassifier.classify(user_message)
    print(f"Intent classified as: {intent}")
    # 返回带有next字段的字典，而不是直接返回字符串
    return {"next": intent}

# 文档纠错节点
def correction(state: State):
    print("Entering correction node")
    messages = state["messages"].copy()
    user_message = messages[-1]["content"]
    
    # 检查是否为重新纠错请求
    if state.get('next') == 'recorrection' and state.get('original_text'):
        print(f"处理重新纠错请求，使用保存的原始文本（第{state.get('recorrection_count', 1)}次尝试）")
        text_to_correct = state['original_text']
        # 清除状态中的original_text以避免无限循环
        state.pop('original_text', None)
        
        # 获取重新纠错次数，添加到提示中以让模型知道这是重新纠错
        correction_count = state.get('recorrection_count', 1)
        correction_suffix = f"（请注意，这是第{correction_count}次尝试纠错，用户对之前的结果不满意）"
    else:
        # 提取需要纠错的文本
        # 假设纠错请求格式为：请将XXX进行公文纠错
        text_to_correct = user_message.replace("请将", "").replace("进行公文纠错", "").strip()
        if not text_to_correct or text_to_correct == user_message:
            # 如果提取失败，使用整个消息作为纠错内容
            text_to_correct = user_message
        correction_suffix = ""
        # 重置重新纠错计数
        if 'recorrection_count' in state:
            state['recorrection_count'] = 0
    
    print(f"Text to correct: {text_to_correct[:100]}...")
    
    # 保存原始文本以便后续反馈使用
    original_text = text_to_correct
    
    # 首先使用CSC工具进行中文拼写纠错
    print("Using CSC tool for spelling correction...")
    try:
        # 直接使用SimpleMCPTool调用纠错工具
        correction_result = csc_tool.correct_text(text_to_correct)
        print(f"CSC correction result: {correction_result[:100] if isinstance(correction_result, str) else correction_result}...")
        
        # 如果纠错工具成功返回结果
        if correction_result and not str(correction_result).startswith("工具调用错误") and not str(correction_result).startswith("调用工具出错"):
            # 使用CSC纠错结果作为输入，交给LLM进行进一步改进
            system_prompt = f"""你是一个专业的公文纠错助手。我先使用中文拼写纠错工具对文本进行了初步纠错，现在请你进一步完善和改进这个结果。{correction_suffix}
            
请注意以下几点：
1. 文本中可能仍存在工具未能识别的错误，请仔细检查并修正
2. 对于公文格式和表达方式进行优化
3. 给出详细的修改解释和建议

在回复的开头添加标记[公文纠错专用模式-联合纠错]，并简要说明CSC工具已进行了哪些修正。
"""
            
            # 构建对模型的请求
            correction_messages = [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": f"""
原始文本：
{text_to_correct}

CSC工具纠错后的文本：
{correction_result}

请进一步改进上述文本，使其更符合公文规范，并给出详细的修改建议。{correction_suffix}
"""}
            ]
            
            # 调用模型进行纠错改进
            print("Calling model for correction refinement...")
            correction_response = llm.invoke(correction_messages)
            print(f"Correction refinement response received: {correction_response.content[:100]}...")
            
            # 将原始文本添加到状态，供后续反馈使用
            updated_state = {
                "messages": messages + [{"role": "assistant", "content": correction_response.content}],
                "original_text": original_text,
                "recorrection_count": state.get('recorrection_count', 0)  # 保持计数器不变
            }
            
            # 返回改进后的纠错结果
            return updated_state
        
    except Exception as e:
        print(f"Error using CSC tool: {e}")
        # 如果CSC工具失败，继续使用原始LLM方法
    
    # 如果CSC工具失败或返回失败结果，回退到使用纯LLM的方法
    print("Falling back to pure LLM correction...")
    
    # 构建系统提示词，指示模型进行公文纠错
    system_prompt = f"你是一个专业的公文纠错助手。请对以下内容进行公文格式和语法纠错，指出错误并给出修改建议。在回复的开头添加标记[公文纠错专用模式-LLM纠错]，以表明这是使用LLM进行的纠错。{correction_suffix}"
    
    # 构建对模型的请求
    correction_messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": text_to_correct}
    ]
    
    # 调用模型进行纠错
    print("Calling model for correction...")
    correction_response = llm.invoke(correction_messages)
    print(f"Correction response received: {correction_response.content[:100]}...")
    
    # 将原始文本添加到状态，供后续反馈使用
    updated_state = {
        "messages": messages + [{"role": "assistant", "content": correction_response.content}],
        "original_text": original_text,
        "recorrection_count": state.get('recorrection_count', 0)  # 保持计数器不变
    }
    
    # 返回纠错结果
    return updated_state

# 构建chatbot节点
def chatbot(state: State):
    print("Entering chatbot node")
    messages = state["messages"].copy()
    result = llm.invoke(state["messages"])
    print(f"Chatbot response: {result.content[:100]}...")
    return {"messages": messages + [{"role": "assistant", "content": result.content}]}