"""
直接测试CSC服务
"""
import json
import subprocess
import sys
import os
from pathlib import Path

def test_csc_direct():
    """直接使用子进程调用CSC服务测试"""
    # 测试文本
    test_text = "今天天气怎么样"
    
    # 创建JSON-RPC请求
    request = {
        "jsonrpc": "2.0",
        "id": "1",
        "method": "echo",
        "params": {"text": test_text}
    }
    
    # 将请求转换为JSON字符串
    request_str = json.dumps(request) + "\n"
    
    # 获取CSC服务器路径
    csc_server_script = str(Path(__file__).parent / "simple-csc" / "csc_server.py")
    
    # 准备环境变量
    env = os.environ.copy()
    env["PYTHONUNBUFFERED"] = "1"
    
    print(f"测试CSC服务: {csc_server_script}")
    print(f"请求: {request_str}")
    
    # 调用子进程
    try:
        process = subprocess.Popen(
            [sys.executable, csc_server_script],
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            env=env,
            text=True
        )
        
        # 发送请求
        stdout, stderr = process.communicate(input=request_str, timeout=15)
        
        # 打印结果
        print(f"返回码: {process.returncode}")
        print(f"标准输出:\n{stdout}")
        
        if stderr:
            print(f"错误输出:\n{stderr}")
        
        # 尝试解析JSON响应
        if stdout:
            try:
                # 尝试提取JSON部分
                if '{' in stdout and '}' in stdout:
                    json_start = stdout.find('{')
                    json_end = stdout.rfind('}') + 1
                    json_str = stdout[json_start:json_end]
                    response = json.loads(json_str)
                    print(f"解析的JSON响应:\n{json.dumps(response, indent=2, ensure_ascii=False)}")
                else:
                    print("输出中未找到JSON格式内容")
            except json.JSONDecodeError as e:
                print(f"JSON解析错误: {e}")
    
    except subprocess.TimeoutExpired:
        print("子进程执行超时")
    except Exception as e:
        print(f"测试过程中出错: {e}")

if __name__ == "__main__":
    test_csc_direct() 