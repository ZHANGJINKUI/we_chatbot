import axios from 'axios'
import { useFileStore } from '@/stores/file' // 导入文件存储

interface ChatMessage {
  role: string;
  id?: string;
  createAt?: number;
  content: string;
  status?: string;
}

interface DocumentInfo {
  document_id: string;
  content: string;
  original_content?: string;
}

/**
 * WeChatbot服务类 - 处理与后端API交互
 */
export class WeChatbotService {
  /**
   * 请求处理文档，但不自动获取预览
   * @param fileId 文件ID
   * @param forceReprocess 是否强制重新处理
   * @returns 文档处理是否成功
   */
  async requestDocumentPreview(fileId: string, forceReprocess = false): Promise<boolean> {
    const startTime = new Date().toISOString();
    console.log(`[${startTime}] WeChatbotService.requestDocumentPreview 开始, fileId=${fileId}, forceReprocess=${forceReprocess}`);
    
    // 验证参数
    if (!fileId) {
      console.error(`[${startTime}] 请求文档处理失败: 文件ID不能为空`);
      return false;
    }
    
    // 获取聊天ID
    const chatId = localStorage.getItem('chat_id') || '';
    if (!chatId) {
      console.error(`[${startTime}] 请求文档处理失败: 聊天ID不能为空`);
      return false;
    }
    
    // 检查文档处理状态
    const isDocumentProcessed = localStorage.getItem('document_processed') === 'true';
    const lastProcessedFileId = localStorage.getItem('last_processed_file_id');
    const needReprocess = forceReprocess || !isDocumentProcessed || lastProcessedFileId !== fileId;
    
    // 如果需要重新处理
    if (needReprocess) {
      console.log(`[${startTime}] 需要重新处理文档`);
      
      try {
        // 调用correction API处理文档
        const correctionResponse = await axios.post('/api/mcp/correction', {
          document_id: fileId,
          chat_id: chatId
        });
        
        console.log(`[${startTime}] correction API响应:`, correctionResponse.data);
        
        if (correctionResponse.data.success) {
          // 更新localStorage状态
          localStorage.setItem('document_processed', 'true');
          localStorage.setItem('last_processed_file_id', fileId);
          localStorage.setItem('document_processed_timestamp', Date.now().toString());
          
          // 触发处理完成事件，但不获取预览
          const event = new CustomEvent('documentProcessed', {
            detail: {
              fileId,
              chatId,
              timestamp: Date.now()
            }
          });
          document.dispatchEvent(event);
          
          return true;
        } else {
          console.warn(`[${startTime}] 文档处理请求失败:`, correctionResponse.data);
          return false;
        }
      } catch (error) {
        console.error(`[${startTime}] 文档处理请求出错:`, error);
        return false;
      }
    } else {
      console.log(`[${startTime}] 文档已处理，无需再次处理`);
      return true;
    }
  }
  
  /**
   * 显式获取文档预览 - 仅在用户请求预览时调用
   * @param fileId 文件ID
   * @param chatId 聊天ID
   * @returns 预览是否获取成功
   */
  async getDocumentPreview(fileId: string, chatId: string): Promise<boolean> {
    const startTime = new Date().toISOString();
    console.log(`[${startTime}] WeChatbotService.getDocumentPreview 开始, fileId=${fileId}, chatId=${chatId}`);
    
    if (!fileId || !chatId) {
      console.error(`[${startTime}] 获取预览失败: 参数不完整, fileId=${fileId}, chatId=${chatId}`);
      return false;
    }
    
    // 尝试获取修改后的文档预览
    let blobData: Blob | null = null;
    let success = false;
    let attemptCount = 0;
    const maxAttempts = 3;
    
    // 首先从MCP API获取处理后的文本内容
    try {
      console.log(`[${startTime}] 先尝试从MCP API获取处理后的文本内容`);
      const mcpResponse = await axios.get(`/api/mcp/get-processed-content?file_id=${fileId}&chat_id=${chatId}`);
      
      if (mcpResponse.data && mcpResponse.data.content) {
        console.log(`[${startTime}] 成功从MCP API获取处理后的文本内容，长度: ${mcpResponse.data.content.length}`);
        
        // 尝试将文本转换为DOCX
        try {
          console.log(`[${startTime}] 尝试转换内容为DOCX格式`);
          const convertedBlob = await this.convertTextToDocx(
            mcpResponse.data.content,
            `processed_document_${fileId}.docx`
          );
          
          if (convertedBlob && convertedBlob.size > 0) {
            console.log(`[${startTime}] 成功转换为DOCX，大小: ${convertedBlob.size}`);
            blobData = convertedBlob;
            success = true;
            
            // 直接触发更新事件
            const event = new CustomEvent('modifiedDocumentUpdated', {
              detail: {
                blob: blobData,
                fileId,
                chatId
              }
            });
            document.dispatchEvent(event);
            return true;
          }
        } catch (convertError) {
          console.error(`[${startTime}] 转换DOCX失败:`, convertError);
          // 转换失败时，使用文本Blob作为备选
          const textBlob = new Blob([mcpResponse.data.content], { type: 'text/plain' });
          console.log(`[${startTime}] 使用文本格式, 大小: ${textBlob.size}`);
          blobData = textBlob;
          success = true;
          
          // 直接触发更新事件
          const event = new CustomEvent('modifiedDocumentUpdated', {
            detail: {
              blob: blobData,
              fileId,
              chatId
            }
          });
          document.dispatchEvent(event);
          return true;
        }
      }
    } catch (mcpError) {
      console.log(`[${startTime}] 从MCP API获取内容失败, 将尝试GET方式:`, mcpError);
    }
    
    // 尝试使用GET请求
    while (attemptCount < maxAttempts && !success) {
      attemptCount++;
      console.log(`[${startTime}] 尝试使用GET请求获取修改后文档预览 (尝试 ${attemptCount}/${maxAttempts})`);
      try {
        const timestamp = Date.now();
        const url = `/api/preview-modified?file_id=${fileId}&chat_id=${chatId}&t=${timestamp}`;
        console.log(`[${startTime}] 请求URL: ${url}`);
        
        const response = await axios.get(url, {
          responseType: 'blob',
          validateStatus: (status) => {
            // 记录所有状态码
            console.log(`[${startTime}] GET请求返回状态码: ${status}`);
            return true; // 返回true让axios不抛出异常，我们自己处理
          }
        });
        
        if (response.status === 200) {
          console.log(`[${startTime}] GET请求状态码200`);
          if (response.data instanceof Blob && response.data.size > 0) {
            blobData = response.data;
            success = true;
            console.log(`[${startTime}] 成功获取修改后文档预览, size=${blobData.size}, type=${blobData.type}`);
          } else {
            console.warn(`[${startTime}] GET请求返回数据无效: 不是Blob或大小为0`);
          }
        } else if (response.status === 404) {
          console.warn(`[${startTime}] GET请求返回404，文档可能未处理或路径错误`);
          // 404错误，尝试使用POST请求
          break;
        } else {
          console.warn(`[${startTime}] GET请求返回异常状态码: ${response.status}`);
        }
      } catch (error: any) {
        console.error(`[${startTime}] GET请求异常:`, error);
        if (error.response) {
          console.log(`[${startTime}] 响应状态: ${error.response.status}`);
          console.log(`[${startTime}] 响应头:`, error.response.headers);
        }
      }
      
      if (!success && attemptCount < maxAttempts) {
        const waitTime = 2000 * attemptCount;
        console.log(`[${startTime}] 等待 ${waitTime}ms 后进行第 ${attemptCount + 1} 次尝试`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
    }
    
    // 如果GET失败，尝试POST请求
    if (!success) {
      console.log(`[${startTime}] GET请求失败，尝试使用POST请求`);
      try {
        const postResponse = await axios.post('/api/preview-modified', {
          file_id: fileId,
          chat_id: chatId,
          timestamp: Date.now()
        }, {
          responseType: 'blob'
        });
        
        if (postResponse.status === 200 && postResponse.data instanceof Blob && postResponse.data.size > 0) {
          blobData = postResponse.data;
          success = true;
          console.log(`[${startTime}] 成功使用POST请求获取修改后文档预览, size=${blobData.size}, type=${blobData.type}`);
        } else {
          console.warn(`[${startTime}] POST请求返回无效数据:`, postResponse.status);
        }
      } catch (postError) {
        console.error(`[${startTime}] POST请求失败:`, postError);
      }
    }
    
    // 如果获取到Blob数据，触发更新事件
    if (blobData) {
      console.log(`[${startTime}] 触发文档更新事件`);
      const event = new CustomEvent('modifiedDocumentUpdated', {
        detail: {
          blob: blobData,
          fileId,
          chatId
        }
      });
      document.dispatchEvent(event);
      return true;
    } else {
      // 尝试调用correction API然后再获取预览
      console.log(`[${startTime}] 预览获取失败，尝试重新处理文档`);
      
      try {
        const correctionResponse = await axios.post('/api/mcp/correction', {
          document_id: fileId,
          chat_id: chatId,
          timestamp: Date.now()
        });
        
        if (correctionResponse.data.success) {
          console.log(`[${startTime}] 重新处理文档成功，2秒后尝试获取预览`);
          
          // 等待处理完成
          await new Promise(resolve => setTimeout(resolve, 2000));
          
          // 再次尝试获取预览
          return await this.getDocumentPreview(fileId, chatId);
        } else {
          console.log(`[${startTime}] 重新处理文档失败`);
          return false;
        }
      } catch (error) {
        console.error(`[${startTime}] 重新处理文档错误:`, error);
        return false;
      }
    }
  }

  /**
   * 上传文档
   * @param file 文件对象
   * @returns 文档信息
   */
  async uploadDocument(file: File): Promise<DocumentInfo> {
    const formData = new FormData()
    formData.append('file', file)
    const response = await axios.post('/api/upload-document', formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    })
    return response.data
  }

  /**
   * 发送聊天消息（支持文档处理）
   * @param message 消息内容
   * @param documentContent 文档内容
   * @param chatHistory 聊天历史
   * @returns 聊天响应
   */
  async sendChatMessage(message: string, documentContent: string | null = null, chatHistory: ChatMessage[] = []) {
    // 将聊天历史转换为API需要的格式
    const formattedHistory = this.formatMessagesForAPI(chatHistory)
    
    const response = await axios.post('/api/chat', {
      message,
      document_content: documentContent,
      chat_history: formattedHistory
    })
    return response.data
  }

  /**
   * 用于处理流式聊天响应
   * @param message 消息内容
   * @param documentContent 文档内容
   * @param chatHistory 聊天历史
   * @param onUpdate 内容更新回调
   * @param onComplete 完成回调
   * @returns 清理函数
   */
  async streamChatResponse(
    message: string, 
    documentContent: string | null = null, 
    chatHistory: ChatMessage[] = [], 
    onUpdate: (content: string) => void, 
    onComplete: () => void
  ) {
    try {
      // 准备聊天历史
      const formattedHistory = this.formatMessagesForAPI(chatHistory)
      
      // 创建查询参数对象
      const queryParams = new URLSearchParams({
        message,
        chat_history: JSON.stringify(formattedHistory)
      });
      
      // 如果有文档内容，添加到参数
      if (documentContent) {
        queryParams.append('document_content', documentContent);
      }
      
      // 检查是否是文档相关请求
      const isDocumentRequest = this.isDocumentRelatedQuery(message);
      
      // 如果是文档相关请求，获取文件ID并添加到请求
      let fileId = '';
      if (isDocumentRequest) {
        try {
          // 从localStorage获取文件存储状态
          const fileStoreStr = localStorage.getItem('pinia-file');
          if (fileStoreStr) {
            const fileStore = JSON.parse(fileStoreStr);
            if (fileStore && fileStore.currentFile && fileStore.currentFile.id) {
              fileId = fileStore.currentFile.id;
              queryParams.append('file_id', fileId);
              console.log('添加文件ID到请求:', fileId);
            }
          }
        } catch (e) {
          console.error('获取文件ID失败:', e);
        }
      }
      
      // 创建EventSource连接
      const eventSourceUrl = `/api/stream-chat?${queryParams.toString()}`;
      console.log('创建EventSource连接:', eventSourceUrl);
      const eventSource = new EventSource(eventSourceUrl);
      
      // 文档处理状态标志
      let documentProcessed = false;
      
      eventSource.onmessage = (event) => {
        let response = event.data;
        if (response === 'end') {
          eventSource.close();
          
          // 如果是文档请求，且文档已处理，则主动触发文档处理事件
          if (isDocumentRequest && documentProcessed && fileId) {
            console.log('聊天结束，主动处理文档');
            
            // 调用处理文档的函数，并自动获取预览
            this.requestDocumentPreview(fileId).then(success => {
              if (success) {
                // 触发获取预览的事件，让FilePage组件知道可以获取预览了
                const previewEvent = new CustomEvent('documentPreviewReady', {
                  detail: {
                    fileId,
                    timestamp: Date.now()
                  }
                });
                document.dispatchEvent(previewEvent);
                
                // 自动尝试获取预览
                this.getDocumentPreview(fileId, localStorage.getItem('chat_id') || '').then(previewSuccess => {
                  console.log('自动获取预览结果:', previewSuccess ? '成功' : '失败');
                }).catch(err => {
                  console.error('自动获取预览错误:', err);
                });
              }
            }).catch(err => {
              console.error('处理文档错误:', err);
            });
          }
          
          onComplete();
          return;
        }
        
        try {
          // 尝试解析JSON响应
          const parsedResponse = JSON.parse(response);
          
          // 如果有文档处理结果，直接更新文件存储
          if (parsedResponse.processed_document) {
            console.log('收到处理后的文档内容，长度:', parsedResponse.processed_document.length);
            documentProcessed = true;
            
            // 直接更新文件存储
            try {
              const fileStore = useFileStore();
              
              // 更新处理后的文档内容
              fileStore.updateProcessedContent(parsedResponse.processed_document);
              
              // 设置文档已修改标志
              fileStore.setHasModifiedDoc(true);
              
              // 存储处理状态到localStorage，帮助后续错误处理判断
              try {
                localStorage.setItem('document_processed', 'true');
                localStorage.setItem('last_processed_file_id', fileId);
                localStorage.setItem('document_processed_timestamp', Date.now().toString());
                console.log('已将文档处理状态保存到localStorage, fileId:', fileId);
              } catch (e) {
                console.error('存储文档处理状态失败:', e);
              }
              
              console.log('成功更新文件存储中的处理后文档内容');
              
              // 同时触发事件，以兼容其他可能监听此事件的组件
              window.dispatchEvent(new CustomEvent('processed-document-updated', { 
                detail: { 
                  content: parsedResponse.processed_document,
                  docxRequired: true,
                  fileId: fileId
                } 
              }));
              
              // 立即创建文本Blob作为临时预览，确保有内容显示
              const textBlob = new Blob([parsedResponse.processed_document], { type: 'text/plain' });
              
              // 触发更新事件，立即显示文本内容
              console.log('以文本格式立即触发更新事件');
              document.dispatchEvent(new CustomEvent('modifiedDocumentUpdated', {
                detail: {
                  blob: textBlob,
                  fileId: fileId,
                  chatId: localStorage.getItem('chat_id') || ''
                } 
              }));
              
              // 如果有fileId，主动触发DOCX转换
              if (fileId) {
                this.convertTextToDocx(
                  parsedResponse.processed_document,
                  `processed_document_${fileId}.docx`
                ).then(docxBlob => {
                  console.log('成功转换处理后文档为DOCX格式, 大小:', docxBlob.size);
                  
                  // 触发DOCX更新事件
                  window.dispatchEvent(new CustomEvent('docx-converted', {
                    detail: {
                      blob: docxBlob,
                      fileId: fileId
                    }
                  }));
                  
                  // 立即触发修改后文档更新事件，让文档立即显示
                  document.dispatchEvent(new CustomEvent('modifiedDocumentUpdated', {
                    detail: {
                      blob: docxBlob,
                      fileId: fileId,
                      chatId: localStorage.getItem('chat_id') || ''
                    }
                  }));
                }).catch(err => {
                  console.error('转换DOCX格式失败:', err);
                  
                  // 如果转换失败，使用文本格式作为备用
                  const textBlob = new Blob([parsedResponse.processed_document], { type: 'text/plain' });
                  document.dispatchEvent(new CustomEvent('modifiedDocumentUpdated', {
                    detail: {
                      blob: textBlob,
                      fileId: fileId,
                      chatId: localStorage.getItem('chat_id') || ''
                    }
                  }));
                });
              }
            } catch (err) {
              console.error('更新文件存储失败:', err);
            }
          }
          
          // 如果有内容更新，调用回调
          if (parsedResponse.content) {
            onUpdate(parsedResponse.content);
          }
        } catch (e) {
          // 如果不是JSON，直接使用文本
          onUpdate(response);
        }
      };
      
      eventSource.onerror = (error) => {
        console.error('EventSource error:', error);
        eventSource.close();
        onComplete();
      };
      
      // 返回一个用于清理的函数
      return () => {
        eventSource.close();
      };
    } catch (error) {
      console.error('Error in stream chat:', error);
      onComplete();
      return () => {};
    }
  }

  /**
   * 判断是否是与文档相关的查询
   * @param query 查询文本
   * @returns 是否与文档相关
   */
  isDocumentRelatedQuery(query: string): boolean {
    const documentKeywords = ['文档', '公文', '上传', '纠错', '修改', '润色', '校对', '修订'];
    return documentKeywords.some(keyword => query.includes(keyword));
  }

  /**
   * 保存文档
   * @param documentId 文档ID
   * @param content 文档内容
   * @param filename 文件名
   * @returns 保存结果
   */
  async saveDocument(documentId: string, content: string, filename: string = 'processed_document.docx') {
    const response = await axios.post('/api/save-document', {
      document_id: documentId,
      content,
      filename
    })
    return response.data
  }

  /**
   * 健康检查
   * @returns 服务是否可用
   */
  async checkHealth() {
    try {
      const response = await axios.get('/api/health-check')
      return true
    } catch (error) {
      console.error('Server connection check failed:', error)
      return false
    }
  }

  /**
   * 将文本内容转换为DOCX格式
   * @param textContent 文本内容
   * @param filename 文件名
   * @returns 转换后的Blob
   */
  async convertTextToDocx(textContent: string, filename: string): Promise<Blob> {
    console.log('开始转换文本到DOCX格式...')
    try {
      const response = await axios.post('/api/convert-text-to-docx', {
        text_content: textContent,
        filename: filename
      }, {
        responseType: 'blob',
        timeout: 30000 // 增加超时时间为30秒
      })
      
      console.log('转换文本到DOCX响应状态:', response.status)
      
      // 检查响应是否为有效的Blob
      if (response.data && response.data instanceof Blob && response.data.size > 0) {
        return response.data
      } else {
        console.error('转换响应无效:', response)
        throw new Error('Invalid conversion response format')
      }
    } catch (error) {
      console.error('转换文本到DOCX失败:', error)
      
      // 如果服务器转换失败，创建一个简单的文本Blob作为回退
      const fallbackText = textContent || "无法转换文档内容，请重试。";
      return new Blob([fallbackText], { type: 'text/plain' })
    }
  }

  /**
   * 将Chat组件中的消息转换为API需要的格式
   * @param messages 消息数组
   * @returns 格式化后的消息
   */
  formatMessagesForAPI(messages: ChatMessage[]) {
    return messages.map(msg => ({
      role: msg.role,
      content: msg.content
    }))
  }
}

// 创建默认实例
export const weChatbotService = new WeChatbotService(); 