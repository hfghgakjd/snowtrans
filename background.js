/**
 * 监听来自content script的消息
 * 处理翻译请求并返回翻译结果
 * @param {Object} request - 请求对象，包含翻译相关参数
 * @param {string} request.type - 消息类型，必须为 'TRANSLATE'
 * @param {string} request.text - 需要翻译的文本
 * @param {string} request.from - 源语言代码，如 'auto', 'en', 'zh' 等
 * @param {string} request.to - 目标语言代码
 * @param {Object} sender - 发送消息的源信息
 * @param {Function} sendResponse - 用于发送响应的回调函数
 * @returns {boolean} - 返回 true 表示将异步发送响应
 * @author Shawn Jones
 */
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === 'TRANSLATE') {
        handleTranslate(request)
            .then(result => sendResponse({ result }))
            .catch(error => sendResponse({ error: error.message }));
        return true; // 保持消息通道开启
    }
});

/**
 * 处理翻译请求
 * 使用 Google Translate API 进行文本翻译
 * @param {Object} params - 翻译参数
 * @param {string} params.text - 需要翻译的文本
 * @param {string} params.from - 源语言代码
 * @param {string} params.to - 目标语言代码
 * @returns {Promise<string>} - 返回翻译后的文本
 * @throws {Error} - 当翻译请求失败时抛出错误
 * @author Shawn Jones
 */
async function handleTranslate({ text, from, to }) {
    try {
        // 构建 Google Translate API URL
        const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${from}&tl=${to}&dt=t&q=${encodeURIComponent(text)}`;

        // 发送翻译请求
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error('Translation API request failed');
        }

        // 解析翻译结果
        const data = await response.json();
        
        // Google Translate API 返回的数据结构：
        // data[0] 是一个数组，包含所有翻译段落
        // 每个段落是一个数组：[translatedText, originalText, ...]
        const translatedText = data[0]
            .map(item => item[0])  // 提取每个段落的翻译文本
            .filter(Boolean)       // 移除空值
            .join('\n');          // 用换行符连接多个段落

        return translatedText;
    } catch (error) {
        console.error('Translation error:', error);
        throw error;
    }
}

/**
 * 创建右键菜单
 * 在浏览器安装或更新扩展时初始化
 */
chrome.runtime.onInstalled.addListener(() => {
    // 创建选中文本时的右键菜单项
    chrome.contextMenus.create({
        id: 'translateSelection',
        title: '翻译选中文本',
        contexts: ['selection'] // 仅在选中文本时显示
    });
});

/**
 * 处理右键菜单点击事件
 * @param {Object} info - 点击信息
 * @param {string} info.menuItemId - 菜单项ID
 * @param {string} info.selectionText - 选中的文本
 * @param {Object} tab - 当前标签页信息
 * @author Shawn Jones
 */
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
    if (info.menuItemId === 'translateSelection') {
        console.log('处理文本翻译..........');
        
        try {
            // 检查content script是否已注入
            let scriptInjected = false;
            try {
                await chrome.tabs.sendMessage(tab.id, { type: 'PING' });
                scriptInjected = true;
            } catch (error) {
                scriptInjected = false;
            }

            // 如果未注入，先注入脚本
            if (!scriptInjected) {
                await chrome.scripting.insertCSS({
                    target: { tabId: tab.id },
                    files: ['styles.css']
                });

                await chrome.scripting.executeScript({
                    target: { tabId: tab.id },
                    files: ['content.js']
                });
                
                // 等待脚本初始化
                await new Promise(resolve => setTimeout(resolve, 100));
            }

            // 发送翻译消息
            chrome.tabs.sendMessage(tab.id, {
                type: 'CONTEXT_TRANSLATE',
                text: info.selectionText
            });
        } catch (error) {
            console.error('Context menu translation error:', error);
        }
    }
});

/**
 * 监听键盘快捷键命令
 * @param {string} command - 快捷键命令名称
 */
chrome.commands.onCommand.addListener(async (command) => {
    if (command === 'translate-selection') {
        chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
            chrome.tabs.sendMessage(tabs[0].id, {
                type: 'TRANSLATE_COMMAND'
            });
        });
    }
    
    if (command === 'translate-page') {
        try {
            // 获取当前活动标签页
            const [tab] = await chrome.tabs.query({active: true, currentWindow: true});
            
            // 检查content script是否已注入
            let scriptInjected = false;
            try {
                await chrome.tabs.sendMessage(tab.id, { type: 'PING' });
                scriptInjected = true;
            } catch (error) {
                scriptInjected = false;
            }

            // 如果未注入，先注入脚本
            if (!scriptInjected) {
                await chrome.scripting.insertCSS({
                    target: { tabId: tab.id },
                    files: ['styles.css']
                });

                await chrome.scripting.executeScript({
                    target: { tabId: tab.id },
                    files: ['content.js']
                });
                
                // 等待脚本初始化
                await new Promise(resolve => setTimeout(resolve, 100));
            }

            // 发送页面翻译命令
            chrome.tabs.sendMessage(tab.id, {
                type: 'PAGE_TRANSLATE'
            });
        } catch (error) {
            console.error('Page translation shortcut error:', error);
        }
    }
});