import os
import json
import numpy as np
from typing import List, Tuple, Optional
from langchain.schema import Document
from langchain.embeddings.base import Embeddings
from langchain.vectorstores.base import VectorStore
from langchain.embeddings import HuggingFaceEmbeddings


class CustomVectorDB(VectorStore):
    """自定义本地向量数据库，支持高效相似度检索"""
    
    def __init__(self, embeddings: Embeddings, db_path: str):
        # 确保存储路径存在
        os.makedirs(db_path, exist_ok=True)
        
        self.embeddings = embeddings
        self.db_path = db_path
        self.vectors = np.empty((0,))  # 使用numpy数组提升性能
        self.metadata = []
        
        # 自动加载已有数据
        try:
            self.load()
        except FileNotFoundError:
            print("Initialize new vector database")

    def add_texts(self, texts: List[str], metadatas: Optional[List[dict]] = None) -> List[str]:
        """添加文本并生成嵌入向量"""
        # 参数校验
        metadatas = metadatas or [{}] * len(texts)
        if len(texts) != len(metadatas):
            raise ValueError("Texts and metadatas must have the same length")
        
        # 批量生成嵌入向量
        embeds = self.embeddings.embed_documents(texts)
        embeds_np = np.array(embeds)
        
        # 更新存储
        self.vectors = np.vstack([self.vectors, embeds_np]) if self.vectors.size else embeds_np
        self.metadata.extend(metadatas)
        
        self.save()
        return [str(i) for i in range(len(self.metadata)-len(texts), len(self.metadata))]

    def similarity_search(self, query: str, k: int = 4) -> List[Document]:
        """相似度搜索优化实现"""
        query_embed = np.array(self.embeddings.embed_query(query))
        
        # 批量计算余弦相似度
        if self.vectors.size == 0:
            return []
            
        norms = np.linalg.norm(self.vectors, axis=1)
        query_norm = np.linalg.norm(query_embed)
        similarities = np.dot(self.vectors, query_embed) / (norms * query_norm)
        
        # 获取Top K索引
        top_k_idx = np.argsort(similarities)[-k:][::-1]
        
        # 构建返回结果
        return [
            Document(
                page_content=self.metadata[idx].get("text", ""),  # 假设metadata存储原始文本
                metadata=self.metadata[idx]
            ) for idx in top_k_idx
        ]

    def save(self) -> None:
        """保存数据时自动创建目录"""
        np.save(os.path.join(self.db_path, "vectors.npy"), self.vectors)
        with open(os.path.join(self.db_path, "metadata.json"), "w") as f:
            json.dump(self.metadata, f, ensure_ascii=False)

    def load(self) -> None:
        """加载数据增加异常处理"""
        vectors_path = os.path.join(self.db_path, "vectors.npy")
        metadata_path = os.path.join(self.db_path, "metadata.json")
        
        if not os.path.exists(vectors_path) or not os.path.exists(metadata_path):
            raise FileNotFoundError("Database files not found")
            
        self.vectors = np.load(vectors_path)
        with open(metadata_path, "r") as f:
            self.metadata = json.load(f)

    @classmethod
    def from_texts(
        cls,
        texts: List[str],
        embedding: Embeddings,
        metadatas: Optional[List[dict]] = None,
        **kwargs
    ) -> "CustomVectorDB":
        """类方法创建实例"""
        db_path = kwargs.get("db_path", "./vector_db")
        metadatas = metadatas or [{"text": text} for text in texts]  # 自动存储原始文本
        instance = cls(embedding, db_path)
        instance.add_texts(texts, metadatas)
        return instance

class RetrievalTool:
    """增强版检索工具"""
    
    def __init__(self, corpus_path: str = "local_corpus"):
        self.embeddings = HuggingFaceEmbeddings()
        self.db = CustomVectorDB(
            embeddings=self.embeddings,
            db_path=corpus_path
        )
    
    def retrieve(self, text: str, k=3) -> List[str]:
        """执行检索并返回文本内容"""
        docs = self.db.similarity_search(text, k=k)
        return [doc.page_content for doc in docs]