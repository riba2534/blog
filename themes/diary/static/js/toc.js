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

  // 当前位置单独标记（toc-active 是"已读前缀集合"，做进度感；
  // toc-current 才是"我在哪"，桌面目录用它点亮轨道线）
  document.querySelectorAll('.toc-current').forEach(function (e) {
    e.classList.remove('toc-current');
  });
  document.querySelectorAll('.nav-' + activeId).forEach(function (e) {
    e.classList.add('toc-current');
  });

  // Two toc elements here
  // 只滚动 TOC 自身的滚动容器：桌面端是 .toc-content（modern.scss 设 overflow:auto），
  // 旧版规则下是 .toc 本身，按谁真正可滚动来选。
  // 不能用 scrollIntoView：它会连带滚动所有可滚祖先，把移动端抽屉（overflow:hidden）
  // 的菜单顶部滚出可视区且用户无法复原
  document.querySelectorAll(".nav-" + activeId).forEach(e => {
    try {
      var box = [e.closest(".toc-content"), e.closest(".toc")].find(function (c) {
        return c && c.scrollHeight > c.clientHeight;
      });
      if (!box) return;
      var delta = e.getBoundingClientRect().top - box.getBoundingClientRect().top;
      box.scrollTop = Math.max(0, box.scrollTop + delta - (box.clientHeight - e.offsetHeight) / 2);
    } catch (_) {}
  });
}

// 注：原 TOC 自动折叠功能（toggleAllTocItems 等）因 enableAutoCollapse 从未启用，
// 属于全站死代码，已连同 toc.html 中的对应分支一并移除。
