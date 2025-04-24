#!/usr/bin/env python
# -*- coding: utf-8 -*-

"""
测试simple-csc服务的润色和总结功能
"""

import asyncio
import os
from mcp.client import SimpleMCPTool

# 获取当前工作目录
current_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
# 设置CSC服务器路径
csc_server_path = os.path.join(current_dir, "simple-csc", "csc_server.py")

# 测试文本
test_text = """
关于召开2024年度软件工程专业建设研讨会的通知

各位教师、行业专家以及相关单位:

为了促进软件工程专业的发展，推动教学改革和人才培养模式创新，提高教学质量，我校计算机学院将举办2024年度软件工程专业建设研讨会。

会议时间：2024年5月15日 14:00-17:00
会议地点：计算机学院三楼会议室
参会人员：软件工程教研室全体教师、行业企业代表、教学督导专家

会议内容：
1、分析软件工程专业发展现状和问题
2、探讨新工科背景下的课程体系改革
3、讨论产教融合的实施方案
4、研究毕业要求达成评价机制

请各位参会人员做好准备工作，收到通知后请回复是否参加。如有特殊情况不能参加的，请提前说明。

计算机学院
2024年4月30日
"""

async def test_polish():
    """测试润色功能"""
    print("=== 测试润色功能 ===")
    # 使用直接调用方式
    mcp_tool = SimpleMCPTool()
    try:
        # 调用润色工具
        result = await mcp_tool.call("润色工具", text=test_text)
        print(result)
        return True
    except Exception as e:
        print(f"润色功能测试失败: {str(e)}")
        return False

async def test_summary():
    """测试总结功能"""
    print("\n=== 测试总结功能 ===")
    # 使用直接调用方式
    mcp_tool = SimpleMCPTool()
    try:
        # 调用总结工具
        result = await mcp_tool.call("总结工具", text=test_text)
        print(result)
        return True
    except Exception as e:
        print(f"总结功能测试失败: {str(e)}")
        return False

async def test_csc():
    """测试纠错功能（确认原有功能正常）"""
    print("\n=== 测试纠错功能 ===")
    # 使用直接调用方式
    mcp_tool = SimpleMCPTool()
    try:
        # 测试有错别字的文本
        text_with_errors = "软件工程是一门研究用工程化方法构建和维护有效、实用的软件的学科。它涉及程序设计语言、数据库、软件开发工具、系统平台、标准、设计模式等方面。电脑软件作为一种特殊的产品，其成本集中在开发阶段，具有一次开发、多次使用的特性。这种特性决定了软件必须保证其质量。"
        
        # 调用纠错算法
        result = await mcp_tool.call("纠错算法", text=text_with_errors)
        print(result)
        return True
    except Exception as e:
        print(f"纠错功能测试失败: {str(e)}")
        return False

async def main():
    """主函数"""
    print("开始测试MCP服务...")
    print(f"使用CSC服务器: {csc_server_path}")
    
    # 测试纠错功能
    csc_result = await test_csc()
    
    # 测试润色功能
    polish_result = await test_polish()
    
    # 测试总结功能
    summary_result = await test_summary()
    
    # 输出总结果
    print("\n=== 测试结果 ===")
    print(f"纠错功能: {'成功' if csc_result else '失败'}")
    print(f"润色功能: {'成功' if polish_result else '失败'}")
    print(f"总结功能: {'成功' if summary_result else '失败'}")

if __name__ == "__main__":
    asyncio.run(main()) 