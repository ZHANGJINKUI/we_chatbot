from langgraph.graph import StateGraph, END
from utils.state import State
from utils.nodes import chatbot, correction, router
from utils.shared.doc_processor import DocProcessor
file_path = "/home/zjk/my_app/input.docx"

# 构建图对象
graph_builder = StateGraph(State)

# 添加节点
graph_builder.add_node("chatbot", chatbot)
graph_builder.add_node("correction", correction)
graph_builder.add_node("router", router)

# 设置入口点为路由节点
graph_builder.set_entry_point("router")

# 定义路由节点的输出处理
def route_based_on_intent(state):
    intent = state['next']
    
    if intent == "correction":
        return "correction"
    elif intent == "recorrection":
        return "correction"  # 重新纠错也走correction节点
    else:
        return "chatbot"

# 添加边 - 使用新的条件设置
graph_builder.add_conditional_edges(
    "router",
    route_based_on_intent,
    {
        "correction": "correction",
        "chatbot": "chatbot"
    }
)

# 设置终点 - 修改为循环处理
graph_builder.add_edge("correction", "message_processor")  # 纠错后先走消息处理节点
graph_builder.add_edge("chatbot", "router")     # 聊天后返回路由节点

def process_message(state):
    # 获取当前消息
    message = state['messages'][-1]
    
    # 如果是纠错结果反馈
    if message.get('type') == 'correction_feedback':
        print(f"收到纠错反馈: 用户{'' if message.get('satisfied') else '不'}满意")
        
        if message.get('satisfied') == False:
            # 不满意，检查重新纠错次数
            current_count = state.get('recorrection_count', 0)
            
            # 增加计数
            state['recorrection_count'] = current_count + 1
            
            # 检查是否超过最大尝试次数(3次)
            if state['recorrection_count'] > 3:
                print(f"已达到最大重新纠错次数(3次)，转为聊天模式")
                # 重置计数
                state['recorrection_count'] = 0
                # 转为聊天模式
                state['next'] = 'chat'
                # 添加提示消息
                state['messages'].append({
                    "role": "assistant",
                    "content": "抱歉，我已尝试多次但似乎无法很好地满足您的纠错需求。可能我无法很好地修改您的公文，能请您换一种表达方式让我来修正吗？或者您可以更具体地描述您对纠错的期望。"
                })
                return state
                
            # 设置重新纠错意图
            original_text = message.get('original_text', '')
            if original_text:
                # 保存原始文本以供重新纠错
                state['original_text'] = original_text
                state['next'] = 'recorrection'
                print(f"将重新纠错文本: {original_text[:50]}...（第{state['recorrection_count']}次尝试）")
            else:
                # 如果没有提供原始文本，尝试从历史消息中找到
                for i in range(len(state['messages'])-2, -1, -1):
                    prev_message = state['messages'][i]
                    if prev_message.get('role') == 'user' and 'correction_feedback' not in str(prev_message):
                        state['original_text'] = prev_message.get('content', '')
                        state['next'] = 'recorrection'
                        print(f"从历史中找到需要重新纠错的文本: {state['original_text'][:50]}...（第{state['recorrection_count']}次尝试）")
                        break
                
                if not state.get('original_text'):
                    # 如果还是找不到，设置为默认状态
                    state['next'] = 'chat'
                    print("无法找到需要重新纠错的文本，转为聊天模式")
        else:
            # 满意，回到聊天模式并重置计数
            state['next'] = 'chat'
            state['recorrection_count'] = 0
            print("用户对纠错结果表示满意，转为聊天模式")
            
        # 添加系统消息确认反馈已收到
        state['messages'].append({
            "role": "assistant",
            "content": "感谢您的反馈！" + ("我会尝试重新纠错。" if message.get('satisfied') == False and state['recorrection_count'] <= 3 else "")
        })
    
    return state

# 添加消息处理节点
graph_builder.add_node("message_processor", process_message)
graph_builder.add_edge("message_processor", "router")

# 编译图
graph = graph_builder.compile()


def stream_graph_updates(user_input: str):
    for event in graph.stream({"messages": [{"role": "user", "content": user_input}]}):
        for key, value in event.items():
            if key == "messages" and len(value) > 0:
                last_message = value[-1]
                if last_message["role"] == "assistant":
                    print(f"Assistant: {last_message['content'][:100]}...")
                    return last_message["content"]
            

def process_document(file_path):
    """处理文档文件进行纠错"""
    print(f"读取文档: {file_path}")
    user_input = DocProcessor.load_doc(file_path)
    
    print("使用图执行文档纠错...")
    output = stream_graph_updates(f"请将以下内容进行公文纠错：\n\n{user_input}")
    
    print(f"保存纠错结果到: output.docx")
    DocProcessor.save_doc(output, "output.docx")
    return output

if __name__ == "__main__":
    import sys
    
    if len(sys.argv) > 1:
        # 如果提供了文件路径，处理文档
        file_path = sys.argv[1]
        process_document(file_path)
    else:
        # 默认文档处理
        output = process_document(file_path)
        
        # 交互模式
        print("\n是否进入交互模式? (y/n)")
        choice = input().strip().lower()
        
        if choice == 'y':
            print("进入交互模式，输入 'quit' 或 'exit' 退出")
            
            while True:
                try:
                    user_input = input("User: ")
                    if user_input.lower() in ["quit", "exit", "q"]:
                        print("再见!")
                        break
                    
                    result = stream_graph_updates(user_input)
                    print(f"Assistant: {result}")
                    
                except Exception as e:
                    print(f"错误: {e}")
                    break
