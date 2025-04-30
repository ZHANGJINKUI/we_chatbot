<template>
  <!-- <div class="测试区域" style="background-color: antiquewhite">
    <div v-if="loading">Loading...</div>
    <div v-else>{{ chatContent }}</div>
  </div> -->
  <div class="chat-container">
    <div class="chat-header">
      <div class="header-left">
        <h2>{{ currentChat?.title || '新对话' }}</h2>
      </div>
      <div class="header-right">
        <a-button 
          type="primary" 
          @click="createNewChat" 
          :loading="isCreatingNewChat"
          :disabled="isProcessing"
          :title="isProcessing ? '文档处理中，请等待处理完成后再创建新对话' : ''"
        >新对话</a-button>
        <div v-if="showDownloadButton" class="action-buttons">
          <a-button 
            type="primary" 
            @click="downloadDocument" 
            :loading="isDownloading"
            :disabled="isProcessing"
            :title="isProcessing ? '文档处理中，请等待处理完成后再下载文档' : ''"
          >下载文档</a-button>
          <a-button 
            v-if="fileStore.processedContent" 
            @click="previewDocument"
            :disabled="isProcessing"
            :title="isProcessing ? '文档处理中，请等待处理完成后再预览文档' : ''"
          >预览文档</a-button>
        </div>
      </div>
    </div>
    <Chat
      ref="chatRef"
      :roleConfig="roleInfo"
      :chats="chats"
      :key="chatUpdateKey"
      style="margin: 0 auto"
      :uploadProps="{ disabled: true, action: '' }"
      :upload-tip-props="{ content: '已禁用' }"
      :onMessageSend="sendMessage"
      :components="{}"
    >
    </Chat>
    
    <a-modal
      v-model:visible="previewModalVisible"
      title="文档预览"
      width="800px"
      :footer="null"
    >
      <div class="document-preview">
        <pre>{{ fileStore.processedContent }}</pre>
      </div>
    </a-modal>
  </div>
</template>
<script setup lang="ts">
import { ref, watch, computed, nextTick, onMounted } from 'vue'
import { storeToRefs } from 'pinia'
import { message, Button as AButton, Tag as ATag, Modal as AModal, Alert as AAlert } from 'ant-design-vue'
import { useChatStore } from '@/stores/chat'
import { useAuthStore } from '@/stores/auth'
import { useFileStore } from '@/stores/file'
// -- 对话UI组件 -------------------------------
import { Chat } from '@kousum/semi-ui-vue'
import type { Message } from '@/types/ChatType'
// @ts-ignore - Ignore missing type declaration for openRouter
import openRouterService from '@/api/openRouter'
// 引入weChatbot服务
import { sendChatRequest, downloadProcessedDocument } from '@/services/weChatbotService'
// 引入markdown解析
import { marked } from 'marked'
import DOMPurify from 'dompurify'
// --    图标    ------------------------------
import systemLogo from '@/assets/system.png'
import assistantLogo from '@/assets/robot.png'
import userLogo from '@/assets/user-avatar.png'
// --------------------------------------------

defineOptions({
  name: 'ChatPage'
})
// --------------------------------------------
const chatStore = useChatStore()
const fileStore = useFileStore()
const currentChat = computed(() => chatStore.currentChat)
const currentChatId = computed(() => currentChat.value.id)
// 添加日志，确保下载按钮条件能正确显示
const showDownloadButton = computed(() => {
  const result = fileStore.hasModifiedDoc && currentChatId.value;
  console.log(`showDownloadButton 计算: hasModifiedDoc=${fileStore.hasModifiedDoc}, currentChatId=${currentChatId.value}, result=${result}`);
  return result;
})
const { isProcessing } = storeToRefs(fileStore)

// 加载状态
const isCreatingNewChat = ref(false)
const isDownloading = ref(false)
const isMessageSending = ref(false)

// 添加key值用于强制刷新Chat组件
const chatUpdateKey = ref(0)

// --------------------------------------------
const authStore = useAuthStore()
const currentUser = computed(() => authStore.currentUser)
const username = computed(() => currentUser.value?.username || '用户')

// 定义角色信息
const roleInfo = {
  user: {
    name: username.value, // 使用当前登录用户名
    avatar: userLogo
  },
  assistant: {
    name: '智能体',
    avatar: assistantLogo
  },
  system: {
    name: '系统消息',
    avatar: systemLogo
  }
}
// --------------------------------------------
const chatRef = ref(null)
let chats = ref<Message[]>([])

// 初始化聊天消息
const initializeChat = () => {
  chats.value = [
    {
      role: 'system',
      id: '0',
      createAt: new Date().getTime(),
      content: "您好，我是您的公文写作助手，有什么能帮助您的吗？",
      status: 'complete'
    }
  ]
}

// 创建新对话 - 简化版本
const createNewChat = async () => {
  // 如果文档正在处理中，不允许创建新对话
  if (isProcessing.value) {
    message.warning('文档处理中，请等待处理完成后再创建新对话')
    return
  }
  
  // 保存当前文档处理状态
  const hadModifiedDoc = fileStore.hasModifiedDoc;
  const processedContent = fileStore.processedContent;
  
  try {
    isCreatingNewChat.value = true
    
    // 创建新对话
    await chatStore.createNewChat()
    
    // 重置消息列表
    initializeChat()
    
    // 恢复文档处理状态（如果之前有的话）
    if (hadModifiedDoc) {
      console.log('恢复文档处理状态，确保下载按钮可见');
      fileStore.updateProcessedContent(processedContent);
      fileStore.setHasModifiedDoc(true);
    }
    
    message.success('新对话已创建')
    
    // 立即保存初始系统消息到store
    if (currentChatId.value) {
      console.log('保存初始化消息到新聊天, ID:', currentChatId.value);
      chatStore.updateCurrentChat({
        ...currentChat.value,
        messages: chats.value
      })
    }
  } catch (error) {
    console.error('创建新对话失败:', error)
    message.error('创建新对话失败')
  } finally {
    isCreatingNewChat.value = false
  }
}

// 下载文档功能
const downloadDocument = async () => {
  // 如果文档正在处理中，不允许下载
  if (isProcessing.value) {
    message.warning('文档处理中，请等待处理完成后再下载文档')
    return
  }
  
  if (!currentChatId.value || !fileStore.hasModifiedDoc) {
    message.warning('没有可下载的文档')
    return
  }
  
  try {
    isDownloading.value = true
    // 获取文档内容
    const blob = await downloadProcessedDocument(currentChatId.value)
    
    // 创建下载链接
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `processed_document_${currentChatId.value}.docx`
    document.body.appendChild(a)
    a.click()
    
    // 清理
    URL.revokeObjectURL(url)
    document.body.removeChild(a)
    
    message.success('文档下载成功')
  } catch (error) {
    console.error('下载文档失败:', error)
    message.error('下载文档失败')
  } finally {
    isDownloading.value = false
  }
}

// 预览文档
const previewDocument = () => {
  // 如果文档正在处理中，不允许预览
  if (isProcessing.value) {
    message.warning('文档处理中，请等待处理完成后再预览文档')
    return
  }
  
  if (!fileStore.processedContent) {
    message.warning('没有可预览的文档内容')
    return
  }
  
  previewModalVisible.value = true
}

// 发送消息
const sendMessage = async (msg: string) => {
  if (!msg || msg.trim() === '') {
    message.warning('请输入消息内容')
    return
  }

  try {
    isMessageSending.value = true
    console.log('开始处理用户消息:', msg.substring(0, 20) + (msg.length > 20 ? '...' : ''))
    
    // 检查是否包含文档处理关键词
    const isDocProcessingCommand = /纠错|润色|总结|优化|分析/.test(msg)
    
    // 如果是文档处理指令，设置处理状态为true
    if (isDocProcessingCommand && fileStore.currentFile.id) {
      fileStore.setProcessingStatus(true)
      console.log('检测到文档处理指令，设置处理状态为true')
    }
    
    // 如果没有当前聊天，创建一个新的
    if (!currentChatId.value) {
      await createNewChat()
    }

    // 添加用户消息
    const userMessage: Message = {
      role: 'user',
      id: `user-${Date.now()}`,
      createAt: Date.now(),
      content: msg,
      status: 'complete'
    }
    chats.value.push(userMessage)
    
    // 添加一个助手消息(加载中)
    const assistantMessage: Message = {
      role: 'assistant',
      id: `assistant-${Date.now()}`,
      createAt: Date.now(),
      content: '...',
      status: 'loading'
    }
    chats.value.push(assistantMessage)

    // 强制更新Chat组件
    forceUpdateChat()

    // 滚动到底部
    scrollToBottom()
    
    // 发送请求到后端
    await sendChatRequest(
      msg,
      chats.value.slice(0, -1), // 不包括最后一条助手消息
      // 内容更新回调
      (content: string) => {
        console.log('收到内容更新:', content.substring(0, 20) + (content.length > 20 ? '...' : ''))
        // 确保响应式更新
        assistantMessage.content = content
        // 强制重新渲染聊天列表
        chats.value = [...chats.value]
        forceUpdateChat()
        nextTick(() => {
          scrollToBottom()
        })
        
        // 保存当前聊天到store，确保聊天ID不丢失
        if (currentChatId.value) {
          console.log('更新当前聊天，保存消息记录, ID:', currentChatId.value);
          chatStore.updateCurrentChat({
            ...currentChat.value,
            messages: chats.value
          })
        }
      },
      // 完成回调
      () => {
        console.log('聊天请求完成')
        assistantMessage.status = 'complete'
        // 确保响应式更新
        chats.value = [...chats.value]
        forceUpdateChat()
        nextTick(() => {
          scrollToBottom()
        })
        
        // 保存聊天记录和ID
        if (currentChatId.value) {
          console.log('聊天请求完成，保存最终消息记录, ID:', currentChatId.value);
          chatStore.updateCurrentChat({
            ...currentChat.value,
            messages: chats.value
          })
        }
        
        // 如果是文档处理指令，在完成后设置处理状态为false
        if (isDocProcessingCommand && fileStore.currentFile.id) {
          // 延迟一点设置处理完成状态，保证文档完全处理完毕
          setTimeout(() => {
            fileStore.setProcessingStatus(false)
            console.log('文档处理完成，设置处理状态为false，检查下载按钮状态：', 
              `hasModifiedDoc=${fileStore.hasModifiedDoc}, currentChatId=${currentChatId.value}`);
          }, 1000)
        }
      },
      // 错误回调
      (error) => {
        console.error('对话请求错误:', error)
        // 提供更具体的错误信息给用户
        if (error.name === 'AbortError') {
          assistantMessage.content = '请求超时，请重试。'
        } else if (error.name === 'TypeError' && error.message.includes('Failed to fetch')) {
          assistantMessage.content = '网络连接异常，请检查后端服务是否正常运行。'
        } else if (error.response) {
          // 服务器响应错误
          assistantMessage.content = `服务器错误(${error.response.status}): ${error.response.statusText || '请检查服务器日志'}`
        } else if (error.request) {
          // 请求已发送但未收到响应
          assistantMessage.content = '后端服务未响应，请检查后端服务是否正常运行。'
        } else {
          // 其他错误情况
          assistantMessage.content = '发送消息时出错，请重试: ' + (error.message || '未知错误')
        }
        assistantMessage.status = 'error'
        // 确保响应式更新
        chats.value = [...chats.value]
        forceUpdateChat()
        message.error('发送消息失败: ' + (error.message || '未知错误'))
        nextTick(() => {
          scrollToBottom()
        })
        
        // 如果发生错误，也要重置处理状态
        if (isDocProcessingCommand && fileStore.currentFile.id) {
          fileStore.setProcessingStatus(false)
          console.log('文档处理出错，重置处理状态为false')
        }
      }
    )
    
    // 最后再次滚动到底部
    scrollToBottom()
    
    // 简单更新当前聊天，不发送到后端
    if (currentChatId.value) {
      console.log('最终保存聊天记录, ID:', currentChatId.value);
      chatStore.updateCurrentChat({
        ...currentChat.value,
        messages: chats.value
      })
    } else if (chatStore.chatListData.length > 0) {
      // 如果没有当前聊天ID但有历史聊天，尝试恢复
      const lastChat = chatStore.chatListData[0];
      console.log('尝试恢复最近的聊天作为当前聊天:', lastChat.id);
      chatStore.setCurrentChat(lastChat);
      
      // 保存消息到这个聊天
      chatStore.updateCurrentChat({
        ...lastChat,
        messages: chats.value
      });
    }
  } catch (error) {
    console.error('发送消息错误:', error)
    message.error('发送消息失败，请重试')
    
    // 确保任何错误情况下都重置处理状态
    fileStore.setProcessingStatus(false)
  } finally {
    isMessageSending.value = false
  }
}

// 组件挂载时初始化
onMounted(() => {
  // 只在没有当前聊天记录时初始化
  if (!currentChat.value || !currentChat.value.id || !currentChat.value.messages || currentChat.value.messages.length === 0) {
    console.log('没有现有聊天记录，初始化新对话');
    
    // 创建系统初始消息
    initializeChat();
    
    // 如果已经有聊天ID，保存初始化消息
    if (currentChatId.value) {
      console.log('组件挂载时保存初始消息, ID:', currentChatId.value);
      chatStore.updateCurrentChat({
        ...currentChat.value,
        messages: chats.value
      });
    }
  } else {
    console.log('恢复现有聊天记录, ID:', currentChat.value.id);
    // 恢复现有聊天记录
    chats.value = currentChat.value.messages || [];
  }
  
  // 检查文档处理状态，确保下载按钮正确显示
  console.log('组件挂载时检查处理状态：', 
    `hasModifiedDoc=${fileStore.hasModifiedDoc}, currentChatId=${currentChatId.value}`);
})

// --------------------------------------------
const previewModalVisible = ref(false)
const currentFileId = computed(() => fileStore.currentFile?.id || '')

// 强制刷新Chat组件的方法
const forceUpdateChat = () => {
  chatUpdateKey.value += 1
}

// 滚动到底部
const scrollToBottom = () => {
  if (chatRef.value) {
    nextTick(() => {
      try {
        // @ts-ignore - Ignore missing type declaration for this method
        if (chatRef.value && typeof chatRef.value.scrollToBottom === 'function') {
          chatRef.value.scrollToBottom()
        }
      } catch (error) {
        console.warn('滚动到底部失败:', error)
      }
    })
  }
}

// 监听currentChat变化，当切换对话时自动更新聊天记录
watch(
  () => currentChat.value,
  (newChat) => {
    if (newChat && newChat.id && newChat.messages && newChat.messages.length > 0) {
      console.log('检测到聊天记录变化，ID:', newChat.id, '消息数量:', newChat.messages.length)
      chats.value = newChat.messages
      forceUpdateChat()
      nextTick(() => {
        scrollToBottom()
      })
    }
  },
  { deep: true }
)

// 监听hasModifiedDoc状态变化，确保下载按钮正确显示
watch(
  () => fileStore.hasModifiedDoc,
  (newVal) => {
    console.log(`hasModifiedDoc 变化为 ${newVal}，当前 currentChatId=${currentChatId.value}`);
    // 如果文档已处理但当前没有聊天ID，尝试恢复
    if (newVal && !currentChatId.value && chatStore.chatListData.length > 0) {
      // 尝试设置最近的聊天为当前聊天
      const lastChat = chatStore.chatListData[0];
      console.log('尝试恢复聊天ID，使用最近的聊天:', lastChat.id);
      chatStore.setCurrentChat(lastChat);
    }
  }
)
</script>
<style lang="less" scoped>
.chat-container {
  padding: 5px;
  height: 100%;
  display: flex;
  flex-direction: column;
}

.chat-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
  padding: 8px 16px;
  background-color: #f9f9f9;
  border-radius: 8px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
}

.chat-status {
  margin-bottom: 10px;
}

.header-left {
  flex: 1;
  h2 {
    margin: 0;
    font-size: 18px;
    color: #333;
  }
}

.header-center {
  flex: 2;
  text-align: center;
}

.header-right {
  flex: 1;
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}

.document-status {
  display: flex;
  align-items: center;
  gap: 8px;
}

.action-buttons {
  display: flex;
  gap: 10px;
}

.document-preview {
  max-height: 500px;
  overflow-y: auto;
  border: 1px solid #e8e8e8;
  padding: 10px;
  background-color: #f9f9f9;
  
  pre {
    white-space: pre-wrap;
    word-wrap: break-word;
    margin: 0;
    font-family: 'Courier New', Courier, monospace;
  }
}
</style>
