"use client";

import React from 'react';
import MCPClient from '../MCPClient';
import styles from '../../page.module.css';

export default function MCPServicePage() {
  return (
    <div className={styles.main}>
      <div className={styles.header}>
        <h1>MCP Service Integration</h1>
        <p>This page demonstrates the MCP service integration with CSC service</p>
      </div>
      
      <MCPClient />
      
      <div className={styles.footer}>
        <p>MCP Service API Protocol Version: 1.0</p>
      </div>
    </div>
  );
} 