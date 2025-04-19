"""
MCP服务直接调用示例
演示如何直接调用MCP服务，无需依赖其他工具类
"""

import json
import subprocess
import sys
import os
import argparse
from pathlib import Path

def call_mcp_direct(method, params, server_script=None, timeout=10):
    """直接调用MCP服务
    
    Args:
        method (str): 要调用的方法名
        params (dict): 参数字典
        server_script (str, optional): 服务器脚本路径，默认使用simple-csc/csc_server.py
        timeout (int, optional): 超时时间，默认10秒
        
    Returns:
        dict: 包含状态和结果的字典
    """
    # 获取CSC服务器路径
    if not server_script:
        # 获取当前脚本所在目录
        current_dir = Path(__file__).parent
        server_script = str(current_dir / "simple-csc" / "csc_server.py")
    
    # 创建JSON-RPC请求
    request = {
        "jsonrpc": "2.0",
        "id": "test-direct-call",
        "method": method,
        "params": params
    }
    
    # 将请求转换为JSON字符串
    request_str = json.dumps(request) + "\n"
    
    print(f"调用MCP服务: {server_script}")
    print(f"方法: {method}")
    print(f"参数: {json.dumps(params, ensure_ascii=False)}")
    print("请求JSON:", request_str)
    
    # 准备环境变量
    env = os.environ.copy()
    env["PYTHONUNBUFFERED"] = "1"  # 确保输出不缓冲
    
    # 调用子进程
    try:
        process = subprocess.Popen(
            [sys.executable, server_script],
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            env=env,
            text=True  # 使用文本模式
        )
        
        print(f"正在调用子进程，超时设置为{timeout}秒...")
        # 发送请求
        stdout, stderr = process.communicate(input=request_str, timeout=timeout)
        
        print("\n调用结果:")
        print(f"返回码: {process.returncode}")
        print(f"标准错误输出: {stderr if stderr else '无'}")
        print(f"标准输出:\n{stdout}")
        
        # 解析响应
        if stdout and '{' in stdout and '}' in stdout:
            # 尝试提取JSON部分
            json_start = stdout.find('{')
            json_end = stdout.rfind('}') + 1
            json_str = stdout[json_start:json_end]
            
            try:
                response = json.loads(json_str)
                print("\n解析后的响应:")
                print(json.dumps(response, indent=2, ensure_ascii=False))
                
                if "error" in response:
                    return {"status": "error", "message": response["error"].get("message", "未知错误")}
                else:
                    return {"status": "success", "result": response.get("result")}
            except json.JSONDecodeError as e:
                print(f"JSON解析错误: {e}")
                return {"status": "error", "message": f"JSON解析错误: {e}"}
        else:
            print("响应中没有找到有效的JSON数据")
            return {"status": "error", "message": "响应中没有找到有效的JSON数据"}
    
    except subprocess.TimeoutExpired:
        print(f"子进程执行超时（{timeout}秒）")
        return {"status": "error", "message": f"操作超时（{timeout}秒）"}
    except Exception as e:
        print(f"调用过程中出错: {e}")
        return {"status": "error", "message": str(e)}

def test_echo():
    """测试回显功能"""
    print("\n=== 测试回显功能 ===")
    result = call_mcp_direct("echo", {"text": "这是一个测试消息"}, timeout=5)
    return result

def test_add():
    """测试加法功能"""
    print("\n=== 测试加法功能 ===")
    result = call_mcp_direct("add", {"a": 123, "b": 456}, timeout=5)
    return result

def test_correction():
    """测试纠错功能"""
    print("\n=== 测试拼写纠错功能 ===")
    print("注意: 如果没有设置DeepSeek API密钥，此测试可能会超时")
    # 包含错别字的文本
    text = "我是一只光茫的共产党员，要紧跟时代潮流行进"  # "光茫"应为"光荣"
    result = call_mcp_direct("纠错算法", {"text": text}, timeout=20)
    return result

if __name__ == "__main__":
    # 解析命令行参数
    parser = argparse.ArgumentParser(description='测试MCP服务直接调用')
    parser.add_argument('--skip-correction', action='store_true', help='跳过纠错功能测试（需要DeepSeek API）')
    args = parser.parse_args()

    # 测试结果字典
    results = {}
    
    # 测试回显
    echo_result = test_echo()
    results["echo"] = echo_result
    print(f"\n回显测试结果: {echo_result['status']}")
    
    # 测试加法
    add_result = test_add()
    results["add"] = add_result
    print(f"\n加法测试结果: {add_result['status']}")
    
    # 测试纠错（如果没有跳过）
    if not args.skip_correction:
        correction_result = test_correction()
        results["correction"] = correction_result
        print(f"\n纠错测试结果: {correction_result['status']}")
    else:
        print("\n已跳过纠错功能测试")
        results["correction"] = {"status": "skipped"}
    
    # 总结
    print("\n=== 测试总结 ===")
    print(f"回显功能: {'成功' if results['echo']['status'] == 'success' else '失败'}")
    print(f"加法功能: {'成功' if results['add']['status'] == 'success' else '失败'}")
    
    if results["correction"]["status"] == "skipped":
        print("纠错功能: 已跳过")
    else:
        print(f"纠错功能: {'成功' if results['correction']['status'] == 'success' else '失败'}")
        
    # 整体结果
    all_success = all(r["status"] == "success" for r in [results["echo"], results["add"]])
    if results["correction"]["status"] != "skipped":
        all_success = all_success and results["correction"]["status"] == "success"
        
    print(f"\n整体测试结果: {'成功' if all_success else '部分功能失败'}") 