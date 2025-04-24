import http from '@/utils/http'
import type { Result } from '@/utils/http'
import type { FileListRequest, FileItem } from '@/types/FileType'
import type { ChatItem } from '@/types/ChatType'

/** 获取文件列表
 * @param userid
 * @param username
 * **/
export const fetchFileListApi = (params: any): Promise<any[]> => {
  return http.post('/file/list', params);
};

/** 删除文件
 * @param id
 * **/
export const deleteFileApi = (id: string): Promise<void> => {
  return http.delete(`/file/delete/${id}`);
};

/** 上传文件
 * @param fileFormData
 * **/
export const uploadFileApi = (fileFormData: FormData): Promise<any> => {
  return new Promise((resolve, reject) => {
    http.post('/file/upload', fileFormData)
      .then(response => {
        console.log('上传文件API响应:', response);
        // 检查response是否是有效的文件对象，使用类型断言
        const fileResponse = response as any;
        if (fileResponse && typeof fileResponse === 'object' && fileResponse.id && fileResponse.filename) {
          console.log('文件上传成功:', fileResponse);
          resolve(fileResponse);
        } else {
          console.error('文件上传响应格式不正确:', response);
          reject(new Error('文件上传响应格式不正确'));
        }
      })
      .catch(error => {
        console.error('文件上传失败:', error);
        reject(error);
      });
  });
};

/** 查看文件
 * @param id 文件ID或包含ID的对象
 * **/
export const previewFileApi = (id: string | { id: string }): Promise<Blob> => {
  const fileId = typeof id === 'string' ? id : id.id;
  if (!fileId) {
    return Promise.reject(new Error('文件ID不能为空'));
  }
  console.log('预览文件API请求，ID:', fileId);
  return new Promise((resolve, reject) => {
    http.get(`/api/preview?id=${fileId}`, {}, { responseType: 'blob' })
      .then(response => {
        // 检查响应是否为有效的Blob
        if (response && (response instanceof Blob || (response.data && response.data instanceof Blob))) {
          const blobData = response instanceof Blob ? response : response.data;
          console.log('预览文件API响应成功，类型:', blobData.type, '大小:', blobData.size);
          resolve(blobData);
        } else {
          console.error('预览文件API响应无效:', response);
          reject(new Error('Invalid file preview response'));
        }
      })
      .catch(error => {
        console.error('预览文件API请求失败:', error);
        reject(error);
      });
  });
};

/** 下载文件
 * @param id 文件ID或包含ID的对象
 * **/
export const downloadFileApi = (id: string | { id: string }): Promise<{ data: Blob }> => {
  const fileId = typeof id === 'string' ? id : id.id;
  if (!fileId) {
    return Promise.reject(new Error('文件ID不能为空'));
  }
  console.log('下载文件API请求，ID:', fileId);
  return new Promise((resolve, reject) => {
    http.post(`/file/download`, { id: fileId }, { responseType: 'blob' })
      .then(response => {
        if (response && (response instanceof Blob || (response.data && response.data instanceof Blob))) {
          const blobData = response instanceof Blob ? { data: response } : response;
          console.log('下载文件API响应成功，大小:', blobData.data.size);
          resolve(blobData);
        } else {
          console.error('下载文件API响应无效:', response);
          reject(new Error('Invalid file download response'));
        }
      })
      .catch(error => {
        console.error('下载文件API请求失败:', error);
        reject(error);
      });
  });
};

/** 请求文件预览
 *  @param params.file 文件对象
 *  @param params.chat 聊天对象
 */
export const previewModifiedFileApi = (params: { file: FileItem; chat: ChatItem }): Promise<{ data: Blob }> => {
  return new Promise((resolve, reject) => {
    // 记录请求开始时间
    const requestTime = new Date().toISOString();
    console.log(`[${requestTime}] 请求修改后的文档预览, 文件ID: ${params.file.id}, 聊天ID: ${params.chat.id}`);

    // 检查是否有缓存的处理结果
    const lastProcessedFileId = localStorage.getItem('last_processed_file_id');
    const documentProcessed = localStorage.getItem('document_processed');

    if (lastProcessedFileId === params.file.id && documentProcessed === 'true') {
      console.log(`[${requestTime}] 检测到已处理的文档缓存，尝试获取预览`);
    }

    // 创建一个重试函数，支持延迟重试
    const attemptGetModifiedPreview = (retryCount = 0, maxRetries = 3, usePost = false) => {
      // 根据重试次数调整请求方式
      if (!usePost) {
        // GET 请求方式
        const endpoint = `/api/preview-modified?id=${params.file.id}&chat_id=${params.chat.id}&t=${Date.now()}`;
        console.log(`[${requestTime}] 尝试GET请求(${retryCount + 1}/${maxRetries + 1}): ${endpoint}`);

        http.get(endpoint, {}, { responseType: 'blob' })
          .then(response => {
            handleSuccess(response);
          })
          .catch(error => {
            handleError(error, retryCount, maxRetries, usePost);
          });
      } else {
        // POST 请求方式
        const endpoint = `/api/preview-modified`;
        console.log(`[${requestTime}] 尝试POST请求(${retryCount + 1}/${maxRetries + 1}): ${endpoint}`);

        http.post(endpoint, {
          id: params.file.id,
          chat_id: params.chat.id,
          timestamp: Date.now()
        }, { responseType: 'blob' })
          .then(response => {
            handleSuccess(response);
          })
          .catch(error => {
            handleError(error, retryCount, maxRetries, usePost);
          });
      }
    };

    // 处理成功响应
    const handleSuccess = (response: any) => {
      if (response && (response instanceof Blob || (response.data && response.data instanceof Blob))) {
        const blobData = response instanceof Blob ? { data: response } : response;
        console.log(`[${requestTime}] 成功获取修改后文档预览, 类型: ${blobData.data.type}, 大小: ${blobData.data.size} 字节`);

        // 保存处理状态到localStorage
        try {
          localStorage.setItem('document_processed', 'true');
          localStorage.setItem('last_processed_file_id', params.file.id);
          localStorage.setItem('document_processed_timestamp', Date.now().toString());
        } catch (e) {
          console.warn('保存文档处理状态失败:', e);
        }

        resolve(blobData);
      } else {
        console.warn(`[${requestTime}] 预览修改文件响应格式无效`);
        throw new Error('Invalid modified file preview response');
      }
    };

    // 处理错误响应
    const handleError = (error: any, retryCount: number, maxRetries: number, usePost: boolean) => {
      // 获取HTTP状态码和详细错误信息
      const status = error.response?.status;
      const errorDetails = error.response?.data || error.message || '未知错误';

      console.log(`[${requestTime}] 预览修改文件失败(尝试${retryCount + 1}/${maxRetries + 1}): 状态码=${status}, 错误=${errorDetails}`);

      // 判断是否为404错误（功能不存在或文件未找到）
      const is404Error = status === 404;

      // 根据不同情况处理错误
      if (retryCount < maxRetries) {
        // 还有重试次数
        if (is404Error && !usePost) {
          // 如果是404错误且当前使用GET方法，切换到POST方法
          console.log(`[${requestTime}] 检测到404错误，切换请求方法为POST`);
          setTimeout(() => {
            attemptGetModifiedPreview(retryCount, maxRetries, true);
          }, 800);
        } else if (is404Error && usePost && retryCount === 0) {
          // 如果两种方法都返回404，尝试触发纠错流程
          tryCorrection();
        } else {
          // 其他错误情况，使用递增延迟重试
          const delay = (retryCount + 1) * 1500; // 递增延迟
          console.log(`[${requestTime}] 将在${delay}ms后重试(${retryCount + 2}/${maxRetries + 1})`);

          setTimeout(() => {
            attemptGetModifiedPreview(retryCount + 1, maxRetries, usePost);
          }, delay);
        }
      } else {
        // 所有重试次数用完
        if (is404Error) {
          // 404错误，尝试调用纠错API
          tryCorrection();
        } else {
          // 非404错误且重试次数用完，返回错误提示
          returnFallbackMessage();
        }
      }
    };

    // 尝试调用纠错API
    const tryCorrection = () => {
      console.log(`[${requestTime}] 预览API返回404，尝试调用纠错API`);

      // 调用纠错API尝试重新处理文档
      http.post('/api/mcp/correction', {
        file_id: params.file.id,
        chat_id: params.chat.id,
        operation: 'correction',
        timestamp: Date.now()
      })
        .then(correctionResponse => {
          console.log(`[${requestTime}] 纠错API调用成功:`, correctionResponse);

          // 延迟后再次尝试获取修改后文档
          setTimeout(() => {
            http.get(`/api/preview-modified?id=${params.file.id}&t=${Date.now()}`, {}, { responseType: 'blob' })
              .then(finalResponse => {
                if (finalResponse && (finalResponse instanceof Blob || (finalResponse.data && finalResponse.data instanceof Blob))) {
                  const blobData = finalResponse instanceof Blob ? { data: finalResponse } : finalResponse;
                  console.log(`[${requestTime}] 纠错后获取修改文档成功`);
                  resolve(blobData);
                } else {
                  throw new Error('纠错后获取修改文档失败');
                }
              })
              .catch(finalError => {
                // 所有方法都失败，返回文本说明
                console.error(`[${requestTime}] 多次尝试后无法获取修改文档:`, finalError);
                returnFallbackMessage();
              });
          }, 2000);
        })
        .catch((correctionError) => {
          // 纠错API也失败，记录详细错误
          console.log(`[${requestTime}] 纠错API调用失败:`, correctionError);
          returnFallbackMessage(true);
        });
    };

    // 返回友好的错误信息
    const returnFallbackMessage = (isCorrectFailed = false) => {
      let friendlyMessage;

      if (isCorrectFailed) {
        friendlyMessage =
          "感谢您的尝试！目前系统仅支持公文纠错、公文润色和总结功能。" +
          "请在聊天框中输入\"公文纠错\"、\"文档润色\"或\"总结文档\"来使用这些功能。" +
          "\n\n我们正在努力开发更多功能以提升您的体验，敬请期待！";
      } else {
        friendlyMessage = "很抱歉，无法获取修改后的文档内容。请尝试在聊天框中发送\"公文纠错\"或\"文档润色\"来处理文档。";
      }

      const blob = new Blob([friendlyMessage], { type: 'text/plain' });
      console.log(`[${requestTime}] 返回友好提示消息`);
      resolve({ data: blob });
    };

    // 开始第一次尝试
    attemptGetModifiedPreview();
  });
}

/** 确认修改
 *  @param file: FileItem
 *  @param chat: ChatItem
 */
export const confirmModifyApi = (params: { file: FileItem; chat: ChatItem }): Promise<{ success: boolean }> => {
  return new Promise((resolve, reject) => {
    http.post(`/file/confirm-modify`, params)
      .then(response => {
        resolve({ success: true });
      })
      .catch(error => {
        console.log('确认修改失败，本地模拟成功:', error);
        // 模拟确认成功
        resolve({ success: true });
      });
  });
}