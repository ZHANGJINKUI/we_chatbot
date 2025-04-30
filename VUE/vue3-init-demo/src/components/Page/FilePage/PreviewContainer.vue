<template>
  <div class="docx-preview">
    <!-- loading -->
    <div v-if="loading" style="display: flex; justify-content: center; align-items: center">
      <a-spin style="font-size: 28px; margin-right: 10px" />
      <span>正在加载...</span>
    </div>
    <!-- 空状态 -->
    <a-empty v-if="(!originalBlob && !modifiedBlob) && !loading" description="暂无预览" />
    
    <div class="preview-sections">
      <!-- 原始文档 -->
      <div class="preview-section" v-if="originalBlob || loading">
        <div class="section-header">原始文档</div>
        <div v-if="loadingPreview" class="loading-container">
          <a-spin tip="加载原始文档..." />
        </div>
        <div v-else-if="originalError" class="error-container">
          <a-alert type="error" message="文档加载失败" :description="originalError" />
          <a-button 
            v-if="originalBlob" 
            @click="retryRenderOriginal" 
            class="retry-button"
            type="primary"
          >
            重试加载
          </a-button>
        </div>
        <div v-else class="docx-content-wrapper original-doc-wrapper">
          <div
            ref="originalDocContainer"
            class="docx-content"
          ></div>
        </div>
      </div>
      
      <!-- 处理后文档 -->
      <div class="preview-section" v-if="modifiedBlob || loadingModify || converting || hasModified">
        <div class="section-header">
          处理后文档
          <a-tag v-if="hasModified" color="green">已修改</a-tag>
        </div>
        <div v-if="loadingModify || converting" class="loading-container">
          <a-spin :tip="converting ? '转换文档格式中...' : '加载处理后文档...'" />
        </div>
        <div v-else-if="modifiedError" class="error-container">
          <a-alert type="error" message="处理后文档加载失败" :description="modifiedError" />
          <a-button 
            v-if="modifiedBlob" 
            @click="retryRenderModified" 
            class="retry-button"
            type="primary"
          >
            重试加载
          </a-button>
        </div>
        <div v-else class="docx-content-wrapper modified-doc-wrapper">
          <div
            ref="modifiedDocContainer"
            class="docx-content"
          ></div>
        </div>
      </div>
    </div>
  </div>
</template>
<script setup lang="ts">
import { ref, onMounted, watch, nextTick } from 'vue'
import { message } from 'ant-design-vue'
import { renderAsync } from 'docx-preview'
import type { Options } from 'docx-preview'

defineOptions({
  name: 'PreviewContainer'
})

// 接收父组件传值
const props = defineProps<{
  originalBlob: Blob | null
  modifiedBlob: Blob | null
  loadingPreview: boolean
  loadingModify: boolean
  converting: boolean
  hasModified: boolean
}>()

const originalDocContainer = ref<HTMLElement | null>(null)
const modifiedDocContainer = ref<HTMLElement | null>(null)
const originalError = ref<string | null>(null)
const modifiedError = ref<string | null>(null)
const loading = ref<boolean>(false)

// 重试渲染原始文档
const retryRenderOriginal = () => {
  originalError.value = null;
  renderOriginalDocPreview();
}

// 重试渲染修改后文档
const retryRenderModified = () => {
  modifiedError.value = null;
  renderModifiedDocPreview();
}

// 渲染文本Blob
const renderTextBlob = async (blob: Blob, container: HTMLElement) => {
  try {
    const text = await blob.text();
    renderPlainTextAsHtml(container, text);
    return true;
  } catch (error) {
    console.error('读取文本内容失败:', error);
    container.innerHTML = '<div class="error-msg">无法读取文本内容</div>';
    return false;
  }
}

// 处理纯文本内容转换为HTML
const renderPlainTextAsHtml = (container: HTMLElement, text: string) => {
  // 替换换行符为<br>并处理段落
  const htmlContent = text
    .split('\n')
    .map(line => line.trim() ? `<p>${line}</p>` : '<br>')
    .join('');
  
  container.innerHTML = `<div class="text-content">${htmlContent}</div>`;
  console.log('渲染文本内容成功，长度:', text.length);
}

// 渲染原始文档预览
const renderOriginalDocPreview = async () => {
  if (!props.originalBlob) {
    console.warn('没有原始文档数据');
    return;
  }

  try {
    console.log('开始渲染原始文档, Blob size:', props.originalBlob.size, 'Blob type:', props.originalBlob.type);
    originalError.value = null;
    
    // 确保DOM准备好
    await nextTick();
    
    // 检查容器是否存在
    if (!originalDocContainer.value) {
      console.error('原始文档预览容器不存在');
      originalError.value = '预览容器不可用，请刷新页面';
      return;
    }

    // 清空容器
    originalDocContainer.value.innerHTML = '';

    // 检查Blob是否有效
    if (!props.originalBlob || props.originalBlob.size === 0) {
      console.warn('原始文档Blob无效或为空');
      originalDocContainer.value.innerHTML = '<div class="error-msg">无法加载文档，请重新上传或刷新页面</div>';
      return;
    }

    // 如果是文本类型，直接显示文本
    if (props.originalBlob.type === 'text/plain') {
      await renderTextBlob(props.originalBlob, originalDocContainer.value);
      return;
    }

    try {
      // 创建docx blob
      const docxBlob = new Blob([props.originalBlob], {
        type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      });

      // 优化的渲染选项
      const options = {
        className: 'custom-docx-render',
        inWrapper: true,
        breakPages: true,
        ignoreFonts: true,
        ignoreHeight: false, // 不忽略高度，确保内容完整显示
        ignoreWidth: false, // 不忽略宽度，确保内容完整显示
        useBase64URL: true, // 使用base64编码图片，提高渲染速度
        trimXmlDeclaration: true, // 减少解析开销
        debug: false
      };

      // 渲染docx
      await renderAsync(docxBlob, originalDocContainer.value, undefined, options);
      console.log('原始文档渲染成功');
      
      // 优化渲染后的内容
      optimizeRenderedDocument(originalDocContainer.value);
    } catch (renderError) {
      console.error('文档渲染失败:', renderError);
      
      // 尝试作为文本渲染
      try {
        const text = await props.originalBlob.text();
        renderPlainTextAsHtml(originalDocContainer.value, text);
        console.log('作为文本渲染成功');
      } catch (textError) {
        originalError.value = '文档格式不支持或渲染失败';
        if (originalDocContainer.value) {
          originalDocContainer.value.innerHTML = '<div class="error-msg">文档格式不支持或渲染失败</div>';
        }
      }
    }
  } catch (error) {
    console.error('原始文档加载失败:', error);
    originalError.value = error?.message || '未知错误';
  }
}

// 优化渲染后的文档内容
const optimizeRenderedDocument = (container: HTMLElement) => {
  try {
    // 找到所有页面元素
    const pages = container.querySelectorAll('.docx-page');
    if (pages.length > 0) {
      // 为每个页面设置适当的宽度
      pages.forEach(page => {
        // 移除可能导致内容截断的样式
        (page as HTMLElement).style.overflow = 'visible';
        (page as HTMLElement).style.height = 'auto';
        
        // 确保页面宽度适合容器
        (page as HTMLElement).style.width = '100%';
        (page as HTMLElement).style.maxWidth = '100%';
      });
    }
    
    // 处理表格以避免溢出
    const tables = container.querySelectorAll('table');
    if (tables.length > 0) {
      tables.forEach(table => {
        (table as HTMLElement).style.maxWidth = '100%';
        (table as HTMLElement).style.width = 'auto';
        (table as HTMLElement).style.tableLayout = 'auto';
      });
    }
    
    // 处理图片以适应容器
    const images = container.querySelectorAll('img');
    if (images.length > 0) {
      images.forEach(img => {
        (img as HTMLElement).style.maxWidth = '100%';
        (img as HTMLElement).style.height = 'auto';
      });
    }
  } catch (error) {
    console.error('优化渲染后文档失败:', error);
  }
}

// 渲染修改后文档预览
const renderModifiedDocPreview = async () => {
  if (!props.modifiedBlob) {
    console.warn('没有修改后文档数据');
    return;
  }

  try {
    console.log('开始渲染修改后文档, Blob size:', props.modifiedBlob.size, 'Blob type:', props.modifiedBlob.type);
    modifiedError.value = null;
    
    // 确保DOM准备好
    await nextTick();
    
    // 检查容器是否存在
    if (!modifiedDocContainer.value) {
      console.warn('修改文档预览容器不存在，将在300ms后自动重试');
      
      // 自动重试逻辑，而不是立即显示错误
      setTimeout(async () => {
        console.log('自动重试渲染修改后文档');
        // 再次确保DOM准备好
        await nextTick();
        
        // 再次检查容器
        if (!modifiedDocContainer.value) {
          console.warn('修改文档预览容器仍不存在，将在500ms后再次重试');
          
          // 再次重试
          setTimeout(async () => {
            console.log('第二次自动重试渲染修改后文档');
            await nextTick();
            
            if (modifiedDocContainer.value) {
              console.log('预览容器已准备好，开始渲染');
              try {
                // 清空容器
                modifiedDocContainer.value.innerHTML = '';
                
                // 检查Blob是否有效
                if (!props.modifiedBlob || props.modifiedBlob.size === 0) {
                  console.warn('修改后文档Blob无效或为空');
                  modifiedDocContainer.value.innerHTML = '<div class="error-msg">无法加载处理后文档，请重试处理或刷新页面</div>';
                  return;
                }
                
                // 渲染文档
                await renderModifiedDocContent();
              } catch (retryError) {
                console.error('第二次自动重试渲染失败:', retryError);
                modifiedError.value = '预览加载失败，请刷新页面';
              }
            } else {
              console.error('经过多次尝试，预览容器仍然不存在');
              // 不设置错误状态，只是log，避免不必要的UI错误显示
              // modifiedError.value = '预览容器不可用，请刷新页面';
            }
          }, 500);
        } else {
          console.log('预览容器已准备好，开始渲染');
          try {
            // 清空容器
            modifiedDocContainer.value.innerHTML = '';
            
            // 检查Blob是否有效
            if (!props.modifiedBlob || props.modifiedBlob.size === 0) {
              console.warn('修改后文档Blob无效或为空');
              modifiedDocContainer.value.innerHTML = '<div class="error-msg">无法加载处理后文档，请重试处理或刷新页面</div>';
              return;
            }
            
            // 渲染文档
            await renderModifiedDocContent();
          } catch (retryError) {
            console.error('自动重试渲染失败:', retryError);
            modifiedError.value = '预览加载失败，请刷新页面';
          }
        }
      }, 300);
      
      return;
    }

    // 容器存在，直接渲染
    // 清空容器
    modifiedDocContainer.value.innerHTML = '';
    
    // 检查Blob是否有效
    if (!props.modifiedBlob || props.modifiedBlob.size === 0) {
      console.warn('修改后文档Blob无效或为空');
      modifiedDocContainer.value.innerHTML = '<div class="error-msg">无法加载处理后文档，请重试处理或刷新页面</div>';
      return;
    }
    
    // 渲染文档内容
    await renderModifiedDocContent();
  } catch (error) {
    console.error('修改后文档加载失败:', error);
    // 不设置错误状态，只是log，避免不必要的UI错误显示
    // modifiedError.value = error?.message || '未知错误';
  }
}

// 提取渲染修改后文档内容的逻辑
const renderModifiedDocContent = async () => {
  if (!modifiedDocContainer.value || !props.modifiedBlob) {
    console.error('渲染条件不满足: 容器或文档数据不存在');
    return;
  }

  // 如果是文本类型，直接显示文本
  if (props.modifiedBlob.type === 'text/plain') {
    await renderTextBlob(props.modifiedBlob, modifiedDocContainer.value);
    return;
  }

  try {
    // 创建docx blob
    const docxBlob = new Blob([props.modifiedBlob], {
      type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    });

    // 优化的渲染选项
    const options = {
      className: 'custom-docx-render',
      inWrapper: true,
      breakPages: true,
      ignoreFonts: true,
      ignoreHeight: false, // 不忽略高度，确保内容完整显示
      ignoreWidth: false, // 不忽略宽度，确保内容完整显示
      useBase64URL: true, // 使用base64编码图片，提高渲染速度
      trimXmlDeclaration: true, // 减少解析开销
      debug: false
    };

    // 渲染docx
    await renderAsync(docxBlob, modifiedDocContainer.value, undefined, options);
    console.log('修改后文档渲染成功');
    
    // 优化渲染后的内容
    optimizeRenderedDocument(modifiedDocContainer.value);
  } catch (renderError) {
    console.error('修改后文档渲染失败:', renderError);
    
    // 尝试作为文本渲染
    try {
      const text = await props.modifiedBlob.text();
      renderPlainTextAsHtml(modifiedDocContainer.value, text);
      console.log('作为文本渲染成功');
    } catch (textError) {
      modifiedError.value = '文档格式不支持或渲染失败';
      if (modifiedDocContainer.value) {
        modifiedDocContainer.value.innerHTML = '<div class="error-msg">文档格式不支持或渲染失败</div>';
      }
    }
  }
}

// 组件挂载后，如果已有blob数据则渲染
onMounted(async () => {
  console.log('PreviewContainer组件挂载');
  
  // 确保DOM已渲染
  await nextTick();
  
  // 初始渲染
  if (props.originalBlob) {
    renderOriginalDocPreview();
  }
  
  if (props.modifiedBlob) {
    console.log('组件挂载时检测到修改后文档数据，准备渲染');
    renderModifiedDocPreview();
    
    // 增加一个额外的延迟检查，确保即使前面的渲染失败也能再次尝试
    setTimeout(() => {
      if (modifiedError.value && props.modifiedBlob) {
        console.log('检测到渲染错误，自动重新尝试渲染修改后文档');
        modifiedError.value = null;
        renderModifiedDocPreview();
      }
    }, 800);
  }
});

// 监听blob变化，重新渲染预览
watch(
  () => props.originalBlob,
  async (newBlob) => {
    if (newBlob) {
      console.log('原始文档Blob已更新，准备重新渲染');
      await nextTick();
      renderOriginalDocPreview();
    }
  }
)

// 监听修改后的blob变化
watch(
  () => props.modifiedBlob,
  async (newBlob) => {
    if (newBlob) {
      console.log('修改后文档Blob已更新，准备重新渲染');
      modifiedError.value = null; // 清除任何之前的错误
      await nextTick();
      renderModifiedDocPreview();
      
      // 添加安全机制，确保即使上面的渲染失败，也能再次尝试
      setTimeout(async () => {
        if (modifiedError.value && props.modifiedBlob) {
          console.log('检测到渲染错误，自动重新尝试渲染');
          modifiedError.value = null;
          await nextTick();
          renderModifiedDocPreview();
        }
      }, 500);
    }
  }
)
</script>
<style lang="less" scoped>
.docx-preview {
  background: #fff;
  padding: 10px;
  border-radius: 4px;
  min-height: 200px;
  box-shadow: 0 0 0 1px #d9d9d9;
}

.preview-sections {
  display: flex;
  flex-direction: column;
  gap: 20px;
  width: 100%;
}

.preview-section {
  border: 1px solid #eee;
  border-radius: 4px;
  overflow: hidden;
  margin-bottom: 20px;
}

.section-header {
  padding: 8px 16px;
  background-color: #f5f5f5;
  font-weight: bold;
  border-bottom: 1px solid #eee;
  display: flex;
  align-items: center;
  gap: 8px;
  position: sticky;
  top: 0;
  z-index: 5;
}

.docx-content-wrapper {
  padding: 15px;
  max-height: none;
  overflow: visible;
}

.original-doc-wrapper {
  background-color: #fafafa;
}

.modified-doc-wrapper {
  background-color: #f0f8ff;
}

.loading-container {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 200px;
}

.error-container {
  padding: 20px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 15px;
}

.retry-button {
  margin-top: 10px;
}

.error-msg {
  color: #ff4d4f;
  text-align: center;
  padding: 20px;
}

.docx-content {
  width: 100%;
  min-height: 100px;
}

.text-content {
  padding: 10px;
  white-space: pre-wrap;
}

:deep(.custom-docx-render) {
  background: white;
  padding: 20px;
  box-shadow: none;
  width: 100% !important;
  max-width: 100% !important;
  height: auto !important;
  overflow: visible;
}

:deep(.docx-page) {
  margin-bottom: 20px;
  box-shadow: 0 0 0 1px #eee;
  padding: 20px;
  background: white;
  page-break-after: always;
  width: 100% !important;
  max-width: 100% !important;
  height: auto !important;
}

:deep(table) {
  max-width: 100% !important;
  width: auto !important;
}

:deep(img) {
  max-width: 100% !important;
  height: auto !important;
}

@media (max-width: 768px) {
  .docx-content-wrapper {
    padding: 10px;
  }

  :deep(.docx-page) {
    padding: 10px;
  }
}
</style>
