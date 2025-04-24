import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'
import Antd from 'ant-design-vue'
import { message } from 'ant-design-vue'
import 'ant-design-vue/dist/reset.css';
// 引入全局样式
import './styles/global-style.css'

// 禁用消息提示
message.config({
  duration: 0.01, // 设置显示时间极短，实际上相当于禁用
  maxCount: 1     // 限制消息数量
})

// createApp(App).mount('#app')
const app = createApp(App)

app.use(createPinia())
app.use(router) 
app.use(Antd)

app.mount('#app')

