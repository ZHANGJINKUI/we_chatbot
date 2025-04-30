import json
import httpx
from typing import Any, Dict, List, Union, Optional
import asyncio
import os
from mcp.server import FastMCP
from langchain_openai import ChatOpenAI
from dotenv import load_dotenv
from pathlib import Path

# 加载环境变量
# 获取当前文件的目录
current_dir = Path(__file__).parent
# 获取项目根目录（csc_server.py所在目录的上一级的上一级，即we_chatbot目录）
root_dir = current_dir.parent.parent
# 构建.env文件的路径
dotenv_path = root_dir / '.env'
load_dotenv(dotenv_path)
# 获取Qwen API认证信息
qwen_api_key = os.getenv("QWEN_API_KEY")
qwen_base_url = os.getenv("QWEN_BASE_URL")

# 打印环境变量检查
if qwen_api_key and qwen_base_url:
    print(f"已加载Qwen API配置: base_url={qwen_base_url}, key={qwen_api_key[:5]}***")
else:
    print(f"⚠️ 警告: Qwen API配置未找到，尝试从 {dotenv_path} 加载但未成功")

# 创建MCP服务器实例 - 这是langgraph通过SimpleMCPTool调用的服务入口
mcp = FastMCP("CSC服务器")

# 通用的系统提示词
SYSTEM_PROMPT = """你是一个专业的中文拼写纠错工具。
你的任务是识别并修正文本中的拼写错误、词语误用、标点符号错误和其他语法问题。
请特别注意：
1. 仅修正拼写和明显的语法错误，不要改变原文的意思或风格
2. 注意公文中特有的表达方式和专业术语
3. 对英文单词、人名、地名等专有名词的处理要谨慎
4. 只输出JSON格式的结果，包含修改后的文本和修改说明

输出格式（必须严格遵守）：
{
  "corrected": "修改后的文本",
  "modifications": ["将'错误1'修正为'正确1'（错误类型）", "将'错误2'修正为'正确2'（错误类型）", ...]
}
"""

# 润色系统提示词
POLISH_SYSTEM_PROMPT = """你是一个专业的文本润色工具，专注于将各类文本改写为符合中国政务公文风格的正式文本。

请严格按照以下政务公文润色标准进行工作：
1. 语体风格：务必使用庄重、严谨、规范、正式的官方书面语。
2. 语言表达：用词精准、规范，符合政务语境下的习惯用法；避免使用口语化、网络化、情绪化或过于随意的词语和表达方式；可适当运用政务公文中常见的表述，如"为贯彻落实...精神"、"根据...要求"、"切实加强"、"进一步推动"、"确保"等，但需自然贴切。
3. 句子结构：句子力求结构完整、逻辑清晰、表意明确；可适当使用长句，但要保证语法正确、易于理解。
4. 内容主旨：在润色的同时，必须忠实于原文的核心信息和基本意图，不得歪曲、删减关键内容或添加无关信息。
5. 语气态度：保持客观、中立、严肃的态度，体现政策性、指导性或事务性。

输出格式（必须严格遵守）：
{
  "polished": "润色后的文本",
  "modifications": ["将'原表达1'修改为'新表达1'（修改原因）", "将'原表达2'修改为'新表达2'（修改原因）", ...]
}
"""

# 总结系统提示词
SUMMARY_SYSTEM_PROMPT = """你是一个专业的文本总结工具，专注于为政务类文件生成规范、简练的摘要。

请严格按照以下标准进行总结：
1. 核心要素提取：摘要必须包含公文的主要目的（为什么发文）、核心内容（讲了什么事）、关键信息点（重要数据、事实）、主要决定或结论（达成了什么共识或结果）以及提出的要求或下一步行动（需要谁做什么）。
2. 简洁明了：使用精炼的语言，避免冗余信息和不必要的修饰。摘要长度应显著短于原文。
3. 结构清晰：优先使用项目符号（bullet points）格式列出要点，使信息一目了然。如果公文内容非常简单，也可以输出一段连贯的摘要文字。
4. 重点突出：准确把握公文的重点和关键环节。
5. 客观中立：保持客观的立场，准确反映原文信息，不添加个人主观臆断或评论。
6. 信息完整性：在简洁的前提下，尽量不遗漏关键的决策、责任主体、时间节点等要素（如果原文有明确提及）。

输出格式（必须严格遵守）：
{
  "summary": "总结后的文本",
  "key_points": ["要点1", "要点2", "要点3", ...]
}
"""

# 共享的内容解析函数
def parse_correction_content(content: str, original_text: str) -> Dict[str, Any]:
    """
    解析模型返回的纠错内容
    
    参数:
        content: 模型返回的内容
        original_text: 原始文本
        
    返回:
        解析后的结果字典
    """
    modifications = []
    corrected_text = original_text
    
    try:
        if '{' in content and '}' in content:
            # 提取JSON部分
            json_start = content.find('{')
            json_end = content.rfind('}') + 1
            json_str = content[json_start:json_end]
            
            data = json.loads(json_str)
            corrected_text = data.get('corrected', original_text)
            modifications = data.get('modifications', [])
        else:
            # 如果不是JSON格式，尝试提取关键信息
            if "修改后的文本" in content and "修改说明" in content:
                # 简单解析
                corrected_text = content.split("修改后的文本")[1].split("修改说明")[0].strip(": \n")
                mods_text = content.split("修改说明")[1].strip(": \n")
                if "、" in mods_text:
                    modifications = [item.strip() for item in mods_text.split("、")]
                elif "." in mods_text:
                    modifications = [item.strip() for item in mods_text.split(".")]
                elif "\n" in mods_text:
                    modifications = [item.strip() for item in mods_text.split("\n") if item.strip()]
                else:
                    modifications = [mods_text]
    except Exception as e:
        print(f"解析错误: {e}")
        # 如果解析失败，保持原文
        corrected_text = original_text
        modifications = [f"解析错误: {str(e)}"]
    
    # 检查是否有实际修改
    if not modifications or corrected_text == original_text:
        return {
            "corrected_text": original_text,
            "modifications": "文本未发现明显拼写错误，无需修改。",
            "status": "success"
        }
    
    # 将修改项转为字符串
    mods_str = "; ".join(modifications) if modifications else "进行了拼写纠错，但未显示具体修改项"
    
    return {
        "corrected_text": corrected_text,
        "modifications": mods_str,
        "status": "success"
    }

# 解析润色内容的函数
def parse_polish_content(content: str, original_text: str) -> Dict[str, Any]:
    """
    解析模型返回的润色内容
    
    参数:
        content: 模型返回的内容
        original_text: 原始文本
        
    返回:
        解析后的结果字典
    """
    modifications = []
    polished_text = original_text
    
    try:
        if '{' in content and '}' in content:
            # 提取JSON部分
            json_start = content.find('{')
            json_end = content.rfind('}') + 1
            json_str = content[json_start:json_end]
            
            data = json.loads(json_str)
            polished_text = data.get('polished', original_text)
            modifications = data.get('modifications', [])
        else:
            # 如果不是JSON格式，尝试提取关键信息
            if "润色后的文本" in content:
                polished_text = content.split("润色后的文本")[1].split("修改说明")[0].strip(": \n")
                if "修改说明" in content:
                    mods_text = content.split("修改说明")[1].strip(": \n")
                    if "、" in mods_text:
                        modifications = [item.strip() for item in mods_text.split("、")]
                    elif "." in mods_text:
                        modifications = [item.strip() for item in mods_text.split(".")]
                    elif "\n" in mods_text:
                        modifications = [item.strip() for item in mods_text.split("\n") if item.strip()]
                    else:
                        modifications = [mods_text]
    except Exception as e:
        print(f"解析错误: {e}")
        # 如果解析失败，保持原文
        polished_text = original_text
        modifications = [f"解析错误: {str(e)}"]
    
    # 检查是否有实际修改
    if not modifications or polished_text == original_text:
        return {
            "polished_text": original_text,
            "modifications": "文本已符合政务公文标准，无需润色。",
            "status": "success"
        }
    
    # 将修改项转为字符串
    mods_str = "; ".join(modifications) if modifications else "进行了润色，但未显示具体修改项"
    
    return {
        "polished_text": polished_text,
        "modifications": mods_str,
        "status": "success"
    }

# 解析总结内容的函数
def parse_summary_content(content: str, original_text: str) -> Dict[str, Any]:
    """
    解析模型返回的总结内容
    
    参数:
        content: 模型返回的内容
        original_text: 原始文本
        
    返回:
        解析后的结果字典
    """
    key_points = []
    summary_text = ""
    
    try:
        if '{' in content and '}' in content:
            # 提取JSON部分
            json_start = content.find('{')
            json_end = content.rfind('}') + 1
            json_str = content[json_start:json_end]
            
            data = json.loads(json_str)
            summary_text = data.get('summary', "")
            key_points = data.get('key_points', [])
        else:
            # 如果不是JSON格式，尝试提取关键信息
            if "摘要" in content:
                summary_text = content.split("摘要")[1].split("要点")[0].strip(": \n")
                if "要点" in content:
                    points_text = content.split("要点")[1].strip(": \n")
                    if "、" in points_text:
                        key_points = [item.strip() for item in points_text.split("、")]
                    elif "." in points_text:
                        key_points = [item.strip() for item in points_text.split(".")]
                    elif "\n" in points_text:
                        key_points = [item.strip() for item in points_text.split("\n") if item.strip()]
                    else:
                        key_points = [points_text]
    except Exception as e:
        print(f"解析错误: {e}")
        # 如果解析失败，返回简单总结
        summary_text = "无法生成总结，解析出错"
        key_points = [f"解析错误: {str(e)}"]
    
    # 检查是否有内容
    if not summary_text and not key_points:
        return {
            "summary_text": "无法从文本中提取有效摘要。",
            "key_points": [],
            "status": "error"
        }
    
    # 格式化要点
    formatted_key_points = "\n• " + "\n• ".join(key_points) if key_points else ""
    
    return {
        "summary_text": summary_text,
        "key_points": formatted_key_points,
        "status": "success"
    }

# MCP工具：拼写纠错功能
@mcp.tool(
    name='纠错算法',
    description='对用户输入的文本进行拼写纠错，识别并修正文本中的拼写错误、词语误用等问题'
)
def csc(text: str) -> str:
    '''
    对用户需要纠错的文本进行纠错
    Args:
        text: 需要纠错的文本
    Returns:
        纠错后的文本
    '''
    # 调用同步的纠错函数
    result = correct_text(text)
    
    # 提取结果
    corrected_text = result.get('corrected_text', text)
    modifications = result.get('modifications', '文本未发现明显拼写错误，无需修改。')
    
    # 返回格式化的结果
    return f"纠错后的文本: {corrected_text}\n主要修改: {modifications}"

# MCP工具：润色功能
@mcp.tool(
    name='润色工具',
    description='如果用户需要对他所输入的文本进行润色，那么就应该调用这个润色工具，对文本严格按照中国政务公文的风格和标准进行润色和改写。'
)
def polish(text: str) -> str:
    '''
    对用户需要润色的文本进行润色
    Args:
        text: 需要润色的文本
    Returns:
        润色后的文本
    '''
    # 调用同步的润色函数
    result = polish_text(text)
    
    # 提取结果
    polished_text = result.get('polished_text', text)
    modifications = result.get('modifications', '文本已符合政务公文标准，无需润色。')
    
    # 返回格式化的结果
    return f"润色后的文本: {polished_text}\n修改建议: {modifications}"

# MCP工具：总结功能
@mcp.tool(
    name='总结工具',
    description='如果用户需要对他所输入的文本进行总结，那么就应该调用这个总结工具，对用户文本生成一份简洁、清晰、全面的内容摘要。'
)
def summarize(text: str) -> str:
    '''
    对用户需要总结的文本进行总结
    Args:
        text: 需要总结的文本
    Returns:
        总结后的文本
    '''
    # 调用同步的总结函数
    result = summarize_text(text)
    
    # 提取结果
    summary_text = result.get('summary_text', "无法从文本中提取有效摘要。")
    key_points = result.get('key_points', "")
    
    # 返回格式化的结果
    if key_points:
        return f"摘要:\n{summary_text}\n\n要点:{key_points}"
    else:
        return f"摘要:\n{summary_text}"

# MCP工具：加法功能（示例）
@mcp.tool(
    name='add',
    description='对两个数字进行加法运算'
)
def add(a: int, b: int) -> int:
    return a + b

# MCP工具：简单的测试工具，不依赖外部API
@mcp.tool(
    name='echo',
    description='简单的回显功能，返回输入的文本，用于测试MCP服务是否正常工作'
)
def echo(text: str) -> str:
    '''
    简单回显输入的文本
    Args:
        text: 输入文本
    Returns:
        原样返回输入文本
    '''
    return f"回显: {text}"

# 异步纠错实现
async def async_correct_text(text: str) -> Dict[str, Any]:
    """
    中文拼写纠错功能的异步实现
    参数:
        text: 待纠错的文本
    返回:
        包含纠错结果的字典
    """
    try:
        # 使用Qwen API进行文本纠错
        llm = ChatOpenAI(
            model="qwen-max",
            api_key=qwen_api_key,
            base_url=qwen_base_url
        )
        
        messages = [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": text}
        ]
        
        response = await llm.ainvoke(messages)
        
        # 使用共享解析函数处理结果
        return parse_correction_content(response.content, text)
        
    except Exception as e:
        # 捕获所有异常，确保API不会崩溃
        return {
            "corrected_text": text,
            "modifications": f"纠错处理出错: {str(e)}",
            "status": "error"
        }

# API调用的同步实现
def correct_text(text: str) -> Dict[str, Any]:
    """
    中文拼写纠错功能的同步实现（供API调用）
    参数:
        text: 待纠错的文本
    返回:
        包含纠错结果的字典
    """
    try:
        # 使用Qwen API进行文本纠错
        llm = ChatOpenAI(
            model="qwen-max",
            api_key=qwen_api_key,
            base_url=qwen_base_url
        )
        
        messages = [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": text}
        ]
        
        response = llm.invoke(messages)
        
        # 使用共享解析函数处理结果
        return parse_correction_content(response.content, text)
        
    except Exception as e:
        # 捕获所有异常，确保API不会崩溃
        return {
            "corrected_text": text,
            "modifications": f"纠错处理出错: {str(e)}",
            "status": "error"
        }

# 润色功能的同步实现
def polish_text(text: str) -> Dict[str, Any]:
    """
    文本润色功能的同步实现
    参数:
        text: 待润色的文本
    返回:
        包含润色结果的字典
    """
    try:
        # 使用Qwen API进行文本润色
        llm = ChatOpenAI(
            model="qwen-max",
            api_key=qwen_api_key,
            base_url=qwen_base_url
        )
        
        messages = [
            {"role": "system", "content": POLISH_SYSTEM_PROMPT},
            {"role": "user", "content": text}
        ]
        
        response = llm.invoke(messages)
        
        # 使用解析函数处理结果
        return parse_polish_content(response.content, text)
        
    except Exception as e:
        # 捕获所有异常，确保API不会崩溃
        return {
            "polished_text": text,
            "modifications": f"润色处理出错: {str(e)}",
            "status": "error"
        }

# 总结功能的同步实现
def summarize_text(text: str) -> Dict[str, Any]:
    """
    文本总结功能的同步实现
    参数:
        text: 待总结的文本
    返回:
        包含总结结果的字典
    """
    try:
        # 使用Qwen API进行文本总结
        llm = ChatOpenAI(
            model="qwen-max",
            api_key=qwen_api_key,
            base_url=qwen_base_url
        )
        
        messages = [
            {"role": "system", "content": SUMMARY_SYSTEM_PROMPT},
            {"role": "user", "content": text}
        ]
        
        response = llm.invoke(messages)
        
        # 使用解析函数处理结果
        return parse_summary_content(response.content, text)
        
    except Exception as e:
        # 捕获所有异常，确保API不会崩溃
        return {
            "summary_text": "无法生成总结，处理出错",
            "key_points": f"错误: {str(e)}",
            "status": "error"
        }

if __name__ == "__main__":
    # 以标准 I/O 方式运行 MCP 服务器
    print("CSC服务启动...")
    # 检查环境变量
    print(f"Qwen API 配置: key={qwen_api_key[:5] + '***' if qwen_api_key else 'None'}, base_url={qwen_base_url if qwen_base_url else 'None'}")
    
    try:
        # 运行MCP服务
        mcp.run(transport='stdio')
    except Exception as e:
        print(f"CSC服务出错: {str(e)}")
        import traceback
        print(traceback.format_exc())
        import sys
        sys.exit(1)



