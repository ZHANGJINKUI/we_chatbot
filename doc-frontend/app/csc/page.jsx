'use client';

import React from 'react';
import CorrectionTool from '../../src/components/CorrectionTool';

const CSCPage = () => {
  return (
    <div className="container" style={{maxWidth: '1200px', margin: '0 auto', padding: '40px 20px'}}>
      <div className="header" style={{textAlign: 'center', marginBottom: '24px'}}>
        <h1 style={{fontSize: '2rem', marginBottom: '8px'}}>
          中文拼写纠错
        </h1>
        <p style={{color: '#666', marginBottom: '24px'}}>
          基于MCP（最小字符扰动）规则的拼写纠错技术，确保修正文本使用最小的字符变动
        </p>
      </div>
      
      <CorrectionTool />
      
      <div style={{
        marginTop: '32px', 
        padding: '20px', 
        backgroundColor: '#f0f7ff', 
        borderRadius: '8px'
      }}>
        <h3 style={{fontSize: '1.2rem', marginBottom: '12px'}}>
          关于MCP（最小字符扰动）
        </h3>
        <p>
          MCP（Minimal Character Perturbation）是一种优化拼写纠错的方法，遵循"最小干预原则"，即在纠正文本错误时，
          尽可能使用最少的字符变动来达到纠错目的。该技术特别适用于中文文本纠错，能有效处理形近字、音近字等常见错误，
          同时保持原文的语义和风格。
        </p>
        <p style={{marginTop: '8px'}}>
          我们的系统集成了基于Qwen系列大语言模型的MCP实现，通过精细调整的变换类型权重和扭曲概率，
          实现高质量、低干扰的中文拼写纠错。
        </p>
      </div>
    </div>
  );
};

export default CSCPage; 