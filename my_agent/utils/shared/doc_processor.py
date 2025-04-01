from langchain_community.document_loaders import Docx2txtLoader
from docx import Document  # 正确导入 python-docx



class DocProcessor:
    @staticmethod
    def load_doc(file_path):
        loader = Docx2txtLoader(file_path)
        content = []
        try:
            # 调用加载器的 load 方法加载文档内容
            documents = loader.load()
            # 遍历加载的文档列表
            for doc in documents:
                # 打印文档的内容
                content.append(doc.page_content)
        except Exception as e:
            print(f"加载文档时出现错误: {e}")   
        
        # 改进错误处理
        if not content:
            print("警告：文档内容为空，返回默认值")
            return "请提供有效的文档内容"
        
        return content[0]
    
    @staticmethod
    def save_doc(content: str, output_path: str):
        """保存结果到新文档"""
        doc = Document()  # 直接使用 Document
        doc.add_paragraph(content)
        doc.save(output_path)