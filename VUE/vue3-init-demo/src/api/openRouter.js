// import axios from 'axios'
import OpenAI from 'openai'

const OPENROUTER_API_KEY = import.meta.env.VITE_OPENROUTER_API_KEY
const OPENAI_MODEL = import.meta.env.VITE_OPENAI_MODEL
// const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions'

const openai = new OpenAI({
  baseURL: 'https://openrouter.ai/api/v1',
  apiKey: OPENROUTER_API_KEY,
  dangerouslyAllowBrowser: true,
  defaultHeaders: {
    'HTTP-Referer': import.meta.env.VITE_APP_URL, // Optional. Site URL for rankings on openrouter.ai.
    'X-Title': import.meta.env.VITE_APP_TITLE, // Optional. Site title for rankings on openrouter.ai.
  },
})

const openRouterService = {
  async sendMessage(messages) {
    try {
      const response = await openai.chat.completions.create({
        model: OPENAI_MODEL, // OPENAI_MODEL='deepseek/deepseek-chat-v3-0324'
        messages: messages,
        stream: true,
      })
      // console.log(response)
      // let streamResponse = ''
   
      // return streamResponse
      return response
    } catch (error) {
      console.error('OpenRouter API error:', error)
      throw error
    }
  },
}

export default openRouterService
