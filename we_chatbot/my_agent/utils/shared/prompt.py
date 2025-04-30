PROMPT_TEMPLATES = {
    "correction": (
        "请基于以下参考内容，对用户文档进行专业纠错：\n"
        "参考内容：{references}\n"
        "用户文档：{content}\n"
        "要求：保持原意不变，仅修正语法和事实错误"
    ),
    "writing": (
        "请基于以下参考内容，对用户文档进行专业润色：\n"
        "参考内容：{references}\n"
        "用户文档：{content}\n"
        "要求：提升表达专业性，保持核心信息不变"
    ),
    "chat": "你是一个文档助手，现在进行自由对话：{content}"
}