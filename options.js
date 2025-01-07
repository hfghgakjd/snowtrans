/**
 * 设置页面功能实现
 * @author Shawn Jones
 */
document.addEventListener('DOMContentLoaded', function() {
    const defaultTargetLang = document.getElementById('defaultTargetLang');
    const saveBtn = document.getElementById('saveSettings');

    // 加载保存的设置
    chrome.storage.local.get(['lastTargetLang'], function(data) {
        if (data.lastTargetLang) {
            defaultTargetLang.value = data.lastTargetLang;
        }
    });

    // 保存设置
    saveBtn.addEventListener('click', function() {
        chrome.storage.local.set({
            'lastTargetLang': defaultTargetLang.value
        }, function() {
            // 显示保存成功提示
            const status = document.createElement('div');
            status.style.color = '#34a853';
            status.style.marginTop = '16px';
            status.textContent = '设置已保存';
            saveBtn.parentNode.appendChild(status);

            // 2秒后移除提示
            setTimeout(() => {
                status.remove();
            }, 2000);
        });
    });
});
