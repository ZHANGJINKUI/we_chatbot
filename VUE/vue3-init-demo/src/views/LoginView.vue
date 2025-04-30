<template>
  <div class="login-container">
    <LoginForm @submit="toLogin" :loading="loading" />
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import LoginForm from '@/components/LoginForm.vue'
import type { LoginRequest } from '@/types/UserType'

const router = useRouter()
const authStore = useAuthStore()
const loading = ref(false) // 控制子组件登录按钮的加载状态

const toLogin = async (credentials: LoginRequest) => {
  loading.value = true
  try {
    // 返回 Promise 以便子组件可以等待操作完成
    await authStore.login(credentials)
    router.push({ name: 'Home' }) // 跳转去主页
  } catch (error) {
    console.error(error)
    throw error // 将错误传递给子组件
  } finally {
    loading.value = false
  }
}
</script>

<style lang="less" scoped>
.login-container {
  display: flex;
  justify-content: center; /* 水平居中 */
  align-items: center; /* 垂直居中 */
  width: 100%;
  height: 100vh;
}
</style>
