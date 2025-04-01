'use client';

import { useState } from 'react';
import axios from 'axios';
import styles from './page.module.css';

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFileSelect = (selectedFile: File) => {
    if (!selectedFile.name.endsWith('.docx')) {
      setError('只支持.docx格式文件');
      return;
    }
    
    setFile(selectedFile);
    setResult(null);
    setError(null);
  };

  const handleProcessFile = async () => {
    if (!file) return;
    
    const formData = new FormData();
    formData.append('file', file);
    
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await axios.post(
        'http://localhost:8001/api/process-document', 
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        }
      );
      
      setResult(response.data.content);
      
    } catch (error: any) {
      console.error('Error processing document:', error);
      setError(error.response?.data?.detail || '文档处理过程中发生错误，请重试');
    } finally {
      setIsLoading(false);
    }
  };

  const handleReset = () => {
    setFile(null);
    setResult(null);
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + ' B';
    else if (bytes < 1048576) return (bytes / 1024).toFixed(2) + ' KB';
    else return (bytes / 1048576).toFixed(2) + ' MB';
  };

  return (
    <main className={styles.main}>
      <div className={styles.container}>
        <div className={styles.header}>
          <h1>智能文档处理系统</h1>
          <p>上传文档，获取AI处理结果</p>
        </div>

        {!result ? (
          <div className={styles.card}>
            <div 
              className={styles.uploadArea}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                  handleFileSelect(e.dataTransfer.files[0]);
                }
              }}
            >
              <div className={styles.uploadIcon}>📄</div>
              <p>拖拽文件到这里或点击上传</p>
              <input
                type="file"
                id="fileInput"
                accept=".docx"
                style={{ display: 'none' }}
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    handleFileSelect(e.target.files[0]);
                  }
                }}
              />
              <button 
                className={styles.button}
                onClick={() => document.getElementById('fileInput')?.click()}
                disabled={isLoading}
              >
                选择文件
              </button>
            </div>
            
            {file && (
              <div className={styles.fileInfo}>
                已选择: {file.name} ({formatFileSize(file.size)})
              </div>
            )}
            
            {error && <div className={styles.error}>{error}</div>}
            
            <div className={styles.buttonContainer}>
              <button
                className={`${styles.button} ${styles.primary}`}
                onClick={handleProcessFile}
                disabled={!file || isLoading}
              >
                {isLoading ? '处理中...' : '处理文档'}
              </button>
            </div>
            
            {isLoading && (
              <div className={styles.loader}>
                <div className={styles.spinner}></div>
                <p>正在处理文档，请稍候...</p>
              </div>
            )}
          </div>
        ) : (
          <div className={styles.card}>
            <h2>处理结果</h2>
            <div className={styles.resultContent}>
              {result}
            </div>
            <div className={styles.buttonContainer}>
              <a 
                href="http://localhost:8001/api/download-result"
                className={`${styles.button} ${styles.primary}`}
                download
              >
                下载处理后文档
              </a>
              <button
                className={`${styles.button} ${styles.secondary}`}
                onClick={handleReset}
              >
                上传新文档
              </button>
            </div>
          </div>
        )}
      </div>
    </main>
  );
} 