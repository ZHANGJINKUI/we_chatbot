import re

class IntentClassifier:
    @staticmethod
    def classify(user_input: str) -> str:
        # 识别重新纠错命令
        recorrection_patterns = [
            r'(再次|重新|再|重做|重试).*(纠错|修正|修改)',
            r'(不满意|不够好|不行|不好).*(结果|纠错|修正)',
            r'(改进|优化|提高).*(纠错|修正|修改|结果)',
            r'这个(纠错|修正|修改|结果).*(不满意|不够好|不行|不好)',
        ]
        
        # 先检查是否是重新纠错请求
        for pattern in recorrection_patterns:
            if re.search(pattern, user_input, re.IGNORECASE):
                return "recorrection"
        
        # 更精确的纠错关键词匹配，确保是明确的纠错请求
        correction_patterns = [
            r'(请|帮我|帮忙|需要|想要|可以).*(纠错|修正|修改|检查错误)',
            r'(纠错|修正|修改|检查错误).*(这|以下|如下|我的)',
            r'公文纠错',
            r'(对|把|将)(刚刚|上一句|前面|之前).*(纠错|修正|修改|检查错误)',
            r'(纠错|修正|修改|检查错误).*(刚刚|上一句|前面|之前)'
        ]
        
        writing_keywords = r'写作|润色|改写|优化'
        
        # 检查是否匹配任何纠错模式
        for pattern in correction_patterns:
            if re.search(pattern, user_input, re.IGNORECASE):
                return "correction"
                
        # 检查是否匹配写作关键词
        if re.search(writing_keywords, user_input):
            return "writing"
            
        # 默认为聊天意图
        return "chat"
        
    @staticmethod
    def is_history_correction(user_input: str) -> bool:
        """检查是否是要求纠错历史消息的请求"""
        history_correction_patterns = [
            r'(对|把|将)(刚刚|上一句|前面|之前).*(纠错|修正|修改|检查错误)',
            r'(纠错|修正|修改|检查错误).*(刚刚|上一句|前面|之前)'
        ]
        
        for pattern in history_correction_patterns:
            if re.search(pattern, user_input, re.IGNORECASE):
                return True
                
        return False
        
    @staticmethod
    def is_recorrection(user_input: str) -> bool:
        """检查是否是要求重新纠错的请求"""
        recorrection_patterns = [
            r'(再次|重新|再|重做|重试).*(纠错|修正|修改)',
            r'(不满意|不够好|不行|不好).*(结果|纠错|修正)',
            r'(改进|优化|提高).*(纠错|修正|修改|结果)',
            r'这个(纠错|修正|修改|结果).*(不满意|不够好|不行|不好)',
        ]
        
        for pattern in recorrection_patterns:
            if re.search(pattern, user_input, re.IGNORECASE):
                return True
                
        return False