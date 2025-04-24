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
      // 所有API请求都通过统一前缀
      '/api': {
        // target: 'http://10.102.59.4:8003',
        target: 'http://localhost:8003',
        changeOrigin: true,
        secure: false
      },
      // 文件相关接口
      '/file': {
        // target: 'http://10.102.59.4:8003/api',
        target: 'http://localhost:8003/api',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/file/, '')
      },
      // 聊天相关接口
      '/chat': {
        // target: 'http://10.102.59.4:8003/api',
        target: 'http://localhost:8003/api',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/chat/, '')
      },
      '/stream-chat': {
        // target: 'http://10.102.59.4:8003/api',
        target: 'http://localhost:8003/api',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/stream-chat/, '')
      },
      '/health-check': {
        // target: 'http://10.102.59.4:8003/api',
        target: 'http://localhost:8003/api',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/health-check/, '')
      },
      '/download-result': {
        // target: 'http://10.102.59.4:8003/api',
        target: 'http://localhost:8003/api',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/download-result/, '')
      },
      '/convert-text-to-docx': {
        // target: 'http://10.102.59.4:8003/api',
        target: 'http://localhost:8003/api',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/convert-text-to-docx/, '')
      }
    }
  }
})
