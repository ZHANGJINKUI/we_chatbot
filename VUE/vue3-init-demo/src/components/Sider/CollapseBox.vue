<template>
  <div v-if="!props.collapsed" class="collapse-container">
    <a-collapse
      v-model:activeKey="activeKeys"
      class="custom-collapse"
      @change="handleCollapseChange"
      ghost
    >
      <!-- 上传新文件 -->
      <div class="sider-btn">
        <a-upload
          v-model:file-list="uploadFileList"
          :before-upload="customUpload"
          :show-upload-list="false"
          :multiple="false"
          :max-count="1"
          accept=".doc,.docx"
          class="upload-full-width"
        >
          <a-button class="btn-css" :icon="h(CloudUploadOutlined)" :loading="loadingUpload"
            >上传新文件</a-button
          >
        </a-upload>
      </div>
      <a-collapse-panel key="1" header="文件列表" class="collapse-panel">
        <file-list />
      </a-collapse-panel>
      <!-- 开启新对话 -->
      <div class="sider-btn">
        <a-button class="btn-css" :icon="h(PlusSquareOutlined)" @click="onOpenChat"
          >开启新对话</a-button
        >
      </div>
      <a-collapse-panel key="2" header="历史对话" class="collapse-panel history-collapse-panel">
        <chat-history />
      </a-collapse-panel>
    </a-collapse>
  </div>
  <div class="icon-container" v-else>
    <a-tooltip placement="right">
      <template #title>
        <span>上传新文件</span>
      </template>
      <a-upload
        v-model:file-list="uploadFileList"
        :before-upload="customUpload"
        :show-upload-list="false"
        :multiple="false"
        :max-count="1"
        accept=".doc,.docx"
        class="upload-full-width"
      >
        <LoadingOutlined
          v-if="loadingUpload"
          :style="{ fontSize: '32px', color: '#6f9edc', marginBottom: '20px' }"
        />
        <CloudUploadOutlined
          v-else
          :style="{ fontSize: '32px', color: '#6f9edc', marginBottom: '20px', cursor: 'pointer' }"
        />
      </a-upload>
    </a-tooltip>
    <a-tooltip placement="right">
      <template #title>
        <span>开启新对话</span>
      </template>
      <PlusSquareOutlined :style="{ fontSize: '32px', color: '#6f9edc' }" @click="onOpenChat" />
    </a-tooltip>
  </div>
</template>
<script setup lang="ts">
import { ref, onMounted, nextTick, h, watch } from 'vue'
import { storeToRefs } from 'pinia'

import type { UploadProps } from 'ant-design-vue'
import { message } from 'ant-design-vue' // 引入message
import { CloudUploadOutlined, PlusSquareOutlined, LoadingOutlined } from '@ant-design/icons-vue'

import { useFileStore } from '@/stores/file'
import { useAuthStore } from '@/stores/auth'
import { useChatStore } from '@/stores/chat'

// -------------------------------------------------------
const activeKeys = ref<string[]>(['1', '2']) // 默认两个都展开

// 引入子组件
import FileList from '@/components/List/FileList.vue'
import ChatHistory from '@/components/Sider/ChatHistory.vue'

// 组件名称定义
defineOptions({
  name: 'CollapseBox'
})

// 接收父组件传值
const props = defineProps({
  collapsed: {
    type: Boolean,
    default: false
  }
})

// -------------------------------------------------------

const fileStore = useFileStore()
const authStore = useAuthStore()
const chatStore = useChatStore()

const { loadingUpload, uploadFileList } = storeToRefs(fileStore)
// 自定义上传
const customUpload: UploadProps['beforeUpload'] = async (file, _fileList) => {
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
    console.log('开始上传文件:', file.name);
    // 上传文件
    const fileItem = await fileStore.uploadFile({
      userid: authStore.currentUser?.userid || '', // 登录用户ID
      file: file
    })
    
    console.log('文件上传成功，服务器返回:', fileItem);
    message.success(`${file.name} 上传成功`)
    
    // 1. 更新当前文件ID
    fileStore.setCurrentFile(fileItem)
    
    // 2. 刷新文件列表
    await fileStore.fetchFileList({
      userid: authStore.currentUser?.userid || '',
      username: authStore.currentUser?.username || ''
    })
  } catch (error) {
    console.error('文件上传失败:', error);
    message.error(`上传失败: ${error instanceof Error ? error.message : '未知错误'}`);
  }

  return false // 返回false手动处理上传
}

// -------------------------------------------------------

// 打开新对话
const onOpenChat = async () => {
  try {
    console.log('开始创建新对话...');
    
    // 先保存当前聊天内容(如果有)
    const chat = chatStore.currentChat
    if (chat && chat.id && chat.messages && chat.messages.length > 1) {
      try {
        await chatStore.updateCurrentChat({
          ...chat
        })
        console.log('已保存当前对话到历史记录')
      } catch (updateError) {
        console.error('保存当前对话失败:', updateError)
      }
    }
    
    // 调用chatStore创建新对话
    console.log('调用 createNewChat...');
    const newChat = await chatStore.createNewChat()
    
    if (newChat) {
      console.log('新对话创建成功:', newChat);
      message.success('开启新对话成功')
      
      // 确保折叠面板打开
      ensureHistoryPanelOpen()
      
      // 主动刷新聊天列表，确保显示最新数据
      setTimeout(() => {
        // 触发全局事件，通知其他组件刷新列表
        window.dispatchEvent(new CustomEvent('new-chat-created'))
      }, 100)
    } else {
      console.error('创建新对话失败: 返回值为null');
      message.warning('创建新对话失败，请重试')
    }
  } catch (error) {
    console.error('创建新对话失败:', error)
    message.error('开启新对话失败: ' + (error instanceof Error ? error.message : String(error)))
  }
}

// 确保历史对话面板打开
const ensureHistoryPanelOpen = () => {
  if (!activeKeys.value.includes('2')) {
    activeKeys.value.push('2')
    nextTick(() => {
      adjustCollapseHeight()
      highlightHistoryPanel()
    })
  } else {
    highlightHistoryPanel()
  }
}

// 高亮历史对话面板，引起用户注意
const highlightHistoryPanel = () => {
  const panel = document.querySelector('.history-collapse-panel') as HTMLElement
  if (panel) {
    panel.classList.add('highlight-panel')
    setTimeout(() => {
      panel.classList.remove('highlight-panel')
    }, 1000)
  }
}

// 监听聊天列表变化，确保显示最新数据
watch(() => chatStore.chatListData.length, (newLen, oldLen) => {
  if (newLen > oldLen) {
    console.log('聊天列表数量增加，确保历史对话面板打开')
    ensureHistoryPanelOpen()
  }
})

// ---------------------------------------------------------------------------

const handleCollapseChange = (keys: string[]) => {
  activeKeys.value = keys
  nextTick(() => {
    adjustCollapseHeight()
  })
}

const adjustCollapseHeight = () => {
  const panel1 = document.querySelector('.collapse-panel[data-panel-key="1"]') as HTMLElement
  const panel2 = document.querySelector('.collapse-panel[data-panel-key="2"]') as HTMLElement
  const viewportHeight = window.innerHeight

  // 获取面板头部高度
  const getPanelHeaderHeight = (panel: HTMLElement) => {
    const header = panel?.querySelector('.ant-collapse-header') as HTMLElement
    return header?.offsetHeight || 0
  }

  const panel1HeaderHeight = panel1 ? getPanelHeaderHeight(panel1) : 0
  const panel2HeaderHeight = panel2 ? getPanelHeaderHeight(panel2) : 0

  // 情况1: 两个都不展开
  if (activeKeys.value.length === 0) {
    if (panel1) panel1.style.height = ''
    if (panel2) panel2.style.height = ''
    return
  }

  // 情况4: 两个都展开
  if (activeKeys.value.includes('1') && activeKeys.value.includes('2')) {
    const contentHeight = (viewportHeight - panel1HeaderHeight - panel2HeaderHeight - 70) / 2
    if (panel1) {
      const panel1Content = panel1.querySelector('.ant-collapse-content') as HTMLElement
      if (panel1Content) panel1Content.style.maxHeight = `${contentHeight}px`
    }
    if (panel2) {
      const panel2Content = panel2.querySelector('.ant-collapse-content') as HTMLElement
      if (panel2Content) panel2Content.style.maxHeight = `${contentHeight}px`
    }
    return
  }

  // 情况2: 只有面板2展开
  if (!activeKeys.value.includes('1') && activeKeys.value.includes('2')) {
    if (panel1) {
      const panel1Content = panel1.querySelector('.ant-collapse-content') as HTMLElement
      if (panel1Content) panel1Content.style.maxHeight = '0px'
    }
    if (panel2) {
      const panel2Content = panel2.querySelector('.ant-collapse-content') as HTMLElement
      if (panel2Content) panel2Content.style.maxHeight = `${viewportHeight - panel2HeaderHeight - 70}px`
    }
    return
  }

  // 情况3: 只有面板1展开
  if (activeKeys.value.includes('1') && !activeKeys.value.includes('2')) {
    if (panel1) {
      const panel1Content = panel1.querySelector('.ant-collapse-content') as HTMLElement
      if (panel1Content) panel1Content.style.maxHeight = `${viewportHeight - panel1HeaderHeight - 70}px`
    }
    if (panel2) {
      const panel2Content = panel2.querySelector('.ant-collapse-content') as HTMLElement
      if (panel2Content) panel2Content.style.maxHeight = '0px'
    }
  }
}

onMounted(() => {
  // 为每个面板添加自定义属性以便查询
  document.querySelectorAll('.collapse-panel').forEach((panel, index) => {
    panel.setAttribute('data-panel-key', (index + 1).toString())
  })

  // 确保两个面板默认都展开
  if (!activeKeys.value.includes('1')) activeKeys.value.push('1')
  if (!activeKeys.value.includes('2')) activeKeys.value.push('2')
  
  nextTick(() => {
    adjustCollapseHeight()
  })
  
  window.addEventListener('resize', adjustCollapseHeight)
})
</script>
<style lang="less" scoped>
.icon-container {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  margin: 10px;
}
.collapse-container {
  height: 100vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.custom-collapse {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
//-----------------------
.collapse-panel {
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border-bottom: 1px solid #f0f0f0;
}
.collapse-panel:last-child {
  border-bottom: none;
}
.collapse-panel :deep(.ant-collapse-content) {
  overflow: hidden;
  transition: max-height 0.2s ease-out;
}
.collapse-panel :deep(.ant-collapse-content-box) {
  height: 100%;
  padding: 0 !important;
}

// 历史对话面板的高亮效果
.history-collapse-panel {
  transition: background-color 0.5s ease;
}
.highlight-panel {
  background-color: rgba(111, 158, 220, 0.1);
}
.highlight-panel :deep(.ant-collapse-header) {
  background-color: rgba(111, 158, 220, 0.2);
}
//-----------------------
.sider-btn {
  display: flex;
  justify-content: center;
  padding: 5px;
  width: 100%;

  // background-color: aquamarine;
  .upload-full-width {
    width: 100%;
    display: block;
  }

  .upload-full-width :deep(.ant-upload) {
    width: 100%;
    display: block;
  }

  .upload-full-width :deep(.ant-upload-select) {
    width: 100%;
    display: block;
  }

  .btn-css {
    width: 100%;
    background-color: #6f9edc;
    color: #fff;
    border: none;
  }

  .btn-css:hover {
    background-color: #29509c;
  }
}
</style>
