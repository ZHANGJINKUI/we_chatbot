<template>
  <a-spin v-if="loadingFetchList" class="loading-container" />
  <a-empty v-if="!loadingFetchList && fileListData.length === 0" description="暂无数据" />
  <div v-else class="panel-content">
    <div v-for="(item, index) in fileListData" :key="index" class="trigger">
      <span class="ellipsis" @click="onFileClick(item)">
        <FileWordOutlined style="margin-right: 8px" />{{ item.filename }}
      </span>
      <CloseCircleOutlined class="fade-div" @click="showConfirm(item)" />
    </div>
  </div>
</template>
<script setup lang="ts">
import { h, onMounted, computed, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useFileStore } from '@/stores/file'
import { useAuthStore } from '@/stores/auth'

import { message, Modal } from 'ant-design-vue'
import {
  FileWordOutlined,
  CloseCircleOutlined,
  ExclamationCircleOutlined
} from '@ant-design/icons-vue'

import type { FileItem } from '@/types/FileType'

defineOptions({
  name: 'FileList'
})

const fileStore = useFileStore()
const authStore = useAuthStore()
const { loadingFetchList, fileListData } = storeToRefs(fileStore)

// 获取文件列表数据
const fetchFileList = async () => {
  await fileStore.fetchFileList({
    userid: authStore.currentUser?.userid || '',
    username: authStore.currentUser?.username || ''
  })
}

// 组件挂载时获取文件列表
onMounted(() => {
  fetchFileList()
})

// 打开文件
const onFileClick = async (item: FileItem) => {
  try {
    message.info(`打开文件: ${item.filename}`)
    // 1. 设置当前文件
    fileStore.setCurrentFile(item)
    
    // 2. 触发全局事件，通知其他组件文件已切换
    window.dispatchEvent(new CustomEvent('file-changed', {
      detail: {
        fileId: item.id,
        filename: item.filename
      }
    }))
  } catch (error) {
    console.error('切换文件失败:', error)
    message.error('切换文件失败，请重试')
  }
}

// 删除文件
const showConfirm = (item: { id: string; filename: string }) => {
  Modal.confirm({
    title: '删除提示',
    icon: h(ExclamationCircleOutlined),
    content: `确定要删除 [${item.filename}] 吗？`,
    okText: '删除',
    okType: 'danger',
    cancelText: '取消',
    async onOk() {
      await fileStore.deleteFile(item.id) // 执行删除
      message.success('删除成功')
      fetchFileList() // 重新获取文件列表
    },
    onCancel() {
      message.info('已取消删除')
    }
  })
}

// 监听用户变化，重新获取文件列表
watch(
  computed(() => authStore.currentUser),
  () => {
    fetchFileList()
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
