import axios from 'axios'
import { useFileStore } from '@/stores/file';
import { message as antMessage } from 'ant-design-vue';

// 创建一个没有baseURL的axios实例，这样请求会通过Vite代理
const axiosInstance = axios.create({
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json'
  }
});

// 添加响应拦截器用于全局错误处理
axiosInstance.interceptors.response.use(
  response => response,
  error => {
    console.error('API请求错误:', error.message);
    // 增强错误对象，添加更详细的信息
    if (error.response) {
      // 服务器返回了错误响应
      error.apiErrorType = 'server';
      error.statusCode = error.response.status;
      error.statusText = error.response.statusText;
      console.error(`服务器错误: ${error.statusCode} ${error.statusText}`);
    } else if (error.request) {
      // 请求已发送但未收到响应
      error.apiErrorType = 'timeout';
      console.error('请求超时或后端服务未响应');
    } else {
      // 设置请求时发生错误
      error.apiErrorType = 'network';
      console.error('网络或其他错误:', error.message);
    }
    return Promise.reject(error);
  }
);

/**
 * 检查消息是否与文档处理相关
 * @param message 用户消息
 * @returns boolean 是否与文档处理相关
 */
const isDocumentRelatedQuery = (message: string): boolean => {
  const docKeywords = [
    '文档', '公文', '纠错', '润色', '文件',
    '上传', '处理', '修改', '校对', '检查',
    '改进', '修复', '纠正', '审核', '改良'
  ];

  return docKeywords.some(keyword => message.includes(keyword));
}

/**
 * 识别用户消息的意图类型
 * @param message 用户消息
 * @returns string 意图类型："correction"(纠错)、"polish"(润色)、"summary"(总结)或"chat"(普通聊天)
 */
const getMessageIntent = (message: string): string => {
  // 检查是否包含润色相关关键词
  if (message.includes('润色') ||
    message.includes('优化') ||
    message.includes('改写') ||
    message.includes('改进表达')) {
    return 'polish';
  }

  // 检查是否包含总结相关关键词
  if (message.includes('总结') ||
    message.includes('摘要') ||
    message.includes('概括') ||
    message.includes('归纳')) {
    return 'summary';
  }

  // 检查是否包含纠错相关关键词
  if (message.includes('纠错') ||
    message.includes('修正') ||
    message.includes('修改错误') ||
    message.includes('检查错误')) {
    return 'correction';
  }

  // 默认为聊天
  return 'chat';
}

/**
 * 发送聊天请求到后端服务
 * @param message 用户消息
 * @param chatHistory 聊天历史
 * @param onContent 内容更新回调
 * @param onComplete 完成回调
 * @param onError 错误回调
 */
export const sendChatRequest = async (
  message: string,
  chatHistory: any[],
  onContent: (content: string) => void,
  onComplete: () => void,
  onError: (error: any) => void
) => {
  // 定义可能需要清理的资源
  let timeoutId: number | null = null;
  let controller: AbortController | null = new AbortController();

  try {
    // 检查消息是否与文档处理相关
    const isDocRequest = isDocumentRelatedQuery(message);
    const fileStore = useFileStore();
    const hasUploadedDoc = fileStore.currentFile && fileStore.currentFile.id;

    // 获取用户意图
    const messageIntent = getMessageIntent(message);
    console.log(`检测到用户意图: ${messageIntent}`);

    // 构建请求参数
    const params = new URLSearchParams();
    params.append('message', message);

    // 限制历史消息数量，只取最近的10条消息，避免请求头过大
    const limitedChatHistory = chatHistory.length > 10
      ? chatHistory.slice(chatHistory.length - 10)
      : chatHistory;

    params.append('chat_history', JSON.stringify(limitedChatHistory.map(msg => ({
      role: msg.role,
      content: msg.content
    }))));
    params.append('intent', messageIntent); // 添加意图参数

    // 如果是文档处理请求并且有上传的文档，添加文件ID
    if (isDocRequest && hasUploadedDoc && fileStore.currentFile?.id) {
      params.append('file_id', fileStore.currentFile.id);
    }

    // 构建请求URL
    const requestUrl = `/api/stream-chat?${params.toString()}`;

    // 设置超时
    const timeout = isDocRequest ? 60000 : 30000;
    timeoutId = window.setTimeout(() => {
      if (controller) {
        controller.abort();
        controller = null;
      }
    }, timeout);

    // 详细日志记录请求信息
    console.log("==========================================");
    console.log("开始发送流式请求，请求信息：");
    console.log("URL:", requestUrl);
    console.log("用户消息:", message.substring(0, 50) + (message.length > 50 ? '...' : ''));
    console.log("历史消息数量:", chatHistory.length, "实际发送:", limitedChatHistory.length);
    console.log("意图:", messageIntent);
    console.log("是否包含文档:", isDocRequest && hasUploadedDoc);
    console.log("==========================================");

    // 使用fetch API处理流式响应
    console.log("开始发送请求到: ", requestUrl);
    const response = await fetch(requestUrl, {
      method: 'GET',
      headers: {
        'Accept': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive'
      },
      signal: controller.signal
    });

    console.log("收到响应:", response.status, response.statusText);

    // 输出响应头信息以便调试
    console.log("响应头信息:");
    response.headers.forEach((value, key) => {
      console.log(`${key}: ${value}`);
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}, statusText: ${response.statusText}`);
    }

    if (!response.body) {
      throw new Error('Response body is null');
    }

    // 收集到的完整内容
    let fullContent = '';
    let hasProcessedDocument = false;

    // 创建一个reader读取流式数据
    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    console.log("开始读取流式响应...");

    // 读取数据
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        console.log("流式响应读取完成");
        break;
      }

      // 解码二进制数据为文本
      const text = decoder.decode(value, { stream: true });
      console.log("收到数据块，长度:", text.length, "字节");

      const messages = text.split('\n\n');
      console.log("解析得到消息块数量:", messages.length);

      // 处理每个消息块
      for (const msg of messages) {
        if (!msg || !msg.trim()) continue;

        if (msg.startsWith('data: ')) {
          const data = msg.substring(6).trim();

          if (data === 'end') {
            console.log("收到结束标记");
            break;
          }

          try {
            const parsedData = JSON.parse(data);
            console.log("成功解析JSON数据");

            // 更新内容
            if (parsedData && parsedData.content) {
              fullContent = parsedData.content;
              onContent(fullContent);
              console.log("更新内容，长度:", fullContent.length);
            }

            // 处理文档内容
            if (parsedData && parsedData.processed_document) {
              hasProcessedDocument = true;

              if (fileStore.currentFile && fileStore.currentFile.id) {
                fileStore.setHasModifiedDoc(true);
                fileStore.updateProcessedContent(parsedData.processed_document);

                // 显示文档处理成功消息
                antMessage.success('文档处理完成，正在获取预览...');

                // 触发文档处理完成事件，使前端能够自动获取并显示预览
                const event = new CustomEvent('documentProcessed', {
                  detail: {
                    fileId: fileStore.currentFile.id,
                    timestamp: Date.now()
                  }
                });
                document.dispatchEvent(event);

                // 创建文本Blob并触发修改后文档更新事件
                try {
                  const textBlob = new Blob([parsedData.processed_document], { type: 'text/plain' });

                  // 触发修改后文档更新事件
                  const updateEvent = new CustomEvent('modifiedDocumentUpdated', {
                    detail: {
                      blob: textBlob,
                      fileId: fileStore.currentFile.id,
                      timestamp: Date.now()
                    }
                  });
                  document.dispatchEvent(updateEvent);
                } catch (e) {
                  console.error('创建文本Blob失败:', e);
                }
              }
            }
          } catch (error) {
            console.error('解析消息失败:', error, "原始数据:", data.substring(0, 100));
          }
        }
      }
    }

    // 如果是文档处理请求但没有收到处理后的文档
    if (isDocRequest && hasUploadedDoc && !hasProcessedDocument) {
      antMessage.warning('文档处理可能未完成，请稍后再试');
    }

    // 完成回调
    onComplete();

    // 如果是文档处理请求并且处理成功，延迟触发一次预览更新
    if (isDocRequest && hasUploadedDoc && hasProcessedDocument && fileStore.currentFile?.id) {
      // 延迟一秒触发文档处理完成事件，确保界面能显示处理后的预览
      setTimeout(() => {
        console.log('延迟触发文档处理完成事件，确保显示预览');
        const event = new CustomEvent('documentProcessed', {
          detail: {
            fileId: fileStore.currentFile?.id,
            timestamp: Date.now()
          }
        });
        document.dispatchEvent(event);
      }, 1000);
    }
  } catch (error: any) {
    console.error('请求错误:', error);
    // 详细记录错误信息
    if (error instanceof TypeError) {
      console.error('网络错误，可能是CORS或网络连接问题:', error.message);
    } else if (error.name === 'AbortError') {
      console.error('请求被中止，可能是超时或用户取消:', error.message);
    } else {
      console.error('其他错误:', error.message);
    }
    onError(error);
  } finally {
    // 清理资源
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
    }
    controller = null;
  }
};

/**
 * 健康检查接口，用于检测后端服务是否可用
 * @returns Promise<boolean> 服务是否可用
 */
export const healthCheck = async (): Promise<boolean> => {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const response = await axiosInstance.get('/api/health-check', {
      signal: controller.signal,
      timeout: 5000
    });

    clearTimeout(timeoutId);
    console.log('健康检查成功，服务正常运行');
    return response.status === 200 && response.data?.status === 'ok';
  } catch (error: any) {
    console.error('健康检查失败:', error);
    // 输出更详细的错误信息
    if (error.apiErrorType === 'server') {
      console.error(`服务器返回错误: ${error.statusCode} ${error.statusText}`);
    } else if (error.apiErrorType === 'timeout') {
      console.error('健康检查超时，服务可能不可用');
    } else {
      console.error('网络错误，无法连接到后端服务');
    }
    return false;
  }
};

/**
 * 下载处理后的文档
 * @param chatId 聊天ID
 * @returns Promise<Blob> 文档Blob对象
 */
export const downloadProcessedDocument = async (chatId: string): Promise<Blob> => {
  try {
    // 添加下载进度提示
    antMessage.loading('正在准备下载文档...');

    const response = await axiosInstance.get('/api/download-result', {
      responseType: 'blob',
      params: { chatId },
      timeout: 30000
    });

    return response.data;
  } catch (error) {
    console.error('下载文档失败:', error);
    antMessage.error('下载文档失败，请重试');
    throw error;
  }
};

/**
 * 将文本内容转换为DOCX格式
 * @param textContent 文本内容
 * @param filename 文件名
 * @returns Promise<Blob> 转换后的DOCX文件Blob对象
 */
export const convertTextToDocx = async (textContent: string, filename: string): Promise<Blob> => {
  try {
    console.log('开始转换文本到DOCX格式...');

    antMessage.loading('正在转换文档格式...');

    const response = await axiosInstance.post('/api/convert-text-to-docx', {
      text_content: textContent,
      filename: filename
    }, {
      responseType: 'blob',
      timeout: 20000
    });

    console.log('转换文本到DOCX响应:', response.status);
    return response.data;
  } catch (error) {
    console.error('转换文本到DOCX失败:', error);
    antMessage.error('转换文档格式失败');
    throw error;
  }
};

/**
 * 请求处理文档并获取预览
 * @param fileId 文件ID
 * @param forceReprocess 是否强制重新处理
 * @returns 文档处理是否成功
 */
export const requestDocumentPreview = async (
  fileId: string,
  forceReprocess = false
): Promise<boolean> => {
  const startTime = new Date().toISOString();
  console.log(`[${startTime}] requestDocumentPreview 开始, fileId=${fileId}, forceReprocess=${forceReprocess}`);

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
      // 使用正确的API端点处理文档
      const correctionResponse = await axios.post('/api/mcp/correction', {
        file_id: fileId,
        chat_id: chatId,
        timestamp: Date.now() // 添加时间戳防止缓存
      });

      console.log(`[${startTime}] correction API响应:`, correctionResponse.data);

      if (correctionResponse.data.status === 'success') {
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
};

/**
 * 获取最后一次处理的文档内容
 * @param chatId 聊天ID
 * @returns Promise<string> 处理后的文档内容
 */
export const getLastProcessedDocument = async (chatId: string): Promise<string> => {
  if (!chatId) {
    console.error('获取处理后文档内容失败: 聊天ID不能为空');
    return '';
  }

  const startTime = new Date().toISOString();
  console.log(`[${startTime}] 获取最后处理的文档内容, chatId=${chatId}`);

  try {
    // 调用API获取处理后的文档内容
    const response = await axiosInstance.get(`/api/chat/processed-document?chat_id=${chatId}&timestamp=${Date.now()}`);

    if (response.data && response.data.status === 'success' && response.data.content) {
      console.log(`[${startTime}] 成功获取处理后文档内容，内容长度: ${response.data.content.length}`);
      return response.data.content;
    } else {
      console.warn(`[${startTime}] 获取处理后文档内容失败: ${response.data?.message || '未知错误'}`);
      return '';
    }
  } catch (error) {
    console.error(`[${startTime}] 获取处理后文档内容出错:`, error);
    return '';
  }
};

/**
 * 检查API端点是否可用
 * @param endpoint API端点路径
 * @returns Promise<boolean> 端点是否可用
 */
export const checkEndpointAvailability = async (endpoint: string): Promise<boolean> => {
  try {
    console.log(`检查API端点可用性: ${endpoint}`);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);

    const response = await axiosInstance.get(`/api/${endpoint}`, {
      signal: controller.signal,
      timeout: 3000
    });

    clearTimeout(timeoutId);
    console.log(`API端点 ${endpoint} 检查成功，状态: ${response.status}`);
    return response.status >= 200 && response.status < 300;
  } catch (error: any) {
    console.error(`API端点 ${endpoint} 检查失败:`, error.message);
    return false;
  }
}; 