<template>
  <div class="chat-history">
    <div class="history-header">
      <h3>历史对话 ({{ chatStore.chatListData.length }})</h3>
      <div>
        <a-button type="link" @click="refreshChatList" :loading="loadingChatList">
          <template #icon><ReloadOutlined /></template>
        </a-button>
      </div>
    </div>
    <div class="history-list">
      <a-spin :spinning="loadingChatList" tip="加载中...">
        <a-list :data-source="chatStore.chatListData" :locale="{ emptyText: ' ' }">
          <template #empty>
            <div class="empty-history">
              <a-empty description="暂无历史对话" :image="Empty.PRESENTED_IMAGE_SIMPLE" />
              <a-button type="primary" @click="refreshChatList">刷新</a-button>
            </div>
          </template>
          <template #item="{ item }">
            <a-list-item
              :class="['history-item', { active: item.id === chatStore.currentChatId }]"
              @click="selectChat(item.id)"
            >
              <div class="item-content">
                <div class="item-title">
                  <a-tooltip :title="item.title || '新对话'">
                    {{ item.title || '新对话' }}
                  </a-tooltip>
                </div>
                <div class="item-info">
                  <span class="item-time">{{ formatTime(item.createAt) }}</span>
                  <span class="item-messages-count">{{ getMessageCount(item) }}条消息</span>
                </div>
              </div>
              <template #actions>
                <a-popconfirm
                  title="确定要删除这个对话吗?"
                  ok-text="是"
                  cancel-text="否"
                  @confirm="deleteChat(item.id)"
                >
                  <a-button type="text" danger>
                    <template #icon><DeleteOutlined /></template>
                  </a-button>
                </a-popconfirm>
              </template>
            </a-list-item>
          </template>
        </a-list>
      </a-spin>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useChatStore } from '@/stores/chat'
import { useAuthStore } from '@/stores/auth'
import { DeleteOutlined, ReloadOutlined } from '@ant-design/icons-vue'
import { message, Empty, Spin as ASpin, Popconfirm as APopconfirm, Tooltip as ATooltip } from 'ant-design-vue'
import { onMounted, ref } from 'vue'
import type { ChatItem } from '@/types/ChatType'

const chatStore = useChatStore()
const authStore = useAuthStore()
const loadingChatList = ref(false)

// 格式化时间
const formatTime = (timestamp: number) => {
  if (!timestamp) return '未知时间'
  
  const now = new Date()
  const date = new Date(timestamp)
  
  // 如果是今天
  if (date.toDateString() === now.toDateString()) {
    return `今天 ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`
  }
  
  // 超过一天就显示完整日期
  return `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')}`
}

// 获取消息数量
const getMessageCount = (item: ChatItem) => {
  if (!item.messages) return 0
  return item.messages.filter(msg => msg.role === 'user' || msg.role === 'assistant').length
}

// 刷新聊天列表 - 简化版本
const refreshChatList = async () => {
  try {
    loadingChatList.value = true
    
    const currentUser = authStore.currentUser
    if (currentUser && currentUser.userid) {
      await chatStore.fetchChatList({
        userid: currentUser.userid,
        username: currentUser.username || ''
      })
      
      if (chatStore.chatListData.length > 0) {
        message.success(`已加载${chatStore.chatListData.length}条对话历史`)
      } else {
        message.info('没有历史对话记录')
      }
    } else {
      message.warning('请先登录后再刷新对话列表')
    }
  } catch (error) {
    console.error('刷新对话列表失败:', error)
    message.error('刷新对话列表失败')
  } finally {
    loadingChatList.value = false
  }
}

// 选择对话
const selectChat = (chatId: string) => {
  if (chatId === chatStore.currentChatId) {
    return
  }
  
  chatStore.setCurrentChatId(chatId)
  message.success('切换对话成功')
}

// 删除对话
const deleteChat = async (chatId: string) => {
  try {
    loadingChatList.value = true
    await chatStore.deleteChat(chatId)
    message.success('删除成功')
  } catch (error) {
    console.error('删除对话失败:', error)
    message.error('删除对话失败')
  } finally {
    loadingChatList.value = false
  }
}

// 初始化时获取对话列表
onMounted(() => {
  refreshChatList()
})
</script>

<style lang="less" scoped>
.chat-history {
  height: 100%;
  display: flex;
  flex-direction: column;
  background-color: #fff;
}

.history-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  border-bottom: 1px solid #e8e8e8;
  
  h3 {
    margin: 0;
    color: #333;
    font-size: 16px;
  }
}

.history-list {
  flex: 1;
  overflow-y: auto;
  padding: 8px;
}

.empty-history {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 20px;
  height: 200px;
}

.history-item {
  padding: 12px 16px;
  border-radius: 8px;
  margin-bottom: 8px;
  cursor: pointer;
  transition: all 0.3s;
  
  &:hover {
    background-color: #f5f5f5;
  }
  
  &.active {
    background-color: #e6f7ff;
    border-left: 3px solid #1890ff;
  }
}

.item-content {
  flex: 1;
  overflow: hidden;
}

.item-title {
  font-weight: 500;
  color: #333;
  margin-bottom: 4px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.item-info {
  display: flex;
  justify-content: space-between;
  color: #999;
  font-size: 12px;
}
</style> 