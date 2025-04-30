/**
 * 文档API相关函数
 */
import axios from 'axios';

/**
 * 获取原始文档预览
 * @param fileId 文件ID
 * @returns Promise<Blob> 文档Blob对象
 */
export const getOriginalPreview = async (fileId: string): Promise<Blob> => {
    try {
        console.log(`获取原始文档预览: ${fileId}`);
        const response = await axios.get(`/api/preview?id=${fileId}`, {
            responseType: 'blob'
        });

        return response.data;
    } catch (error) {
        console.error(`获取原始文档预览失败:`, error);
        throw error;
    }
};

/**
 * 获取处理后的文档预览
 * @param fileId 文件ID
 * @param timestamp 时间戳，用于避免缓存
 * @returns Promise<Blob> 处理后的文档Blob对象
 */
export const getModifiedPreview = async (fileId: string, timestamp: number = Date.now()): Promise<Blob> => {
    try {
        console.log(`获取处理后文档预览: ${fileId}, 时间戳: ${timestamp}`);
        const response = await axios.post('/api/preview-modified', {
            file_id: fileId,
            timestamp: timestamp // 使用传入的时间戳防止缓存
        }, {
            responseType: 'blob'
        });

        return response.data;
    } catch (error) {
        console.error(`获取处理后文档预览失败:`, error);
        throw error;
    }
};

/**
 * 切换文档
 * @param fileId 文件ID
 * @returns Promise<any> 处理结果
 */
export const switchDocument = async (fileId: string): Promise<any> => {
    try {
        console.log(`切换文档: ${fileId}`);
        const response = await axios.post('/api/document/switch', {
            file_id: fileId
        });

        return response.data;
    } catch (error) {
        console.error(`切换文档失败:`, error);
        throw error;
    }
};

/**
 * 请求处理文档
 * @param fileId 文件ID
 * @param chatId 聊天ID
 * @returns Promise<any> 处理结果
 */
export const processDocument = async (fileId: string, chatId: string): Promise<any> => {
    try {
        console.log(`处理文档: ${fileId}, 聊天ID: ${chatId}`);
        const response = await axios.post('/api/mcp/correction', {
            file_id: fileId,
            chat_id: chatId,
            timestamp: Date.now()
        });

        return response.data;
    } catch (error) {
        console.error(`处理文档失败:`, error);
        throw error;
    }
}; 