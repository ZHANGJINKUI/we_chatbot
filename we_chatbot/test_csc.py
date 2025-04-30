"""
测试CSC公文纠错模块
"""

import json
from my_agent.agent_tools import csc, call_mcp_service

def test_mcp_service():
    """测试MCP服务连接"""
    print("测试MCP服务连接...")
    # 使用echo工具测试连接
    response = call_mcp_service("echo", {"text": "测试消息"})
    print(f"MCP服务响应: {json.dumps(response, ensure_ascii=False, indent=2)}")
    
    if response["status"] == "success":
        print("✓ MCP服务连接成功")
    else:
        print(f"× MCP服务连接失败: {response.get('message', '未知错误')}")
    
    return response["status"] == "success"

def test_csc_debug():
    """使用直接调用MCP方式测试纠错算法"""
    print("\n直接通过MCP调用纠错算法...\n")
    test_text = "今天天气怎么样"
    print(f"测试文本: '{test_text}'")
    
    # 直接调用MCP服务
    response = call_mcp_service("纠错算法", {"text": test_text})
    print(f"MCP纠错算法响应: {json.dumps(response, ensure_ascii=False, indent=2)}")
    
    # 查看输出内容详情
    if response["status"] == "success":
        print("✓ 纠错算法调用成功")
        return True
    else:
        print(f"× 纠错算法调用失败: {response.get('message', '未知错误')}")
        return False

def test_csc():
    """测试CSC纠错函数"""
    # 先检查MCP服务是否可用
    if not test_mcp_service():
        print("MCP服务不可用，跳过CSC测试")
        return
    
    # 测试直接MCP调用
    if not test_csc_debug():
        print("MCP纠错算法直接调用失败，问题可能在算法实现")
        return
    
    # 测试文本
    test_texts = [
        "今天天气怎么样",  # 常规文本
        "我是一只光荣的共产党员",  # 政治相关文本
        "这个文档需要纠正，里面有很多措词不妥的地方" # 有关纠错的文本
    ]
    
    print("\n开始CSC服务测试...")
    
    for idx, text in enumerate(test_texts):
        print(f"\n测试 {idx+1}: '{text}'")
        result = csc(text)
        print(f"CSC结果: {json.dumps(result, ensure_ascii=False, indent=2)}")
    
    print("\n测试完成")

if __name__ == "__main__":
    test_csc() 