import json
import subprocess
import logging
from pathlib import Path
import os
import time

# 设置日志
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger("agent_tools")

def call_mcp_service(method, params):
    """
    调用MCP服务的通用函数
    
    Args:
        method (str): 要调用的方法名
        params (dict): 参数字典
        
    Returns:
        dict: 服务返回的结果
    """
    try:
        # 创建JSON-RPC请求
        request = {
            "jsonrpc": "2.0",
            "id": str(time.time()),
            "method": method,
            "params": params
        }
        
        # 将请求转换为JSON字符串
        request_str = json.dumps(request)
        
        # 使用subprocess调用MCP服务
        logger.info(f"调用工具 {method} 参数: {params}")
        start_time = time.time()
        
        # 调用CSC服务
        csc_server_script = str(Path(__file__).parent.parent / "simple-csc" / "csc_server.py")
        result = subprocess.run(
            ["python", csc_server_script],
            input=request_str.encode(),
            capture_output=True,
            check=True
        )
        
        # 解析JSON-RPC响应
        response = json.loads(result.stdout.decode())
        
        # 计算耗时
        elapsed_time = time.time() - start_time
        
        # 检查是否有错误
        if "error" in response:
            logger.error(f"MCP服务出错: {response['error']}")
            return {"status": "error", "message": response["error"]}
        
        return {"status": "success", "result": response["result"], "elapsed_time": elapsed_time}
    
    except Exception as e:
        logger.error(f"调用MCP服务过程中出错: {str(e)}")
        return {"status": "error", "message": str(e)}

def csc(text):
    """
    使用MCP协议调用CSC服务进行拼写纠错
    
    Args:
        text (str): 要纠错的文本
        
    Returns:
        dict: 纠错结果，包含原文、修正后文本和变更说明
    """
    try:
        # 调用CSC服务
        response = call_mcp_service("csc", {"text": text})
        
        if response["status"] == "error":
            logger.error(f"CSC服务出错: {response['message']}")
            return {"status": "error", "message": response["message"]}
        
        result = response["result"]
        elapsed_time = response["elapsed_time"]
        
        # 格式化输出结果
        if "text" in result and result.get("modified", False):
            logger.info(f"CSC纠错成功: {result.get('changes', '无详细说明')}")
            return {
                "status": "success",
                "modified": True,
                "original_text": text,
                "corrected_text": result["text"],
                "changes": result.get("changes", ""),
                "elapsed_time": elapsed_time
            }
        else:
            logger.info("CSC未发现需要修改的内容")
            return {
                "status": "success",
                "modified": False,
                "original_text": text,
                "message": result.get("message", "文本未发现明显拼写错误，无需修改。"),
                "elapsed_time": elapsed_time
            }
            
    except Exception as e:
        logger.error(f"CSC纠错过程中出错: {str(e)}")
        return {"status": "error", "message": str(e)}

# 测试代码
if __name__ == "__main__":
    test_text = "我是一只光荣的共产党人"
    result = csc(test_text)
    print(json.dumps(result, ensure_ascii=False, indent=2)) 