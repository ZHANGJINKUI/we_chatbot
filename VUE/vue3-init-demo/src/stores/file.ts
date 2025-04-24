import { ref } from 'vue'
import { defineStore } from 'pinia'
import type { UploadProps } from 'ant-design-vue'
import type { FileListRequest, FileItem, FileFormData } from '@/types/FileType'
import {
  fetchFileListApi,
  deleteFileApi,
  uploadFileApi,
  downloadFileApi,
  previewFileApi,
  previewModifiedFileApi,
  confirmModifyApi
} from '@/api/file'
import type { ChatItem } from '@/types/ChatType'
import axios from 'axios'

// 新增文档切换结果接口
interface SwitchDocumentResult {
  status: string;
  document_id: string;
  filename: string;
  has_binary: boolean;
  has_processed: boolean;
}

export const useFileStore = defineStore('file', () => {
  const fileListData = ref<FileItem[]>([])
  const loadingFetchList = ref<boolean>(false)
  // 请求文件列表
  const fetchFileList = async (params: FileListRequest) => {
    try {
      loadingFetchList.value = true
      fileListData.value = [] // 清空数据
      const data = await fetchFileListApi(params)
      if (data && data.length > 0) fileListData.value = data
    } catch (error) {
      console.error('fetchFileListApi失败:', error)
    } finally {
      loadingFetchList.value = false
    }
  }
  // ---------------------------------------------
  const currentFile = ref<FileItem>({
    id: '',
    userid: '',
    filename: '',
    fileuuid: '',
    fileurl: '',
    updatetime: ''
  })

  // 设置当前文件
  const setCurrentFile = (file: FileItem) => {
    currentFile.value = file
  }
  // ---------------------------------------------
  // 删除文件
  const deleteFile = async (fileId: string) => {
    try {
      await deleteFileApi(fileId)
      // 如果删除的是当前选中的文件，清空选中状态
      if (currentFile.value.id === fileId) {
        currentFile.value = {
          id: '',
          userid: '',
          filename: '',
          fileuuid: '',
          fileurl: '',
          updatetime: ''
        }
      }
    } catch (error) {
      console.error('Failed to delete file:', error)
    }
  }
  // ------------------------------------------------------
  const loadingUpload = ref<boolean>(false)
  const uploadFileList = ref<UploadProps['fileList'] | undefined>([])
  // 文件上传
  const uploadFile: (params: FileFormData) => Promise<FileItem> = async (params: FileFormData) => {
    try {
      loadingUpload.value = true
      const formData = new FormData()
      formData.append('userid', params.userid)
      formData.append('file', params.file) // 单文件
      // params.file.forEach(f => { // 多文件
      //   formData.append('file', f)
      // })
      const response = await uploadFileApi(formData)
      console.log('文件上传API响应:', response)

      // 返回文件信息
      return response
    } catch (err) {
      console.error('Failed to upload file:', err)
      throw err
    } finally {
      loadingUpload.value = false
    }
  }
  // ------------------------------------------------------
  const loadingDownload = ref<boolean>(false)
  // 文件下载
  const downloadFile = async (_id: string) => {
    try {
      loadingDownload.value = true
      const response = await downloadFileApi({ id: _id })

      if (!response.data) {
        throw new Error('下载文件失败: 无效的响应数据');
      }

      const url = window.URL.createObjectURL(new Blob([response.data]))

      const filename = currentFile.value.filename
      // 生成毫秒级时间戳
      const timestamp = new Date().getTime()
      // 分割文件名和扩展名
      const lastDotIndex = filename.lastIndexOf('.')
      const name = lastDotIndex !== -1 ? filename.substring(0, lastDotIndex) : filename
      const extension = lastDotIndex !== -1 ? filename.substring(lastDotIndex) : ''
      // 组合新文件名：原文件名_时间戳.扩展名
      const newFilename = `${name}_${timestamp}${extension}`

      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', newFilename) // 设置带时间戳的文件名
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    } catch (err) {
      console.error('Failed to download file:', err)
      throw err
    } finally {
      loadingDownload.value = false
    }
  }
  // ------------------------------------------------------
  // 优化预览文件方法，确保获取到的是原始文档的二进制数据
  const previewFile = async (_id: string) => {
    try {
      loadingDownload.value = true
      // 使用previewFileApi而不是downloadFileApi
      console.log('获取文件预览, ID:', _id)
      const response = await previewFileApi(_id)

      if (response) {
        console.log('获取到文件预览数据 类型:', typeof response, response instanceof Blob ? `Blob类型: ${response.type}, 大小: ${response.size}` : '非Blob类型')
        return response // previewFileApi应该已经返回Blob
      }
      return null
    } catch (error) {
      console.error('文件预览失败:', error)
      return null
    } finally {
      loadingDownload.value = false
    }
  }

  // 修改文件预览
  const previewModifiedFile = async (file: FileItem, chat: ChatItem) => {
    try {
      console.log('预览修改文件, 文件ID:', file.id, '聊天ID:', chat.id);
      if (!file.id || !chat.id) {
        console.error('预览修改文件失败: 文件ID或聊天ID为空');
        throw new Error('文件ID或聊天ID不能为空');
      }

      // 确保传递正确的ID值
      const response = await previewModifiedFileApi({
        file: {
          id: file.id.toString(),
          filename: file.filename,
          fileuuid: file.fileuuid,
          fileurl: file.fileurl,
          updatetime: file.updatetime,
          userid: file.userid
        },
        chat: {
          id: chat.id.toString(),
          title: chat.title || '',
          messages: chat.messages || [],
          createAt: chat.createAt || 0
        }
      });

      if (!response) {
        throw new Error('预览修改文件失败: 服务器返回空响应');
      }

      console.log('修改文件预览响应获取成功', response.data ? 'blob类型:' + response.data.type : '响应格式错误');
      return response.data; // 返回blob数据
    } catch (err) {
      console.error('Failed to preview modified file:', err);
      throw err;
    }
  }
  // ------------------------------------------------------
  // 文档修改状态
  const hasModifiedDoc = ref<boolean>(false)

  // 设置文档修改状态
  const setHasModifiedDoc = (status: boolean) => {
    hasModifiedDoc.value = status
  }
  // ------------------------------------------------------
  // 确认修改
  const confirmModify = async (file: FileItem, chat: ChatItem) => {
    try {
      await confirmModifyApi({ file, chat })
      // 重置状态
      hasModifiedDoc.value = false
    } catch (err) {
      console.error('Failed to confirm modify:', err)
    }
  }
  // ------------------------------------------------------
  // 处理后的文档内容
  const processedContent = ref<string>('')

  // 更新处理后的文档内容
  const updateProcessedContent = (content: string) => {
    console.log('更新处理后的文档内容，长度:', content.length)
    processedContent.value = content
    // 设置文档已修改状态
    hasModifiedDoc.value = true
  }

  // 获取处理后的文档内容
  const getProcessedContent = async (fileId: string): Promise<string> => {
    try {
      // 直接通过file/content接口获取内容，包括原始内容和处理后内容
      const response = await axios.get(`/api/file/content?file_id=${fileId}&include_processed=true`);

      if (response.data && response.data.status === 'success') {
        // 优先使用处理后内容
        if (response.data.has_processed && response.data.processed_content) {
          console.log('获取到处理后内容，长度:', response.data.processed_content.length);
          return response.data.processed_content;
        } else {
          console.log('文档未处理，无处理后内容');
          return '';
        }
      }

      return '';
    } catch (error) {
      console.error('获取处理后内容失败:', error);
      return '';
    }
  }

  // 添加获取原始文档内容的方法
  const getOriginalContent = async (fileId: string): Promise<string> => {
    try {
      // 通过file/content接口获取原始内容
      const response = await axios.get(`/api/file/content?file_id=${fileId}&include_processed=false`);

      if (response.data && response.data.status === 'success') {
        console.log('获取到原始内容，长度:', response.data.content?.length || 0);
        return response.data.content || '';
      }

      return '';
    } catch (error) {
      console.error('获取原始内容失败:', error);
      return '';
    }
  };

  // ------------------------------------------------------
  // 添加新方法 - 切换文档
  const switchDocument = async (fileId: string): Promise<SwitchDocumentResult | null> => {
    try {
      console.log('切换文档:', fileId);

      // 调用后端API切换文档
      const response = await axios.post('/api/document/switch', { file_id: fileId });

      if (response.data && response.data.status === 'success') {
        const result = response.data;

        // 更新当前文件信息
        currentFile.value = {
          id: result.document_id,
          userid: currentFile.value.userid, // 保留当前用户ID
          filename: result.filename,
          fileuuid: currentFile.value.fileuuid || '',
          fileurl: currentFile.value.fileurl || '',
          updatetime: new Date().toISOString()
        };

        console.log('文档切换成功，文件名:', result.filename);

        // 重置处理后内容状态
        processedContent.value = '';
        setHasModifiedDoc(false);

        return result;
      }

      return null;
    } catch (error) {
      console.error('切换文档失败:', error);

      // 发生错误时也重置处理后状态
      processedContent.value = '';
      setHasModifiedDoc(false);

      return null;
    }
  };
  // ------------------------------------------------------
  return {
    fileListData,
    loadingFetchList,
    fetchFileList,
    currentFile,
    setCurrentFile,
    deleteFile,
    loadingUpload,
    uploadFile,
    uploadFileList,
    loadingDownload,
    downloadFile,
    previewFile,
    previewModifiedFile,
    hasModifiedDoc,
    setHasModifiedDoc,
    confirmModify,
    processedContent,
    updateProcessedContent,
    getProcessedContent,
    getOriginalContent,
    switchDocument
  }
})
