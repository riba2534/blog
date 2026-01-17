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

  function detectLanguage() {
    var blocks = document.querySelectorAll('.post-body .highlight, .post-body > pre');

    blocks.forEach(function(block) {
      if (block.dataset.lang) {
        return;
      }

      var code = block.matches('.highlight')
        ? block.querySelector('td:last-child code')
        : block.querySelector('code');

      if (!code) {
        return;
      }

      var className = code.className || '';
      var match = className.match(/language-([\w+-]+)/);
      var lang = match ? match[1] : (code.getAttribute('data-lang') || '');

      if (lang) {
        block.setAttribute('data-lang', lang.toUpperCase());
      }
    });
  }

  // 为纯代码块添加行号
  function addLineNumbers() {
    var simpleBlocks = document.querySelectorAll('.post-body > pre');

    simpleBlocks.forEach(function(pre) {
      // 跳过已经处理过的
      if (pre.classList.contains('line-numbers-added')) {
        return;
      }

      var code = pre.querySelector('code');
      if (!code) {
        return;
      }

      // 跳过 mermaid、math 等需要特殊渲染的代码块
      var className = code.className || '';
      if (className.match(/language-mermaid|language-math|language-latex|mermaid/i)) {
        return;
      }

      var text = code.textContent;
      var lines = text.split('\n');

      // 移除最后的空行（如果有）
      if (lines.length > 0 && lines[lines.length - 1] === '') {
        lines.pop();
      }

      // 如果没有内容，跳过
      if (lines.length === 0) {
        return;
      }

      // 创建 highlight 容器
      var highlight = document.createElement('div');
      highlight.className = 'highlight';

      // 创建表格结构（与 Hugo 生成的结构一致）
      var wrapper = document.createElement('div');
      wrapper.className = 'chroma';

      var table = document.createElement('table');
      table.className = 'lntable';

      var tbody = document.createElement('tbody');
      var tr = document.createElement('tr');

      // 行号列
      var tdLineNos = document.createElement('td');
      tdLineNos.className = 'lntd';
      var preLineNos = document.createElement('pre');
      preLineNos.className = 'chroma lnt';
      var codeLineNos = document.createElement('code');

      // 代码列
      var tdCode = document.createElement('td');
      tdCode.className = 'lntd';
      var preCode = document.createElement('pre');
      preCode.className = 'chroma code';
      var codeContent = document.createElement('code');

      // 填充行号和代码
      var lineNumbers = [];
      var codeLines = [];

      for (var i = 0; i < lines.length; i++) {
        lineNumbers.push((i + 1).toString());
        // 对 HTML 进行转义
        var escapedLine = lines[i]
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;');
        codeLines.push(escapedLine);
      }

      codeLineNos.textContent = lineNumbers.join('\n');
      codeContent.innerHTML = codeLines.join('\n');

      // 组装结构
      preLineNos.appendChild(codeLineNos);
      tdLineNos.appendChild(preLineNos);

      preCode.appendChild(codeContent);
      tdCode.appendChild(preCode);

      tr.appendChild(tdLineNos);
      tr.appendChild(tdCode);
      tbody.appendChild(tr);
      table.appendChild(tbody);
      wrapper.appendChild(table);
      highlight.appendChild(wrapper);

      // 替换原来的 pre
      pre.parentNode.replaceChild(highlight, pre);

      // 标记为已处理
      highlight.classList.add('line-numbers-added');
    });
  }

  function enhance() {
    // 延迟执行，确保 mermaid 等库先处理
    setTimeout(function() {
      try {
        // 为纯代码块添加行号
        addLineNumbers();
        detectLanguage();
        addCopyButtons();
      } catch (e) {
        console.warn('代码增强功能初始化失败:', e);
      }
    }, 100);
  }

  function addCopyButtons() {

    if (!navigator.clipboard) {
      return;
    }

    // 为纯代码块添加复制按钮（现在它们已经变成 .highlight 了）
    var simpleBlocks = document.querySelectorAll('.post-body > pre:not(.line-numbers-added)');
    simpleBlocks.forEach(function(block) {
      if (block.querySelector('.code-copy-btn')) {
        return;
      }
      var btn = createButton();
      block.appendChild(btn);
      bindCopy(btn, function() {
        var code = block.querySelector('code');
        return code ? code.textContent : block.textContent;
      });
    });

    var highlightBlocks = document.querySelectorAll('.post-body .highlight');
    highlightBlocks.forEach(function(block) {
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

  document.addEventListener('DOMContentLoaded', enhance);
})();
