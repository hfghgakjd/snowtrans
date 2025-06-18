// popup.js
/**
 * 翻译弹窗功能实现
 * @author Shawn Jones
 */
document.addEventListener('DOMContentLoaded', function () {
    // 获取DOM元素
    const sourceText = document.getElementById('sourceText');
    const translateBtn = document.getElementById('translateBtn');
    const result = document.getElementById('result');
    const targetLang = document.getElementById('targetLang');  // 直接获取select元素

    // 自动聚焦到输入框
    sourceText.focus();

    // 绑定翻译按钮点击事件
    translateBtn.addEventListener('click', handleTranslate);

    // 绑定输入框快捷键
    sourceText.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
            handleTranslate();
        }
    });

    /**
     * 处理翻译操作
     * @returns {Promise<void>}
     */
    async function handleTranslate() {
        const text = sourceText.value.trim();
        if (!text) {
            showMessage('请输入要翻译的文本');
            return;
        }

        // 显示加载状态
        result.textContent = '翻译中...';
        translateBtn.disabled = true;

        try {
            // 发送消息给background script
            chrome.runtime.sendMessage({
                type: 'TRANSLATE',
                text: text,
                from: 'auto',
                to: targetLang.value
            }, response => {
                translateBtn.disabled = false;

                if (response.error) {
                    showMessage('翻译失败：' + response.error);
                } else {
                    result.textContent = response.result;
                    // 添加复制按钮
                    addCopyButton(response.result);
                }
            });
        } catch (error) {
            translateBtn.disabled = false;
            showMessage('翻译服务出错，请稍后重试');
        }
    }

    /**
     * 添加复制按钮
     * @param {string} text - 要复制的文本
     */
    function addCopyButton(text) {
        const copyBtn = document.createElement('button');
        copyBtn.textContent = '复制译文';
        copyBtn.className = 'copy-btn';  // 使用CSS类来设置样式

        copyBtn.addEventListener('click', async () => {
            try {
                await navigator.clipboard.writeText(text);
                showMessage('复制成功');
            } catch (err) {
                showMessage('复制失败，请手动复制');
            }
        });

        if (result.nextElementSibling?.tagName === 'BUTTON') {
            result.parentNode.removeChild(result.nextElementSibling);
        }
        result.parentNode.insertBefore(copyBtn, result.nextElementSibling);
    }

    // 显示消息提示
    function showMessage(msg) {
        result.textContent = msg;
        result.style.color = msg.includes('失败') ? '#ff4444' : '#333';
    }

    // 保存上次使用的目标语言
    targetLang.addEventListener('change', function () {
        chrome.storage.local.set({ 'lastTargetLang': this.value });
    });

    // 加载上次使用的目标语言
    chrome.storage.local.get('lastTargetLang', function (data) {
        if (data.lastTargetLang) {
            targetLang.value = data.lastTargetLang;
        }
    });

    const pageTranslateBtn = document.getElementById('pageTranslateBtn');
    pageTranslateBtn.addEventListener('click', async () => {
        try {
            // 获取当前标签页
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            
            // 检查是否已经注入了content script
            let scriptInjected = false;
            try {
                await chrome.tabs.sendMessage(tab.id, { type: 'PING' });
                scriptInjected = true;
            } catch (error) {
                // content script 未注入，需要注入
                scriptInjected = false;
            }

            // 只在需要时注入脚本
            if (!scriptInjected) {
                // 注入样式
                await chrome.scripting.insertCSS({
                    target: { tabId: tab.id },
                    files: ['styles.css']
                });

                // 注入content script
                await chrome.scripting.executeScript({
                    target: { tabId: tab.id },
                    files: ['content.js']
                });
                
                // 等待脚本初始化
                await new Promise(resolve => setTimeout(resolve, 100));
            }

            // 发送页面翻译消息
            await chrome.tabs.sendMessage(tab.id, {
                type: 'PAGE_TRANSLATE'
            });
            
            // 关闭弹窗
            window.close();
        } catch (error) {
            console.error('Translation error:', error);
            alert('页面无法翻译，请确保页面已完全加载');
        }
    });

    // 设置按钮处理
    const settingsBtn = document.getElementById('settingsBtn');
    settingsBtn.addEventListener('click', () => {
        // 创建设置菜单
        chrome.runtime.openOptionsPage();
    });
});