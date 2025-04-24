import http from '@/utils/http'
import type { Result } from '@/utils/http'
import type { ChatListRequest, ChatItem } from '@/types/ChatType'

/** 获取聊天列表
 * @param ChatListRequest
 * **/
export const fetchChatListApi = (params: ChatListRequest): Promise<ChatItem[]> => {
  console.log('获取聊天列表，参数:', params)
  return http.post('/chat/list', params)
}

/** 创建聊天
 * @param ChatItem
 * **/
export const createChatApi = (params: ChatItem): Promise<ChatItem> => {
  return http.post('/chat/create', params)
}

/** 更新聊天信息
 * @param ChatItem
 * **/
export const updateChatApi = (params: ChatItem): Promise<any> => {
  return http.post('/chat/update', params)
}

/** 删除聊天
 * @param id
 * **/
export const deleteChatApi = (id: string): Promise<any> => {
  return http.post('/chat/delete', { id })
}

/** 获取聊天消息
 * @param chatId
 * **/
export const fetchChatMessagesApi = (chatId: string): Promise<any> => {
  return http.get(`/chat/messages/${chatId}`)
}

