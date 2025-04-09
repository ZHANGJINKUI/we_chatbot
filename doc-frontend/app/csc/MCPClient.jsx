"use client";

import React, { useState, useEffect } from 'react';
import styles from '../page.module.css';

export default function MCPClient() {
  const [text, setText] = useState('');
  const [result, setResult] = useState('');
  const [status, setStatus] = useState('idle'); // idle, loading, success, error
  const [serviceInfo, setServiceInfo] = useState(null);
  const [error, setError] = useState(null);
  
  // 获取MCP服务信息
  useEffect(() => {
    fetchServiceInfo();
  }, []);
  
  const fetchServiceInfo = async () => {
    try {
      const response = await fetch('http://localhost:8003/api/mcp/info');
      const data = await response.json();
      
      if (data.status === 'success') {
        setServiceInfo(data);
      } else {
        setError(data.message || 'Failed to fetch service info');
      }
    } catch (err) {
      setError(err.message || 'Error connecting to MCP service');
    }
  };
  
  const handleCorrection = async () => {
    if (!text.trim()) {
      setError('Please enter some text for correction');
      return;
    }
    
    setStatus('loading');
    setError(null);
    
    try {
      const response = await fetch('http://localhost:8003/api/mcp/correction', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ text }),
      });
      
      const data = await response.json();
      
      if (data.status === 'success') {
        setResult(data.corrected);
        setStatus('success');
      } else {
        setError(data.message || 'Correction failed');
        setStatus('error');
      }
    } catch (err) {
      setError(err.message || 'Error processing request');
      setStatus('error');
    }
  };
  
  const handleInvokeTool = async (toolName) => {
    setStatus('loading');
    setError(null);
    
    try {
      const response = await fetch('http://localhost:8003/api/mcp/invoke', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          tool: toolName,
          params: { text }
        }),
      });
      
      const data = await response.json();
      
      if (data.status === 'success') {
        setResult(data.result);
        setStatus('success');
      } else {
        setError(data.message || 'Tool invocation failed');
        setStatus('error');
      }
    } catch (err) {
      setError(err.message || 'Error processing request');
      setStatus('error');
    }
  };
  
  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <h1 className={styles.title}>MCP Client - CSC Service</h1>
        
        {serviceInfo ? (
          <div className={styles.serviceInfo}>
            <h3>Service Information</h3>
            <p>Status: {serviceInfo.status}</p>
            <p>Available Tools:</p>
            <ul>
              {serviceInfo.tools && serviceInfo.tools.map((tool, index) => (
                <li key={index}>
                  <strong>{tool.name}</strong>: {tool.description}
                  <button 
                    onClick={() => handleInvokeTool(tool.name)}
                    disabled={status === 'loading' || !text.trim()}
                    className={styles.smallButton}
                  >
                    Invoke
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : error ? (
          <div className={styles.error}>Error: {error}</div>
        ) : (
          <div>Loading service information...</div>
        )}
        
        <div className={styles.inputGroup}>
          <label htmlFor="text" className={styles.label}>Enter text for correction:</label>
          <textarea
            id="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            className={styles.textarea}
            rows={6}
            placeholder="Enter text to correct..."
            disabled={status === 'loading'}
          />
        </div>
        
        <div className={styles.buttonGroup}>
          <button
            onClick={handleCorrection}
            disabled={status === 'loading' || !text.trim()}
            className={styles.button}
          >
            {status === 'loading' ? 'Processing...' : 'Correct Text'}
          </button>
        </div>
        
        {error && (
          <div className={styles.error}>
            <p>Error: {error}</p>
          </div>
        )}
        
        {result && (
          <div className={styles.resultContainer}>
            <h3>Correction Result:</h3>
            <div className={styles.result}>
              {result}
            </div>
          </div>
        )}
      </div>
    </div>
  );
} 