from typing import Annotated
from typing_extensions import TypedDict

# 状态节点，贯穿输入输出
class State(TypedDict):
    messages: list