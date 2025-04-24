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
        <a-button type="primary" @click="createNewChat" :loading="isCreatingNewChat">新对话</a-button>
        <div v-if="showDownloadButton" class="action-buttons">
          <a-button type="primary" @click="downloadDocument" :loading="isDownloading">下载文档</a-button>
          <a-button v-if="fileStore.processedContent" @click="previewDocument">预览文档</a-button>
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
import { ref, watch, computed, nextTick, onMounted, onUnmounted } from 'vue'
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
import { sendChatRequest, downloadProcessedDocument, healthCheck } from '@/services/weChatbotService'
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
const showDownloadButton = computed(() => fileStore.hasModifiedDoc && currentChatId.value)

// 加载状态
const isCreatingNewChat = ref(false)
const isDownloading = ref(false)
const isMessageSending = ref(false)
const connectionStatus = ref('checking') // 'checking', 'connected', 'error'
const connectionStatusMessage = computed(() => {
  switch(connectionStatus.value) {
    case 'checking': return '正在检查后端连接...';
    case 'connected': return '已连接到后端服务';
    case 'error': return '无法连接到后端服务，某些功能可能不可用';
    default: return '';
  }
})

// 添加key值用于强制刷新Chat组件
const chatUpdateKey = ref(0)

// 检查后端连接状态
const checkBackendConnection = async () => {
  // 直接将状态设为已连接，不再执行实际检查
  connectionStatus.value = 'connected';
  return true;
  
  // 以下代码已禁用
  /*
  try {
    connectionStatus.value = 'checking';
    const isHealthy = await healthCheck();
    connectionStatus.value = isHealthy ? 'connected' : 'error';
    
    if (!isHealthy) {
      message.warning('无法连接到后端服务，某些功能可能无法正常工作');
    }
  } catch (error) {
    connectionStatus.value = 'error';
    console.error('检查后端连接失败:', error);
    message.error('无法连接到后端服务');
  }
  */
};

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
  try {
    isCreatingNewChat.value = true
    
    // 创建新对话
    await chatStore.createNewChat()
    
    // 重置消息列表
    initializeChat()
    
    message.success('新对话已创建')
  } catch (error) {
    console.error('创建新对话失败:', error)
    message.error('创建新对话失败')
  } finally {
    isCreatingNewChat.value = false
  }
}

// 下载文档功能
const downloadDocument = async () => {
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
      },
      // 错误回调
      (error) => {
        console.error('对话请求错误:', error)
        // 提供更具体的错误信息给用户
        if (error.name === 'AbortError') {
          assistantMessage.content = '请求超时，请重试。'
        } else if (error.name === 'TypeError' && error.message.includes('Failed to fetch')) {
          assistantMessage.content = '网络连接异常，请检查后端服务是否正常运行。'
        } else {
          assistantMessage.content = '发送消息时出错，请重试。'
        }
        assistantMessage.status = 'error'
        // 确保响应式更新
        chats.value = [...chats.value]
        forceUpdateChat()
        message.error('发送消息失败: ' + (error.message || '未知错误'))
        nextTick(() => {
          scrollToBottom()
        })
      }
    )
    
    // 最后再次滚动到底部
    scrollToBottom()
    
    // 简单更新当前聊天，不发送到后端
    if (currentChatId.value) {
      chatStore.updateCurrentChat({
        messages: chats.value
      })
    }
  } catch (error) {
    console.error('发送消息错误:', error)
    message.error('发送消息失败，请重试')
  } finally {
    isMessageSending.value = false
  }
}

// 滚动到底部的函数
const scrollToBottom = () => {
  nextTick(() => {
    try {
      // 1. 尝试使用 semi-chat 类名查找
      const chatElement = document.querySelector('.semi-chat')
      if (chatElement) {
        chatElement.scrollTop = chatElement.scrollHeight
      }

      // 2. 尝试使用组件的内置方法
      if (chatRef.value && typeof chatRef.value.scrollToBottom === 'function') {
        chatRef.value.scrollToBottom(true)
      }

      // 3. 尝试查找消息容器的其他可能类名
      const messageContainer = document.querySelector('.semi-chat-messages')
      if (messageContainer) {
        messageContainer.scrollTop = messageContainer.scrollHeight
      }
    } catch (error) {
      console.error('滚动到底部失败:', error)
    }
  })
}

// 组件挂载时初始化和检查后端连接
onMounted(() => {
  initializeChat()
  checkBackendConnection()
  
  // 设置定期检查后端连接的计时器
  const connectionCheckInterval = setInterval(checkBackendConnection, 60000) // 每分钟检查一次
  
  // 组件卸载时清除计时器
  onUnmounted(() => {
    clearInterval(connectionCheckInterval)
  })
})

// --------------------------------------------
const previewModalVisible = ref(false)
const currentFileId = computed(() => fileStore.currentFile?.id || '')

// 强制刷新Chat组件的方法
const forceUpdateChat = () => {
  chatUpdateKey.value += 1
}
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
