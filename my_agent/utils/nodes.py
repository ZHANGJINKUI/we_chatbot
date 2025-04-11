from .state import State
from dotenv import load_dotenv
import os
from langchain_openai import ChatOpenAI
from .shared.intent_classifier import IntentClassifier

# 加载API
load_dotenv()
deepseek_api_key = os.getenv("DEEPSEEK_API_KEY")
deepseek_base_url = os.getenv("DEEPSEEK_API_BASE")
os.environ["OPENAI_API_KEY"] = deepseek_api_key
os.environ["OPENAI_API_BASE"] = deepseek_base_url
llm = ChatOpenAI(model="deepseek-chat")

# 路由节点：根据意图分类结果确定下一个节点
def router(state: State):
    # 获取用户最后一条消息
    user_message = state["messages"][-1]["content"]
    # 使用意图分类器判断意图
    intent = IntentClassifier.classify(user_message)
    print(f"Intent classified as: {intent}")
    return intent

# 文档纠错节点
def correction(state: State):
    print("Entering correction node")
    messages = state["messages"].copy()
    user_message = messages[-1]["content"]
    
    # 提取需要纠错的文本
    # 假设纠错请求格式为：请将XXX进行公文纠错
    text_to_correct = user_message.replace("请将", "").replace("进行公文纠错", "").strip()
    if not text_to_correct or text_to_correct == user_message:
        # 如果提取失败，使用整个消息作为纠错内容
        text_to_correct = user_message
    
    print(f"Text to correct: {text_to_correct[:100]}...")
    
    # 构建系统提示词，指示模型进行公文纠错
    system_prompt = "你是一个专业的公文纠错助手。请对以下内容进行公文格式和语法纠错，指出错误并给出修改建议。"
    
    # 构建对模型的请求
    correction_messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": text_to_correct}
    ]
    
    # 调用模型进行纠错
    print("Calling model for correction...")
    correction_response = llm.invoke(correction_messages)
    print(f"Correction response received: {correction_response.content[:100]}...")
    
    # 返回纠错结果
    return {"messages": messages + [correction_response]}

# 构建chatbot节点
def chatbot(state: State):
    print("Entering chatbot node")
    result = llm.invoke(state["messages"])
    print(f"Chatbot response: {result.content[:100]}...")
    return {"messages": [result]}
