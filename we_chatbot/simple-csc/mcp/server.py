"""
最小化MCP协议服务器实现
提供符合MCP协议的JSON-RPC 2.0通信接口
"""

import sys
import json
import inspect
import asyncio
from typing import Dict, Any, Callable, List, Optional, Union, get_type_hints

class FastMCP:
    """简单的MCP协议服务器实现"""
    
    def __init__(self, name: str):
        """初始化MCP服务器
        
        Args:
            name: 服务器名称
        """
        self.name = name
        self.tools = {}
        self.descriptions = {}
        
    def tool(self, name: str = None, description: str = None):
        """工具装饰器，用于注册工具函数
        
        Args:
            name: 工具名称
            description: 工具描述
        """
        def decorator(func):
            # 获取函数名称（如果未提供则使用函数名）
            tool_name = name or func.__name__
            # 获取函数描述（如果未提供则使用函数文档字符串）
            tool_desc = description or func.__doc__ or ""
            
            # 注册工具
            self.tools[tool_name] = func
            self.descriptions[tool_name] = tool_desc
            
            return func
        return decorator
        
    def handle_request(self, request_data: Dict[str, Any]) -> Dict[str, Any]:
        """处理MCP请求
        
        Args:
            request_data: MCP请求数据
            
        Returns:
            MCP响应数据
        """
        # 验证JSON-RPC 2.0请求
        if request_data.get("jsonrpc") != "2.0":
            return {
                "jsonrpc": "2.0",
                "error": {"code": -32600, "message": "无效的请求: 不是JSON-RPC 2.0"},
                "id": request_data.get("id")
            }
            
        # 获取请求ID
        request_id = request_data.get("id")
        
        # 获取请求方法
        method = request_data.get("method")
        if not method:
            return {
                "jsonrpc": "2.0",
                "error": {"code": -32601, "message": "方法未指定"},
                "id": request_id
            }
            
        # 获取请求参数
        params = request_data.get("params", {})
        
        # 查找对应的工具函数
        if method not in self.tools:
            return {
                "jsonrpc": "2.0",
                "error": {"code": -32601, "message": f"方法不存在: {method}"},
                "id": request_id
            }
            
        try:
            # 调用工具函数
            tool_func = self.tools[method]
            
            # 检查是否是异步函数
            if inspect.iscoroutinefunction(tool_func):
                # 运行异步函数
                loop = asyncio.get_event_loop()
                result = loop.run_until_complete(tool_func(**params))
            else:
                # 运行同步函数
                result = tool_func(**params)
            
            # 返回结果
            return {
                "jsonrpc": "2.0",
                "result": result,
                "id": request_id
            }
        except Exception as e:
            # 返回错误
            return {
                "jsonrpc": "2.0",
                "error": {"code": -32603, "message": f"内部错误: {str(e)}"},
                "id": request_id
            }
    
    def run(self, transport: str = "stdio"):
        """运行MCP服务器
        
        Args:
            transport: 传输方式，支持stdio
        """
        if transport == "stdio":
            self._run_stdio()
        else:
            raise ValueError(f"不支持的传输方式: {transport}")
    
    def _run_stdio(self):
        """通过标准输入输出运行MCP服务器"""
        try:
            # 如果需要，初始化事件循环
            try:
                loop = asyncio.get_event_loop()
            except RuntimeError:
                # 如果找不到事件循环，创建一个新的
                loop = asyncio.new_event_loop()
                asyncio.set_event_loop(loop)
            
            # 从标准输入读取一行JSON请求
            for line in sys.stdin:
                line = line.strip()
                if not line:
                    continue
                
                try:
                    # 解析JSON请求
                    request_data = json.loads(line)
                    
                    # 处理请求
                    response_data = self.handle_request(request_data)
                    
                    # 返回JSON响应
                    print(json.dumps(response_data))
                    sys.stdout.flush()
                except json.JSONDecodeError:
                    # 返回解析错误
                    print(json.dumps({
                        "jsonrpc": "2.0",
                        "error": {"code": -32700, "message": "解析错误: 无效的JSON"},
                        "id": None
                    }))
                    sys.stdout.flush()
        except KeyboardInterrupt:
            pass 