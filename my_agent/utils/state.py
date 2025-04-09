from typing import Annotated
from typing_extensions import TypedDict

# 状态节点，贯穿输入输出
class State(TypedDict):
    messages: list
    next: str = None
    original_text: str = None  # 存储需要纠错的原始文本，用于重新纠错
    recorrection_count: int = 0  # 记录重新纠错的次数，防止无限循环