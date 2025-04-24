<template>
    <div class="container">
        <div class="header">
            <a-menu v-model:selectedKeys="current" mode="horizontal" :items="items" @click="onMenuClik" />
        </div>
        <div class="main flex-content">
            <div v-if="showFilePage" class="file-container">
                <file-page />
            </div>
            <div v-if="showChatPage"
                :class="['chat-container', showFilePage ? 'chat-container-fixed' : 'chat-container-flex']">
                <chat-page />
            </div>
        </div>
        <!-- <div class="footer">footer</div> -->
    </div>
</template>

<script setup lang="ts">
import { reactive, ref, h } from 'vue'
import { AppstoreOutlined, FileSearchOutlined, CommentOutlined } from '@ant-design/icons-vue'
import FilePage from '@/components/Page/FilePage.vue' // 引入文件组件
import ChatPage from '@/components/Page/ChatPage.vue' // 引入对话组件
import '../styles/basic-style.less' // 引入CSS

const current = ref<string[]>(['/all'])
const items = reactive([
    {
        key: '/all',
        icon: () => h(AppstoreOutlined),
        label: '全部',
        title: '全部'
    },
    {
        key: '/filepage',
        icon: () => h(FileSearchOutlined),
        label: '仅文件',
        title: '仅文件'
    },
    {
        key: '/chatpage',
        icon: () => h(CommentOutlined),
        label: '仅对话',
        title: '仅对话'
    }
])

const showFilePage = ref(true)
const showChatPage = ref(true)

const onMenuClik = ({ item, key, keyPath }: any) => {
    console.log(key)
    switch (key) {
        case '/all':
            showFilePage.value = true
            showChatPage.value = true
            break
        case '/filepage':
            showFilePage.value = true
            showChatPage.value = false
            break
        case '/chatpage':
            showFilePage.value = false
            showChatPage.value = true
            break
    }
}
</script>

<style lang="less" scoped>
.flex-content {
    display: flex;
    height: 100%;
    //   justify-content: center;
    //   align-items: center;
}

.file-container {
    flex: 1;
    // background-color: antiquewhite;
    height: 100%;
    overflow-y: auto;
}

.chat-container {
    // flex: 1;
    // background-color: rgba(187, 241, 241, 0.792);
    height: 100%;
    overflow-y: auto;
}

.chat-container-fixed {
    width: 400px;
}

.chat-container-flex {
    flex: 1;
}
</style>
