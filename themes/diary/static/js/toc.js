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

  var meetUnread = false
  let lastElemName = elems[elems.length - 1].id || 'undefined';
  elems.forEach(function (elem, idx) {
    if (!elem) return;
    var elemTop = elem.offsetTop;
    var id = elem.getAttribute('id');
    if (!id) return;
    var navElems = document.getElementsByClassName("nav-"+id);
    if (navElems.length == 0) {
      return
    }
    if (currentTop >= elemTop || currentBottom >= pageBottom) {
      Array.from(navElems).forEach((e) => {
        e.classList.add('toc-active');
      });
    } else {
      if (meetUnread == false) {
        meetUnread = true;
        if (idx > 0) {
          lastElemName = elems[idx - 1].id; 
        }
      }
      Array.from(navElems).forEach((e) => {
        e.classList.remove('toc-active');
      });
    }
  })
  let selector = ".nav-" + lastElemName;
  // Two toc elements here
  document.querySelectorAll(selector).forEach(e => {
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
