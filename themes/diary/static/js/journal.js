// 滚动驱动的导航栏透明度切换 + 文章头图视差 + TOC 高亮（spy 定义在 toc.js）。
// 抽屉开合统一走 baseof.html 内联的 window.toggleDrawer，此处不再重复绑定。
const navBar = document.getElementById("navBar");
const navBackground = document.getElementById("navBackground");
const navTitle = document.getElementById("navTitle");

var lastNavShown = null;
// CSS 的 reduced-motion 规则管不到 JS 每帧写入的 transform/opacity，这里单独尊重
var reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
var handleScroll = function () {
  try {
    var pageHead = document.getElementById("pageHead");
    var scrollY = window.scrollY;

    // 先集中读取布局，再统一写入，避免同一帧内读写交替触发强制重排
    var pageHeadHeight = (pageHead && pageHead.offsetHeight) || 1;
    var navBarHeight = (navBar && navBar.offsetHeight) || 1;

    // pageHead 视差效果
    if (pageHead && !reduceMotion) {
      pageHead.style.transform = "translateZ(0px) translateY(" + (0.3 * scrollY) + "px)";
      pageHead.style.opacity = 1 - Math.min(scrollY / 300, 1);
    }

    if (navBar && navBackground && navTitle) {
      var navShown = scrollY >= pageHeadHeight - navBarHeight * 0.8;
      if (navShown !== lastNavShown) {
        lastNavShown = navShown;
        navBackground.style.opacity = navShown ? 1 : 0;
        navTitle.style.opacity = navShown ? 1 : 0;
      }
    }

    if (typeof spy === "function") {
      spy();
    }
  } catch (e) {
    // 静默处理滚动事件中的错误
  }
};

// rAF 节流：每帧至多执行一次；passive 让浏览器无需等待 handler 即可合成滚动
var scrollTicking = false;
window.addEventListener(
  "scroll",
  function () {
    if (scrollTicking) return;
    scrollTicking = true;
    requestAnimationFrame(function () {
      scrollTicking = false;
      handleScroll();
    });
  },
  { passive: true }
);
