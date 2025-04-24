import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  },
  base: '/',
  server: {
    // 端口号
    port: 3000,
    // 监听所有地址
    host: '0.0.0.0',
    // 服务启动时是否自动打开浏览器
    open: true,
    // 允许跨域
    cors: true,
    // 自定义代理规则
    proxy: {
      // API前缀代理
      '/api': {
        target: 'http://10.102.59.4:8003',
        changeOrigin: true,
        secure: false
      },
      // 文件相关API代理
      '/file': {
        target: 'http://10.102.59.4:8003/api',
        changeOrigin: true,
        secure: false,
        rewrite: path => path.replace(/^\/file/, '')
      },
      // 聊天相关API代理
      '/chat': {
        target: 'http://10.102.59.4:8003/api',
        changeOrigin: true,
        secure: false,
        rewrite: path => path.replace(/^\/chat/, '')
      }
    }
  }
}) 