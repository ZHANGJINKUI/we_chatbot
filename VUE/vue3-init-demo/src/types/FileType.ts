export interface FileListRequest {
  userid: string
  username: string
}

// 文件Item
export interface FileItem {
  id: string
  filename: string
  fileuuid: string
  fileurl: string
  updatetime: string
  userid: string
  username?: string
}

// 上传文件参数
export interface FileFormData {
  userid: string
  file: File
}

// 文件预览响应
export interface FilePreviewResponse {
  data: Blob
  status: number
  statusText: string
  headers: Record<string, string>
}

