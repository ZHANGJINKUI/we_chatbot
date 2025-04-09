'use client';

import { useState } from 'react';
import axios from 'axios';
// 使用全局CSS替代模块CSS
import './styles.css';

// 使用服务器IP替代localhost
const SERVER_IP = '10.102.59.4';
// 更新API端口
const API_PORT = 8003;

// 定义消息类型
type ChatMessage = {
  role: string;
  content: string;
  type?: string;
  isFeedbackProcessing?: boolean;
};

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [originalContent, setOriginalContent] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showComparison, setShowComparison] = useState<boolean>(true); // 默认显示对比视图
  
  // 聊天相关状态
  const [showChat, setShowChat] = useState(false);
  const [message, setMessage] = useState('');
  const [chatHistory, setChatHistory] = useState<Array<ChatMessage>>([]);
  const [isChatLoading, setIsChatLoading] = useState(false);

  // 在组件顶部添加状态管理
  const [isFeedbackLoading, setIsFeedbackLoading] = useState(false);

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
        `http://${SERVER_IP}:${API_PORT}/api/process-document`, 
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        }
      );
      
      setResult(response.data.content);
      setOriginalContent(response.data.original_content);
      
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
    setOriginalContent(null);
  };
  
  // 发送聊天消息
  const handleSendMessage = async () => {
    if (!message.trim()) return;
    
    const userMessage = { role: 'user', content: message };
    const updatedHistory = [...chatHistory, userMessage];
    
    setChatHistory(updatedHistory);
    setMessage('');
    setIsChatLoading(true);
    
    try {
      const response = await axios.post(`http://${SERVER_IP}:${API_PORT}/api/chat`, {
        message: message,
        chat_history: chatHistory
      });
      
      setChatHistory(response.data.chat_history);
    } catch (error: any) {
      console.error('Error sending message:', error);
      // 添加错误消息到聊天历史
      setChatHistory([
        ...updatedHistory, 
        { role: 'assistant', content: '发生错误，请重试' }
      ]);
    } finally {
      setIsChatLoading(false);
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + ' B';
    else if (bytes < 1048576) return (bytes / 1024).toFixed(2) + ' KB';
    else return (bytes / 1048576).toFixed(2) + ' MB';
  };

  // 格式化响应，处理特殊格式
  const formatResponse = (responseText: string) => {
    // 添加更全面的检测模式，包括各种可能的前缀
    const correctionPrefixes = [
      '【MCP协议公文纠错专用模式已启用】',
      '【公文纠错专用模式-文档处理已启用】',
      '【公文纠错专用模式-聊天纠错已启用】', 
      '【公文纠错专用模式-润色建议】',
      '【公文纠错专用模式-改进版】',
      '[公文纠错专用模式-文档处理]',
      '[公文纠错专用模式-聊天纠错]',
      '[公文纠错专用模式-润色建议]',
      '[公文纠错专用模式-改进版]',
      '[公文纠错专用模式-LLM纠错]',
      '[公文纠错专用模式-联合纠错]'
    ];
    
    // 检查是否包含任何一种纠错模式前缀
    for (const prefix of correctionPrefixes) {
      if (responseText.includes(prefix)) {
        const mainContent = responseText.replace(prefix, '');
        // 根据前缀类型确定图标和标题
        let icon = '💬';
        let title = '公文纠错专用模式';
        
        if (prefix.includes('MCP协议')) {
          icon = '🔧';
          title = 'MCP协议公文纠错专用模式已启用';
        } else if (prefix.includes('文档处理')) {
          icon = '📄';
          title = '公文纠错专用模式-文档处理';
        } else if (prefix.includes('润色建议')) {
          icon = '✨';
          title = '公文纠错专用模式-润色建议';
        } else if (prefix.includes('改进版')) {
          icon = '🔄';
          title = '公文纠错专用模式-改进版';
        } else if (prefix.includes('LLM纠错')) {
          icon = '🤖';
          title = '公文纠错专用模式-LLM纠错';
        } else if (prefix.includes('联合纠错')) {
          icon = '🔗';
          title = '公文纠错专用模式-联合纠错';
        }
        
        // 所有纠错模式都包含反馈按钮
        return (
          <>
            <div className={`special-mode-tag ${prefix.includes('MCP协议') ? 'mcp' : prefix.includes('文档处理') ? 'doc' : 'chat'}`}>
              <div>
                <span className="icon">{icon}</span>
                {title}
              </div>
              <div className="feedback-buttons">
                <button 
                  className="feedback-btn positive" 
                  onClick={() => handleFeedback('positive', findLastCorrectionText(chatHistory))}
                >
                  满意
                </button>
                <button 
                  className="feedback-btn negative" 
                  onClick={() => handleFeedback('negative', findLastCorrectionText(chatHistory))}
                >
                  不满意
                </button>
              </div>
            </div>
            {mainContent}
          </>
        );
      }
    }
    
    // 警告：检查是否有潜在的部分匹配，可能因为格式问题未被正确识别
    if (responseText.includes('公文纠错专用模式') || responseText.includes('MCP协议')) {
      console.warn('检测到可能的纠错模式标签，但格式不完全匹配:', responseText.substring(0, 50));
    }
    
    return responseText;
  };

  // 处理反馈
  const handleFeedback = (isPositive: string, correctionResult: string) => {
    // 找到最后一次用户提供的纠错文本
    const originalText = findLastCorrectionText(chatHistory);
    
    if (originalText) {
      // 设置加载状态
      setIsFeedbackLoading(true);
      
      // 创建反馈消息
      const feedbackMessage = {
        role: 'user',
        content: '用户反馈',
        type: 'correction_feedback',
        satisfied: isPositive === 'positive',
        original_text: originalText
      };
      
      // 添加一个临时反馈消息到历史
      const tempMessage = {
        role: 'assistant',
        content: isPositive === 'positive' ? '感谢您的反馈！' : '正在处理您的反馈，重新纠错中...',
        isFeedbackProcessing: true
      };
      
      const updatedHistory = [...chatHistory, feedbackMessage, tempMessage];
      setChatHistory(updatedHistory);
      
      // 发送到后端
      axios.post(`http://${SERVER_IP}:${API_PORT}/api/chat`, {
        message: JSON.stringify(feedbackMessage),
        chat_history: chatHistory
      })
      .then(response => {
        setChatHistory(response.data.chat_history);
        setIsFeedbackLoading(false);
      })
      .catch(error => {
        console.error('Error sending feedback:', error);
        alert('发送反馈时出错，请重试');
        setIsFeedbackLoading(false);
      });
    } else {
      // 当找不到原始文本时
      alert(isPositive === 'positive' ? '感谢您的反馈！' : '抱歉，无法找到需要重新纠错的文本');
    }
  };

  // 从聊天历史中找到最后一条需要反馈的纠错文本
  const findLastCorrectionText = (history: ChatMessage[]): string => {
    // 倒序遍历历史记录，找到最近的用户消息
    for (let i = history.length - 1; i >= 0; i--) {
      if (history[i].role === 'user') {
        return history[i].content;
      }
    }
    return '';
  };

  return (
    <div className="main-container">
      <header className="app-header">
        <h1>智能公文纠错系统</h1>
        <div className="app-tabs">
          <button 
            className={!showChat ? 'active' : ''}
            onClick={() => {
              setShowChat(false);
            }}
            style={{
              padding: '12px 25px',
              fontSize: '16px',
              borderRadius: '8px 8px 0 0',
              margin: '0 8px',
              fontWeight: 'bold',
              display: 'flex',
              alignItems: 'center',
              transition: 'all 0.3s ease'
            }}
          >
            <span style={{ marginRight: '8px', fontSize: '20px' }}>📄</span>
            文档纠错
          </button>
          <button 
            className={showChat ? 'active' : ''}
            onClick={() => {
              setShowChat(true);
            }}
            style={{
              padding: '12px 25px',
              fontSize: '16px',
              borderRadius: '8px 8px 0 0',
              margin: '0 8px',
              fontWeight: 'bold',
              display: 'flex',
              alignItems: 'center',
              transition: 'all 0.3s ease'
            }}
          >
            <span style={{ marginRight: '8px', fontSize: '20px' }}>💬</span>
            聊天助手
          </button>
        </div>
      </header>

      <main className="main" style={{ padding: '30px 0' }}>
        <div className="container" style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 20px' }}>
          {!showChat ? (
            // 文档处理界面
            !result ? (
              <div className="card" style={{ 
                backgroundColor: '#f8fafc', 
                borderRadius: '12px', 
                boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)',
                padding: '30px',
                transition: 'all 0.3s ease'
              }}>
                <h2 style={{ 
                  fontSize: '24px', 
                  marginBottom: '20px', 
                  color: '#1e40af',
                  borderBottom: '2px solid #dbeafe',
                  paddingBottom: '12px'
                }}>
                  文档纠错服务
                </h2>
                <p style={{ marginBottom: '20px', color: '#4b5563' }}>
                  上传您的文档，系统将自动进行公文格式与内容纠错，支持.docx格式文件。
                </p>
                <div 
                  className="upload-area"
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                      handleFileSelect(e.dataTransfer.files[0]);
                    }
                  }}
                  style={{
                    border: '2px dashed #93c5fd',
                    borderRadius: '8px',
                    padding: '40px',
                    textAlign: 'center',
                    backgroundColor: '#eff6ff',
                    marginBottom: '20px',
                    cursor: 'pointer',
                    transition: 'all 0.3s ease'
                  }}
                >
                  <div className="upload-icon" style={{ fontSize: '48px', marginBottom: '16px' }}>📄</div>
                  <p style={{ fontSize: '16px', marginBottom: '24px', color: '#3b82f6' }}>拖拽文件到这里或点击上传</p>
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
                    className="button"
                    onClick={() => document.getElementById('fileInput')?.click()}
                    disabled={isLoading}
                    style={{
                      backgroundColor: '#2563eb',
                      color: 'white',
                      border: 'none',
                      padding: '12px 24px',
                      borderRadius: '6px',
                      fontSize: '16px',
                      cursor: 'pointer',
                      fontWeight: 'bold',
                      transition: 'all 0.3s ease',
                      opacity: isLoading ? 0.7 : 1
                    }}
                  >
                    选择文件
                  </button>
                </div>
                
                {file && (
                  <div className="file-info" style={{
                    backgroundColor: '#e0f2fe',
                    padding: '12px 16px',
                    borderRadius: '6px',
                    fontSize: '14px',
                    marginBottom: '20px',
                    display: 'flex',
                    alignItems: 'center'
                  }}>
                    <span style={{ marginRight: '8px', fontSize: '18px' }}>📎</span>
                    已选择: {file.name} ({formatFileSize(file.size)})
                  </div>
                )}
                
                {error && <div className="error" style={{
                  backgroundColor: '#fee2e2',
                  color: '#b91c1c',
                  padding: '12px 16px',
                  borderRadius: '6px',
                  marginBottom: '20px'
                }}>{error}</div>}
                
                <div className="button-container" style={{ textAlign: 'center', marginTop: '30px' }}>
                  <button
                    className="button primary"
                    onClick={handleProcessFile}
                    disabled={!file || isLoading}
                    style={{
                      backgroundColor: '#1d4ed8',
                      color: 'white',
                      border: 'none',
                      padding: '14px 30px',
                      borderRadius: '8px',
                      fontSize: '16px',
                      cursor: 'pointer',
                      fontWeight: 'bold',
                      boxShadow: '0 4px 6px rgba(29, 78, 216, 0.1)',
                      transition: 'all 0.3s ease',
                      opacity: !file || isLoading ? 0.7 : 1
                    }}
                  >
                    {isLoading ? '处理中...' : '处理文档'}
                  </button>
                </div>
                
                {isLoading && (
                  <div className="loader" style={{ 
                    textAlign: 'center', 
                    marginTop: '20px',
                    padding: '20px',
                    backgroundColor: '#f0f9ff',
                    borderRadius: '8px'
                  }}>
                    <div className="spinner" style={{
                      display: 'inline-block',
                      width: '30px',
                      height: '30px',
                      border: '3px solid rgba(59, 130, 246, 0.2)',
                      borderRadius: '50%',
                      borderTop: '3px solid #3b82f6',
                      animation: 'spin 1s linear infinite',
                      marginBottom: '15px'
                    }}></div>
                    <p style={{ color: '#3b82f6' }}>正在处理文档，请稍候...</p>
                  </div>
                )}
              </div>
            ) : (
              <div className="card" style={{ 
                backgroundColor: '#f8fafc', 
                borderRadius: '12px', 
                boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)',
                padding: '30px'
              }}>
                <h2 style={{ 
                  fontSize: '24px', 
                  marginBottom: '20px', 
                  color: '#1e40af',
                  borderBottom: '2px solid #dbeafe',
                  paddingBottom: '12px'
                }}>处理结果</h2>
                <div className="result-tabs" style={{
                  display: 'flex',
                  marginBottom: '20px',
                  borderBottom: '1px solid #e5e7eb',
                  paddingBottom: '10px'
                }}>
                  <button 
                    className={showComparison ? "active" : ""}
                    onClick={() => setShowComparison(true)}
                    style={{
                      padding: '8px 16px',
                      marginRight: '10px',
                      backgroundColor: showComparison ? '#3b82f6' : '#e5e7eb',
                      color: showComparison ? 'white' : '#4b5563',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontWeight: showComparison ? 'bold' : 'normal',
                      transition: 'all 0.3s ease'
                    }}
                  >
                    对比视图
                  </button>
                  <button 
                    className={!showComparison ? "active" : ""}
                    onClick={() => setShowComparison(false)}
                    style={{
                      padding: '8px 16px',
                      backgroundColor: !showComparison ? '#3b82f6' : '#e5e7eb',
                      color: !showComparison ? 'white' : '#4b5563',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontWeight: !showComparison ? 'bold' : 'normal',
                      transition: 'all 0.3s ease'
                    }}
                  >
                    仅结果
                  </button>
                </div>
                
                {showComparison && originalContent ? (
                  <div className="comparison-view">
                    <div className="comparison-container" style={{
                      display: 'grid',
                      gridTemplateColumns: '1fr 1fr',
                      gap: '20px',
                      marginBottom: '30px'
                    }}>
                      <div className="original-content" style={{
                        backgroundColor: '#f1f5f9',
                        padding: '20px',
                        borderRadius: '8px',
                        border: '1px solid #e2e8f0'
                      }}>
                        <h3 style={{
                          fontSize: '18px',
                          marginBottom: '15px',
                          color: '#475569',
                          display: 'flex',
                          alignItems: 'center'
                        }}>
                          <span style={{ marginRight: '8px', fontSize: '18px' }}>📄</span>
                          原始文档
                        </h3>
                        <div className="content-box" style={{
                          backgroundColor: 'white',
                          padding: '15px',
                          borderRadius: '6px',
                          maxHeight: '500px',
                          overflowY: 'auto',
                          border: '1px solid #e2e8f0',
                          lineHeight: '1.6',
                          fontSize: '14px'
                        }}>
                          {originalContent}
                        </div>
                      </div>
                      <div className="corrected-content" style={{
                        backgroundColor: '#ecfdf5',
                        padding: '20px',
                        borderRadius: '8px',
                        border: '1px solid #d1fae5'
                      }}>
                        <h3 style={{
                          fontSize: '18px',
                          marginBottom: '15px',
                          color: '#065f46',
                          display: 'flex',
                          alignItems: 'center'
                        }}>
                          <span style={{ marginRight: '8px', fontSize: '18px' }}>✓</span>
                          纠错后文档
                        </h3>
                        <div className="content-box" style={{
                          backgroundColor: 'white',
                          padding: '15px',
                          borderRadius: '6px',
                          maxHeight: '500px',
                          overflowY: 'auto',
                          border: '1px solid #d1fae5',
                          lineHeight: '1.6',
                          fontSize: '14px'
                        }}>
                          {formatResponse(result)}
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="result-content" style={{
                    backgroundColor: '#ecfdf5',
                    padding: '25px',
                    borderRadius: '8px',
                    border: '1px solid #d1fae5',
                    marginBottom: '30px',
                    lineHeight: '1.6'
                  }}>
                    {formatResponse(result)}
                  </div>
                )}
                
                <div className="button-container" style={{ 
                  display: 'flex',
                  justifyContent: 'center',
                  gap: '15px',
                  marginTop: '20px'
                }}>
                  <a 
                    href={`http://${SERVER_IP}:${API_PORT}/api/download-result`}
                    className="button primary"
                    download
                    style={{
                      backgroundColor: '#047857',
                      color: 'white',
                      padding: '12px 24px',
                      borderRadius: '8px',
                      textDecoration: 'none',
                      fontWeight: 'bold',
                      display: 'inline-flex',
                      alignItems: 'center',
                      transition: 'all 0.3s ease'
                    }}
                  >
                    <span style={{ marginRight: '8px', fontSize: '18px' }}>⬇️</span>
                    下载处理后文档
                  </a>
                  <button
                    className="button secondary"
                    onClick={handleReset}
                    style={{
                      backgroundColor: '#e2e8f0',
                      color: '#475569',
                      border: 'none',
                      padding: '12px 24px',
                      borderRadius: '8px',
                      fontWeight: 'bold',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      transition: 'all 0.3s ease'
                    }}
                  >
                    <span style={{ marginRight: '8px', fontSize: '18px' }}>⟲</span>
                    上传新文档
                  </button>
                </div>
              </div>
            )
          ) : (
            // 聊天问答界面
            <div className="card" style={{ 
              backgroundColor: '#f8fafc', 
              borderRadius: '12px', 
              boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)',
              padding: '30px',
              minHeight: '600px',
              display: 'flex',
              flexDirection: 'column'
            }}>
              <h2 style={{ 
                fontSize: '24px', 
                marginBottom: '20px', 
                color: '#1e40af',
                borderBottom: '2px solid #dbeafe',
                paddingBottom: '12px',
                display: 'flex',
                alignItems: 'center'
              }}>
                <span style={{ marginRight: '10px', fontSize: '24px' }}>💬</span>
                智能聊天助手
              </h2>
              <div className="chat-container" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                <div className="chat-messages" style={{ 
                  flex: 1, 
                  overflowY: 'auto', 
                  marginBottom: '20px',
                  padding: '15px',
                  backgroundColor: '#ffffff',
                  borderRadius: '8px',
                  border: '1px solid #e5e7eb',
                  minHeight: '400px',
                  maxHeight: '500px'
                }}>
                  {chatHistory.length === 0 ? (
                    <div className="welcome-message" style={{
                      textAlign: 'center',
                      padding: '40px 20px',
                      backgroundColor: '#f0f9ff',
                      borderRadius: '8px',
                      marginBottom: '20px'
                    }}>
                      <h3 style={{ 
                        fontSize: '20px', 
                        marginBottom: '15px',
                        color: '#0369a1'
                      }}>👋 欢迎使用公文纠错聊天助手</h3>
                      <p style={{ marginBottom: '15px', color: '#0c4a6e' }}>您可以直接输入问题进行咨询，或者提供文本进行公文纠错。</p>
                      <p style={{ marginBottom: '10px', color: '#0c4a6e', fontWeight: 'bold' }}>例如：</p>
                      <ul style={{ 
                        listStyleType: 'none', 
                        padding: '0',
                        margin: '0 auto',
                        maxWidth: '400px',
                        textAlign: 'left'
                      }}>
                        <li style={{ 
                          padding: '10px 15px', 
                          backgroundColor: '#bae6fd', 
                          borderRadius: '6px', 
                          marginBottom: '10px',
                          color: '#0c4a6e'
                        }}>请对以下内容进行公文纠错：</li>
                        <li style={{ 
                          padding: '10px 15px', 
                          backgroundColor: '#bae6fd', 
                          borderRadius: '6px', 
                          marginBottom: '10px',
                          color: '#0c4a6e'
                        }}>这份文件格式有哪些问题？</li>
                        <li style={{ 
                          padding: '10px 15px', 
                          backgroundColor: '#bae6fd', 
                          borderRadius: '6px',
                          color: '#0c4a6e'
                        }}>如何写好一份会议记录？</li>
                      </ul>
                    </div>
                  ) : (
                    chatHistory.map((msg, index) => (
                      <div 
                        key={index} 
                        className={`chat-message ${msg.role === 'assistant' ? 'assistant-message' : 'user-message'}`}
                        style={{
                          marginBottom: '15px',
                          maxWidth: '80%',
                          alignSelf: msg.role === 'assistant' ? 'flex-start' : 'flex-end',
                          marginLeft: msg.role === 'assistant' ? '0' : 'auto',
                          marginRight: msg.role === 'assistant' ? 'auto' : '0',
                          backgroundColor: msg.role === 'assistant' ? '#f3f4f6' : '#dbeafe',
                          padding: '15px',
                          borderRadius: msg.role === 'assistant' ? '0 12px 12px 12px' : '12px 0 12px 12px',
                          position: 'relative',
                          boxShadow: '0 2px 5px rgba(0,0,0,0.05)'
                        }}
                      >
                        {msg.role === 'assistant' && (
                          <div style={{ 
                            position: 'absolute', 
                            top: '-20px',
                            left: '10px',
                            backgroundColor: '#3b82f6',
                            color: 'white',
                            padding: '2px 10px',
                            borderRadius: '10px',
                            fontSize: '12px',
                            fontWeight: 'bold'
                          }}>
                            助手
                          </div>
                        )}
                        {msg.role === 'user' && (
                          <div style={{ 
                            position: 'absolute', 
                            top: '-20px',
                            right: '10px',
                            backgroundColor: '#6366f1',
                            color: 'white',
                            padding: '2px 10px',
                            borderRadius: '10px',
                            fontSize: '12px',
                            fontWeight: 'bold'
                          }}>
                            用户
                          </div>
                        )}
                        <div className="message-content" style={{ lineHeight: '1.5' }}>
                          {msg.isFeedbackProcessing ? (
                            <div className="feedback-processing">
                              <div className="spinner"></div>
                              <span>{msg.content}</span>
                            </div>
                          ) : (
                            formatResponse(msg.content)
                          )}
                        </div>
                      </div>
                    ))
                  )}
                  {isChatLoading && (
                    <div className="chat-message assistant-message" style={{
                      backgroundColor: '#f3f4f6',
                      padding: '15px',
                      borderRadius: '0 12px 12px 12px',
                      marginBottom: '15px',
                      maxWidth: '60%'
                    }}>
                      <div className="feedback-processing">
                        <div className="spinner"></div>
                        <span>正在处理您的请求...</span>
                      </div>
                    </div>
                  )}
                </div>
                <div className="chat-actions">
                  {findLastCorrectionText(chatHistory) && (
                    <div className="special-actions" style={{
                      marginBottom: '15px',
                      display: 'flex',
                      justifyContent: 'flex-end'
                    }}>
                      <button 
                        className="button secondary small"
                        onClick={handleSendMessage}
                        disabled={isChatLoading}
                        style={{
                          backgroundColor: '#3b82f6',
                          color: 'white',
                          border: 'none',
                          padding: '8px 16px',
                          borderRadius: '6px',
                          fontSize: '14px',
                          cursor: 'pointer',
                          opacity: isChatLoading ? 0.7 : 1
                        }}
                      >
                        发送消息
                      </button>
                    </div>
                  )}
                </div>
                <div className="chat-input" style={{
                  display: 'flex',
                  gap: '10px',
                  backgroundColor: '#ffffff',
                  padding: '15px',
                  borderRadius: '8px',
                  border: '1px solid #e5e7eb'
                }}>
                  <input
                    type="text"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="输入您的问题..."
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSendMessage();
                      }
                    }}
                    disabled={isChatLoading}
                    style={{
                      flex: 1,
                      padding: '12px 15px',
                      borderRadius: '6px',
                      border: '1px solid #d1d5db',
                      fontSize: '16px',
                      outline: 'none',
                      transition: 'border-color 0.3s'
                    }}
                    className="chat-input-field"
                  />
                  <button
                    className="button primary"
                    onClick={handleSendMessage}
                    disabled={isChatLoading || !message.trim()}
                    style={{
                      backgroundColor: '#3b82f6',
                      color: 'white',
                      border: 'none',
                      padding: '0 20px',
                      borderRadius: '6px',
                      fontSize: '16px',
                      cursor: 'pointer',
                      fontWeight: 'bold',
                      opacity: isChatLoading || !message.trim() ? 0.7 : 1,
                      transition: 'all 0.3s ease'
                    }}
                  >
                    发送
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
      <style jsx>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        @keyframes pulse {
          0%, 100% { opacity: 0.5; transform: scale(0.8); }
          50% { opacity: 1; transform: scale(1.2); }
        }
        .chat-input-field:focus {
          border-color: #3b82f6 !important;
          box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.2);
        }
      `}</style>
    </div>
  );
}
