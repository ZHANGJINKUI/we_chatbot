from langgraph.graph import StateGraph
from utils.state import State
from utils.nodes import chatbot
from utils.shared.doc_processor import DocProcessor
file_path = "/home/zjk/my_app/input.docx"

# 构建图对象
graph_builder = StateGraph(State)

# 添加节点
graph_builder.add_node("chatbot", chatbot)
# 添加边
graph_builder.set_entry_point("chatbot")
graph_builder.set_finish_point("chatbot")
# 编译图
graph = graph_builder.compile()


def stream_graph_updates(user_input: str):
    for event in graph.stream({"messages": [{"role": "user", "content": user_input}]}):
        for value in event.values():
            print("Assistant:", value["messages"][-1].content)
            return value["messages"][-1].content
            

user_input = DocProcessor.load_doc(file_path)

output = stream_graph_updates(user_input)

DocProcessor.save_doc(output, "output.docx")
# while True:
#     try:
#         user_input = input("User: ")
#         if user_input.lower() in ["quit", "exit", "q"]:
#             print("Goodbye!")
#             break
        
#         stream_graph_updates(user_input)
#     except:
#         # fallback if input() is not available
#         user_input = "What do you know about LangGraph?"
#         print("User: " + user_input)
#         stream_graph_updates(user_input)
#         break

