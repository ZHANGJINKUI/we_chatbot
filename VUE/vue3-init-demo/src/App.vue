<template>
  <router-view/>
</template>

<script setup lang="ts">
import { onMounted } from 'vue'

onMounted(() => {
  // 检查本地存储内容
  try {
    const storedChats = localStorage.getItem('vue3_chat_history')
    console.log('App启动时本地存储内容:', storedChats ? '有数据' : '无数据')
    if (storedChats) {
      const chats = JSON.parse(storedChats)
      console.log('解析后的历史对话数量:', chats.length)
      console.log('历史对话数据示例:', chats.slice(0, 2))
    }
  } catch (error) {
    console.error('读取本地存储失败:', error)
  }
})
</script>

<style>
</style>