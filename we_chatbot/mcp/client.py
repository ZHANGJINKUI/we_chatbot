"""
MCP客户端 - 提供简单的MCP协议客户端实现
"""

import json
import asyncio
import subprocess
import sys
import os
from typing import Dict, Any, Optional, List, Union

class SimpleMCPTool:
    """简单的MCP协议客户端实现，通过HTTP或subprocess调用MCP服务"""
    
    def __init__(self, endpoint: str = None):
        """初始化SimpleMCPTool
        
        Args:
            endpoint: MCP服务的HTTP端点，例如http://127.0.0.1:8080
                     如果不提供，则默认使用subprocess调用
        """
        self.endpoint = endpoint
        self.is_http = endpoint is not None and endpoint.startswith("http")
        
        # 如果没有提供endpoint，或者endpoint不是HTTP URL，则使用默认配置
        if not self.is_http:
            # 获取当前工作目录
            self.cwd = os.getcwd()
            # 查找simple-csc目录
            simple_csc_dir = None
            current_dir = self.cwd
            
            # 尝试向上查找simple-csc目录
            for _ in range(5):  # 最多向上查找5层
                if os.path.exists(os.path.join(current_dir, "simple-csc")):
                    simple_csc_dir = os.path.join(current_dir, "simple-csc")
                    break
                parent_dir = os.path.dirname(current_dir)
                if parent_dir == current_dir:  # 已经到达根目录
                    break
                current_dir = parent_dir
            
            # 如果找到simple-csc目录，则使用它
            if simple_csc_dir:
                self.simple_csc_dir = simple_csc_dir
                self.server_path = os.path.join(self.simple_csc_dir, "csc_server.py")
            else:
                # 如果没有找到，则尝试使用提供的路径或当前目录下的csc_server.py
                self.simple_csc_dir = self.cwd
                self.server_path = os.path.join(self.simple_csc_dir, "csc_server.py")
                if not os.path.exists(self.server_path):
                    raise ValueError(f"找不到CSC服务器文件: {self.server_path}")
    
    async def call(self, method: str, **params) -> Any:
        """异步调用MCP工具
        
        Args:
            method: 工具方法名
            **params: 参数
            
        Returns:
            工具返回的结果
        """
        if self.is_http:
            # 通过HTTP调用
            return await self._call_via_http(method, params)
        else:
            # 通过subprocess调用
            return await self._call_via_subprocess(method, params)
    
    async def _call_via_http(self, method: str, params: Dict[str, Any]) -> Any:
        """通过HTTP调用MCP工具
        
        Args:
            method: 工具方法名
            params: 参数
            
        Returns:
            工具返回的结果
        """
        import aiohttp
        
        # 构建MCP请求
        mcp_request = {
            "jsonrpc": "2.0",
            "method": method,
            "params": params,
            "id": 1
        }
        
        # 发送HTTP请求
        async with aiohttp.ClientSession() as session:
            async with session.post(self.endpoint, json=mcp_request) as response:
                if response.status != 200:
                    # 请求失败
                    error_text = await response.text()
                    raise RuntimeError(f"HTTP请求失败: {response.status} - {error_text}")
                
                # 解析响应
                response_data = await response.json()
                
                # 检查是否有错误
                if "error" in response_data:
                    error = response_data["error"]
                    raise RuntimeError(f"MCP调用错误: {error.get('message', '未知错误')}")
                
                # 返回结果
                return response_data.get("result")
    
    async def _call_via_subprocess(self, method: str, params: Dict[str, Any]) -> Any:
        """通过subprocess调用MCP工具
        
        Args:
            method: 工具方法名
            params: 参数
            
        Returns:
            工具返回的结果
        """
        # 构建MCP请求
        mcp_request = {
            "jsonrpc": "2.0",
            "method": method,
            "params": params,
            "id": 1
        }
        
        # 将请求转换为JSON字符串
        request_json = json.dumps(mcp_request) + "\n"
        
        # 准备环境变量
        env = os.environ.copy()
        # 设置PYTHONUNBUFFERED确保输出不缓冲
        env["PYTHONUNBUFFERED"] = "1"
        
        # 确保PYTHONPATH包含simple-csc目录
        python_path = env.get("PYTHONPATH", "")
        if self.simple_csc_dir not in python_path:
            path_sep = ";" if sys.platform == "win32" else ":"
            env["PYTHONPATH"] = f"{python_path}{path_sep}{self.simple_csc_dir}" if python_path else self.simple_csc_dir
        
        # 创建子进程
        process = await asyncio.create_subprocess_exec(
            sys.executable,
            self.server_path,
            stdin=asyncio.subprocess.PIPE,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
            env=env,
            cwd=self.simple_csc_dir
        )
        
        # 发送请求并读取响应
        stdout, stderr = await process.communicate(input=request_json.encode('utf-8'))
        
        # 解析响应
        if stderr:
            stderr_text = stderr.decode('utf-8', errors='replace')
            print(f"警告: 工具调用有标准错误输出: {stderr_text}")
        
        if not stdout:
            raise RuntimeError(f"工具 {method} 没有返回数据")
        
        stdout_text = stdout.decode('utf-8', errors='replace')
        
        # 尝试从标准输出中找到并解析JSON响应
        response_data = None
        for line in stdout_text.splitlines():
            line = line.strip()
            if not line:
                continue
            
            try:
                data = json.loads(line)
                if "jsonrpc" in data and "id" in data and data.get("id") == 1:
                    response_data = data
                    break
            except json.JSONDecodeError:
                continue
        
        if not response_data:
            raise RuntimeError(f"无法解析工具 {method} 的响应: {stdout_text}")
        
        # 检查是否有错误
        if "error" in response_data:
            error = response_data["error"]
            raise RuntimeError(f"MCP调用错误: {error.get('message', '未知错误')}")
        
        # 返回结果
        return response_data.get("result")

    def close(self) -> None:
        """关闭客户端连接，释放资源"""
        # 在此版本中不需要特殊的清理操作
        pass 