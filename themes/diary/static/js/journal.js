var debounce = function (func, wait, options) {
  let lastArgs, lastThis, maxWait, result, timerId, lastCallTime;

  let lastInvokeTime = 0;
  let leading = false;
  let maxing = false;
  let trailing = true;
  
  // Define root as window or global
  const root = typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : this);

  // Bypass `requestAnimationFrame` by explicitly setting `wait=0`.
  const useRAF =
    !wait && wait !== 0 && typeof root.requestAnimationFrame === "function";

  if (typeof func !== "function") {
    throw new TypeError("Expected a function");
  }
  function isObject(value) {
    const type = typeof value;
    return value != null && (type === "object" || type === "function");
  }

  wait = +wait || 0;
  if (isObject(options)) {
    leading = !!options.leading;
    maxing = "maxWait" in options;
    maxWait = maxing ? Math.max(+options.maxWait || 0, wait) : maxWait;
    trailing = "trailing" in options ? !!options.trailing : trailing;
  }

  function invokeFunc(time) {
    const args = lastArgs;
    const thisArg = lastThis;

    lastArgs = lastThis = undefined;
    lastInvokeTime = time;
    result = func.apply(thisArg, args);
    return result;
  }

  function startTimer(pendingFunc, wait) {
    if (useRAF) {
      root.cancelAnimationFrame(timerId);
      return root.requestAnimationFrame(pendingFunc);
    }
    return setTimeout(pendingFunc, wait);
  }

  function cancelTimer(id) {
    if (useRAF) {
      return root.cancelAnimationFrame(id);
    }
    clearTimeout(id);
  }

  function leadingEdge(time) {
    // Reset any `maxWait` timer.
    lastInvokeTime = time;
    // Start the timer for the trailing edge.
    timerId = startTimer(timerExpired, wait);
    // Invoke the leading edge.
    return leading ? invokeFunc(time) : result;
  }

  function remainingWait(time) {
    const timeSinceLastCall = time - lastCallTime;
    const timeSinceLastInvoke = time - lastInvokeTime;
    const timeWaiting = wait - timeSinceLastCall;

    return maxing
      ? Math.min(timeWaiting, maxWait - timeSinceLastInvoke)
      : timeWaiting;
  }

  function shouldInvoke(time) {
    const timeSinceLastCall = time - lastCallTime;
    const timeSinceLastInvoke = time - lastInvokeTime;

    // Either this is the first call, activity has stopped and we're at the
    // trailing edge, the system time has gone backwards and we're treating
    // it as the trailing edge, or we've hit the `maxWait` limit.
    return (
      lastCallTime === undefined ||
      timeSinceLastCall >= wait ||
      timeSinceLastCall < 0 ||
      (maxing && timeSinceLastInvoke >= maxWait)
    );
  }

  function timerExpired() {
    const time = Date.now();
    if (shouldInvoke(time)) {
      return trailingEdge(time);
    }
    // Restart the timer.
    timerId = startTimer(timerExpired, remainingWait(time));
  }

  function trailingEdge(time) {
    timerId = undefined;

    // Only invoke if we have `lastArgs` which means `func` has been
    // debounced at least once.
    if (trailing && lastArgs) {
      return invokeFunc(time);
    }
    lastArgs = lastThis = undefined;
    return result;
  }

  function cancel() {
    if (timerId !== undefined) {
      cancelTimer(timerId);
    }
    lastInvokeTime = 0;
    lastArgs = lastCallTime = lastThis = timerId = undefined;
  }

  function flush() {
    return timerId === undefined ? result : trailingEdge(Date.now());
  }

  function pending() {
    return timerId !== undefined;
  }

  function debounced(...args) {
    const time = Date.now();
    const isInvoking = shouldInvoke(time);

    lastArgs = args;
    lastThis = this;
    lastCallTime = time;

    if (isInvoking) {
      if (timerId === undefined) {
        return leadingEdge(lastCallTime);
      }
      if (maxing) {
        // Handle invocations in a tight loop.
        timerId = startTimer(timerExpired, wait);
        return invokeFunc(lastCallTime);
      }
    }
    if (timerId === undefined) {
      timerId = startTimer(timerExpired, wait);
    }
    return result;
  }
  debounced.cancel = cancel;
  debounced.flush = flush;
  debounced.pending = pending;
  return debounced;
};

const navBar = document.getElementById("navBar");
const navBackground = document.getElementById("navBackground");
const navTitle = document.getElementById("navTitle");
const extraContainer = document.getElementById("extraContainer");
const streamContainer = document.getElementById("streamContainer");

// Scroll

var sgn = function (t, x) {
  let k = 1 / (1 - 2 * t);
  if (x <= t) return 0;
  else if (x >= 1 - t) return 1;
  else {
    return k * (x - t);
  }
};

var handleScroll = function () {
  try {
    var pageHead = document.getElementById("pageHead");
    var navBar = document.getElementById("navBar");

    // 如果必要元素不存在，直接返回
    if (!pageHead || !navBar || !navBackground || !navTitle) {
      return;
    }

    var pageHeadHeight = pageHead.offsetHeight || 1;
    var navBarHeight = navBar.offsetHeight || 1;

    var navOpacity = sgn(
      0.0,
      Math.min(
        1,
        Math.max(0, window.scrollY / (pageHeadHeight - navBarHeight * 0.8))
      )
    );

    if (navOpacity >= 1) {
      navBackground.style.opacity = 1;
      navTitle.style.opacity = 1;
    } else {
      navBackground.style.opacity = 0;
      navTitle.style.opacity = 0;
    }

    if (typeof spy !== "undefined" && typeof spy === "function") {
      spy();
    }
  } catch (e) {
    // 静默处理滚动事件中的错误
  }
};

window.addEventListener(
  "scroll",
  debounce(handleScroll, 100, { maxWait: 100 }),
  false
);

document.querySelectorAll("table").forEach(function (elem) {
  elem.classList.add("table-striped");
  elem.classList.add("table");
  elem.classList.add("table-responsive");
  elem.classList.add("table-hover");
});

// Drawer

var openDrawer = function () {
  document.getElementsByTagName("html")[0].style.overflow = "hidden";
  document
    .getElementById("drawer")
    .classList.add("single-column-drawer-container-active");
  // Show transparent overlay for click-to-close
  var overlay = document.getElementById("drawer-overlay");
  if (overlay) {
    overlay.style.display = "block";
  }
};

// Safe event listener attachment
var navDropdownBtn = document.getElementById("nav_dropdown_btn");
if (navDropdownBtn) {
  navDropdownBtn.addEventListener("click", function () {
    openDrawer();
  });
}

var closeDrawer = function () {
  document.getElementsByTagName("html")[0].style.overflow = "unset";
  document
    .getElementById("drawer")
    .classList.remove("single-column-drawer-container-active");
  // Hide transparent overlay
  var overlay = document.getElementById("drawer-overlay");
  if (overlay) {
    overlay.style.display = "none";
  }
};

// Add click handler for transparent overlay
var drawerOverlay = document.getElementById("drawer-overlay");
if (drawerOverlay) {
  drawerOverlay.addEventListener("click", function () {
    closeDrawer();
  });
}
