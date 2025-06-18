/**
 * 设置页面功能实现
 * @author Shawn Jones
 */
document.addEventListener('DOMContentLoaded', function() {
    const defaultTargetLang = document.getElementById('defaultTargetLang');
    const saveBtn = document.getElementById('saveSettings');
    const resetBtn = document.getElementById('resetSettings');
    const statusMessage = document.getElementById('statusMessage');

    // 快捷键相关元素
    const translateSelectionShortcut = document.getElementById('translateSelectionShortcut');
    const translatePageShortcut = document.getElementById('translatePageShortcut');
    const translateSelectionKeys = document.getElementById('translateSelectionKeys');
    const translatePageKeys = document.getElementById('translatePageKeys');

    // 当前正在录制的快捷键
    let recordingTarget = null;
    let recordedKeys = [];

    // 默认快捷键设置
    const defaultShortcuts = {
        'translate-selection': 'Alt+T',
        'translate-page': 'Alt+Alt'
    };

    // 加载保存的设置
    loadSettings();

    /**
     * 加载保存的设置
     */
    async function loadSettings() {
        try {
            // 加载默认语言设置
            const data = await chrome.storage.local.get(['lastTargetLang']);
            if (data.lastTargetLang) {
                defaultTargetLang.value = data.lastTargetLang;
            }

            // 加载快捷键设置
            const commands = await chrome.commands.getAll();
            commands.forEach(command => {
                if (command.name === 'translate-selection') {
                    translateSelectionKeys.textContent = command.shortcut || defaultShortcuts['translate-selection'];
                } else if (command.name === 'translate-page') {
                    translatePageKeys.textContent = command.shortcut || defaultShortcuts['translate-page'];
                }
            });
        } catch (error) {
            console.error('Failed to load settings:', error);
        }
    }

    /**
     * 保存设置
     */
    async function saveSettings() {
        try {
            // 保存默认语言
            await chrome.storage.local.set({
                'lastTargetLang': defaultTargetLang.value
            });

            showStatus('设置已保存成功！', 'success');
        } catch (error) {
            console.error('Failed to save settings:', error);
            showStatus('保存设置失败，请重试', 'error');
        }
    }

    /**
     * 重置设置到默认值
     */
    async function resetSettings() {
        if (confirm('确定要重置所有设置到默认值吗？')) {
            defaultTargetLang.value = 'zh';
            translateSelectionKeys.textContent = defaultShortcuts['translate-selection'];
            translatePageKeys.textContent = defaultShortcuts['translate-page'];
            
            await saveSettings();
            showStatus('设置已重置为默认值', 'success');
        }
    }

    /**
     * 显示状态消息
     */
    function showStatus(message, type) {
        statusMessage.textContent = message;
        statusMessage.className = `status-message status-${type}`;
        statusMessage.style.display = 'block';

        setTimeout(() => {
            statusMessage.style.display = 'none';
        }, 3000);
    }

    /**
     * 格式化按键组合
     */
    function formatKeyCombo(keys) {
        const modifiers = [];
        const regularKeys = [];

        keys.forEach(key => {
            if (['Control', 'Alt', 'Shift', 'Meta'].includes(key)) {
                if (key === 'Control') modifiers.push('Ctrl');
                else if (key === 'Meta') modifiers.push('Cmd');
                else modifiers.push(key);
            } else {
                regularKeys.push(key.toUpperCase());
            }
        });

        return [...modifiers, ...regularKeys].join('+');
    }

    /**
     * 开始录制快捷键
     */
    function startRecording(target, statusElement, keysElement) {
        recordingTarget = target;
        recordedKeys = [];
        
        target.classList.add('recording');
        statusElement.textContent = '按下新的快捷键组合...';
        statusElement.classList.add('recording');
        
        // 添加键盘监听
        document.addEventListener('keydown', handleKeyDown);
        document.addEventListener('keyup', handleKeyUp);
    }

    /**
     * 停止录制快捷键
     */
    function stopRecording() {
        if (recordingTarget) {
            recordingTarget.classList.remove('recording');
            const statusElement = recordingTarget.querySelector('.shortcut-status');
            statusElement.classList.remove('recording');
            statusElement.textContent = '点击修改';
            
            recordingTarget = null;
            recordedKeys = [];
            
            document.removeEventListener('keydown', handleKeyDown);
            document.removeEventListener('keyup', handleKeyUp);
        }
    }

    /**
     * 处理按键按下
     */
    function handleKeyDown(e) {
        if (!recordingTarget) return;
        
        e.preventDefault();
        e.stopPropagation();
        
        const key = e.key;
        if (!recordedKeys.includes(key)) {
            recordedKeys.push(key);
        }
        
        // 更新显示
        const keysElement = recordingTarget.querySelector('.shortcut-keys');
        if (recordedKeys.length > 0) {
            keysElement.textContent = formatKeyCombo(recordedKeys);
        }
    }

    /**
     * 处理按键释放
     */
    function handleKeyUp(e) {
        if (!recordingTarget) return;
        
        e.preventDefault();
        e.stopPropagation();
        
        // 如果有有效的按键组合，保存它
        if (recordedKeys.length >= 2) {
            const combo = formatKeyCombo(recordedKeys);
            const keysElement = recordingTarget.querySelector('.shortcut-keys');
            keysElement.textContent = combo;
            
            showStatus(`快捷键已更新为: ${combo}`, 'success');
        }
        
        stopRecording();
    }

    // 绑定事件
    saveBtn.addEventListener('click', saveSettings);
    resetBtn.addEventListener('click', resetSettings);

    // 快捷键录制事件
    translateSelectionShortcut.addEventListener('click', () => {
        const statusElement = translateSelectionShortcut.querySelector('.shortcut-status');
        startRecording(translateSelectionShortcut, statusElement, translateSelectionKeys);
    });

    translatePageShortcut.addEventListener('click', () => {
        const statusElement = translatePageShortcut.querySelector('.shortcut-status');
        startRecording(translatePageShortcut, statusElement, translatePageKeys);
    });

    // 点击其他地方停止录制
    document.addEventListener('click', (e) => {
        if (recordingTarget && !recordingTarget.contains(e.target)) {
            stopRecording();
        }
    });

    // ESC键停止录制
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && recordingTarget) {
            stopRecording();
        }
    });
});
