import { ref } from 'vue'
import { defineStore } from 'pinia'
import type { ChatListRequest, ChatItem, Message } from '@/types/ChatType'
import { fetchChatListApi, deleteChatApi, createChatApi, updateChatApi } from '@/api/chat'
import { v4 as uuidv4 } from 'uuid'
import { useAuthStore } from '@/stores/auth'
import { message } from 'ant-design-vue'

export const useChatStore = defineStore('chat', () => {
  const chatListData = ref<ChatItem[]>([])
  const loadingFetchList = ref<boolean>(false)

  // 请求聊天会话列表
  const fetchChatList = async (params: ChatListRequest) => {
    try {
      loadingFetchList.value = true
      chatListData.value = [] // 清空数据
      const data = await fetchChatListApi(params)
      if (data && data.length > 0) {
        // 按创建时间倒序排列，最新的在前面
        chatListData.value = data.sort((a, b) => {
          const timeA = a.createAt || 0
          const timeB = b.createAt || 0
          return timeB - timeA
        })
      }
    } catch (error) {
      console.error('fetchChatList失败:', error)
    } finally {
      loadingFetchList.value = false
    }
  }

  // ---------------------------------------------
  const currentChat = ref<ChatItem>({
    id: '',
    title: '',
    messages: [],
    createAt: 0
  })
  const currentChatId = ref<string>('')

  // 设置当前聊天
  const setCurrentChat = (chat: ChatItem) => {
    currentChat.value = chat
    currentChatId.value = chat.id
  }
  
  // 根据ID设置当前聊天
  const setCurrentChatId = (chatId: string) => {
    currentChatId.value = chatId
    
    // 在聊天列表中查找匹配的聊天
    const chat = chatListData.value.find(item => item.id === chatId)
    if (chat) {
      currentChat.value = chat
    }
  }

  // 创建新聊天 - 简化实现
  const createNewChat = async () => {
    try {
      const authStore = useAuthStore()
      const currentUser = authStore.currentUser
      
      if (!currentUser) {
        message.warning('未登录状态，无法创建新对话')
        return null
      }
      
      // 创建新聊天对象
      const newChat: ChatItem = {
        id: uuidv4(),
        title: '新对话',
        messages: [
          {
            role: 'system',
            id: `system-${Date.now()}`,
            createAt: Date.now(),
            content: "I'm here to assist you with any questions or tasks.",
            status: 'complete'
          }
        ],
        createAt: Date.now(),
        userid: currentUser.userid,
        username: currentUser.username || ''
      }
      
      // 先设置当前聊天
      setCurrentChat(newChat)
      
      return newChat
    } catch (error) {
      console.error('创建新对话失败:', error)
      return null
    }
  }

  // 更新当前聊天 - 简化版本，不发送到后端
  const updateCurrentChat = async (chatData: Partial<ChatItem>) => {
    if (!currentChat.value.id) {
      return
    }
    
    // 更新当前聊天
    Object.assign(currentChat.value, chatData)
  }

  // ---------------------------------------------
  // 删除聊天 - 简化版本，不发送到后端
  const deleteChat = async (chatId: string) => {
    try {
      // 从列表中移除
      chatListData.value = chatListData.value.filter(chat => chat.id !== chatId)
      
      // 如果删除的是当前选中的聊天，清空选中状态
      if (currentChat.value.id === chatId) {
        currentChat.value = {
          id: '',
          title: '',
          messages: [],
          createAt: 0
        }
        currentChatId.value = ''
      }
    } catch (error) {
      console.error('删除对话失败:', error)
    }
  }

  return {
    chatListData,
    loadingFetchList,
    fetchChatList,
    currentChat,
    currentChatId,
    setCurrentChat,
    setCurrentChatId,
    createNewChat,
    updateCurrentChat,
    deleteChat
  }
})
