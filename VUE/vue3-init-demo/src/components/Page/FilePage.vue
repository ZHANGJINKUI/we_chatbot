<template>
  <div class="page-container">
    <a-card title="文件处理" class="card-container">
      <!-- 按钮区 -->
      <div class="fixed-btn-area">
        <div class="upload-area">
          <a-upload
            name="file"
            :multiple="false"
            :before-upload="beforeUpload"
            :show-upload-list="false"
            :loading="loadingUpload"
            :disabled="isProcessing"
          >
            <a-button 
              type="primary" 
              :loading="loadingUpload" 
              :disabled="isProcessing"
              :title="isProcessing ? '文档处理中，请等待处理完成后再上传文件' : ''"
            >
              <template #icon><upload-outlined /></template>
              上传文件
            </a-button>
          </a-upload>
          <span class="upload-hint">支持 .docx 格式，最大10MB</span>
        </div>
        <div class="action-buttons">
          <span v-if="file.id" class="file-title">{{ file.filename }}</span>
          
          <!-- 删除预览按钮 -->
        </div>
      </div>

      <!-- 内容区 -->
      <div class="scrollable-content">
        <template v-if="file.id">
          <PreviewContainer
            :original-blob="originalBlob"
            :modified-blob="modifiedBlob"
            :loading-preview="loadingPreview"
            :loading-modify="loadingModify"
            :converting="converting"
            :has-modified="hasModifiedDoc"
          />
        </template>
        <template v-else>
          <div class="upload-placeholder">
            <upload-outlined style="font-size: 48px; margin-bottom: 16px" />
            <p>请上传.docx文档以开始处理</p>
          </div>
        </template>
      </div>
    </a-card>
  </div>
</template>
<script setup lang="ts">
import { ref, watch, computed, onMounted, onUnmounted, nextTick } from 'vue'
import { storeToRefs } from 'pinia'
import { message } from 'ant-design-vue'
import { UploadOutlined } from '@ant-design/icons-vue'
import PreviewContainer from '@/components/Page/FilePage/PreviewContainer.vue'
import { useFileStore } from '@/stores/file'
import { useAuthStore } from '@/stores/auth'
import { useChatStore } from '@/stores/chat'
import * as weChatbotService from '@/services/weChatbotService'
import type { FileItem } from '@/types/FileType'
import type { ChatItem } from '@/types/ChatType'
import axios from 'axios'
import * as documentApi from '@/api/document'

defineOptions({
  name: 'FilePage'
})

// Store 引用
const fileStore = useFileStore()
const authStore = useAuthStore()
const chatStore = useChatStore()

// 状态引用
const { hasModifiedDoc, isProcessing } = storeToRefs(fileStore)
const file = computed(() => fileStore.currentFile)
const currentFileId = computed(() => fileStore.currentFile.id)
const chat = computed(() => chatStore.currentChat)
const { loadingUpload } = storeToRefs(fileStore)

// 文档状态
const loadingPreview = ref<boolean>(false)
const originalBlob = ref<Blob | null>(null)
const loadingModify = ref<boolean>(false)
const modifiedBlob = ref<Blob | null>(null)
const converting = ref<boolean>(false)
const loadingPreviewRequest = ref<boolean>(false)

// 初始化服务
const mountTime = new Date().toISOString()

// 获取原始文档预览
const fetchOriginalPreview = async (fileId: string) => {
  if (!fileId) {
    message.warning('文件ID无效，无法获取预览');
    return;
  }

  console.log(`[${new Date().toISOString()}] 正在获取原始文档预览: ${fileId}`);
  originalBlob.value = null; // 先清除强制刷新
  loadingPreview.value = true;

  try {
    // 使用document API获取原始文档内容
    const blob = await documentApi.getOriginalPreview(fileId);
    
    if (blob && blob.size > 0) {
      await nextTick();
      originalBlob.value = blob;
      message.success('原始文档预览加载成功');
    } else {
      console.error('获取到空的文档Blob');
      message.error('文档预览失败: 获取到空文件');
    }
  } catch (error) {
    console.error('获取原始文档预览出错:', error);
    message.error('获取原始文档预览失败');
  } finally {
    loadingPreview.value = false;
  }
};

/**
 * 处理"查看预览"按钮点击
 */
const handlePreviewClick = async () => {
  const startTime = new Date().toISOString();
  console.log(`[${startTime}] 用户点击查看预览按钮`);
  
  // 检查参数
  if (!file.value?.id || !chat.value?.id) {
    message.error('无法获取文件或会话信息');
    return;
  }
  
  // 设置加载状态
  loadingPreviewRequest.value = true;
  
  try {
    // 显式请求获取文档预览
    const success = await weChatbotService.requestDocumentPreview(
      file.value.id, 
      true // 强制重新处理
    );
    
    if (success) {
      message.success('预览请求成功，正在处理...');
      // 文档预览请求成功后，自动获取预览内容
      setTimeout(() => {
        autoFetchDocumentPreview(file.value.id);
      }, 1000);
    } else {
      message.warning('预览加载失败，请重试');
    }
  } catch (error) {
    console.error(`[${startTime}] 获取预览失败:`, error);
    message.error('获取预览出错，请重试');
  } finally {
    loadingPreviewRequest.value = false;
  }
};

/**
 * 处理文档的逻辑
 * @param fileId 文件ID
 * @param chatId 聊天ID
 * @param forced 是否强制重新处理
 * @returns Promise<boolean> 文档处理是否成功
 */
const processDocument = async (fileId?: string, chatId?: string, forced = false): Promise<boolean> => {
  const startTime = new Date().toISOString();
  console.log(`[${startTime}] processDocument 开始, fileId=${fileId}, chatId=${chatId}, forced=${forced}`);
  
  // 验证参数
  const currentFileId = fileId || file.value?.id;
  const currentChatId = chatId || chat.value?.id;
  
  if (!currentFileId) {
    console.error(`[${startTime}] processDocument 错误: 文件ID不能为空`);
    return false;
  }
  
  if (!currentChatId) {
    console.error(`[${startTime}] processDocument 错误: 聊天ID不能为空`);
    return false;
  }
  
  // 设置处理状态为true
  fileStore.setProcessingStatus(true);
  
  // 处理文档
  try {
    console.log(`[${startTime}] 开始通过WeChatbotService处理文档`);
    const success = await weChatbotService.requestDocumentPreview(currentFileId, forced);
    
    if (success) {
      console.log(`[${startTime}] 文档处理成功`);
      message.success('文档处理成功，正在获取预览...');
      return true;
    } else {
      console.warn(`[${startTime}] 文档处理失败`);
      message.warning('文档处理失败，将尝试重新获取预览');
      return false;
    }
  } catch (error) {
    console.error(`[${startTime}] 文档处理错误:`, error);
    message.error('文档处理出错，将尝试重新获取预览');
    return false;
  } finally {
    // 处理完成后，设置处理状态为false
    fileStore.setProcessingStatus(false);
  }
};

// 处理修改后文档更新事件
const handleModifiedDocumentUpdated = (event: any) => {
  const eventTime = new Date().toISOString();
  console.log(`[${eventTime}] 收到修改后文档更新事件:`, event.detail);
  
  const { blob, fileId, chatId } = event.detail;
  
  // 确保重置处理状态
  fileStore.setProcessingStatus(false);
  
  // 验证数据
  if (fileId && file.value && file.value.id === fileId) {
    console.log(`[${eventTime}] 文件ID匹配，立即更新预览`);
    
    // 设置hasModifiedDoc状态
    fileStore.setHasModifiedDoc(true);
    localStorage.setItem('document_processed', 'true');
    localStorage.setItem('last_processed_file_id', fileId);
    localStorage.setItem('document_processed_timestamp', Date.now().toString());
    
    // 设置加载状态
    loadingModify.value = true;
    
    try {
      // 清除旧的blob数据，强制重新渲染
      modifiedBlob.value = null;
      
      // 使用nextTick确保DOM更新后再设置新的blob
      nextTick(async () => {
        // 首先尝试从fileStore中获取处理后的内容
        const processedContent = fileStore.processedContent;
        
        if (processedContent && processedContent.length > 0) {
          console.log(`[${eventTime}] 使用存储的处理后内容作为预览，内容长度: ${processedContent.length}`);
          
          // 创建文本Blob
          const textBlob = new Blob([processedContent], { type: 'text/plain' });
          
          // 设置用于预览的blob
          modifiedBlob.value = textBlob;
          
          // 尝试转换为DOCX（更好的显示效果）
          weChatbotService.convertTextToDocx(
            processedContent,
            `processed_document_${fileId}.docx`
          ).then(docxBlob => {
            console.log(`[${eventTime}] 成功转换为DOCX，更新显示`);
            modifiedBlob.value = docxBlob;
          }).catch(err => {
            console.error(`[${eventTime}] 转换DOCX失败，保持文本显示:`, err);
          }).finally(() => {
            loadingModify.value = false;
          });
        } else if (blob && blob instanceof Blob) {
          // 如果没有处理后内容但有blob，则使用事件中的blob
          console.log(`[${eventTime}] 文档更新事件包含有效Blob数据: size=${blob.size}, type=${blob.type}`);
          modifiedBlob.value = blob;
          loadingModify.value = false;
        } else {
          // 如果都没有，尝试通过API获取
          console.log(`[${eventTime}] 没有获取到内容，尝试从API获取`);
          try {
            // 尝试获取处理后的内容
            const content = await fileStore.getProcessedContent(fileId);
            if (content && content.length > 0) {
              console.log(`[${eventTime}] 成功从API获取处理后内容，长度: ${content.length}`);
              
              // 创建文本Blob
              const textBlob = new Blob([content], { type: 'text/plain' });
              
              // 设置用于预览的blob
              modifiedBlob.value = textBlob;
              
              // 尝试转换为DOCX
              weChatbotService.convertTextToDocx(
                content,
                `processed_document_${fileId}.docx`
              ).then(docxBlob => {
                modifiedBlob.value = docxBlob;
              }).catch(err => {
                console.error(`[${eventTime}] 转换DOCX失败:`, err);
              });
            } else {
              console.warn(`[${eventTime}] 无法获取处理后内容`);
              message.warning('无法获取处理后文档内容');
            }
          } catch (error) {
            console.error(`[${eventTime}] 获取处理后内容失败:`, error);
            message.error('获取处理后文档内容失败');
          } finally {
            loadingModify.value = false;
          }
        }
      });
    } catch (error) {
      console.error(`[${eventTime}] 预览更新失败:`, error);
      loadingModify.value = false;
      message.error('文档预览加载失败，请刷新页面重试');
    }
  } else {
    console.log(`[${eventTime}] 文件ID不匹配，忽略更新: 当前=${file.value?.id}, 事件=${fileId}`);
  }
  
  // 确保更新状态
  fileStore.setProcessingStatus(false);
};

// 处理文档预览错误事件
const handleDocumentPreviewError = (event: any) => {
  const eventTime = new Date().toISOString();
  console.error(`[${eventTime}] 文档预览错误:`, event.detail);
  
  const { message: errorMessage, fileId } = event.detail;
  
  // 检查文件ID是否匹配
  if (!fileId || file.value?.id === fileId) {
    console.log(`[${eventTime}] 文件ID匹配，显示错误消息`);
    message.error(errorMessage || '文档预览加载失败');
  } else {
    console.log(`[${eventTime}] 文件ID不匹配，忽略错误: 当前=${file.value?.id}, 事件=${fileId}`);
  }
};

// 处理文档处理完成事件
const handleDocumentProcessed = async (event: any) => {
  const eventTime = new Date().toISOString();
  console.log(`[${eventTime}] 收到文档处理完成事件:`, event.detail);
  
  const { fileId, timestamp } = event.detail;
  
  // 确保重置处理状态
  fileStore.setProcessingStatus(false);
  
  // 更新状态
  if (fileId && fileId === file.value?.id) {
    // 无论如何，设置文档已修改状态，确保界面显示处理后区域
    fileStore.setHasModifiedDoc(true);
    message.success('文档处理完成，正在获取预览...');
    
    // 先清空之前的Blob，确保UI更新
    modifiedBlob.value = null;
    
    // 设置加载状态
    loadingModify.value = true;
    
    // 尝试获取处理后的内容
    try {
      // 首先检查fileStore中是否有处理后的内容
      const processedContent = fileStore.processedContent;
      
      if (processedContent && processedContent.length > 0) {
        console.log(`[${eventTime}] 从fileStore获取到处理后内容，长度: ${processedContent.length}`);
        
        // 创建文本Blob
        const textBlob = new Blob([processedContent], { type: 'text/plain' });
        
        // 设置用于预览的blob
        modifiedBlob.value = textBlob;
        
        // 尝试转换为DOCX（更好的显示效果）
        weChatbotService.convertTextToDocx(
          processedContent,
          `processed_document_${fileId}.docx`
        ).then(docxBlob => {
          console.log(`[${eventTime}] 成功转换为DOCX，更新显示`);
          modifiedBlob.value = docxBlob;
        }).catch(err => {
          console.error(`[${eventTime}] 转换DOCX失败，保持文本显示:`, err);
        }).finally(() => {
          loadingModify.value = false;
        });
        
        return; // 如果已经获取到内容并成功显示，就不需要继续了
      }
      
      // 如果fileStore中没有内容，尝试从API获取
      console.log(`[${eventTime}] fileStore中没有处理后内容，尝试从API获取`);
      const processedContent2 = await fileStore.getProcessedContent(fileId);
      
      if (processedContent2 && processedContent2.length > 0) {
        console.log(`[${eventTime}] 成功从API获取处理后内容，长度: ${processedContent2.length}`);
        
        // 将获取到的内容更新到fileStore中
        fileStore.updateProcessedContent(processedContent2);
        
        // 创建文本Blob
        const textBlob = new Blob([processedContent2], { type: 'text/plain' });
        
        // 设置用于预览的blob
        modifiedBlob.value = textBlob;
        
        // 尝试转换为DOCX
        weChatbotService.convertTextToDocx(
          processedContent2,
          `processed_document_${fileId}.docx`
        ).then(docxBlob => {
          console.log(`[${eventTime}] 成功转换为DOCX，更新显示`);
          modifiedBlob.value = docxBlob;
        }).catch(err => {
          console.error(`[${eventTime}] 转换DOCX失败，保持文本显示:`, err);
        }).finally(() => {
          loadingModify.value = false;
        });
        
        return; // 如果已经获取到内容并成功显示，就不需要继续了
      }
      
      // 如果上述方法都失败，尝试获取处理后预览
      console.log(`[${eventTime}] 尝试获取处理后预览`);
      await fetchModifiedPreview(fileId);
    } catch (error) {
      console.error(`[${eventTime}] 获取处理后内容失败:`, error);
      message.error('获取处理后文档内容失败');
      
      // 最后尝试使用fetchModifiedPreview
      try {
        await fetchModifiedPreview(fileId);
      } catch (e) {
        console.error(`[${eventTime}] 自动获取处理后预览失败:`, e);
        loadingModify.value = false;
      }
    }
  }
  
  // 确保更新状态
  fileStore.setProcessingStatus(false);
};

/**
 * 自动获取文档预览
 * @param fileId 文件ID
 */
const autoFetchDocumentPreview = async (fileId: string) => {
  if (!fileId) return;
  
  try {
    // 获取原始预览
    await fetchOriginalPreview(fileId);
    
    // 获取处理后预览
    await fetchModifiedPreview(fileId);
  } catch (error) {
    console.error('自动获取文档预览失败:', error);
    message.error('获取文档预览失败，请重试');
  }
};

// 处理文档预览就绪事件
const handleDocumentPreviewReady = (event: any) => {
  const eventTime = new Date().toISOString();
  console.log(`[${eventTime}] 收到文档预览就绪事件:`, event.detail);
  
  const { fileId, timestamp } = event.detail;
  
  // 自动获取预览
  if (fileId && file.value?.id === fileId) {
    console.log(`[${eventTime}] 文档预览已就绪，正在自动获取...`);
    autoFetchDocumentPreview(fileId);
  }
};

// 上传前检查
const beforeUpload = async (file: File): Promise<boolean> => {
  // 如果文件正在处理中，不允许上传
  if (isProcessing.value) {
    message.warning('文档处理中，请等待处理完成后再上传文件');
    return false;
  }
  
  const isWord = 
    file.type === 'application/msword' || 
    file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    /\.(doc|docx)$/.test(file.name.toLowerCase())
  
  if (!isWord) {
    message.error('只能上传Word文档!')
    return false
  }
  
  const isLt10M = file.size / 1024 / 1024 < 10
  if (!isLt10M) {
    message.error('文件大小不能超过10MB!')
    return false
  }
  
  try {
    // 上传文件
    loadingUpload.value = true
    console.log('开始上传文件:', file.name, '大小:', file.size)
    
    const fileItem = await fileStore.uploadFile({
      userid: authStore.currentUser?.userid || '',
      file: file
    })
    
    console.log('文件上传成功，返回数据:', fileItem)
    
    message.success(`${file.name} 上传成功，请在聊天框中输入"公文纠错"或"文档润色"等指令处理文档`)
    
    // 更新当前文件
    fileStore.setCurrentFile(fileItem)
    
    // 刷新文件列表
    await fileStore.fetchFileList({
      userid: authStore.currentUser?.userid || '',
      username: authStore.currentUser?.username || ''
    })
    
    // 自动加载预览
    await fetchOriginalPreview(fileItem.id)
  } catch (error) {
    console.error('上传文件失败:', error)
    message.error(`上传文件失败: ${error instanceof Error ? error.message : '未知错误'}`)
  } finally {
    loadingUpload.value = false
  }
  
  return false // 阻止默认上传行为
}

// 监听文档更新事件 - 简化核心逻辑
const handleDocumentUpdate = (event: CustomEvent) => {
  const updateTime = new Date().toISOString();
  console.log(`[${updateTime}] 收到文档更新事件:`, event.detail);
  
  if (event.detail) {
    // 设置有修改文档的状态
    if (!fileStore.hasModifiedDoc) {
      fileStore.setHasModifiedDoc(true);
      localStorage.setItem('document_processed', 'true');
      localStorage.setItem('last_processed_file_id', currentFileId.value);
      localStorage.setItem('document_processed_timestamp', Date.now().toString());
    }
    
    // 如果有blob直接使用
    if (event.detail.blob) {
      modifiedBlob.value = event.detail.blob;
      console.log(`[${updateTime}] 直接接收到处理后的Blob数据，大小:`, event.detail.blob.size);
    } else if (event.detail.fileId && file.value?.id === event.detail.fileId) {
      // 如果只有fileId，则自动获取预览
      console.log(`[${updateTime}] 收到文档处理完成通知，正在自动获取预览...`);
      autoFetchDocumentPreview(event.detail.fileId);
    }
  }
}

// 监听currentFileId变化
watch(
  () => currentFileId.value,
  async newFileId => {
    // 如果文件正在处理中，则不执行切换
    if (fileStore.isProcessing) {
      message.warning('文档处理中，请等待处理完成后再切换文件');
      return;
    }
    
    if (newFileId) {
      const startTime = new Date().toISOString();
      console.log(`[${startTime}] 当前文件ID: ${newFileId}, 文件名: ${file.value.filename}`);
      
      try {
        loadingPreview.value = true;
        
        // 使用document API切换文档
        const switchResult = await documentApi.switchDocument(newFileId);
        
        if (switchResult && switchResult.status === 'success') {
          // 更新当前文件信息
          const result = switchResult;
          fileStore.setCurrentFile({
            id: result.document_id,
            userid: fileStore.currentFile.userid, // 保留当前用户ID
            filename: result.filename,
            fileuuid: fileStore.currentFile.fileuuid || '',
            fileurl: fileStore.currentFile.fileurl || '',
            updatetime: new Date().toISOString()
          });
          
          // 获取原始文档预览
          await fetchOriginalPreview(newFileId);
          
          // 清空处理后文档显示区域
          modifiedBlob.value = null;
          
          // 重置处理后文档状态标记
          fileStore.setHasModifiedDoc(false);
          
          // 更新本地存储
          localStorage.setItem('document_processed', 'false');
          localStorage.removeItem('last_processed_file_id');
        } else {
          // 如果document/switch API失败，尝试使用原来的方法
          await fetchOriginalPreview(newFileId);
          
          // 清空修改后文档预览
          modifiedBlob.value = null;
          
          // 重置处理后文档状态标记
          fileStore.setHasModifiedDoc(false);
        }
      } catch (error) {
        console.error(`[${startTime}] 切换文件出错:`, error);
        
        // 出错时仍然尝试预览
        await fetchOriginalPreview(newFileId);
        
        // 清空修改后文档预览
        modifiedBlob.value = null;
        
        // 重置处理后文档状态标记
        fileStore.setHasModifiedDoc(false);
      } finally {
        loadingPreview.value = false;
      }
    } else {
      // 重置状态
      originalBlob.value = null;
      modifiedBlob.value = null;
      fileStore.setHasModifiedDoc(false);
    }
  },
  { immediate: true }
)

// 监听聊天内容变化，当有AI回复时自动获取预览
watch(
  () => chat.value.messages,
  (newMessages, oldMessages) => {
    // 如果有新消息，并且这是AI的回复（assistant角色）
    if (newMessages && oldMessages && newMessages.length > oldMessages.length) {
      const latestMessage = newMessages[newMessages.length - 1];
      
      // 如果是AI的回复，并且当前有文件和聊天会话
      if (latestMessage?.role === 'assistant' && file.value?.id && chat.value?.id) {
        const watchTime = new Date().toISOString();
        console.log(`[${watchTime}] 检测到AI回复，检查是否包含文档处理关键词`);
        
        // 检查消息内容是否有文档处理的关键词
        const messageContent = latestMessage.content || '';
        const hasProcessedKeywords = messageContent.includes('纠错') || 
                                     messageContent.includes('已处理') || 
                                     messageContent.includes('修改') || 
                                     messageContent.includes('文档已') ||
                                     messageContent.includes('处理完成') ||
                                     messageContent.includes('文档处理') ||
                                     messageContent.includes('调整');
        
        if (hasProcessedKeywords) {
          console.log(`[${watchTime}] 检测到文档处理相关回复，尝试获取并显示处理后文档`);
          
          // 立即设置文档已修改状态
          fileStore.setHasModifiedDoc(true);
          localStorage.setItem('document_processed', 'true');
          localStorage.setItem('last_processed_file_id', currentFileId.value);
          localStorage.setItem('document_processed_timestamp', Date.now().toString());
          
          // 先检查是否已经有处理后内容
          if (!fileStore.processedContent) {
            // 尝试从weChatbotService中获取处理后的内容
            console.log(`[${watchTime}] 尝试从API获取处理后文档内容`);
            
            // 获取最后一条消息内容
            weChatbotService.getLastProcessedDocument(chat.value.id)
              .then(content => {
                if (content && content.length > 0) {
                  console.log(`[${watchTime}] 成功获取到处理后内容，长度: ${content.length}`);
                  
                  // 更新到fileStore
                  fileStore.updateProcessedContent(content);
                  
                  // 手动触发文档更新事件
                  const updateEvent = new CustomEvent('modifiedDocumentUpdated', {
                    detail: {
                      fileId: file.value.id,
                      timestamp: Date.now()
                    }
                  });
                  document.dispatchEvent(updateEvent);
                }
              })
              .catch(err => {
                console.error(`[${watchTime}] 获取处理后内容失败:`, err);
              });
          }
          
          // 手动触发文档处理完成事件
          const event = new CustomEvent('documentProcessed', {
            detail: {
              fileId: file.value.id,
              timestamp: Date.now()
            }
          });
          document.dispatchEvent(event);
        }
        
        // 使用一系列的延迟获取，提高成功率
        const delayIntervals = [500, 1500, 3000, 5000];
        
        delayIntervals.forEach((delay, index) => {
          setTimeout(() => {
            if (!modifiedBlob.value) {
              console.log(`[${watchTime}] 延迟(${delay}ms)自动获取预览 #${index + 1}`);
              // 直接获取处理后的预览
              fetchModifiedPreview(file.value.id);
            }
          }, delay);
        });
      }
    }
  }
)

// 组件挂载和卸载
onMounted(() => {
  console.log(`[${mountTime}] FilePage组件挂载`);
  
  // 添加事件监听器
  document.addEventListener('modifiedDocumentUpdated', handleModifiedDocumentUpdated);
  document.addEventListener('documentPreviewError', handleDocumentPreviewError);
  document.addEventListener('documentProcessed', handleDocumentProcessed);
  document.addEventListener('documentPreviewReady', handleDocumentPreviewReady);
  document.addEventListener('file-changed', handleFileChanged);
  
  // 挂载时检查是否有已处理的文档需要显示
  if (file.value?.id) {
    const lastProcessedFileId = localStorage.getItem('last_processed_file_id');
    const isDocumentProcessed = localStorage.getItem('document_processed') === 'true';
    
    if (isDocumentProcessed && lastProcessedFileId === file.value.id) {
      console.log(`[${mountTime}] 检测到该文件已处理过，自动获取预览...`);
      
      // 延迟一点执行，确保组件完全挂载
      setTimeout(() => {
        autoFetchDocumentPreview(file.value.id);
      }, 300);
    }
  }
});

onUnmounted(() => {
  const unmountTime = new Date().toISOString();
  console.log(`[${unmountTime}] FilePage组件卸载，清理资源`);
  
  // 移除事件监听器
  document.removeEventListener('modifiedDocumentUpdated', handleModifiedDocumentUpdated);
  document.removeEventListener('documentPreviewError', handleDocumentPreviewError);
  document.removeEventListener('documentProcessed', handleDocumentProcessed);
  document.removeEventListener('documentPreviewReady', handleDocumentPreviewReady);
  document.removeEventListener('file-changed', handleFileChanged);
});

// 处理文件切换事件
const handleFileChanged = async (event: CustomEvent) => {
  const eventTime = new Date().toISOString();
  console.log(`[${eventTime}] 收到文件切换事件:`, event.detail);
  
  // 如果文件正在处理中，则不执行切换
  if (fileStore.isProcessing) {
    message.warning('文档处理中，请等待处理完成后再切换文件');
    return;
  }
  
  const { fileId, filename } = event.detail;
  if (!fileId) return;
  
  try {
    // 立即清空处理后文档和状态
    modifiedBlob.value = null;
    fileStore.setHasModifiedDoc(false);
    
    // 更新本地存储
    localStorage.setItem('document_processed', 'false');
    localStorage.removeItem('last_processed_file_id');
    
    // 更新界面显示为加载中
    loadingPreview.value = true;
    
    // 获取原始文档预览
    await fetchOriginalPreview(fileId);
  } catch (error) {
    console.error(`[${eventTime}] 处理文件切换事件出错:`, error);
    message.error('切换文件失败，请重试');
  } finally {
    loadingPreview.value = false;
  }
};

// 获取修改后文档预览
const fetchModifiedPreview = async (fileId: string) => {
  if (!fileId) {
    console.warn('文件ID无效，无法获取处理后预览');
    return;
  }

  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] 正在获取处理后文档预览: ${fileId}`);
  modifiedBlob.value = null; // 先清除强制刷新
  loadingModify.value = true;

  try {
    // 首先检查fileStore中是否有处理后的内容
    const processedContent = fileStore.processedContent;
    
    if (processedContent && processedContent.length > 0) {
      console.log(`[${timestamp}] 使用fileStore中的处理后内容，长度: ${processedContent.length}`);
      
      // 创建文本Blob
      const textBlob = new Blob([processedContent], { type: 'text/plain' });
      
      // 设置用于预览的blob
      await nextTick();
      modifiedBlob.value = textBlob;
      
      // 尝试转换为DOCX（更好的显示效果）
      weChatbotService.convertTextToDocx(
        processedContent,
        `processed_document_${fileId}.docx`
      ).then(docxBlob => {
        console.log(`[${timestamp}] 成功转换为DOCX，更新显示`);
        modifiedBlob.value = docxBlob;
      }).catch(err => {
        console.error(`[${timestamp}] 转换DOCX失败，保持文本显示:`, err);
      }).finally(() => {
        loadingModify.value = false;
      });
      
      // 设置文档已修改状态
      fileStore.setHasModifiedDoc(true);
      
      // 更新本地存储
      localStorage.setItem('document_processed', 'true');
      localStorage.setItem('last_processed_file_id', fileId);
      localStorage.setItem('document_processed_timestamp', Date.now().toString());
      
      message.success('处理后文档预览加载成功');
      return;
    }
    
    // 如果fileStore中没有内容，尝试从API获取
    console.log(`[${timestamp}] fileStore中没有内容，尝试从API获取`);
    const processedContent2 = await fileStore.getProcessedContent(fileId);
    
    if (processedContent2 && processedContent2.length > 0) {
      console.log(`[${timestamp}] 成功从API获取处理后内容，长度: ${processedContent2.length}`);
      
      // 将获取到的内容更新到fileStore中
      fileStore.updateProcessedContent(processedContent2);
      
      // 创建文本Blob
      const textBlob = new Blob([processedContent2], { type: 'text/plain' });
      
      // 设置用于预览的blob
      await nextTick();
      modifiedBlob.value = textBlob;
      
      // 尝试转换为DOCX
      weChatbotService.convertTextToDocx(
        processedContent2,
        `processed_document_${fileId}.docx`
      ).then(docxBlob => {
        console.log(`[${timestamp}] 成功转换为DOCX，更新显示`);
        modifiedBlob.value = docxBlob;
      }).catch(err => {
        console.error(`[${timestamp}] 转换DOCX失败，保持文本显示:`, err);
      }).finally(() => {
        loadingModify.value = false;
      });
      
      // 设置文档已修改状态
      fileStore.setHasModifiedDoc(true);
      
      // 更新本地存储
      localStorage.setItem('document_processed', 'true');
      localStorage.setItem('last_processed_file_id', fileId);
      localStorage.setItem('document_processed_timestamp', Date.now().toString());
      
      message.success('处理后文档预览加载成功');
      return;
    }
    
    // 如果上述方法都失败，使用document API获取处理后文档内容
    console.log(`[${timestamp}] 尝试通过document API获取处理后文档`);
    // 使用document API获取处理后文档内容，添加时间戳避免缓存
    const blob = await documentApi.getModifiedPreview(fileId, Date.now());
    
    if (blob && blob.size > 0) {
      console.log(`[${timestamp}] 获取到处理后文档，大小: ${blob.size}`);
      await nextTick();
      modifiedBlob.value = blob;
      
      // 设置文档已修改状态
      fileStore.setHasModifiedDoc(true);
      
      // 更新本地存储
      localStorage.setItem('document_processed', 'true');
      localStorage.setItem('last_processed_file_id', fileId);
      localStorage.setItem('document_processed_timestamp', Date.now().toString());
      
      message.success('处理后文档预览加载成功');
    } else {
      console.warn(`[${timestamp}] 获取到空的处理后文档Blob`);
      // 强制重新获取一次
      if (fileStore.hasModifiedDoc) {
        console.log(`[${timestamp}] 系统显示文档应该已处理，尝试强制重新获取...`);
        setTimeout(async () => {
          try {
            const retryBlob = await documentApi.getModifiedPreview(fileId, Date.now() + 1000);
            if (retryBlob && retryBlob.size > 0) {
              console.log(`[${timestamp}] 重试成功，获取到处理后文档`);
              modifiedBlob.value = retryBlob;
            }
          } catch (e) {
            console.error(`[${timestamp}] 重试获取处理后预览失败:`, e);
          } finally {
            loadingModify.value = false;
          }
        }, 1000);
      }
    }
  } catch (error) {
    console.error(`[${timestamp}] 获取处理后文档预览出错:`, error);
    message.warning('获取处理后文档预览失败');
    loadingModify.value = false;
  }
};
</script>
<style lang="less" scoped>
.page-container {
  margin: 20px;
  /* 使页面容器充分利用可用空间 */
  height: calc(100vh - 40px);
  max-height: calc(100vh - 40px);
  display: flex;
  flex-direction: column;
}
.card-container {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  /* 确保卡片容器占据所有可用空间 */
  flex: 1;
}
.fixed-btn-area {
  flex-shrink: 0;
  position: sticky;
  top: 0;
  background-color: white;
  z-index: 10;
  padding: 10px 0;
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
}
.upload-area {
  display: flex;
  align-items: center;
}
.upload-hint {
  margin-left: 10px;
  color: #999;
  font-size: 12px;
}
.action-buttons {
  display: flex;
  gap: 8px;
  align-items: center;
}
.file-title {
  font-size: 16px;
  font-weight: bold;
  color: #1890ff;
  margin-right: 8px;
}
.scrollable-content {
  flex: 1;
  overflow-y: auto;
  padding: 10px;
  /* 确保滚动区域有足够的空间 */
  max-height: calc(100vh - 120px);
  /* 添加更平滑的滚动效果 */
  scroll-behavior: smooth;
}
.upload-placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 300px;
  color: #999;
}
</style>
