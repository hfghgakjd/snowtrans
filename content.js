/**
 * 翻译面板类
 * 负责管理页面上的翻译功能，包括划词翻译和整页翻译
 * @author Shawn Jones
 */
class TranslatePanel {
    /**
     * 初始化翻译面板
     * 设置必要的状态和事件监听
     * @author Shawn Jones
     */
    constructor() {
        // 初始化属性
        this.wrapper = null;          // 面板DOM元素
        this.isVisible = false;       // 面板显示状态
        this.currentText = '';        // 当前翻译文本
        this.position = { x: 0, y: 0 };// 面板位置

        /**
         * 翻译缓存，用于存储已翻译的文本
         * @type {Map<string, string>}
         * key: 原文+目标语言的组合
         * value: 翻译结果
         */
        this.translationCache = new Map();

        this.selectedText = '';

        /**
         * 已翻译节点集合，用于防止重复翻译
         * @type {Set<Element>}
         */
        this.translatedNodes = new Set();

        /**
         * 页面翻译状态标记
         * @type {boolean}
         */
        this.isPageTranslating = false;

        this.originalContent = null;  // 添加原始内容存储

        // 初始化
        this.init();
    }

    // 初始化方法
    init() {
        // 绑定事件处理器到this
        this.handleMouseDown = this.handleMouseDown.bind(this);
        this.handleSelectionChange = this.handleSelectionChange.bind(this);

        // 添加事件监听
        document.addEventListener('mousedown', this.handleMouseDown);
        document.addEventListener('mouseup', this.handleSelectionChange);

        // 监听来自 background 的消息
        chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
            if (request.type === 'TRANSLATE_COMMAND') {
                this.handleTranslateCommand();
            }
            if (request.type === 'PAGE_TRANSLATE') {
                this.translatePage();
            }
        });

        // 创建面板
        this.createPanel();
    }

    // 创建翻译面板
    createPanel() {
        const panel = document.createElement('div');
        panel.className = 'translate-panel';
        panel.innerHTML = `
        <div class="translate-header">
          <select class="translate-lang-select">
            <option value="zh">中文</option>
            <option value="en">英语</option>
            <option value="ja">日语</option>
            <option value="ko">韩语</option>
            <option value="fr">法语</option>
            <option value="de">德语</option>
          </select>
          <div class="translate-close">×</div>
        </div>
        <div class="translate-content">
          <div class="translate-source">
            <div class="translate-title">原文</div>
            <div class="translate-text"></div>
          </div>
          <div class="translate-result">
            <div class="translate-title">译文</div>
            <div class="translate-text"></div>
          </div>
        </div>
        <div class="translate-footer">
          <button class="translate-copy">复制译文</button>
          <button class="translate-switch">切换语言</button>
        </div>
      `;

        document.body.appendChild(panel);
        this.wrapper = panel;

        // 绑定面板事件
        this.bindPanelEvents();
    }

    // 绑定面板事件
    bindPanelEvents() {
        // 关闭按钮
        this.wrapper.querySelector('.translate-close').addEventListener('click', () => {
            this.hidePanel();
        });

        // 复制按钮
        this.wrapper.querySelector('.translate-copy').addEventListener('click', () => {
            const resultText = this.wrapper.querySelector('.translate-result .translate-text').textContent;
            navigator.clipboard.writeText(resultText);
            this.showToast('复制成功');
        });

        // 语言切换
        this.wrapper.querySelector('.translate-switch').addEventListener('click', () => {
            const select = this.wrapper.querySelector('.translate-lang-select');
            const currentText = this.wrapper.querySelector('.translate-source .translate-text').textContent;
            if (currentText) {
                this.handleTranslate(currentText, this.position);
            }
        });
    }

    // 处理鼠标选择文本事件
    handleSelectionChange(e) {
        const selection = window.getSelection();
        this.selectedText = selection.toString().trim();
        if (this.selectedText) {
            // 保存鼠标位置，用于之后显示翻译面板
            this.position = { x: e.pageX, y: e.pageY };
        }
    }

    // 处理鼠标点击事件
    handleMouseDown(e) {
        if (this.wrapper && this.isVisible && !this.wrapper.contains(e.target)) {
            this.hidePanel();
        }
    }

    // 处理翻译命令
    handleTranslateCommand() {
        if (this.selectedText) {
            this.handleTranslate(this.selectedText, this.position);
        }
    }

    // 处理翻译
    async handleTranslate(text, position) {
        if (!text) return;

        if (!this.wrapper) {
            this.createPanel();
        }

        // 设置面板位置
        const { x, y } = this.calculatePosition(position);
        this.wrapper.style.left = x + 'px';
        this.wrapper.style.top = y + 'px';

        // 显示原文
        this.wrapper.querySelector('.translate-source .translate-text').textContent = text;
        this.wrapper.querySelector('.translate-result .translate-text').textContent = '翻译中...';

        try {
            const result = await this.translate(text);
            this.wrapper.querySelector('.translate-result .translate-text').textContent = result;
            this.showPanel();
        } catch (err) {
            this.wrapper.querySelector('.translate-result .translate-text').textContent = '翻译失败，请重试';
            console.error('Translation error:', err);
        }
    }

    // 调用翻译API
    async translate(text) {
        const targetLang = this.wrapper.querySelector('.translate-lang-select').value || 'zh'; // 默认中文
        const cacheKey = `${text}_${targetLang}`;

        // 检查缓存
        if (this.translationCache.has(cacheKey)) {
            return this.translationCache.get(cacheKey);
        }

        // 发送消息给background script
        return new Promise((resolve, reject) => {
            chrome.runtime.sendMessage({
                type: 'TRANSLATE',
                text,
                from: 'auto',
                to: targetLang
            }, response => {
                if (response.error) {
                    reject(response.error);
                } else {
                    // 存入缓存
                    this.translationCache.set(cacheKey, response.result);
                    resolve(response.result);
                }
            });
        });
    }

    // 计算面板位置
    calculatePosition(position) {
        const panelWidth = 300;
        const panelHeight = 200;
        const padding = 20;
        const viewport = {
            width: window.innerWidth || document.documentElement.clientWidth,
            height: window.innerHeight || document.documentElement.clientHeight,
            scrollX: window.pageXOffset || document.documentElement.scrollLeft,
            scrollY: window.pageYOffset || document.documentElement.scrollTop
        };

        let x = position.x + padding;
        let y = position.y + padding;

        // 确保面板在视口内
        if (x + panelWidth > viewport.width + viewport.scrollX) {
            x = position.x - panelWidth - padding;
        }
        if (y + panelHeight > viewport.height + viewport.scrollY) {
            y = position.y - panelHeight - padding;
        }

        // 确保不会超出左边和上边界
        x = Math.max(viewport.scrollX + padding, x);
        y = Math.max(viewport.scrollY + padding, y);

        return { x, y };
    }

    // 显示面板
    showPanel() {
        this.wrapper.style.display = 'block';
        this.isVisible = true;
    }

    // 隐藏面板
    hidePanel() {
        this.wrapper.style.display = 'none';
        this.isVisible = false;
        this.currentText = '';
    }

    // 显示提示信息
    showToast(message) {
        const toast = document.createElement('div');
        toast.className = 'translate-toast';
        toast.textContent = message;
        document.body.appendChild(toast);

        setTimeout(() => {
            document.body.removeChild(toast);
        }, 2000);
    }

    /**
     * 处理页面翻译
     * 遍历页面中的文本节点并进行翻译
     * @returns {Promise<void>}
     * @author Shawn Jones
     */
    async translatePage() {
        // 防止重复翻译
        if (this.isPageTranslating || document.body.getAttribute('data-translated') === 'true') {
            this.showToast('页面已经翻译过了');
            return;
        }

        // 保存原始内容
        this.originalContent = {
            title: document.title,
            body: document.body.innerHTML
        };

        this.addRestoreButton();
        this.isPageTranslating = true;
        document.body.setAttribute('data-translated', 'true');

        try {
            const textNodes = this.getTextNodes(document.body);
            const batchSize = 10;
            
            for (let i = 0; i < textNodes.length; i += batchSize) {
                const batch = textNodes.slice(i, i + batchSize);
                await this.translateBatch(batch);
            }

            this.showToast('页面翻译完成');
        } catch (error) {
            console.error('Page translation error:', error);
            this.showToast('页面翻译失败');
        } finally {
            this.isPageTranslating = false;
        }
    }

    /**
     * 获取需要翻译的文本节点
     * @param {Element} element - 要搜索的根元素
     * @returns {Array<Node>} - 符合翻译条件的文本节点数组
     * @author Shawn Jones
     */
    getTextNodes(element) {
        // 创建 TreeWalker 用于遍历 DOM 树
        const walker = document.createTreeWalker(
            element,
            NodeFilter.SHOW_TEXT,
            {
                acceptNode: (node) => {
                    // 排除不需要翻译的节点：
                    // 1. script 和 style 标签中的内容
                    // 2. 已经翻译过的节点
                    // 3. 不包含英文的节点
                    if (node.parentElement.tagName === 'SCRIPT' || 
                        node.parentElement.tagName === 'STYLE' ||
                        node.parentElement.hasAttribute('data-translated') ||
                        this.translatedNodes.has(node)) {
                        return NodeFilter.FILTER_REJECT;
                    }
                    
                    // 只翻译包含英文的文本
                    const text = node.textContent.trim();
                    return /[a-zA-Z]/.test(text) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
                }
            }
        );

        const nodes = [];
        let node;
        while (node = walker.nextNode()) {
            nodes.push(node);
        }
        return nodes;
    }

    /**
     * 批量翻译文本节点
     * @param {Array<Node>} nodes - 要翻译的文本节点数组
     * @returns {Promise<void>}
     * @author Shawn Jones
     */
    async translateBatch(nodes) {
        const texts = nodes.map(node => node.textContent.trim());
        const translations = await Promise.all(
            texts.map(text => this.translate(text))
        );

        nodes.forEach((node, index) => {
            if (translations[index] && !node.parentElement.hasAttribute('data-translated')) {
                const wrapper = document.createElement('span'); // Changed from 'div'
                wrapper.setAttribute('data-translated', 'true');
                wrapper.className = 'page-translation-wrapper';
                
                const original = document.createElement('span'); // Changed from 'div'
                original.textContent = node.textContent;
                original.className = 'page-translation-original';
                
                const translated = document.createElement('span'); // Changed from 'div'
                translated.textContent = translations[index];
                translated.className = 'page-translation-result';
                
                wrapper.appendChild(original);
                wrapper.appendChild(translated);
                
                node.parentNode.replaceChild(wrapper, node);
                this.translatedNodes.add(wrapper);
            }
        });
    }

    // 添加还原按钮
    addRestoreButton() {
        const existingBtn = document.querySelector('.translate-restore-btn');
        if (existingBtn) return;

        const restoreBtn = document.createElement('button');
        restoreBtn.textContent = '还原';
        restoreBtn.className = 'translate-restore-btn';
        restoreBtn.addEventListener('click', () => this.restoreOriginalContent());
        document.body.appendChild(restoreBtn);
    }

    // 还原内容
    restoreOriginalContent() {
        if (this.originalContent) {
            document.title = this.originalContent.title;
            document.body.innerHTML = this.originalContent.body;
            this.isPageTranslating = false;
            document.body.removeAttribute('data-translated');
            this.addRestoreButton(); // 重新添加还原按钮
            this.showToast('页面已还原');
        }
    }
}

// 创建翻译面板实例
const translatePanel = new TranslatePanel();