/** 用户认证工具 */
import Cookies from 'js-cookie'

// Token 键名
const TOKEN_KEY = 'auth_token'
const USER_KEY = 'auth_user'

// 获取token
export function getToken(): string | null | undefined {
  return Cookies.get(TOKEN_KEY)
}

// 设置token
export function setToken(token: string, expires: number): void {
  // expires 单位为天
  Cookies.set(TOKEN_KEY, token, { expires: expires / (24 * 60 * 60) })
}

// 移除token
export function removeToken(): void {
  Cookies.remove(TOKEN_KEY)
}

// 获取用户信息
export function getUser(): any {
  const user = localStorage.getItem(USER_KEY)
  return user ? JSON.parse(user) : null
}

// 设置用户信息
export function setUser(user: object): void {
  localStorage.setItem(USER_KEY, JSON.stringify(user))
}

// 移除用户信息
export function removeUser(): void {
  localStorage.removeItem(USER_KEY)
}
