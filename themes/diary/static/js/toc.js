// 上一次滚动的激活标题 id：不变时整帧跳过 DOM 写入
var spyLastActive = null;
var spy = function () {
  var elems = document.querySelectorAll(Array.from(Array(6).keys(), x => ".post-body h"+(x+1).toString()));
  // ":is()" was not supported until Chrome 88+
  // Here is a backfill
  if (elems.length == 0) {
    return;
  }
  var supportPageOffset = window.pageXOffset !== undefined;
  var isCSS1Compat = ((document.compatMode || "") === "CSS1Compat");

  var currentTop = supportPageOffset ? window.pageYOffset : isCSS1Compat ? document.documentElement.scrollTop : document.body.scrollTop;
  var currentBottom = currentTop + (window.innerHeight || document.documentElement.clientHeight);
  var doc = document.documentElement;
  var body = document.body || { scrollHeight: 0, offsetHeight: 0, clientHeight: 0 };
  var pageBottom = Math.max(doc.scrollHeight, doc.offsetHeight, doc.clientHeight, body.scrollHeight, body.offsetHeight, body.clientHeight);
  var reachedBottom = currentBottom >= pageBottom;

  // 阶段一：集中读取布局（offsetTop），读写分离，避免逐条 read/write 交替触发的连环强制重排
  var entries = [];
  elems.forEach(function (elem) {
    if (!elem) return;
    var id = elem.getAttribute('id');
    if (!id) return;
    entries.push({ id: id, top: elem.offsetTop });
  });
  if (entries.length == 0) {
    return;
  }

  // 阶段二：纯计算，已读标题集合是一段前缀，末尾即当前激活项
  var activeId = entries[0].id;
  entries.forEach(function (en) {
    en.read = reachedBottom || currentTop >= en.top;
    if (en.read) {
      activeId = en.id;
    }
  });

  // 激活项没变则 TOC 状态必然没变，直接跳过全部 DOM 写入
  if (activeId === spyLastActive) {
    return;
  }
  spyLastActive = activeId;

  // 阶段三：集中写入
  entries.forEach(function (en) {
    var navElems = document.getElementsByClassName("nav-" + en.id);
    Array.from(navElems).forEach(function (e) {
      e.classList.toggle('toc-active', en.read);
    });
  });

  // Two toc elements here
  document.querySelectorAll(".nav-" + activeId).forEach(e => {
    try {
      // Avoid jank on scroll: no smooth behavior inside scroll handler
      e.scrollIntoView({ block: "center", behavior: 'auto' });
    } catch (_) {}
  });
}

// TOC Auto-collapse functionality
var tocExpandedState = {};

function toggleAllTocItems() {
  const tocItems = document.querySelectorAll('.toc-collapsible');
  const toggleButton = document.getElementById('toc-toggle-all');
  const icon = toggleButton.querySelector('i');

  let allExpanded = true;
  tocItems.forEach(item => {
    if (item.style.display === 'none') {
      allExpanded = false;
    }
  });

  tocItems.forEach(item => {
    item.style.display = allExpanded ? 'none' : 'block';
  });

  icon.textContent = allExpanded ? 'expand_more' : 'expand_less';
}

function toggleTocItem(element) {
  const subList = element.nextElementSibling;
  if (subList && subList.classList.contains('toc-collapsible')) {
    const isHidden = subList.style.display === 'none';
    subList.style.display = isHidden ? 'block' : 'none';

    const icon = element.querySelector('.toc-toggle-icon');
    if (icon) {
      icon.textContent = isHidden ? 'expand_less' : 'expand_more';
    }
  }
}

// Initialize TOC collapse functionality
document.addEventListener('DOMContentLoaded', function() {
  // Add toggle icons to parent items that have collapsible children
  const tocItems = document.querySelectorAll('.toc a');
  tocItems.forEach(item => {
    const nextUl = item.parentElement.querySelector('.toc-collapsible');
    if (nextUl) {
      // Add expand icon
      const icon = document.createElement('i');
      icon.className = 'material-icons toc-toggle-icon';
      icon.textContent = 'expand_more';
      icon.style.fontSize = '14px';
      icon.style.marginLeft = '5px';
      icon.style.cursor = 'pointer';
      item.appendChild(icon);

      // Add click handler
      icon.addEventListener('click', function(e) {
        e.preventDefault();
        e.stopPropagation();
        toggleTocItem(item.parentElement);
      });
    }
  });
});
