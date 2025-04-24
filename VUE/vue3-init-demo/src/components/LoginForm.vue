<template>
  <div class="login-form">
    <label class="title">政务文书智能辅助系统</label>
    <!-- <label class="title sub-title">政务文书智能辅助系统</label> -->
    <!-- 登录框 -->
    <a-card class="login-card">
      <a-form
        ref="formRef"
        :model="formState"
        name="login"
        @finish="onFinish"
        @finishFailed="onFinishFailed"
      >
        <!-- 用户名 -->
        <a-form-item name="userid" :rules="[{ required: true, message: '请输入工号!' }]">
          <a-input v-model:value="formState.userid" placeholder="工号" allowClear>
            <template #prefix>
              <UserOutlined class="site-form-item-icon" />
            </template>
          </a-input>
        </a-form-item>
        <!-- 密码 -->
        <a-form-item name="password" :rules="[{ required: true, message: '请输入密码!' }]">
          <a-input-password v-model:value="formState.password" placeholder="密码" allowClear>
            <template #prefix>
              <LockOutlined class="site-form-item-icon" />
            </template>
          </a-input-password>
        </a-form-item>
        <!-- 登录、重置按钮 -->
        <a-form-item>
          <div style="display: flex; justify-content: center">
            <a-button
              type="primary"
              html-type="submit"
              :loading="props.loading"
              class="btn btn-login"
              >登录</a-button
            >
            <a-button type="primary" class="btn btn-reset" @click="resetForm">重置</a-button>
          </div>
        </a-form-item>
      </a-form>
    </a-card>
  </div>
</template>

<script setup lang="ts">
import { reactive, ref } from 'vue'
import { UserOutlined, LockOutlined } from '@ant-design/icons-vue'
import type { LoginRequest } from '@/types/UserType'
import { message } from 'ant-design-vue'

// 组件名称定义 (需要 Vue 3.3+ 或 unplugin-vue-define-options 插件)
defineOptions({
  name: 'LoginForm'
})
const emit = defineEmits(['submit'])

const props = defineProps({
  loading: {
    type: Boolean,
    default: false
  }
})

const formState = reactive<LoginRequest>({
  userid: '20250011',
  password: '1234'
})

const onFinish = async (values: LoginRequest) => {
  try {
    // 等待父组件的异步操作完成
    await emit('submit', values)
  } catch (error) {
    console.error('Login error:', error)
    // 显示登录错误消息给用户
    message.error('登录失败，请检查用户名和密码或联系管理员')
  }
}

const onFinishFailed = (errorInfo: any) => {
  console.log('Failed:', errorInfo)
}

// 重置
const formRef = ref()
const resetForm = () => {
  formRef.value.resetFields()
}
</script>

<style lang="less" scoped>
.login-form {
  display: flex;
  flex-direction: column;
}

.title {
  font-size: 36px;
  text-align: center;
  margin-bottom: 20px;
}

.sub-title {
  font-size: 18px;
  margin-bottom: 30px;
}

.login-card {
  width: 400px;
  box-shadow: 0 2px 12px 0 rgba(0, 0, 0, 0.2);
  padding: 30px 50px 10px 50px;
}

.btn {
  width: 100px;
}

.btn-login {
  background-color: #6f9edc;
}

.btn-login:hover {
  background-color: #29509c;
}

.btn-reset {
  margin-left: 10px;
  border-color: #6f9edc;
  background-color: #ffffff;
  color: #6f9edc;
}

.btn-reset:hover {
  background-color: #ffffff;
  color: #29509c;
  border-color: #29509c;
}
</style>
