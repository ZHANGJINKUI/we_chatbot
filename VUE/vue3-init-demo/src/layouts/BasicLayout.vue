<template>
  <a-layout>
    <!-- 左侧导航栏 -->
    <a-layout-sider
      v-model:collapsed="collapsed"
      :trigger="null"
      collapsible
      :width="siderWidth"
      :collapsedWidth="collapsedWidth"
    >
      <div v-if="!collapsed" class="container">
        <!-- 标题 + 收缩icon -->
        <title-header v-model:collapsed="collapsed" />
        <!-- 文件列表 + 历史对话-->
        <collapse-box :collapsed="collapsed" />
        <!-- 个人信息 -->
        <user-setting :collapsed="collapsed" />
      </div>
      <div v-else class="container">
        <div class="header">
          <!-- 标题 + 收缩icon -->
          <title-header v-model:collapsed="collapsed" />
        </div>
        <div class="main">
          <!-- 文件列表 + 历史对话-->
          <collapse-box :collapsed="collapsed" />
        </div>
        <div class="footer">
          <!-- 个人信息 -->
          <user-setting :collapsed="collapsed" />
        </div>
      </div>
    </a-layout-sider>
    <!-- 内容区域 -->
    <a-layout-content>
      <router-view />
    </a-layout-content>
  </a-layout>
</template>
<script setup lang="ts">
import { ref } from 'vue'
import TitleHeader from '@/components/Sider/TitleHeader.vue'
import UserSetting from '@/components/Sider/UserSetting.vue'
import CollapseBox from '@/components/Sider/CollapseBox.vue'
import '@/styles/basic-style.less' // 引入CSS样式

const collapsed = ref(false)

const siderWidth: number = 240 // 宽度
const collapsedWidth: number = 78 // 折叠宽度
</script>

<style lang="less" scoped>
/* 布局样式 */
.ant-layout-sider {
  background: #ffffff !important;
  // overflow: hidden; // 隐藏滚动条
}

.ant-layout-content {
  background: #f6f6f6 !important;
  // overflow: hidden; // 隐藏滚动条
}
</style>
