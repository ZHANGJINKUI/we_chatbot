import http from '@/utils/http'
import type { LoginRequest, LoginResponse } from '@/types/UserType'

/** 用户登录
 * @param userid
 * @param password
 * **/
export const loginCheckApi = (params: LoginRequest): Promise<LoginResponse> => {
  return http.post('/api/login', params)
}

// 测试接口-204token过期
// export const testYYApi = (): Promise<null> => {
//   return http.post('/yy/test')
// }
