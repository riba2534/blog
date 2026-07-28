// 代码块复制按钮。行号与语言徽章已由构建期的 render-codeblock.html hook 生成
// （所有围栏统一走 Chroma 高亮，正文中不再存在裸 <pre>），此处只负责运行时交互。
(function() {
  'use strict';

  var COPY_ICON = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>';
  var CHECK_ICON = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"></polyline></svg>';

  function createButton() {
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'code-copy-btn';
    btn.setAttribute('aria-label', '复制代码');
    btn.title = '复制代码';
    btn.innerHTML = COPY_ICON;
    return btn;
  }

  function bindCopy(btn, getText) {
    btn.addEventListener('click', function() {
      var text = getText();
      if (!text || !navigator.clipboard) {
        return;
      }

      navigator.clipboard.writeText(text).then(function() {
        btn.classList.add('copied');
        btn.innerHTML = CHECK_ICON;
        setTimeout(function() {
          btn.classList.remove('copied');
          btn.innerHTML = COPY_ICON;
        }, 2000);
      }).catch(function(err) {
        console.error('复制代码失败: ', err);
      });
    });
  }

  function addCopyButtons() {
    if (!navigator.clipboard) {
      return;
    }

    document.querySelectorAll('.post-body .highlight').forEach(function(block) {
      if (block.querySelector('.code-copy-btn')) {
        return;
      }
      var btn = createButton();
      block.appendChild(btn);
      bindCopy(btn, function() {
        var codeCell = block.querySelector('td:last-child code');
        return codeCell ? codeCell.textContent : block.textContent;
      });
    });
  }

  document.addEventListener('DOMContentLoaded', addCopyButtons);
})();
