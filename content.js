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

        /**
         * 悬浮翻译提示容器
         * @type {HTMLElement}
         */
        this.hoverContainer = null;

        /**
         * 当前悬浮的翻译提示
         * @type {HTMLElement}
         */
        this.currentHoverTip = null;

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
     * 为页面中的文本节点添加悬浮翻译功能
     * @returns {Promise<void>}
     * @author Shawn Jones
     */
    async translatePage() {
        // 防止重复翻译
        if (this.isPageTranslating || document.body.getAttribute('data-translated') === 'true') {
            this.showToast('页面已经翻译过了');
            return;
        }

        this.isPageTranslating = true;
        document.body.setAttribute('data-translated', 'true');

        // 创建悬浮翻译容器
        this.createHoverContainer();
        this.addRestoreButton();

        try {
            const textNodes = this.getTextNodes(document.body);
            const batchSize = 15;
            
            for (let i = 0; i < textNodes.length; i += batchSize) {
                const batch = textNodes.slice(i, i + batchSize);
                await this.translateBatch(batch);
                
                // 添加小延迟避免阻塞UI
                if (i + batchSize < textNodes.length) {
                    await new Promise(resolve => setTimeout(resolve, 100));
                }
            }

            this.showToast('页面翻译完成，鼠标悬停查看翻译');
        } catch (error) {
            console.error('Page translation error:', error);
            this.showToast('页面翻译失败');
        } finally {
            this.isPageTranslating = false;
        }
    }

    /**
     * 创建悬浮翻译容器
     */
    createHoverContainer() {
        if (this.hoverContainer) return;

        this.hoverContainer = document.createElement('div');
        this.hoverContainer.className = 'translate-hover-container';
        document.body.appendChild(this.hoverContainer);
    }

    /**
     * 获取需要翻译的文本节点
     * @param {Element} element - 要搜索的根元素
     * @returns {Array<Node>} - 符合翻译条件的文本节点数组
     * @author Shawn Jones
     */
    getTextNodes(element) {
        const walker = document.createTreeWalker(
            element,
            NodeFilter.SHOW_TEXT,
            {
                acceptNode: (node) => {
                    // 排除不需要翻译的节点
                    const parentTag = node.parentElement.tagName;
                    if (['SCRIPT', 'STYLE', 'CODE', 'PRE'].includes(parentTag) ||
                        node.parentElement.hasAttribute('data-translated') ||
                        node.parentElement.classList.contains('translate-panel') ||
                        node.parentElement.classList.contains('translate-hover-container') ||
                        this.translatedNodes.has(node.parentElement)) {
                        return NodeFilter.FILTER_REJECT;
                    }
                    
                    // 只翻译包含英文且长度适中的文本
                    const text = node.textContent.trim();
                    return /[a-zA-Z]/.test(text) && text.length > 3 && text.length < 500 
                        ? NodeFilter.FILTER_ACCEPT 
                        : NodeFilter.FILTER_REJECT;
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
        const validNodes = nodes.filter(node => 
            node.parentElement && !this.translatedNodes.has(node.parentElement)
        );

        for (const node of validNodes) {
            try {
                const text = node.textContent.trim();
                if (!text || text.length < 3) continue;

                const translation = await this.translate(text);
                if (translation && translation !== text) {
                    this.addHoverTranslation(node.parentElement, text, translation);
                    this.translatedNodes.add(node.parentElement);
                }
            } catch (error) {
                console.warn('Translation failed for node:', error);
            }
        }
    }

    /**
     * 为元素添加悬浮翻译功能
     * @param {Element} element - 目标元素
     * @param {string} originalText - 原文
     * @param {string} translation - 翻译结果
     */
    addHoverTranslation(element, originalText, translation) {
        // 标记元素
        element.setAttribute('data-translatable', 'true');
        element.setAttribute('data-original', originalText);
        element.setAttribute('data-translation', translation);
        
        // 添加悬浮样式
        element.classList.add('translatable-text');

        // 使用变量存储事件处理器，避免重复绑定
        const showHandler = (e) => {
            e.stopPropagation();
            // 清除可能存在的隐藏延迟
            if (element._hideTimeout) {
                clearTimeout(element._hideTimeout);
                element._hideTimeout = null;
            }
            this.showHoverTip(e.currentTarget, translation);
        };

        const hideHandler = (e) => {
            e.stopPropagation();
            // 使用元素级别的延迟控制，避免全局冲突
            element._hideTimeout = setTimeout(() => {
                // 检查鼠标是否真的离开了所有翻译元素
                const hoveredElement = document.elementFromPoint(e.clientX, e.clientY);
                if (!hoveredElement || !hoveredElement.closest('.translatable-text')) {
                    this.hideHoverTip();
                }
                element._hideTimeout = null;
            }, 150);
        };

        // 移除旧的事件监听器（如果存在）
        element.removeEventListener('mouseenter', element._showHandler);
        element.removeEventListener('mouseleave', element._hideHandler);

        // 添加新的事件监听器
        element.addEventListener('mouseenter', showHandler);
        element.addEventListener('mouseleave', hideHandler);

        // 存储事件处理器引用，便于后续移除
        element._showHandler = showHandler;
        element._hideHandler = hideHandler;
    }

    /**
     * 显示悬浮翻译提示
     * @param {Element} element - 触发元素
     * @param {string} translation - 翻译文本
     */
    showHoverTip(element, translation) {
        // 如果当前已有相同内容的提示，不重复创建
        if (this.currentHoverTip && 
            this.currentHoverTip.querySelector('.translate-hover-content').textContent === translation) {
            return;
        }

        // 清除所有延迟隐藏的定时器
        this.clearAllHideTimeouts();

        this.hideHoverTip(); // 先隐藏之前的提示

        const tip = document.createElement('div');
        tip.className = 'translate-hover-tip';
        tip.innerHTML = `
            <div class="translate-hover-content">${translation}</div>
            <div class="translate-hover-arrow"></div>
        `;

        // 临时添加到容器中以获取尺寸
        this.hoverContainer.appendChild(tip);
        this.currentHoverTip = tip;

        // 强制重排以获取正确的尺寸
        tip.offsetHeight;

        // 计算位置
        const rect = element.getBoundingClientRect();
        const tipRect = tip.getBoundingClientRect();
        
        let left = rect.left + (rect.width - tipRect.width) / 2;
        let top = rect.top - tipRect.height - 12;

        // 边界检测
        const viewport = {
            width: window.innerWidth,
            height: window.innerHeight
        };

        // 水平边界检测
        if (left < 8) {
            left = 8;
        } else if (left + tipRect.width > viewport.width - 8) {
            left = viewport.width - tipRect.width - 8;
        }

        // 垂直边界检测 - 如果上方空间不够，显示在下方
        if (top < 8) {
            top = rect.bottom + 12;
            tip.classList.add('translate-hover-tip-bottom');
        }

        // 设置最终位置
        tip.style.left = left + window.pageXOffset + 'px';
        tip.style.top = top + window.pageYOffset + 'px';

        // 立即显示，不使用 requestAnimationFrame 延迟
        tip.classList.add('translate-hover-tip-visible');
    }

    /**
     * 隐藏悬浮翻译提示
     */
    hideHoverTip() {
        if (this.currentHoverTip) {
            const tip = this.currentHoverTip;
            tip.classList.remove('translate-hover-tip-visible');
            
            // 使用更短的延迟时间
            setTimeout(() => {
                if (tip && tip.parentNode) {
                    tip.parentNode.removeChild(tip);
                }
                if (this.currentHoverTip === tip) {
                    this.currentHoverTip = null;
                }
            }, 100);
        }
    }

    /**
     * 清除所有元素的隐藏延迟定时器
     */
    clearAllHideTimeouts() {
        const translatableElements = document.querySelectorAll('[data-translatable="true"]');
        translatableElements.forEach(element => {
            if (element._hideTimeout) {
                clearTimeout(element._hideTimeout);
                element._hideTimeout = null;
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
        // 移除所有翻译相关的类和属性
        const translatableElements = document.querySelectorAll('[data-translatable="true"]');
        translatableElements.forEach(element => {
            // 清除延迟定时器
            if (element._hideTimeout) {
                clearTimeout(element._hideTimeout);
                element._hideTimeout = null;
            }
            
            // 移除事件监听器
            if (element._showHandler) {
                element.removeEventListener('mouseenter', element._showHandler);
            }
            if (element._hideHandler) {
                element.removeEventListener('mouseleave', element._hideHandler);
            }
            
            // 清理属性和类
            element.removeAttribute('data-translatable');
            element.removeAttribute('data-original');
            element.removeAttribute('data-translation');
            element.classList.remove('translatable-text');
            
            // 清理事件处理器引用
            delete element._showHandler;
            delete element._hideHandler;
        });

        // 移除悬浮容器
        if (this.hoverContainer) {
            this.hoverContainer.remove();
            this.hoverContainer = null;
        }

        // 清理当前悬浮提示
        this.currentHoverTip = null;

        // 移除还原按钮
        const restoreBtn = document.querySelector('.translate-restore-btn');
        if (restoreBtn) {
            restoreBtn.remove();
        }

        // 重置状态
        this.isPageTranslating = false;
        this.translatedNodes.clear();
        document.body.removeAttribute('data-translated');
        
        this.showToast('页面已还原');
    }
}

// 创建翻译面板实例
const translatePanel = new TranslatePanel();