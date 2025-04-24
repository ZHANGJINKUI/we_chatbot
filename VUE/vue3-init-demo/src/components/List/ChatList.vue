<template>
  <a-spin v-if="loading" class="loading-container" />
  <div v-else>
    <a-empty v-if="chatStore.chatListData.length === 0" description="暂无数据" />
    <div v-else class="panel-content">
      <div v-for="(item, index) in chatStore.chatListData" :key="index" class="trigger">
        <span class="ellipsis" @click="onChatClick(item)">
          <MessageOutlined style="margin-right: 8px" />{{ item.title }}
        </span>
        <CloseCircleOutlined class="fade-div" @click="showConfirm(item)" />
      </div>
    </div>
  </div>
</template>
<script setup lang="ts">
import { ref, h, onMounted, computed, watch } from 'vue'
import { useChatStore } from '@/stores/chat'
import { useAuthStore } from '@/stores/auth'

import { message, Modal } from 'ant-design-vue'
import {
  MessageOutlined,
  CloseCircleOutlined,
  ExclamationCircleOutlined
} from '@ant-design/icons-vue'

defineOptions({
  name: 'ChatList'
})

const loading = ref(false)
const chatStore = useChatStore()
// 获取用户信息
const authStore = useAuthStore()

// 获取对话列表数据
const fetchChatList = async () => {
  loading.value = true
  try {
    await chatStore.fetchChatList({
      userid: authStore.currentUser?.userid || '',
      username: authStore.currentUser?.username || ''
    })
    // if (chatStore.chatListData.length === 0) {
    //   message.warning('暂无数据')
    // }
  } catch (error) {
    console.error('获取对话列表失败:', error)
  } finally {
    loading.value = false
  }
}

// 组件挂载时获取对话列表
onMounted(() => {
  fetchChatList()
})

// 打开对话
const onChatClick = (item: { id: string; title: string }) => {
  message.info(`打开对话: ${item.title}`)
  chatStore.setCurrentChatId(item.id)
}

// 删除对话
const showConfirm = (item: { id: string; title: string }) => {
  Modal.confirm({
    title: '删除提示',
    icon: h(ExclamationCircleOutlined),
    content: `确定要删除 [${item.title}] 吗？`,
    okText: '删除',
    okType: 'danger',
    cancelText: '取消',
    async onOk() {
      await chatStore.deleteChat(item.id) // 执行删除
      message.success('删除成功')
      fetchChatList() // 重新获取对话列表
    },
    onCancel() {
      message.info('已取消删除')
    }
  })
}

// 监听用户变化，重新获取对话列表
watch(
  computed(() => authStore.currentUser),
  () => {
    fetchChatList()
  },
  { deep: true }
)
</script>
<style lang="less" scoped>
.loading-container {
  padding: 20px;
  margin: 20px 0;
  width: 100%;
  // background-color: antiquewhite;
}

.panel-content {
  height: 100%;
  overflow-y: auto;
  //   padding: 16px;
  //   background-color: azure;
}

.panel-content div {
  //   border-bottom: 1px solid #f0f0f0;
  width: 100%;
  /* Takes full width of parent container */
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 5px 8px;
  margin: 2px 0;
}

.ellipsis {
  //   background-color: pink;
  white-space: nowrap;
  /* Prevents text from wrapping to a new line */
  overflow: hidden;
  /* Hides content that overflows the element */
  text-overflow: ellipsis;
  /* Shows ellipsis (...) for text that overflows */
  max-width: 100%;
  /* 关键属性2：限制最大宽度为父容器宽度 */
  display: inline-block;
  /* 关键属性1：使span可以设置宽度 */
}

.fade-div {
  opacity: 0;
  transition: opacity 0.3s ease;
  margin: 2px;
  cursor: pointer;
}

.trigger:hover .fade-div {
  opacity: 1;
  height: auto;
}

.trigger:hover {
  border-radius: 8px;
  background-color: #e0eef8;
  cursor: pointer;
}
</style>
