export interface ChatListRequest {
  userid: string
  username: string
}

export interface Message {
  role: 'user' | 'assistant' | 'system'
  id: string
  createAt: number
  content: string
  status: 'loading' | 'incomplete' | 'complete' | 'error'
}

export interface ChatItem {
  id: string
  title: string
  messages: Message[]
  createAt: number
  userid?: string
  username?: string
}
