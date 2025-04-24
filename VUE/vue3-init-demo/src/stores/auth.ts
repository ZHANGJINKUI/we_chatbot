import { defineStore } from 'pinia'
import { loginCheckApi } from '@/api/auth'
import type { LoginRequest, UserInfo } from '@/types/UserType'
import { getToken, getUser, removeToken, removeUser, setToken, setUser } from '@/utils/auth'
import router from '@/router'

interface AuthState {
  user: UserInfo | null
  token: string | null | undefined
}

export const useAuthStore = defineStore('auth', {
  state: (): AuthState => ({
    user: getUser(),
    token: getToken()
  }),
  getters: {
    isAuthenticated: state => !!state.token,
    currentUser: state => state.user
  },
  actions: {
    async login(params: LoginRequest) {
      const { user, token } = await loginCheckApi(params)
      // 存储token和user
      setUser(user)
      setToken(token, 60 * 60) // 设置 xx（s）秒过期
      // 更新store状态
      this.user = getUser()
      this.token = getToken()
      console.log('==== 登录成功 =====')
    },
    logout() {
      removeToken()
      removeUser()
      this.token = null
      this.user = null
      console.log('==== 退出登录 =====')
      // 跳转到登录页面
      router.push({ name: 'Login' })
    }
  }
})
