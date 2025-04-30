#!/usr/bin/env python3
"""
MCP服务调用命令行工具
用于直接调用MCP服务上的方法，方便调试和测试

用法:
    python mcp_call.py <方法名> [参数...]
    
示例:
    # 测试回显功能
    python mcp_call.py echo --text="测试消息"
    
    # 测试加法功能
    python mcp_call.py add --a=123 --b=456
    
    # 测试纠错功能
    python mcp_call.py 纠错算法 --text="需要纠错的文本"
"""

import json
import subprocess
import sys
import os
import argparse
from pathlib import Path

def call_mcp(method, params, server_script=None, timeout=15, pretty=True):
    """调用MCP服务
    
    Args:
        method (str): 要调用的方法名
        params (dict): 参数字典
        server_script (str, optional): 服务器脚本路径
        timeout (int, optional): 超时时间（秒）
        pretty (bool, optional): 是否美化输出
        
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
        "id": "command-line-call",
        "method": method,
        "params": params
    }
    
    # 将请求转换为JSON字符串
    request_str = json.dumps(request) + "\n"
    
    if pretty:
        print(f"调用MCP服务: {server_script}")
        print(f"方法: {method}")
        print(f"参数: {json.dumps(params, ensure_ascii=False, indent=2)}")
    
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
        
        if pretty:
            print(f"正在调用MCP服务，超时设置为{timeout}秒...")
        
        # 发送请求
        stdout, stderr = process.communicate(input=request_str, timeout=timeout)
        
        if pretty:
            print("\n== 调用结果 ==")
            if stderr:
                print(f"标准错误输出:\n{stderr}")
        
        # 解析响应
        if stdout and '{' in stdout and '}' in stdout:
            # 提取JSON部分
            json_start = stdout.find('{')
            json_end = stdout.rfind('}') + 1
            json_str = stdout[json_start:json_end]
            
            try:
                response = json.loads(json_str)
                
                if pretty:
                    print("\n== 响应内容 ==")
                    print(json.dumps(response, indent=2, ensure_ascii=False))
                
                if "error" in response:
                    error_msg = response["error"].get("message", "未知错误")
                    return {"status": "error", "message": error_msg}
                else:
                    return {"status": "success", "result": response.get("result")}
            except json.JSONDecodeError as e:
                if pretty:
                    print(f"解析响应失败: {e}")
                return {"status": "error", "message": f"JSON解析错误: {e}"}
        else:
            if pretty:
                print("响应中没有找到有效的JSON数据")
                print(f"原始输出:\n{stdout}")
            return {"status": "error", "message": "响应中没有找到有效的JSON数据"}
    
    except subprocess.TimeoutExpired:
        if pretty:
            print(f"执行超时（{timeout}秒）")
        return {"status": "error", "message": f"操作超时（{timeout}秒）"}
    except Exception as e:
        if pretty:
            print(f"调用过程中出错: {e}")
        return {"status": "error", "message": str(e)}

def parse_args():
    """解析命令行参数"""
    parser = argparse.ArgumentParser(description='调用MCP服务方法')
    parser.add_argument('method', help='要调用的方法名称')
    parser.add_argument('--server', help='MCP服务器脚本路径（默认为当前目录下的simple-csc/csc_server.py）')
    parser.add_argument('--timeout', type=int, default=15, help='超时时间（秒）')
    parser.add_argument('--json-output', action='store_true', help='仅输出JSON结果，不显示调试信息')
    parser.add_argument('--json-params', help='JSON格式的参数（适用于复杂参数）')
    
    # 动态参数，用于传递给方法
    args, unknown = parser.parse_known_args()
    
    # 处理未知参数（转换为方法参数）
    params = {}
    for arg in unknown:
        if arg.startswith('--'):
            parts = arg[2:].split('=', 1)
            if len(parts) == 2:
                key, value = parts
                # 尝试自动转换值类型
                try:
                    # 尝试作为数字解析
                    if '.' in value:
                        params[key] = float(value)
                    else:
                        params[key] = int(value)
                except ValueError:
                    # 处理布尔值
                    if value.lower() in ('true', 'yes', '1'):
                        params[key] = True
                    elif value.lower() in ('false', 'no', '0'):
                        params[key] = False
                    else:
                        params[key] = value
    
    # 如果提供了JSON参数，优先使用JSON参数
    if args.json_params:
        try:
            params = json.loads(args.json_params)
        except json.JSONDecodeError as e:
            print(f"错误: JSON参数解析失败 - {e}")
            sys.exit(1)
    
    return args, params

def main():
    """主函数"""
    args, params = parse_args()
    
    # 调用MCP服务
    result = call_mcp(
        method=args.method,
        params=params,
        server_script=args.server,
        timeout=args.timeout,
        pretty=not args.json_output
    )
    
    # 输出结果
    if args.json_output:
        # 仅输出JSON结果
        print(json.dumps(result, ensure_ascii=False))
    else:
        # 输出格式化结果
        if result["status"] == "success":
            print("\n成功调用MCP服务")
            if isinstance(result["result"], str) and len(result["result"]) > 1000:
                print(f"结果: {result['result'][:1000]}... (内容已截断)")
            else:
                print(f"结果类型: {type(result['result']).__name__}")
                print("结果内容:")
                print("--------")
                if isinstance(result["result"], (dict, list)):
                    print(json.dumps(result["result"], ensure_ascii=False, indent=2))
                else:
                    print(result["result"])
                print("--------")
        else:
            print(f"\n调用失败: {result['message']}")
            sys.exit(1)

if __name__ == "__main__":
    main() 