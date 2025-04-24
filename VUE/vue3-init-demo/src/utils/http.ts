/** 封装axios **/
import axios from 'axios'
import type { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios'
import { message, Modal } from 'ant-design-vue'
import { getToken } from './auth'
import { useAuthStore } from '@/stores/auth'
import { createVNode } from 'vue'
import { ExclamationCircleOutlined } from '@ant-design/icons-vue'

// axios配置
const config = {
  // baseURL: '/server-address/', // 发布地址
  baseURL: import.meta.env.VITE_BASE_URL, // api地址
  //   withCredentials: true, // 确保发送 cookies
  timeout: 15000 // request timeout
}

// 定义返回值类型
export interface Result<T = any> {
  code: number
  msg: string
  data: T
}

// axios封装
class Http {
  // 定义一个axios的实例
  private instance: AxiosInstance

  // 构造函数：初始化
  constructor(config: AxiosRequestConfig) {
    // 创建axios实例
    this.instance = axios.create(config)
    // 配置拦截器
    this.interceptors()
  }

  // 拦截器：处理请求发送和请求返回的数据
  private interceptors() {
    // 请求发送之前的处理
    this.instance.interceptors.request.use(
      config => {
        console.log(`==== ${config.url} ====`)
        console.log(config.data ? config.data : config.params)

        // 设置Content-Type (根据Content-Type自动处理)
        if (config.data instanceof FormData) {
          config.headers!['Content-Type'] = 'multipart/form-data';
        } else {
          config.headers!['Content-Type'] = 'application/json';
        }

        // 添加token到头部
        let token = getToken()
        if (token) {
          config.headers!['Authorization'] = token
        }
        return config
      },
      error => {
        error.data = {}
        error.data.msg = '服务器异常，请联系管理员！'
        return error
      }
    )

    // 请求返回数据的处理
    this.instance.interceptors.response.use(
      (response: AxiosResponse) => {
        // 处理blob响应
        if (response.config.responseType === 'blob') {
          // 确保blob响应正确处理
          if (response.data instanceof Blob) {
            // 如果是blob类型且大小为0，可能是错误
            if (response.data.size === 0) {
              message.error('获取文件失败，文件内容为空');
              return Promise.reject(new Error('File content is empty'));
            }
            return response;
          } else {
            console.error('预期接收Blob，但收到其他类型:', response.data);
            message.error('文件响应格式错误');
            return Promise.reject(new Error('Invalid blob response'));
          }
        }
        // 处理普通JSON响应
        const { data } = response
        // 数据不解密
        const res = data
        console.log(res) // res: { code: 200, data: null, msg: '请求成功' }

        if (res.code === 200) {
          return res.data
        } else if (res.code === 204) {
          // token过期 |无效
          Modal.warning({
            title: '提示',
            icon: createVNode(ExclamationCircleOutlined),
            content: '当前用户登录已超时，请重新登录！',
            onOk() {
              // console.log('ok')
              const authStore = useAuthStore()
              authStore.logout() // 执行退出
            }
          })
        } else {
          message.error(res.msg || '服务器出错！')
          return Promise.reject(new Error(res.msg || '服务器出错！'))
        }
      },
      error => {
        console.log('进入错误')
        console.log('错误详情:', error)  // 添加更详细的错误日志

        error.data = {}
        if (error && error.response) {
          switch (error.response.status) {
            case 400:
              error.data.msg = '错误请求'
              break
            case 500:
              error.data.msg = '服务器内部错误'
              break
            case 404:
              error.data.msg = '请求未找到'
              break
            default:
              error.data.msg = `连接错误${error.response.status}`
              break
          }
          message.error(error.data.msg || '服务器连接出错！')
        } else {
          // 网络错误或其他非HTTP错误
          error.data.msg = '连接到服务器失败，请检查网络连接或联系管理员！'
          message.error(error.data.msg)
        }
        return Promise.reject(error)
      }
    )
  }

  /** RestFul api封装 **/
  // Get请求：注意这里params被解构了，后端获取参数的时候直接取字段名
  get<T = Result>(url: string, params?: object, config?: AxiosRequestConfig): Promise<T> {
    return this.instance.get(url, { params, ...config })
  }
  // Post请求
  post<T = Result>(url: string, data?: object, config?: AxiosRequestConfig): Promise<T> {
    return this.instance.post(url, data, config)
  }

  // Put请求
  put<T = Result>(url: string, data?: object): Promise<T> {
    return this.instance.put(url, data)
  }

  // DELETE请求
  delete<T = Result>(url: string): Promise<T> {
    return this.instance.delete(url)
  }
}
export default new Http(config)
