'use client';

import { useState } from 'react';
import axios from 'axios';
// 使用全局CSS替代模块CSS
import './styles.css';

// 使用服务器IP替代localhost
const SERVER_IP = '10.102.59.4';
// 更新API端口
const API_PORT = 8003;

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
  const [chatHistory, setChatHistory] = useState<Array<{role: string, content: string}>>([]);
  const [isChatLoading, setIsChatLoading] = useState(false);
  
  // 多版本纠错相关状态
  const [showMultipleVersions, setShowMultipleVersions] = useState(false);
  const [correctionVersions, setCorrectionVersions] = useState<string[]>([]);
  const [originalTextToCorrect, setOriginalTextToCorrect] = useState<string>('');
  
  // 渐进式纠错相关状态
  const [showProgressiveCorrection, setShowProgressiveCorrection] = useState(false);
  const [progressiveStep, setProgressiveStep] = useState<string>("format");
  const [progressiveText, setProgressiveText] = useState<string>('');
  const [progressiveExplanation, setProgressiveExplanation] = useState<string>('');
  const [progressiveHistory, setProgressiveHistory] = useState<Array<{step: string, text: string, explanation: string}>>([]);
  const [isProgressiveLoading, setIsProgressiveLoading] = useState(false);

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

  // 处理特殊标记的函数
  const formatResponse = (response: string) => {
    if (typeof response !== 'string') {
      return response;
    }
    
    if (response.includes('[公文纠错专用模式-文档处理]')) {
      return (
        <div>
          <div className="special-mode-tag doc">
            <span className="icon">🔍</span>
            文档纠错专用模式已启用
            <div className="feedback-buttons">
              <button className="feedback-btn positive" onClick={() => handleFeedback(true, response)}>
                👍 满意
              </button>
              <button className="feedback-btn negative" onClick={() => handleFeedback(false, response)}>
                👎 不满意
              </button>
            </div>
          </div>
          {response.replace('[公文纠错专用模式-文档处理]', '')}
        </div>
      );
    } else if (response.includes('[公文纠错专用模式-聊天纠错]')) {
      return (
        <div>
          <div className="special-mode-tag chat">
            <span className="icon">💬</span>
            聊天纠错专用模式已启用
            <div className="feedback-buttons">
              <button className="feedback-btn positive" onClick={() => handleFeedback(true, response)}>
                👍 满意
              </button>
              <button className="feedback-btn negative" onClick={() => handleFeedback(false, response)}>
                👎 不满意
              </button>
            </div>
          </div>
          {response.replace('[公文纠错专用模式-聊天纠错]', '')}
        </div>
      );
    } else {
      // 确保不包含任何部分匹配的标记文本
      if (response.includes('公文纠错') || response.includes('专用模式')) {
        console.warn('发现可能的部分标记匹配:', response.substring(0, 50));
      }
      return response;
    }
  };

  // 处理反馈
  const handleFeedback = (isPositive: boolean, correctionResult: string) => {
    if (isPositive) {
      // 处理满意反馈
      alert('感谢您的反馈！');
    } else {
      // 处理不满意反馈，提示重新纠错
      const originalText = findLastCorrectionText();
      
      if (originalText) {
        // 设置消息为要求改进的纠错请求
        setMessage(`这个纠错结果不满意，请重新纠错并改进：${originalText}`);
        // 聚焦到输入框
        const inputElement = document.querySelector('.chat-input input') as HTMLInputElement;
        if (inputElement) {
          inputElement.focus();
        }
      } else {
        setMessage('请重新纠错并提供更好的结果');
      }
    }
  };

  // 查找最近一次用于纠错的文本
  const findLastCorrectionText = (): string | null => {
    // 从聊天历史中查找最近一次用户请求纠错的消息
    for (let i = chatHistory.length - 1; i >= 0; i--) {
      const msg = chatHistory[i];
      if (msg.role === 'user' && 
         (msg.content.includes('纠错') || 
          msg.content.includes('修正') || 
          msg.content.includes('修改'))) {
        // 从用户消息中提取原始文本
        return msg.content.replace(/请对|请将|进行公文纠错|纠错|修正|修改/g, '').trim();
      }
    }
    return null;
  };

  // 处理纠错的多个版本请求
  const handleRequestMultipleVersions = async () => {
    const textToCorrect = findLastCorrectionText();
    
    if (!textToCorrect) {
      alert('无法找到需要纠错的文本');
      return;
    }
    
    setOriginalTextToCorrect(textToCorrect);
    setIsChatLoading(true);
    
    // 生成三个不同风格的纠错版本
    try {
      // 版本1: 标准公文格式修正
      const response1 = await axios.post(`http://${SERVER_IP}:${API_PORT}/api/chat`, {
        message: `请以标准政府公文格式纠错：${textToCorrect}`,
        chat_history: []
      });
      
      // 版本2: 简明清晰的纠错
      const response2 = await axios.post(`http://${SERVER_IP}:${API_PORT}/api/chat`, {
        message: `请进行简明扼要的公文纠错，突出重点：${textToCorrect}`,
        chat_history: []
      });
      
      // 版本3: 详细解释的纠错
      const response3 = await axios.post(`http://${SERVER_IP}:${API_PORT}/api/chat`, {
        message: `请进行详细的公文纠错，并附带解释说明：${textToCorrect}`,
        chat_history: []
      });
      
      // 保存所有版本
      setCorrectionVersions([
        response1.data.response,
        response2.data.response,
        response3.data.response
      ]);
      
      // 显示多版本选择界面
      setShowMultipleVersions(true);
    } catch (error) {
      console.error('生成多版本纠错失败:', error);
      alert('生成多版本纠错失败，请重试');
    } finally {
      setIsChatLoading(false);
    }
  };
  
  // 选择特定版本的纠错结果
  const handleSelectCorrectionVersion = (version: string) => {
    // 将选择的版本添加到聊天历史
    const updatedHistory = [
      ...chatHistory,
      { role: 'user', content: `请对以下内容进行公文纠错：${originalTextToCorrect}` },
      { role: 'assistant', content: version }
    ];
    
    setChatHistory(updatedHistory);
    setShowMultipleVersions(false);
  };

  // 开始渐进式纠错流程
  const handleStartProgressiveCorrection = () => {
    const textToCorrect = findLastCorrectionText();
    
    if (!textToCorrect) {
      alert('无法找到需要纠错的文本');
      return;
    }
    
    // 初始化渐进式纠错流程
    setOriginalTextToCorrect(textToCorrect);
    setProgressiveText(textToCorrect);
    setProgressiveStep("format");
    setProgressiveHistory([]);
    setShowProgressiveCorrection(true);
  };
  
  // 处理渐进式纠错的下一步
  const handleProgressiveNextStep = async () => {
    if (!progressiveText) return;
    
    setIsProgressiveLoading(true);
    
    try {
      const response = await axios.post(`http://${SERVER_IP}:${API_PORT}/api/progressive-correction`, {
        text: progressiveText,
        step: progressiveStep
      });
      
      const { corrected_text, explanation, next_step } = response.data;
      
      // 保存当前步骤的结果到历史
      setProgressiveHistory([
        ...progressiveHistory,
        {
          step: progressiveStep,
          text: corrected_text,
          explanation: explanation
        }
      ]);
      
      // 如果有下一步，更新状态进入下一步
      if (next_step) {
        setProgressiveStep(next_step);
        setProgressiveText(corrected_text);
        setProgressiveExplanation(explanation);
      } else {
        // 如果没有下一步，完成渐进式纠错
        finishProgressiveCorrection(corrected_text);
      }
    } catch (error) {
      console.error('渐进式纠错过程出错:', error);
      alert('渐进式纠错过程出错，请重试');
    } finally {
      setIsProgressiveLoading(false);
    }
  };
  
  // 完成渐进式纠错流程
  const finishProgressiveCorrection = (finalText: string) => {
    // 将最终结果添加到聊天历史
    const updatedHistory = [
      ...chatHistory,
      { role: 'user', content: `请对以下内容进行公文纠错：${originalTextToCorrect}` },
      { role: 'assistant', content: `[公文纠错专用模式-渐进式]\n\n通过格式、语法和表达多步骤纠错，最终结果如下：\n\n${finalText}` }
    ];
    
    setChatHistory(updatedHistory);
    setShowProgressiveCorrection(false);
  };
  
  // 回退到渐进式纠错的上一步
  const handleProgressiveStepBack = () => {
    if (progressiveHistory.length > 0) {
      // 获取上一步的状态
      const previousStep = progressiveHistory[progressiveHistory.length - 1];
      
      // 回到上一步
      setProgressiveStep(previousStep.step);
      setProgressiveText(previousStep.text);
      setProgressiveExplanation(previousStep.explanation);
      
      // 从历史中移除上一步
      setProgressiveHistory(progressiveHistory.slice(0, -1));
    } else {
      // 如果没有历史，返回到初始状态
      setProgressiveText(originalTextToCorrect);
      setProgressiveStep("format");
    }
  };

  return (
    <main className="main">
      <div className="container">
        <div className="header">
          <h1>文档处理与智能问答系统</h1>
          <div className="tabs">
            <button
              className={!showChat ? "active" : ""}
              onClick={() => setShowChat(false)}
            >
              文档处理
            </button>
            <button
              className={showChat ? "active" : ""}
              onClick={() => setShowChat(true)}
            >
              聊天问答
            </button>
          </div>
        </div>

        {!showChat ? (
          // 文档处理界面
          !result ? (
            <div className="card">
              <div 
                className="upload-area"
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                    handleFileSelect(e.dataTransfer.files[0]);
                  }
                }}
              >
                <div className="upload-icon">📄</div>
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
                  className="button"
                  onClick={() => document.getElementById('fileInput')?.click()}
                  disabled={isLoading}
                >
                  选择文件
                </button>
              </div>
              
              {file && (
                <div className="file-info">
                  已选择: {file.name} ({formatFileSize(file.size)})
                </div>
              )}
              
              {error && <div className="error">{error}</div>}
              
              <div className="button-container">
                <button
                  className="button primary"
                  onClick={handleProcessFile}
                  disabled={!file || isLoading}
                >
                  {isLoading ? '处理中...' : '处理文档'}
                </button>
              </div>
              
              {isLoading && (
                <div className="loader">
                  <div className="spinner"></div>
                  <p>正在处理文档，请稍候...</p>
                </div>
              )}
            </div>
          ) : (
            <div className="card">
              <h2>处理结果</h2>
              <div className="result-tabs">
                <button 
                  className={showComparison ? "active" : ""}
                  onClick={() => setShowComparison(true)}
                >
                  对比视图
                </button>
                <button 
                  className={!showComparison ? "active" : ""}
                  onClick={() => setShowComparison(false)}
                >
                  仅结果
                </button>
              </div>
              
              {showComparison && originalContent ? (
                <div className="comparison-view">
                  <div className="comparison-container">
                    <div className="original-content">
                      <h3>原始文档</h3>
                      <div className="content-box">
                        {originalContent}
                      </div>
                    </div>
                    <div className="corrected-content">
                      <h3>纠错后文档</h3>
                      <div className="content-box">
                        {formatResponse(result)}
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="result-content">
                  {formatResponse(result)}
                </div>
              )}
              
              <div className="button-container">
                <a 
                  href={`http://${SERVER_IP}:${API_PORT}/api/download-result`}
                  className="button primary"
                  download
                >
                  下载处理后文档
                </a>
                <button
                  className="button secondary"
                  onClick={handleReset}
                >
                  上传新文档
                </button>
              </div>
            </div>
          )
        ) : (
          // 聊天问答界面
          <div className="card">
            <div className="chat-container">
              {showMultipleVersions ? (
                // 多版本选择界面
                <div className="versions-container">
                  <h3>请选择您喜欢的纠错版本</h3>
                  <div className="original-text">
                    <h4>原文:</h4>
                    <p>{originalTextToCorrect}</p>
                  </div>
                  <div className="versions-list">
                    {correctionVersions.map((version, index) => (
                      <div key={index} className="version-item">
                        <h4>版本 {index + 1}: {index === 0 ? "标准格式" : index === 1 ? "简明扼要" : "详细解释"}</h4>
                        <div className="version-content">{formatResponse(version)}</div>
                        <button 
                          className="button primary select-version" 
                          onClick={() => handleSelectCorrectionVersion(version)}
                        >
                          选择此版本
                        </button>
                      </div>
                    ))}
                  </div>
                  <button 
                    className="button secondary"
                    onClick={() => setShowMultipleVersions(false)}
                  >
                    返回聊天
                  </button>
                </div>
              ) : showProgressiveCorrection ? (
                // 渐进式纠错界面
                <div className="progressive-container">
                  <h3>渐进式公文纠错</h3>
                  <div className="progressive-step">
                    当前步骤：{progressiveStep === "format" ? "格式纠错" : 
                              progressiveStep === "grammar" ? "语法纠错" : 
                              progressiveStep === "expression" ? "表达优化" : "完成"}
                  </div>
                  
                  <div className="progressive-content">
                    <div className="original-text">
                      <h4>当前文本:</h4>
                      <textarea 
                        value={progressiveText} 
                        onChange={(e) => setProgressiveText(e.target.value)}
                        className="progressive-textarea"
                        disabled={isProgressiveLoading}
                      />
                    </div>
                    
                    {progressiveExplanation && (
                      <div className="progressive-explanation">
                        <h4>建议解释:</h4>
                        <div className="explanation-content">
                          {progressiveExplanation}
                        </div>
                      </div>
                    )}
                  </div>
                  
                  <div className="progressive-actions">
                    <button 
                      className="button secondary"
                      onClick={handleProgressiveStepBack}
                      disabled={isProgressiveLoading || progressiveHistory.length === 0}
                    >
                      回退上一步
                    </button>
                    
                    <button 
                      className="button primary"
                      onClick={handleProgressiveNextStep}
                      disabled={isProgressiveLoading}
                    >
                      {isProgressiveLoading ? "处理中..." : "继续下一步"}
                    </button>
                    
                    <button 
                      className="button secondary"
                      onClick={() => setShowProgressiveCorrection(false)}
                      disabled={isProgressiveLoading}
                    >
                      取消
                    </button>
                  </div>
                  
                  {progressiveHistory.length > 0 && (
                    <div className="progressive-history">
                      <h4>纠错历史:</h4>
                      <div className="history-steps">
                        {progressiveHistory.map((step, index) => (
                          <div key={index} className="history-step">
                            <div className="step-name">
                              步骤 {index + 1}: {step.step === "format" ? "格式纠错" : 
                                               step.step === "grammar" ? "语法纠错" : 
                                               step.step === "expression" ? "表达优化" : step.step}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                // 正常聊天界面
                <>
                  <div className="chat-messages">
                    {chatHistory.length === 0 ? (
                      <div className="chat-welcome">
                        <p>欢迎使用智能助手，请输入您的问题</p>
                      </div>
                    ) : (
                      chatHistory.map((msg, index) => (
                        <div 
                          key={index} 
                          className={`chat-message ${msg.role === 'user' ? 'user-message' : 'assistant-message'}`}
                        >
                          <div className="message-content">{formatResponse(msg.content)}</div>
                        </div>
                      ))
                    )}
                    {isChatLoading && (
                      <div className="chat-message assistant-message">
                        <div className="typing-indicator">
                          <span></span>
                          <span></span>
                          <span></span>
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="chat-actions">
                    {findLastCorrectionText() && (
                      <div className="special-actions">
                        <button 
                          className="button secondary small"
                          onClick={handleRequestMultipleVersions}
                          disabled={isChatLoading}
                        >
                          获取多版本纠错
                        </button>
                        
                        <button 
                          className="button secondary small"
                          onClick={handleStartProgressiveCorrection}
                          disabled={isChatLoading}
                        >
                          渐进式纠错
                        </button>
                      </div>
                    )}
                  </div>
                  <div className="chat-input">
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
                    />
                    <button
                      className="button primary"
                      onClick={handleSendMessage}
                      disabled={isChatLoading || !message.trim()}
                    >
                      发送
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
    </div>
    </main>
  );
}
