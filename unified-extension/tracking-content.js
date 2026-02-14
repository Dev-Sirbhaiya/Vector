/**
 * tracking-content.js
 * Content script injected into web pages for virtual cursor control.
 * Receives cursor coordinates from the sidepanel via chrome.runtime messages
 * and renders a visual cursor overlay, handles clicks, scrolling, etc.
 */
(function () {
  "use strict";

  // Prevent double-injection
  if (window.__trackingContentLoaded) return;
  window.__trackingContentLoaded = true;

  // ============= State =============
  let isActive = false;
  let cursorEl = null;
  let dwellRingEl = null;
  let highlightEl = null;
  let lastX = 0;
  let lastY = 0;

  // ============= Virtual Cursor Overlay =============

  function createOverlay() {
    if (cursorEl) return;

    // Main cursor dot
    cursorEl = document.createElement("div");
    cursorEl.id = "__tracking-cursor";
    cursorEl.style.cssText =
      "position:fixed;z-index:2147483647;width:24px;height:24px;" +
      "border-radius:50%;background:rgba(79,70,229,0.7);" +
      "border:2px solid #fff;box-shadow:0 0 8px rgba(79,70,229,0.5);" +
      "pointer-events:none;transform:translate(-50%,-50%);" +
      "transition:left 0.06s linear,top 0.06s linear;" +
      "display:none;";
    document.documentElement.appendChild(cursorEl);

    // Dwell progress ring (SVG circle)
    dwellRingEl = document.createElement("div");
    dwellRingEl.id = "__tracking-dwell";
    dwellRingEl.style.cssText =
      "position:fixed;z-index:2147483646;width:40px;height:40px;" +
      "pointer-events:none;transform:translate(-50%,-50%);" +
      "display:none;";
    dwellRingEl.innerHTML =
      '<svg viewBox="0 0 40 40" width="40" height="40">' +
      '<circle cx="20" cy="20" r="17" fill="none" stroke="rgba(255,255,255,0.3)" stroke-width="3"/>' +
      '<circle id="__dwell-progress" cx="20" cy="20" r="17" fill="none" ' +
      'stroke="#4F46E5" stroke-width="3" stroke-dasharray="106.8" ' +
      'stroke-dashoffset="106.8" stroke-linecap="round" ' +
      'transform="rotate(-90 20 20)" style="transition:stroke-dashoffset 0.1s linear;"/>' +
      "</svg>";
    document.documentElement.appendChild(dwellRingEl);

    // Element highlight
    highlightEl = document.createElement("div");
    highlightEl.id = "__tracking-highlight";
    highlightEl.style.cssText =
      "position:fixed;z-index:2147483645;pointer-events:none;" +
      "border:2px solid rgba(79,70,229,0.5);border-radius:4px;" +
      "background:rgba(79,70,229,0.08);display:none;" +
      "transition:all 0.1s ease;";
    document.documentElement.appendChild(highlightEl);
  }

  function removeOverlay() {
    if (cursorEl) { cursorEl.remove(); cursorEl = null; }
    if (dwellRingEl) { dwellRingEl.remove(); dwellRingEl = null; }
    if (highlightEl) { highlightEl.remove(); highlightEl = null; }
  }

  function updateCursorPosition(x, y) {
    if (!cursorEl) return;
    lastX = x;
    lastY = y;
    cursorEl.style.left = x + "px";
    cursorEl.style.top = y + "px";
    cursorEl.style.display = "block";
    if (dwellRingEl) {
      dwellRingEl.style.left = x + "px";
      dwellRingEl.style.top = y + "px";
    }
    updateHighlight(x, y);
  }

  function updateHighlight(x, y) {
    if (!highlightEl) return;
    var el = document.elementFromPoint(x, y);
    // Skip our own overlays
    if (!el || el.id?.startsWith("__tracking")) {
      highlightEl.style.display = "none";
      return;
    }
    // Only highlight interactive elements
    var tag = el.tagName.toLowerCase();
    var isInteractive =
      tag === "a" || tag === "button" || tag === "input" ||
      tag === "select" || tag === "textarea" ||
      el.getAttribute("role") === "button" ||
      el.getAttribute("role") === "link" ||
      el.onclick != null || el.hasAttribute("tabindex") ||
      window.getComputedStyle(el).cursor === "pointer";

    if (isInteractive) {
      var rect = el.getBoundingClientRect();
      highlightEl.style.left = rect.left + "px";
      highlightEl.style.top = rect.top + "px";
      highlightEl.style.width = rect.width + "px";
      highlightEl.style.height = rect.height + "px";
      highlightEl.style.display = "block";
    } else {
      highlightEl.style.display = "none";
    }
  }

  function showDwellProgress(progress) {
    if (!dwellRingEl) return;
    var circle = dwellRingEl.querySelector("#__dwell-progress");
    if (!circle) return;
    var circumference = 106.8; // 2 * PI * 17
    var offset = circumference * (1 - Math.min(1, Math.max(0, progress)));
    circle.setAttribute("stroke-dashoffset", offset.toString());
    dwellRingEl.style.display = progress > 0 ? "block" : "none";
  }

  // ============= Action Simulation =============

  function simulateClick(x, y) {
    var el = document.elementFromPoint(x, y);
    if (!el || el.id?.startsWith("__tracking")) return;

    // Visual click feedback
    var ripple = document.createElement("div");
    ripple.style.cssText =
      "position:fixed;z-index:2147483647;width:30px;height:30px;" +
      "border-radius:50%;background:rgba(79,70,229,0.4);" +
      "pointer-events:none;transform:translate(-50%,-50%);" +
      "animation:__tracking-ripple 0.4s ease-out forwards;" +
      "left:" + x + "px;top:" + y + "px;";
    document.documentElement.appendChild(ripple);
    setTimeout(function () { ripple.remove(); }, 500);

    // Inject keyframe if not already present
    if (!document.getElementById("__tracking-keyframes")) {
      var style = document.createElement("style");
      style.id = "__tracking-keyframes";
      style.textContent =
        "@keyframes __tracking-ripple{0%{opacity:1;transform:translate(-50%,-50%) scale(1);}100%{opacity:0;transform:translate(-50%,-50%) scale(2.5);}}";
      document.head.appendChild(style);
    }

    // Dispatch events to simulate a real click
    var opts = { bubbles: true, cancelable: true, clientX: x, clientY: y, view: window };
    el.dispatchEvent(new PointerEvent("pointerdown", opts));
    el.dispatchEvent(new MouseEvent("mousedown", opts));
    el.dispatchEvent(new PointerEvent("pointerup", opts));
    el.dispatchEvent(new MouseEvent("mouseup", opts));
    el.dispatchEvent(new MouseEvent("click", opts));

    // Focus inputs
    if (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT") {
      el.focus();
    }
  }

  function simulateDoubleClick(x, y) {
    var el = document.elementFromPoint(x, y);
    if (!el || el.id?.startsWith("__tracking")) return;
    var opts = { bubbles: true, cancelable: true, clientX: x, clientY: y, view: window };
    el.dispatchEvent(new MouseEvent("dblclick", opts));
  }

  function simulateScroll(direction, amount) {
    var px = parseInt(amount, 10) || 300;
    switch (direction) {
      case "up":
        window.scrollBy({ top: -px, behavior: "smooth" });
        break;
      case "down":
        window.scrollBy({ top: px, behavior: "smooth" });
        break;
      case "left":
        window.scrollBy({ left: -px, behavior: "smooth" });
        break;
      case "right":
        window.scrollBy({ left: px, behavior: "smooth" });
        break;
    }
  }

  function simulateRightClick(x, y) {
    var el = document.elementFromPoint(x, y);
    if (!el || el.id?.startsWith("__tracking")) return;
    var opts = { bubbles: true, cancelable: true, clientX: x, clientY: y, button: 2, view: window };
    el.dispatchEvent(new MouseEvent("contextmenu", opts));
  }

  // ============= Calibration Overlay =============

  let calibrationEl = null;

  function showCalibrationOverlay(msg) {
    if (!calibrationEl) {
      calibrationEl = document.createElement("div");
      calibrationEl.id = "__tracking-calibration";
      calibrationEl.style.cssText =
        "position:fixed;z-index:2147483647;width:30px;height:30px;" +
        "border-radius:50%;background:#ef4444;border:3px solid #fff;" +
        "box-shadow:0 0 10px rgba(0,0,0,0.5);transform:translate(-50%,-50%);" +
        "display:flex;align-items:center;justify-content:center;" +
        "color:white;font-family:sans-serif;font-weight:bold;font-size:12px;";
      document.documentElement.appendChild(calibrationEl);
    }

    // Convert relative coordinates (0-1) to pixels
    var x = msg.x * window.innerWidth;
    var y = msg.y * window.innerHeight;

    calibrationEl.style.left = x + "px";
    calibrationEl.style.top = y + "px";
    calibrationEl.textContent = msg.index + "/" + msg.total;
    calibrationEl.style.display = "flex";
  }

  function hideCalibrationOverlay() {
    if (calibrationEl) {
      calibrationEl.remove();
      calibrationEl = null;
    }
  }

  // ============= Message Handler =============

  chrome.runtime.onMessage.addListener(function (msg, sender, sendResponse) {
    if (!msg || !msg.type || !msg.type.startsWith("TRACKING_")) return;

    switch (msg.type) {
      case "TRACKING_ACTIVATE":
        isActive = true;
        createOverlay();
        sendResponse({ success: true });
        break;

      case "TRACKING_DEACTIVATE":
        isActive = false;
        removeOverlay();
        hideCalibrationOverlay();
        sendResponse({ success: true });
        break;

      case "TRACKING_CALIBRATE_SHOW":
        showCalibrationOverlay(msg);
        sendResponse({ success: true });
        break;

      case "TRACKING_CALIBRATE_HIDE":
        hideCalibrationOverlay();
        sendResponse({ success: true });
        break;

      case "TRACKING_CURSOR_MOVE":
        if (isActive) {
          updateCursorPosition(msg.x, msg.y);
        }
        sendResponse({ success: true });
        break;

      case "TRACKING_DWELL_PROGRESS":
        if (isActive) {
          showDwellProgress(msg.progress);
        }
        sendResponse({ success: true });
        break;

      case "TRACKING_CLICK":
        if (isActive) {
          simulateClick(msg.x || lastX, msg.y || lastY);
        }
        sendResponse({ success: true });
        break;

      case "TRACKING_DOUBLE_CLICK":
        if (isActive) {
          simulateDoubleClick(msg.x || lastX, msg.y || lastY);
        }
        sendResponse({ success: true });
        break;

      case "TRACKING_RIGHT_CLICK":
        if (isActive) {
          simulateRightClick(msg.x || lastX, msg.y || lastY);
        }
        sendResponse({ success: true });
        break;

      case "TRACKING_SCROLL":
        if (isActive) {
          simulateScroll(msg.direction, msg.amount);
        }
        sendResponse({ success: true });
        break;
    }
  });
})();
