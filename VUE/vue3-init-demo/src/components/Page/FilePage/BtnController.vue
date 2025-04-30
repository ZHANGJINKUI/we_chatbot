<template>
  <div class="btn-controller">
    <a-upload
      v-model:file-list="uploadFileList"
      :before-upload="customUpload"
      :show-upload-list="false"
      :multiple="false"
      :max-count="1"
      accept=".doc,.docx"
      class="btn-css"
      :disabled="isProcessing"
    >
      <a-button 
        class="btn-css-upload" 
        :icon="h(CloudUploadOutlined)" 
        :loading="loadingUpload"
        :disabled="isProcessing"
        :title="isProcessing ? '文档处理中，请等待处理完成后再上传文件' : ''"
      >上传新文件</a-button>
    </a-upload>
    <a-button
      class="btn-css btn-css-modify"
      :icon="h(CheckCircleOutlined)"
      @click="onConfirmModify"
      :loading="loadingModify"
      :disabled="disableModify || isProcessing"
      :title="isProcessing ? '文档处理中，请等待处理完成后再进行操作' : ''"
      >确认修改</a-button
    >
    <a-button
      class="btn-css btn-css-reset"
      :icon="h(RedoOutlined)"
      @click="onReset"
      :loading="loadingReset"
      :disabled="disableReset || isProcessing"
      :title="isProcessing ? '文档处理中，请等待处理完成后再进行操作' : ''"
      >重置</a-button
    >
    <a-button
      class="btn-css btn-css-download"
      :icon="h(DownloadOutlined)"
      @click="onDownload"
      :loading="loadingDownload"
      :disabled="disableDownload || isProcessing"
      :title="isProcessing ? '文档处理中，请等待处理完成后再进行操作' : ''"
      >下载</a-button
    >
  </div>
</template>
<script setup lang="ts">
import { ref, h, computed, defineEmits, defineProps } from 'vue'
import { message } from 'ant-design-vue'
import type { UploadProps } from 'ant-design-vue'
import {
  CloudUploadOutlined,
  CheckCircleOutlined,
  RedoOutlined,
  DownloadOutlined
  // SyncOutlined
} from '@ant-design/icons-vue'
import '@/styles/btn-style.less'

import { storeToRefs } from 'pinia'
import { useFileStore } from '@/stores/file'
import { useAuthStore } from '@/stores/auth'

defineOptions({
  name: 'BtnController'
})

// 定义props和事件
const props = defineProps<{
  hasModifiedDoc: boolean
}>()

const emit = defineEmits<{
  (e: 'confirm-modify'): void
  (e: 'reset'): void
}>()
// ----------------------------------------------
const authStore = useAuthStore()
const fileStore = useFileStore()
const currentFileId = computed(() => fileStore.currentFile.id)
// ----------------------------------------------
const { loadingUpload, uploadFileList, isProcessing } = storeToRefs(fileStore)
// 自定义上传
const customUpload: UploadProps['beforeUpload'] = async (file, _fileList) => {
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
    console.log('开始上传文件:', file.name);
    // 上传文件
    const fileItem = await fileStore.uploadFile({
      userid: authStore.currentUser?.userid || '', // 登录用户ID
      file: file
    })
    
    console.log('文件上传成功，服务器返回:', fileItem);
    message.success(`${file.name} 上传成功`)
    
    // 1. 更新当前文件
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
// ----------------------------------------------
const { loadingDownload } = storeToRefs(fileStore)
const disableDownload = computed(() => props.hasModifiedDoc)
// 下载
const onDownload = () => {
  if (currentFileId.value) {
    fileStore.downloadFile(currentFileId.value)
  } else {
    message.warning('请选择1个文件或者上传新文件')
  }
}
// ----------------------------------------------
const loadingModify = ref<boolean>(false)
const disableModify = computed(() => !props.hasModifiedDoc)
// 确认修改
const onConfirmModify = () => {
  loadingModify.value = true
  try {
    // 触发确认修改事件
    emit('confirm-modify')
  } finally {
    loadingModify.value = false
  }
}
// ----------------------------------------------
const loadingReset = ref<boolean>(false)
const disableReset = computed(() => !props.hasModifiedDoc)
// 重置
const onReset = () => {
  loadingReset.value = true
  try {
    // 触发重置事件
    emit('reset')
  } finally {
    loadingReset.value = false
  }
}
</script>
<style lang="less" scoped>
.btn-controller {
  display: flex;
  width: 100%;
}
</style>
