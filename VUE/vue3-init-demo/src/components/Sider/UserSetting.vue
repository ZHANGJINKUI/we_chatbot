<template>
    <a-dropdown :trigger="['click']" placement="topRight">
        <div :class="props.collapsed ? 'sider-footer center-avatar' : 'sider-footer'">
            <a-avatar :size="userIconSize" :src="userLogoLink" />
            <span v-if="!props.collapsed" class="ml-2">{{ currentUser?.username }}</span>
        </div>
        <template #overlay>
            <a-menu>
                <!-- <a-menu-item key="profile"> <user-outlined /> 个人中心 </a-menu-item>
                <a-menu-item key="settings"> <setting-outlined /> 设置 </a-menu-item> -->
                <!-- <a-menu-divider /> -->
                <a-menu-item key="logout" @click="handleLogout">
                    <logout-outlined /> 退出登录
                </a-menu-item>
            </a-menu>
        </template>
    </a-dropdown>
</template>
<script setup lang="ts">
import { computed } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { LogoutOutlined } from '@ant-design/icons-vue'
// 引入用户图标
import userLogoLink from '@/assets/user-avatar.png'
const userIconSize = 36 // 用户头像大小

// 组件名称定义
defineOptions({
    name: 'UserSetting'
})

// 接收父组件传值
const props = defineProps({
    collapsed: {
        type: Boolean,
        default: false
    }
})
// 通知父组件更新
// const emit = defineEmits(['update:collapsed'])

// 设置底部个人信息
const authStore = useAuthStore()
const currentUser = computed(() => authStore.user)

// 退出登录
const handleLogout = () => {
    authStore.logout()
}

</script>
<style lang="less" scoped>
.sider-footer {
    margin: 5px;
    padding: 8px 20px;
    border-radius: 10px;
    display: flex;
    align-items: center;
    border: solid 1px #d2e4f0;
    // background-color: antiquewhite;

    .ml-2 {
        font-size: 14px;
        text-align: center;
        margin-left: 10px;
    }
}

.center-avatar {
    justify-content: center;
    padding: 8px;
}

.sider-footer:hover {
    background-color: #d2e4f0;
    cursor: pointer;
}
</style>