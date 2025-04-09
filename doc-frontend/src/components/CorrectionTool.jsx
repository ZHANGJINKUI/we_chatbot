import React, { useState } from 'react';
import axios from 'axios';

const buttonStyle = {
  padding: '10px 16px',
  fontSize: '1rem',
  borderRadius: '4px',
  cursor: 'pointer',
  border: 'none',
  fontWeight: 'bold',
  transition: 'background-color 0.2s',
};

const primaryButtonStyle = {
  ...buttonStyle,
  backgroundColor: '#0070f3',
  color: 'white',
};

const CorrectionTool = () => {
  const [inputText, setInputText] = useState('');
  const [correctedText, setCorrectedText] = useState('');
  const [corrections, setCorrections] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleCorrection = async () => {
    if (!inputText.trim()) {
      setError('请输入文本');
      return;
    }

    setIsLoading(true);
    setError('');
    
    try {
      const response = await axios.post('/api/csc/correct', {
        text: inputText
      });

      setCorrectedText(response.data.corrected_text);
      setCorrections(response.data.corrections);

      if (response.data.corrections.length === 0) {
        setError('未检测到需要纠正的错误');
      }
    } catch (error) {
      console.error('纠错失败:', error);
      setError(error.response?.data?.detail || '服务器错误');
    } finally {
      setIsLoading(false);
    }
  };

  const highlightText = () => {
    if (!correctedText || corrections.length === 0) return correctedText;
    
    // 创建一个差异高亮的版本
    let result = [];
    let lastPos = 0;
    
    for (const correction of corrections) {
      // 添加未修改的部分
      if (correction.position > lastPos) {
        result.push(
          <span key={`text-${lastPos}`}>
            {correctedText.substring(lastPos, correction.position)}
          </span>
        );
      }
      
      // 添加修改的部分
      result.push(
        <span 
          key={`corr-${correction.position}`}
          style={{
            backgroundColor: '#e6ffed',
            color: '#22863a',
            fontWeight: 'bold',
            padding: '0 1px',
            borderRadius: '2px'
          }}
          title={`原文: ${correction.original || '(无)'}`}
        >
          {correction.corrected || ''}
        </span>
      );
      
      lastPos = correction.position + 1;
    }
    
    // 添加剩余的部分
    if (lastPos < correctedText.length) {
      result.push(
        <span key={`text-end`}>
          {correctedText.substring(lastPos)}
        </span>
      );
    }
    
    return result;
  };

  return (
    <div style={{
      padding: '20px', 
      boxShadow: '0 1px 3px rgba(0,0,0,0.12)', 
      border: '1px solid #e0e0e0', 
      borderRadius: '8px',
      backgroundColor: 'white'
    }}>
      <div style={{display: 'flex', flexDirection: 'column', gap: '16px'}}>
        <h2 style={{fontSize: '1.4rem', margin: '0 0 8px 0'}}>MCP 拼写纠错工具</h2>
        <p style={{fontSize: '0.9rem', color: '#666', margin: 0}}>
          基于Qwen的中文MCP（最小字符扰动）拼写纠错技术
        </p>
        
        <hr style={{width: '100%', border: '0', borderTop: '1px solid #eaeaea', margin: '8px 0'}} />
        
        <label style={{fontWeight: '500'}}>输入文本:</label>
        <textarea
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder="请输入需要纠错的中文文本..."
          style={{
            width: '100%',
            minHeight: '150px',
            padding: '12px',
            boxSizing: 'border-box',
            borderRadius: '4px',
            border: '1px solid #d0d0d0',
            resize: 'vertical',
            fontFamily: 'inherit',
            fontSize: '1rem'
          }}
        />
        
        <button 
          style={{
            ...primaryButtonStyle,
            width: '100%',
            opacity: isLoading ? 0.7 : 1
          }}
          onClick={handleCorrection} 
          disabled={isLoading}
        >
          {isLoading ? '正在纠错...' : '开始纠错'}
        </button>
        
        {error && (
          <div style={{
            padding: '10px', 
            color: '#a94442', 
            backgroundColor: '#f2dede', 
            borderRadius: '4px',
            border: '1px solid #ebccd1'
          }}>
            {error}
          </div>
        )}
        
        {correctedText && (
          <>
            <hr style={{width: '100%', border: '0', borderTop: '1px solid #eaeaea', margin: '8px 0'}} />
            
            <div>
              <div style={{display: 'flex', alignItems: 'center', marginBottom: '8px'}}>
                <label style={{fontWeight: '500', marginRight: '8px'}}>纠错结果:</label>
                {corrections.length > 0 && (
                  <span style={{
                    backgroundColor: '#28a745', 
                    color: 'white', 
                    padding: '2px 8px',
                    borderRadius: '999px',
                    fontSize: '0.8rem',
                    fontWeight: 'bold'
                  }}>
                    已修正 {corrections.length} 处
                  </span>
                )}
              </div>
              
              <div style={{
                padding: '12px', 
                border: '1px solid #d0d0d0', 
                borderRadius: '4px',
                backgroundColor: '#f9f9f9',
                minHeight: '100px',
                fontSize: '1rem',
                lineHeight: '1.5'
              }}>
                {isLoading ? (
                  <div style={{textAlign: 'center', padding: '16px'}}>
                    <div style={{
                      display: 'inline-block',
                      width: '20px',
                      height: '20px',
                      border: '2px solid #ccc',
                      borderTopColor: '#0070f3',
                      borderRadius: '50%',
                      animation: 'spin 1s linear infinite',
                      marginBottom: '8px'
                    }}></div>
                    <p>正在分析并纠正文本...</p>
                    <style jsx>{`
                      @keyframes spin {
                        to { transform: rotate(360deg); }
                      }
                    `}</style>
                  </div>
                ) : (
                  highlightText()
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default CorrectionTool; 