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
        
        # 将请求转换为JSON字符串（添加换行符，确保子进程能正确读取）
        request_str = json.dumps(request) + "\n"
        
        # 使用subprocess调用MCP服务
        logger.info(f"调用工具 {method} 参数: {params}")
        start_time = time.time()
        
        # 调用CSC服务
        csc_server_script = str(Path(__file__).parent.parent / "simple-csc" / "csc_server.py")
        simple_csc_dir = str(Path(__file__).parent.parent / "simple-csc")
        
        # 使用当前Python解释器
        import sys
        python_path = sys.executable
        
        # 准备环境变量
        env = os.environ.copy()
        # 设置PYTHONUNBUFFERED确保输出不缓冲
        env["PYTHONUNBUFFERED"] = "1"
        
        # 确保PYTHONPATH包含simple-csc目录
        python_sys_path = env.get("PYTHONPATH", "")
        if simple_csc_dir not in python_sys_path:
            env["PYTHONPATH"] = f"{python_sys_path}:{simple_csc_dir}" if python_sys_path else simple_csc_dir
        
        try:
            # 使用Popen和communicate更可靠
            process = subprocess.Popen(
                [python_path, csc_server_script],
                stdin=subprocess.PIPE,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                env=env,
                text=True,  # 使用文本模式
                cwd=simple_csc_dir  # 设置工作目录为simple-csc
            )
            
            # 通过stdin发送请求并从stdout读取响应
            stdout, stderr = process.communicate(input=request_str, timeout=120)
            
            # 检查进程返回码
            if process.returncode != 0:
                logger.error(f"MCP子进程返回非零状态码: {process.returncode}")
                if stderr:
                    logger.error(f"子进程错误输出: {stderr}")
                return {
                    "status": "error", 
                    "message": f"子进程异常返回: {stderr}"
                }
            
            # 记录输出以便调试
            logger.info(f"MCP子进程输出: {stdout[:200]}..." if len(stdout) > 200 else f"MCP子进程输出: {stdout}")
            if stderr:
                logger.warning(f"MCP子进程错误: {stderr}")
            
            # 尝试提取JSON部分
            if '{' in stdout and '}' in stdout:
                json_start = stdout.find('{')
                json_end = stdout.rfind('}') + 1
                json_str = stdout[json_start:json_end]
                response = json.loads(json_str)
            else:
                # 如果没有JSON，尝试整体解析
                if stdout.strip():
                    response = json.loads(stdout.strip())
                else:
                    logger.error("MCP子进程没有返回任何输出")
                    return {"status": "error", "message": "MCP子进程没有返回任何输出"}
            
            # 计算耗时
            elapsed_time = time.time() - start_time
            
            # 检查是否有错误
            if "error" in response:
                logger.error(f"MCP服务出错: {response['error']}")
                return {"status": "error", "message": str(response["error"])}
            
            # 返回结果
            return {"status": "success", "result": response["result"], "elapsed_time": elapsed_time}
            
        except subprocess.TimeoutExpired:
            logger.error(f"调用MCP服务超时")
            return {
                "status": "error",
                "message": "调用MCP服务超时，请稍后再试"
            }
            
        except json.JSONDecodeError as e:
            logger.error(f"解析MCP响应JSON出错: {e}, 原始响应: {stdout}")
            return {
                "status": "error", 
                "message": f"JSON解析错误: {str(e)}"
            }
            
    except Exception as e:
        logger.error(f"调用MCP服务过程中出错: {str(e)}")
        import traceback
        logger.error(traceback.format_exc())
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
        # 调用CSC服务 - 使用"纠错算法"作为方法名
        response = call_mcp_service("纠错算法", {"text": text})
        
        if response["status"] == "error":
            logger.error(f"CSC服务出错: {response['message']}")
            return {"status": "error", "message": response["message"]}
        
        result = response["result"]
        elapsed_time = response["elapsed_time"]
        
        # 解析结果格式 - 纠错算法返回的是字符串，需要处理成结构化数据
        try:
            # 尝试解析结果
            if isinstance(result, str):
                if "纠错后的文本:" in result and "主要修改:" in result:
                    parts = result.split("主要修改:")
                    corrected_text = parts[0].replace("纠错后的文本:", "").strip()
                    changes = parts[1].strip()
                    
                    # 检查是否有实际修改
                    is_modified = "未发现明显拼写错误" not in changes and text != corrected_text
                    
                    if is_modified:
                        logger.info(f"CSC纠错成功: {changes}")
                        return {
                            "status": "success",
                            "modified": True,
                            "original_text": text,
                            "corrected_text": corrected_text,
                            "changes": changes,
                            "elapsed_time": elapsed_time
                        }
                    else:
                        logger.info("CSC未发现需要修改的内容")
                        return {
                            "status": "success",
                            "modified": False,
                            "original_text": text,
                            "message": changes,
                            "elapsed_time": elapsed_time
                        }
                else:
                    # 返回原始结果
                    return {
                        "status": "success",
                        "modified": False,
                        "original_text": text,
                        "corrected_text": result,  # 使用完整结果作为纠错文本
                        "message": "无法解析纠错结果格式",
                        "elapsed_time": elapsed_time
                    }
            else:
                # 处理现有的结构化结果
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
        except Exception as parse_error:
            logger.error(f"解析CSC结果时出错: {str(parse_error)}")
            return {
                "status": "success",
                "modified": False,
                "original_text": text,
                "message": f"解析结果出错，但服务正常: {str(parse_error)}",
                "corrected_text": str(result),
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