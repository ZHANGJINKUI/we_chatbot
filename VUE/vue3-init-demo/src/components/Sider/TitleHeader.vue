<template>
    <div class="sider-header">
        <div class="left-logo">
            <text v-if="!props.collapsed">政务公文写作智能体</text>
            <img v-else src="../../assets/robot.png" alt="Logo" @click="toggleCollapse"/>
        </div>
        <div class="right-icon">
            <icon style="float: right" @click="toggleCollapse">
                <template #component>
                    <menu-unfold-outlined v-if="props.collapsed" />
                    <menu-fold-outlined v-else />
                </template>
            </icon>
        </div>
    </div>
</template>
<script setup lang="ts">
// 引入图标
import Icon, { MenuUnfoldOutlined, MenuFoldOutlined } from '@ant-design/icons-vue'

// 组件名称定义
defineOptions({
    name: 'TitleHeader'
})
// 接收父组件传值
const props = defineProps({
    collapsed: {
        type: Boolean,
        default: false
    }
})
// 通知父组件更新
const emit = defineEmits(['update:collapsed'])
// const emit = defineEmits<{
//     (e: 'update:collapsed', value: boolean): void
// }>()

const toggleCollapse = () => {
    emit('update:collapsed', !props.collapsed)
}

</script>
<style lang="less" scoped>
.sider-header {
    padding: 10px;
    display: flex;
    align-items: center;

    .left-logo {
        flex-grow: 1; // 左边自动撑开
        // background-color: darkgoldenrod;
        display: flex;
        justify-content: center;
        align-items: center;

        img {
            width: 28px;
            height: 28px;
            cursor: pointer;
        }

        text {
            font-size: 18px;
            // margin-left: 5px;
            font-weight: bold;
        }
    }

    .right-icon {
        width: 25px;
    }
}
</style>