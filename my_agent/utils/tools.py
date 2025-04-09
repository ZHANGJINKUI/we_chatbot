"""
工具模块 - 提供简单的工具函数，直接通过MCP协议调用simple-csc
"""

import os
import sys
import json
import logging
import subprocess
from typing import Dict, Any, List, Optional, Union

# 设置日志
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
)
logger = logging.getLogger('agent_tools')

class SimpleMCPTool:
    """轻量级MCP工具调用实现"""
    
    def __init__(self):
        """初始化工具"""
        # 获取当前文件所在目录
        current_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        # 获取项目根目录
        project_root = os.path.dirname(current_dir)
        # 设置simple-csc路径
        self.simple_csc_dir = os.path.join(project_root, "simple-csc")
        self.server_path = os.path.join(self.simple_csc_dir, "csc_server.py")
        
        # 检查服务器文件是否存在
        if not os.path.exists(self.server_path):
            logger.error(f"CSC服务器文件不存在: {self.server_path}")
    
    def call_tool(self, method: str, **params) -> Any:
        """通过MCP协议调用工具
        
        Args:
            method: 工具方法名
            **params: 参数
            
        Returns:
            工具返回的结果
        """
        try:
            # 构建MCP请求
            mcp_request = {
                "jsonrpc": "2.0",
                "method": method,
                "params": params,
                "id": 1
            }
            
            logger.info(f"调用工具 {method} 参数: {params}")
            
            # 启动进程
            env = os.environ.copy()
            # 确保PYTHONPATH包含simple-csc目录
            python_path = env.get("PYTHONPATH", "")
            if self.simple_csc_dir not in python_path:
                env["PYTHONPATH"] = f"{python_path}:{self.simple_csc_dir}" if python_path else self.simple_csc_dir
                
            process = subprocess.Popen(
                [sys.executable, self.server_path],
                stdin=subprocess.PIPE,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                cwd=self.simple_csc_dir,
                env=env,
                text=True
            )
            
            # 发送MCP请求
            request_json = json.dumps(mcp_request) + "\n"
            logger.debug(f"发送MCP请求: {request_json}")
            
            # 通过stdin发送请求，并从stdout读取响应
            stdout_data, stderr_data = process.communicate(input=request_json)
            
            # 检查是否有错误
            if stderr_data:
                logger.warning(f"工具调用有标准错误输出: {stderr_data}")
            
            # 解析响应
            if not stdout_data.strip():
                return f"工具 {method} 没有返回数据"
                
            try:
                response = json.loads(stdout_data.strip())
                
                # 检查是否有错误
                if "error" in response:
                    error_msg = response["error"].get("message", "未知错误")
                    logger.error(f"工具调用错误: {error_msg}")
                    return f"工具调用错误: {error_msg}"
                
                # 返回结果
                if "result" in response:
                    return response["result"]
                else:
                    logger.warning(f"工具响应中没有结果字段: {response}")
                    return f"工具 {method} 没有返回有效结果"
                    
            except json.JSONDecodeError as e:
                logger.error(f"解析工具响应失败: {e}, 响应: {stdout_data}")
                return f"解析工具响应失败: {stdout_data}"
                
        except Exception as e:
            logger.exception(f"调用工具 {method} 时出错: {e}")
            return f"调用工具出错: {str(e)}"
    
    def correct_text(self, text: str) -> str:
        """进行中文拼写纠错
        
        Args:
            text: 待纠错的文本
        
        Returns:
            纠错后的文本
        """
        return self.call_tool("纠错算法", text=text)
