/**
 * tracking-manager.js
 * Runs in the sidepanel. Manages camera, MediaPipe Face/Hand Landmarkers,
 * gaze-to-cursor mapping, hand gesture recognition, and communication
 * with the content script for virtual cursor control.
 *
 * NOTE: All utility classes are defined BEFORE they are used to avoid
 * "used before defined" errors.
 */
(function () {
  "use strict";

  // ========================================================
  // SECTION 1: UTILITY CLASSES (defined first)
  // ========================================================

  /**
   * OneEuroFilter for adaptive smoothing.
   * Reduces jitter when moving slowly (low cutoff),
   * but stays responsive when moving quickly (cutoff increases with speed).
   */
  class OneEuroFilter {
    constructor(minCutoff, beta) {
      this.minCutoff = minCutoff || 1.0; // Hz
      this.beta = beta || 0.0;           // speed coefficient
      this.dCutoff = 1.0;                // Hz (for derivative)
      this.xPrev = null;
      this.dxPrev = null;
      this.tPrev = null;
    }

    alpha(cutoff, dt) {
      var tau = 1.0 / (2 * Math.PI * cutoff);
      return 1.0 / (1.0 + tau / dt);
    }

    update(x, now) {
      if (this.tPrev === null) {
        this.xPrev = x;
        this.dxPrev = 0;
        this.tPrev = now;
        return x;
      }

      var dt = (now - this.tPrev) / 1000.0;
      this.tPrev = now;

      if (dt <= 0) return this.xPrev; // duplicate frame

      // Compute speed (dx)
      var dx = (x - this.xPrev) / dt;
      var edx = this.exponentialSmoothing(dx, this.dxPrev, this.alpha(this.dCutoff, dt));

      // Compute cutoff based on speed
      var cutoff = this.minCutoff + this.beta * Math.abs(edx);

      // Filter result
      var result = this.exponentialSmoothing(x, this.xPrev, this.alpha(cutoff, dt));

      this.xPrev = result;
      this.dxPrev = edx;
      return result;
    }

    exponentialSmoothing(x, prev, alpha) {
      return alpha * x + (1 - alpha) * prev;
    }

    reset() {
      this.xPrev = null;
      this.dxPrev = null;
      this.tPrev = null;
    }
  }

  /**
   * Simple cooldown timer to prevent rapid-fire events.
   */
  class Cooldown {
    constructor(ms) {
      this.ms = ms;
      this.lastFired = 0;
    }
    ready() {
      return Date.now() - this.lastFired >= this.ms;
    }
    fire() {
      this.lastFired = Date.now();
    }
  }

  // ========================================================
  // SECTION 2: STATE & CONFIGURATION
  // ========================================================

  var state = {
    eyeTracking: false,
    fingerTracking: false,
    cameraActive: false,
    mediaPipeLoaded: false,
    loadingMediaPipe: false,
    error: null,
  };

  var config = {
    eyeSensitivity: 1.5,
    fingerSensitivity: 1.2,
    dwellTime: 1200,       // ms to trigger dwell-click
    dwellThreshold: 35,    // px movement to reset dwell
    dwellTime: 1200,       // ms to trigger dwell-click
    dwellThreshold: 35,    // px movement to reset dwell
    minCutoff: 0.5,        // OneEuroFilter: lower = more smoothing (hz)
    beta: 0.007,           // OneEuroFilter: higher = more responsive
    blinkCooldown: 800,    // ms between blink clicks
    pinchThreshold: 0.06,  // normalized distance for pinch detection
    scrollSpeed: 8,        // px per frame in scroll mode
  };

  // Smoothing filters (OneEuroFilter)
  var smoothX = new OneEuroFilter(config.minCutoff, config.beta);
  var smoothY = new OneEuroFilter(config.minCutoff, config.beta);

  // Dwell click state
  var dwellState = {
    x: 0, y: 0,
    startTime: 0,
    active: false,
  };

  // Cooldowns
  var blinkCooldown = new Cooldown(config.blinkCooldown);
  var clickCooldown = new Cooldown(400);
  var scrollCooldown = new Cooldown(50);

  // MediaPipe instances
  var faceLandmarker = null;
  var handLandmarker = null;
  var cameraStream = null;
  var videoElement = null;
  var animFrameId = null;

  // Last known cursor position
  var cursorX = 0;
  var cursorY = 0;

  // Finger tracking gesture state
  var fingerGesture = { mode: "point", scrollDir: null };

  // Tab dimensions (set when tracking starts)
  var tabWidth = 1920;
  var tabHeight = 1080;

  // Calibration state
  // 5 points: center, top-left, top-right, bottom-left, bottom-right
  var calibrationPoints = [
    { label: "center", sx: 0.5, sy: 0.5 },
    { label: "top-left", sx: 0.15, sy: 0.15 },
    { label: "top-right", sx: 0.85, sy: 0.15 },
    { label: "bottom-left", sx: 0.15, sy: 0.85 },
    { label: "bottom-right", sx: 0.85, sy: 0.85 },
  ];
  var calibrationState = {
    active: false,
    recording: false,      // true when green dot is shown
    tabId: null,           // tab ID of calibration page
    pointIndex: 0,
    samples: [],           // iris readings for current point
    samplesNeeded: 30,     // frames to collect per point
    results: [],           // { screenX, screenY, irisX, irisY } per point
  };
  // Calibration result: maps iris -> screen via linear regression
  var calibration = {
    offsetX: 0.5,   // iris X when looking at screen center
    offsetY: 0.45,  // iris Y when looking at screen center
    scaleX: 0.20,   // iris X range that maps to full screen width
    scaleY: 0.15,   // iris Y range that maps to full screen height
    valid: false,
  };

  // ========================================================
  // SECTION 3: DOM REFERENCES
  // ========================================================

  function el(id) { return document.getElementById(id); }

  // ========================================================
  // SECTION 4: MEDIAPIPE LOADING
  // ========================================================

  /**
   * Dynamically import MediaPipe Tasks Vision from bundled local files.
   * This avoids CSP issues since files are part of the extension ('self').
   */
  async function loadMediaPipe() {
    if (state.mediaPipeLoaded) return true;
    if (state.loadingMediaPipe) return false;
    state.loadingMediaPipe = true;
    updateStatus("loading", "Loading MediaPipe...");

    try {
      // Dynamic import from locally bundled vision_bundle.mjs
      var wasmPath = chrome.runtime.getURL("lib/mediapipe/wasm/");
      var bundlePath = chrome.runtime.getURL("lib/mediapipe/wasm/vision_bundle.mjs");
      var vision = await import(bundlePath);

      var FilesetResolver = vision.FilesetResolver;
      var FaceLandmarkerClass = vision.FaceLandmarker;
      var HandLandmarkerClass = vision.HandLandmarker;

      // Initialize the WASM fileset
      var fileset = await FilesetResolver.forVisionTasks(wasmPath);

      // Store for later use
      window.__mpVision = {
        fileset: fileset,
        FaceLandmarker: FaceLandmarkerClass,
        HandLandmarker: HandLandmarkerClass,
      };

      state.mediaPipeLoaded = true;
      state.loadingMediaPipe = false;
      updateStatus("ready", "MediaPipe loaded");
      return true;
    } catch (err) {
      console.error("[Tracking] Failed to load MediaPipe:", err);
      state.loadingMediaPipe = false;
      state.error = "MediaPipe files not found. Run setup-tracking.ps1 to download them.";
      updateStatus("error", state.error);
      return false;
    }
  }

  /**
   * Create FaceLandmarker for eye tracking.
   */
  async function initFaceLandmarker() {
    if (faceLandmarker) return true;
    if (!window.__mpVision) return false;
    updateStatus("loading", "Loading face model...");
    try {
      var modelPath = chrome.runtime.getURL("lib/mediapipe/models/face_landmarker.task");
      faceLandmarker = await window.__mpVision.FaceLandmarker.createFromOptions(
        window.__mpVision.fileset,
        {
          baseOptions: {
            modelAssetPath: modelPath,
            delegate: "GPU",
          },
          runningMode: "VIDEO",
          numFaces: 1,
          outputFaceBlendshapes: true,
          outputFacialTransformationMatrixes: false,
        }
      );
      updateStatus("active", "Face model ready");
      return true;
    } catch (err) {
      console.error("[Tracking] FaceLandmarker init failed:", err);
      updateStatus("error", "Face model failed to load");
      return false;
    }
  }

  /**
   * Create HandLandmarker for finger tracking.
   */
  async function initHandLandmarker() {
    if (handLandmarker) return true;
    if (!window.__mpVision) return false;
    updateStatus("loading", "Loading hand model...");
    try {
      var modelPath = chrome.runtime.getURL("lib/mediapipe/models/hand_landmarker.task");
      handLandmarker = await window.__mpVision.HandLandmarker.createFromOptions(
        window.__mpVision.fileset,
        {
          baseOptions: {
            modelAssetPath: modelPath,
            delegate: "GPU",
          },
          runningMode: "VIDEO",
          numHands: 1,
          minHandDetectionConfidence: 0.5,
          minHandPresenceConfidence: 0.5,
          minTrackingConfidence: 0.5,
        }
      );
      updateStatus("active", "Hand model ready");
      return true;
    } catch (err) {
      console.error("[Tracking] HandLandmarker init failed:", err);
      updateStatus("error", "Hand model failed to load");
      return false;
    }
  }

  // ========================================================
  // SECTION 5: CAMERA
  // ========================================================

  async function startCamera() {
    if (state.cameraActive) return true;
    try {
      cameraStream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: "user" },
      });

      videoElement = document.createElement("video");
      videoElement.srcObject = cameraStream;
      videoElement.autoplay = true;
      videoElement.playsInline = true;
      videoElement.muted = true;
      videoElement.style.cssText =
        "width:100%;height:100%;object-fit:cover;transform:scaleX(-1);border-radius:8px;";

      await new Promise(function (resolve) {
        videoElement.onloadeddata = resolve;
      });

      // Place in preview container
      var container = el("tracking-camera-preview");
      if (container) {
        container.innerHTML = "";
        container.appendChild(videoElement);
      }

      state.cameraActive = true;
      updateStatus("active", "Camera active");

      // Get active tab dimensions for coordinate mapping
      await updateTabDimensions();

      return true;
    } catch (err) {
      console.error("[Tracking] Camera error:", err);
      if (err.name === "NotAllowedError" || err.name === "NotFoundError") {
        updateStatus("error", "Camera access denied — grant in Settings > Permissions");
      } else {
        updateStatus("error", "Camera error: " + err.message);
      }
      return false;
    }
  }

  function stopCamera() {
    if (cameraStream) {
      cameraStream.getTracks().forEach(function (t) { t.stop(); });
      cameraStream = null;
    }
    videoElement = null;
    state.cameraActive = false;

    var container = el("tracking-camera-preview");
    if (container) {
      container.innerHTML =
        '<div class="camera-placeholder">' +
        '<span class="cam-icon">&#x1F4F7;</span>' +
        '<span>Camera off</span>' +
        '</div>';
    }
  }

  async function updateTabDimensions() {
    try {
      var tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tabs[0] && tabs[0].url) {
        // Skip extension pages and chrome:// pages
        if (tabs[0].url.startsWith("chrome") || tabs[0].url.startsWith("about:")) {
          return;
        }
        // Execute a small script to get viewport size
        var results = await chrome.scripting.executeScript({
          target: { tabId: tabs[0].id },
          func: function () {
            return { w: window.innerWidth, h: window.innerHeight };
          },
        });
        if (results && results[0] && results[0].result) {
          tabWidth = results[0].result.w;
          tabHeight = results[0].result.h;
        }
      }
    } catch (err) {
      // Fallback to default dimensions
      console.warn("[Tracking] Could not get tab dimensions:", err);
    }
  }

  // ========================================================
  // SECTION 6: FRAME PROCESSING LOOP
  // ========================================================

  function processFrame() {
    if (!state.eyeTracking && !state.fingerTracking) {
      animFrameId = null;
      return;
    }

    if (videoElement && videoElement.readyState >= 2) {
      var now = performance.now();

      // --- Eye Tracking ---
      if (state.eyeTracking && faceLandmarker) {
        try {
          var faceResults = faceLandmarker.detectForVideo(videoElement, now);
          if (faceResults && faceResults.faceLandmarks && faceResults.faceLandmarks.length > 0) {
            processEyeLandmarks(faceResults.faceLandmarks[0], faceResults.faceBlendshapes, now);
          }
        } catch (e) { /* detection can fail occasionally */ }
      }

      // --- Finger Tracking ---
      if (state.fingerTracking && handLandmarker) {
        try {
          var handResults = handLandmarker.detectForVideo(videoElement, now);
          if (handResults && handResults.landmarks && handResults.landmarks.length > 0) {
            processHandLandmarks(handResults.landmarks[0], now);
          }
        } catch (e) { /* detection can fail occasionally */ }
      }
    }

    animFrameId = requestAnimationFrame(processFrame);
  }

  // ========================================================
  // SECTION 7: EYE TRACKING LOGIC
  // ========================================================

  /**
   * Process face landmarks to extract gaze direction.
   * Uses iris landmarks (468-477) relative to eye corners.
   */
  function processEyeLandmarks(landmarks, blendshapes, now) {
    // --- Blink detection ---
    var blinkDetected = false;
    if (blendshapes && blendshapes.length > 0) {
      var shapes = blendshapes[0].categories;
      var leftBlink = null, rightBlink = null;
      for (var i = 0; i < shapes.length; i++) {
        if (shapes[i].categoryName === "eyeBlinkLeft") leftBlink = shapes[i];
        if (shapes[i].categoryName === "eyeBlinkRight") rightBlink = shapes[i];
      }
      // Wink detection: one eye closed, other open
      if (leftBlink && rightBlink) {
        // Left wink = click
        if (leftBlink.score > 0.5 && rightBlink.score < 0.3 && blinkCooldown.ready()) {
          blinkDetected = true;
          blinkCooldown.fire();
          sendToContentScript({ type: "TRACKING_CLICK", x: cursorX, y: cursorY });
        }
      }
    }

    // Skip gaze update during blink (iris landmarks are unreliable)
    if (blinkDetected) return;

    // --- Iris gaze estimation ---
    // Right iris center: landmark 473, Left iris center: landmark 468
    // Right eye corners: 362 (inner), 263 (outer)
    // Left eye corners: 33 (outer), 133 (inner)
    var rightIris = landmarks[473];
    var leftIris = landmarks[468];

    if (!rightIris || !leftIris) return;

    // Right eye boundaries
    var rInner = landmarks[362];
    var rOuter = landmarks[263];
    var rTop = landmarks[386];
    var rBottom = landmarks[374];

    // Left eye boundaries
    var lOuter = landmarks[33];
    var lInner = landmarks[133];
    var lTop = landmarks[159];
    var lBottom = landmarks[145];

    // Compute normalized iris position (0-1) within each eye
    var rEyeW = Math.abs(rOuter.x - rInner.x) || 0.001;
    var rEyeH = Math.abs(rBottom.y - rTop.y) || 0.001;
    var rIrisNormX = (rightIris.x - rInner.x) / rEyeW;
    var rIrisNormY = (rightIris.y - rTop.y) / rEyeH;

    var lEyeW = Math.abs(lInner.x - lOuter.x) || 0.001;
    var lEyeH = Math.abs(lBottom.y - lTop.y) || 0.001;
    var lIrisNormX = (leftIris.x - lOuter.x) / lEyeW;
    var lIrisNormY = (leftIris.y - lTop.y) / lEyeH;

    // Average both eyes for stability
    var irisX = (rIrisNormX + lIrisNormX) / 2;
    var irisY = (rIrisNormY + lIrisNormY) / 2;

    // Map to screen coordinates
    // Camera is mirrored, so X is inverted
    // Use calibration data if available, otherwise hardcoded defaults
    var centerX = calibration.offsetX;
    var centerY = calibration.offsetY;
    var rangeX = calibration.scaleX / config.eyeSensitivity;
    var rangeY = calibration.scaleY / config.eyeSensitivity;

    var screenNormX = 0.5 + (irisX - centerX) / rangeX * 0.5;
    var screenNormY = 0.5 + (irisY - centerY) / rangeY * 0.5;

    // Clamp
    screenNormX = Math.max(0, Math.min(1, screenNormX));
    screenNormY = Math.max(0, Math.min(1, screenNormY));

    // Invert X because camera mirrors
    var rawX = (1 - screenNormX) * tabWidth;
    var rawY = screenNormY * tabHeight;

    // Apply smoothing (OneEuroFilter needs timestamp)
    cursorX = smoothX.update(rawX, now);
    cursorY = smoothY.update(rawY, now);

    sendCursorUpdate(cursorX, cursorY);

    // --- Collect calibration samples if calibrating ---
    if (calibrationState.active && calibrationState.recording) {
      calibrationState.samples.push({ x: irisX, y: irisY });
    }

    // --- Dwell click detection ---
    processDwellClick(cursorX, cursorY);

    // --- Edge scroll zones ---
    processEdgeScroll(screenNormX, screenNormY);
  }

  // ========================================================
  // SECTION 8: FINGER TRACKING LOGIC
  // ========================================================

  /**
   * Process hand landmarks for cursor control and gesture recognition.
   * MediaPipe Hands gives 21 landmarks per hand.
   */
  function processHandLandmarks(landmarks, now) {
    // Finger tip indices: thumb=4, index=8, middle=12, ring=16, pinky=20
    // Finger PIP indices: thumb=3, index=6, middle=10, ring=14, pinky=18

    var indexTip = landmarks[8];
    var thumbTip = landmarks[4];
    var middleTip = landmarks[12];

    // Check which fingers are extended
    var indexExtended = isFingerExtended(landmarks, 8, 6);
    var middleExtended = isFingerExtended(landmarks, 12, 10);
    var ringExtended = isFingerExtended(landmarks, 16, 14);
    var pinkyExtended = isFingerExtended(landmarks, 20, 18);
    var thumbExtended = isThumbExtended(landmarks);

    // Pinch distance (thumb to index)
    var pinchDist = distance2D(thumbTip, indexTip);

    // --- Gesture Classification ---
    var gesture = classifyGesture(indexExtended, middleExtended, ringExtended, pinkyExtended, thumbExtended, pinchDist);

    switch (gesture) {
      case "point":
        // Cursor follows index fingertip
        var fx = (1 - indexTip.x) * tabWidth * config.fingerSensitivity;
        var fy = indexTip.y * tabHeight * config.fingerSensitivity;
        // Center the sensitivity scaling
        fx = tabWidth / 2 + (fx - tabWidth / 2);
        fy = tabHeight / 2 + (fy - tabHeight / 2);
        fx = Math.max(0, Math.min(tabWidth, fx));
        fy = Math.max(0, Math.min(tabHeight, fy));

        fx = Math.max(0, Math.min(tabWidth, fx));
        fy = Math.max(0, Math.min(tabHeight, fy));

        cursorX = smoothX.update(fx, now);
        cursorY = smoothY.update(fy, now);
        sendCursorUpdate(cursorX, cursorY);
        processDwellClick(cursorX, cursorY);
        break;

      case "pinch":
        // Pinch = click
        if (clickCooldown.ready()) {
          clickCooldown.fire();
          sendToContentScript({ type: "TRACKING_CLICK", x: cursorX, y: cursorY });
          resetDwell();
        }
        break;

      case "peace":
        // Peace sign (index + middle) = scroll mode
        if (scrollCooldown.ready()) {
          scrollCooldown.fire();
          // Use middle finger Y movement to determine scroll direction
          var scrollY = (middleTip.y - 0.5) * config.scrollSpeed * 10;
          if (Math.abs(scrollY) > 2) {
            var dir = scrollY > 0 ? "down" : "up";
            sendToContentScript({ type: "TRACKING_SCROLL", direction: dir, amount: Math.abs(scrollY) * 5 });
          }
        }
        break;

      case "fist":
        // Fist = pause/no action
        break;

      case "palm":
        // Open palm = stop tracking temporarily (visual feedback)
        break;
    }

    fingerGesture.mode = gesture;
  }

  function isFingerExtended(landmarks, tipIdx, pipIdx) {
    return landmarks[tipIdx].y < landmarks[pipIdx].y;
  }

  function isThumbExtended(landmarks) {
    // Thumb is extended if tip (4) is further from palm center than IP joint (3)
    var wrist = landmarks[0];
    var thumbTip = landmarks[4];
    var thumbIP = landmarks[3];
    return Math.abs(thumbTip.x - wrist.x) > Math.abs(thumbIP.x - wrist.x);
  }

  function distance2D(a, b) {
    var dx = a.x - b.x;
    var dy = a.y - b.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  function classifyGesture(index, middle, ring, pinky, thumb, pinchDist) {
    // Pinch: thumb close to index finger
    if (pinchDist < config.pinchThreshold) return "pinch";
    // Peace: index + middle extended, ring + pinky curled
    if (index && middle && !ring && !pinky) return "peace";
    // Open palm: all fingers extended
    if (index && middle && ring && pinky && thumb) return "palm";
    // Fist: no fingers extended (except maybe thumb)
    if (!index && !middle && !ring && !pinky) return "fist";
    // Point: only index extended
    if (index && !middle && !ring && !pinky) return "point";
    // Default to point if index is extended
    if (index) return "point";
    return "fist";
  }

  // ========================================================
  // SECTION 9: DWELL CLICK & EDGE SCROLL
  // ========================================================

  function processDwellClick(x, y) {
    var dx = x - dwellState.x;
    var dy = y - dwellState.y;
    var dist = Math.sqrt(dx * dx + dy * dy);

    if (dist > config.dwellThreshold) {
      // Cursor moved — reset dwell
      dwellState.x = x;
      dwellState.y = y;
      dwellState.startTime = Date.now();
      dwellState.active = false;
      sendToContentScript({ type: "TRACKING_DWELL_PROGRESS", progress: 0 });
      return;
    }

    if (!dwellState.startTime) {
      dwellState.startTime = Date.now();
      dwellState.x = x;
      dwellState.y = y;
    }

    var elapsed = Date.now() - dwellState.startTime;
    var progress = Math.min(1, elapsed / config.dwellTime);
    sendToContentScript({ type: "TRACKING_DWELL_PROGRESS", progress: progress });

    if (elapsed >= config.dwellTime && !dwellState.active) {
      dwellState.active = true;
      sendToContentScript({ type: "TRACKING_CLICK", x: x, y: y });
      // Reset after click
      setTimeout(function () {
        dwellState.startTime = Date.now();
        dwellState.active = false;
      }, 300);
    }
  }

  function resetDwell() {
    dwellState.startTime = 0;
    dwellState.active = false;
    sendToContentScript({ type: "TRACKING_DWELL_PROGRESS", progress: 0 });
  }

  function processEdgeScroll(normX, normY) {
    if (!scrollCooldown.ready()) return;
    var edgeZone = 0.08;
    if (normY < edgeZone) {
      scrollCooldown.fire();
      sendToContentScript({ type: "TRACKING_SCROLL", direction: "up", amount: 80 });
    } else if (normY > 1 - edgeZone) {
      scrollCooldown.fire();
      sendToContentScript({ type: "TRACKING_SCROLL", direction: "down", amount: 80 });
    }
  }

  // ========================================================
  // SECTION 10: COMMUNICATION WITH CONTENT SCRIPT
  // ========================================================

  function sendCursorUpdate(x, y) {
    sendToContentScript({ type: "TRACKING_CURSOR_MOVE", x: Math.round(x), y: Math.round(y) });
  }

  async function sendToContentScript(message) {
    try {
      var tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tabs[0] && tabs[0].id && tabs[0].url) {
        // Skip extension pages and chrome:// pages — content scripts can't run there
        if (tabs[0].url.startsWith("chrome") || tabs[0].url.startsWith("about:")) {
          return;
        }
        chrome.tabs.sendMessage(tabs[0].id, message).catch(function () {
          // Content script not injected on this page
        });
      }
    } catch (err) {
      // Ignore send errors
    }
  }

  /**
   * Inject tracking-content.js into a tab and activate it.
   * The content script has a __trackingContentLoaded guard
   * that prevents double-injection.
   */
  async function ensureContentScriptOnTab(tabId) {
    try {
      // Inject the content script programmatically
      await chrome.scripting.executeScript({
        target: { tabId: tabId },
        files: ["tracking-content.js"],
      });
    } catch (e) {
      // Fails on chrome://, extension pages, etc. — that's fine
    }
    try {
      await chrome.tabs.sendMessage(tabId, { type: "TRACKING_ACTIVATE" });
    } catch (e) {
      // Content script may not be ready yet on restricted pages
    }
  }

  // Tab change listeners (stored so we can remove them on deactivate)
  function onTabActivated(activeInfo) {
    if (!state.eyeTracking && !state.fingerTracking) return;
    // New tab became active — inject and activate content script
    chrome.tabs.get(activeInfo.tabId, function (tab) {
      if (chrome.runtime.lastError) return;
      if (tab.url && (tab.url.startsWith("chrome") || tab.url.startsWith("about:"))) return;
      ensureContentScriptOnTab(activeInfo.tabId);
      // Also refresh tab dimensions for the new tab
      updateTabDimensions();
    });
  }

  function onTabUpdated(tabId, changeInfo, tab) {
    if (!state.eyeTracking && !state.fingerTracking) return;
    // Page finished loading — re-inject (content script lost on navigation)
    if (changeInfo.status === "complete" && tab.active) {
      if (tab.url && (tab.url.startsWith("chrome") || tab.url.startsWith("about:"))) return;
      ensureContentScriptOnTab(tabId);
      updateTabDimensions();
    }
  }

  async function activateContentScript() {
    // Inject into current active tab
    try {
      var tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tabs[0] && tabs[0].id && tabs[0].url) {
        if (!tabs[0].url.startsWith("chrome") && !tabs[0].url.startsWith("about:")) {
          await ensureContentScriptOnTab(tabs[0].id);
        }
      }
    } catch (e) { /* ignore */ }

    // Start watching for tab changes
    chrome.tabs.onActivated.addListener(onTabActivated);
    chrome.tabs.onUpdated.addListener(onTabUpdated);
  }

  async function deactivateContentScript() {
    // Stop watching tab changes
    chrome.tabs.onActivated.removeListener(onTabActivated);
    chrome.tabs.onUpdated.removeListener(onTabUpdated);

    // Deactivate on current tab
    await sendToContentScript({ type: "TRACKING_DEACTIVATE" });
  }

  // ========================================================
  // SECTION 10B: CALIBRATION SYSTEM
  // ========================================================

  // ========================================================
  // SECTION 10B: CALIBRATION SYSTEM
  // ========================================================

  /**
   * Start a 5-point calibration session.
   * Opens calibration.html in a new tab.
   */
  async function startCalibration() {
    if (!state.eyeTracking) {
      updateStatus("error", "Enable eye tracking first");
      return;
    }

    chrome.tabs.create({ url: "calibration.html" }, function (tab) {
      calibrationState.tabId = tab.id;
    });

    calibrationState.active = true;
    calibrationState.recording = false;
    calibrationState.pointIndex = 0;
    calibrationState.samples = [];
    calibrationState.results = [];

    updateStatus("calibrating", "Follow instructions on new tab");
  }

  function showCalibrationPoint(index) {
    if (index >= calibrationPoints.length) {
      finishCalibration();
      return;
    }
    var pt = calibrationPoints[index];

    if (calibrationState.tabId) {
      chrome.tabs.sendMessage(calibrationState.tabId, {
        type: "SHOW_POINT",
        x: pt.sx,
        y: pt.sy,
        index: index + 1,
        total: calibrationPoints.length
      });
    }

    calibrationState.recording = false;
    calibrationState.samples = [];
  }

  function advanceCalibration() {
    // Average the collected samples for this point
    var sx = 0, sy = 0;
    if (calibrationState.samples.length > 0) {
      for (var i = 0; i < calibrationState.samples.length; i++) {
        sx += calibrationState.samples[i].x;
        sy += calibrationState.samples[i].y;
      }
      var avgX = sx / calibrationState.samples.length;
      var avgY = sy / calibrationState.samples.length;

      var pt = calibrationPoints[calibrationState.pointIndex];
      calibrationState.results.push({
        screenX: pt.sx,
        screenY: pt.sy,
        irisX: avgX,
        irisY: avgY,
      });
    }

    calibrationState.pointIndex++;
    calibrationState.samples = [];
    calibrationState.recording = false;

    showCalibrationPoint(calibrationState.pointIndex);
  }

  function finishCalibration() {
    calibrationState.active = false;
    calibrationState.recording = false;

    // Tell calibration page to finish (it closes itself)
    if (calibrationState.tabId) {
      chrome.tabs.sendMessage(calibrationState.tabId, { type: "CALIBRATION_COMPLETE" });
      calibrationState.tabId = null;
    }

    if (calibrationState.results.length < 3) {
      updateStatus("error", "Calibration failed — not enough data");
      return;
    }

    // Compute calibration: find iris center (from center point) and
    // iris range (from edge points)
    var centerResult = calibrationState.results[0]; // center point
    calibration.offsetX = centerResult.irisX;
    calibration.offsetY = centerResult.irisY;

    // Compute X range from left vs right edge points
    var leftPoints = calibrationState.results.filter(function (r) { return r.screenX < 0.3; });
    var rightPoints = calibrationState.results.filter(function (r) { return r.screenX > 0.7; });
    var topPoints = calibrationState.results.filter(function (r) { return r.screenY < 0.3; });
    var bottomPoints = calibrationState.results.filter(function (r) { return r.screenY > 0.7; });

    if (leftPoints.length > 0 && rightPoints.length > 0) {
      var avgLeftX = leftPoints.reduce(function (s, p) { return s + p.irisX; }, 0) / leftPoints.length;
      var avgRightX = rightPoints.reduce(function (s, p) { return s + p.irisX; }, 0) / rightPoints.length;
      calibration.scaleX = Math.abs(avgRightX - avgLeftX) * 0.7; // 70% coverage factor
    }

    if (topPoints.length > 0 && bottomPoints.length > 0) {
      var avgTopY = topPoints.reduce(function (s, p) { return s + p.irisY; }, 0) / topPoints.length;
      var avgBottomY = bottomPoints.reduce(function (s, p) { return s + p.irisY; }, 0) / bottomPoints.length;
      calibration.scaleY = Math.abs(avgBottomY - avgTopY) * 0.7;
    }

    // Sanity check
    if (calibration.scaleX < 0.02) calibration.scaleX = 0.20;
    if (calibration.scaleY < 0.02) calibration.scaleY = 0.15;

    calibration.valid = true;
    saveCalibration();
    smoothX.reset();
    smoothY.reset();

    updateStatus("active", "Calibrated ✓ — Tracking active");
  }

  function saveCalibration() {
    chrome.storage.local.set({ trackingCalibration: calibration });
  }

  function loadCalibration() {
    chrome.storage.local.get("trackingCalibration", function (result) {
      if (result.trackingCalibration && result.trackingCalibration.valid) {
        calibration = result.trackingCalibration;
      }
    });
  }

  // Listen for calibration page messages
  chrome.runtime.onMessage.addListener(function (msg, sender, sendResponse) {
    if (!calibrationState.active) return;

    if (msg.type === "CALIBRATION_START") {
      showCalibrationPoint(0);
    }
    else if (msg.type === "START_RECORDING") {
      calibrationState.recording = true;
      // Record for 1 second then stop
      setTimeout(function () {
        calibrationState.recording = false;
        if (calibrationState.tabId) {
          chrome.tabs.sendMessage(calibrationState.tabId, { type: "STOP_RECORDING" });
        }
      }, 1000);
    }
    else if (msg.type === "POINT_FINISHED") {
      advanceCalibration();
    }
  });

  // Load saved calibration on startup
  loadCalibration();

  // ========================================================
  // SECTION 11: UI STATUS UPDATES
  // ========================================================

  function updateStatus(type, text) {
    var dot = el("tracking-status-dot");
    var label = el("tracking-status-text");
    if (dot) {
      dot.className = "tracking-status-dot";
      if (type === "active") dot.classList.add("active");
      else if (type === "error") dot.classList.add("error");
      else if (type === "loading") dot.classList.add("loading");
    }
    if (label) {
      label.textContent = text;
    }
  }

  function updateGestureDisplay(gesture) {
    var disp = el("tracking-current-gesture");
    if (disp) {
      var names = {
        point: "Pointing",
        pinch: "Pinch (Click)",
        peace: "Peace (Scroll)",
        fist: "Fist (Paused)",
        palm: "Open Palm (Stop)",
      };
      disp.textContent = names[gesture] || gesture;
    }
  }

  // ========================================================
  // SECTION 12: TOGGLE HANDLERS
  // ========================================================

  async function toggleEyeTracking(enabled) {
    if (enabled) {
      var mpLoaded = await loadMediaPipe();
      if (!mpLoaded) {
        el("eye-tracking-toggle").checked = false;
        return;
      }
      var camOk = await startCamera();
      if (!camOk) {
        el("eye-tracking-toggle").checked = false;
        return;
      }
      var faceOk = await initFaceLandmarker();
      if (!faceOk) {
        el("eye-tracking-toggle").checked = false;
        return;
      }
      state.eyeTracking = true;
      smoothX.reset();
      smoothY.reset();
      resetDwell();
      activateContentScript();
      updateStatus("active", "Eye tracking active");
      if (!animFrameId) animFrameId = requestAnimationFrame(processFrame);
    } else {
      state.eyeTracking = false;
      if (!state.fingerTracking) {
        stopCamera();
        deactivateContentScript();
        updateStatus("ready", "Tracking off");
      }
    }
  }

  async function toggleFingerTracking(enabled) {
    if (enabled) {
      var mpLoaded = await loadMediaPipe();
      if (!mpLoaded) {
        el("finger-tracking-toggle").checked = false;
        return;
      }
      var camOk = await startCamera();
      if (!camOk) {
        el("finger-tracking-toggle").checked = false;
        return;
      }
      var handOk = await initHandLandmarker();
      if (!handOk) {
        el("finger-tracking-toggle").checked = false;
        return;
      }
      state.fingerTracking = true;
      smoothX.reset();
      smoothY.reset();
      resetDwell();
      activateContentScript();
      updateStatus("active", "Finger tracking active");
      if (!animFrameId) animFrameId = requestAnimationFrame(processFrame);
    } else {
      state.fingerTracking = false;
      if (!state.eyeTracking) {
        stopCamera();
        deactivateContentScript();
        updateStatus("ready", "Tracking off");
      }
    }
  }

  // ========================================================
  // SECTION 13: UI INITIALIZATION
  // ========================================================

  function initTrackingUI() {
    // Eye tracking toggle
    var eyeToggle = el("eye-tracking-toggle");
    if (eyeToggle) {
      eyeToggle.addEventListener("change", function () {
        toggleEyeTracking(this.checked);
      });
    }

    // Calibrate button
    var calibrateBtn = el("calibrate-btn");
    if (calibrateBtn) {
      calibrateBtn.addEventListener("click", function () {
        startCalibration();
      });
    }

    // Finger tracking toggle
    var fingerToggle = el("finger-tracking-toggle");
    if (fingerToggle) {
      fingerToggle.addEventListener("change", function () {
        toggleFingerTracking(this.checked);
      });
    }

    // Eye sensitivity slider
    var eyeSensSlider = el("eye-sensitivity-slider");
    var eyeSensValue = el("eye-sensitivity-value");
    if (eyeSensSlider) {
      eyeSensSlider.addEventListener("input", function () {
        config.eyeSensitivity = parseFloat(this.value);
        if (eyeSensValue) eyeSensValue.textContent = this.value + "x";
      });
    }

    // Finger sensitivity slider
    var fingerSensSlider = el("finger-sensitivity-slider");
    var fingerSensValue = el("finger-sensitivity-value");
    if (fingerSensSlider) {
      fingerSensSlider.addEventListener("input", function () {
        config.fingerSensitivity = parseFloat(this.value);
        if (fingerSensValue) fingerSensValue.textContent = this.value + "x";
      });
    }

    // Dwell time slider
    var dwellSlider = el("dwell-time-slider");
    var dwellValue = el("dwell-time-value");
    if (dwellSlider) {
      dwellSlider.addEventListener("input", function () {
        config.dwellTime = parseInt(this.value, 10);
        if (dwellValue) dwellValue.textContent = (parseInt(this.value, 10) / 1000).toFixed(1) + "s";
      });
    }

    // Smoothing slider (Controls minCutoff)
    var smoothSlider = el("smoothing-slider");
    var smoothValue = el("smoothing-value");
    if (smoothSlider) {
      smoothSlider.addEventListener("input", function () {
        // Map 0.05-0.6 to reasonable cutoff (e.g. 0.01 - 1.0)
        // Let's just use the value directly as minCutoff
        config.minCutoff = parseFloat(this.value);
        smoothX.minCutoff = config.minCutoff;
        smoothY.minCutoff = config.minCutoff;
        if (smoothValue) smoothValue.textContent = this.value + " Hz";
      });
    }

    updateStatus("ready", "Ready — toggle a feature to start");
  }

  // ========================================================
  // SECTION 14: INITIALIZATION
  // ========================================================

  // Wait for DOM ready (defer script already waits, but be safe)
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initTrackingUI);
  } else {
    initTrackingUI();
  }

  // Cleanup on page unload
  window.addEventListener("beforeunload", function () {
    if (animFrameId) cancelAnimationFrame(animFrameId);
    if (faceLandmarker) { try { faceLandmarker.close(); } catch (e) { } }
    if (handLandmarker) { try { handLandmarker.close(); } catch (e) { } }
    stopCamera();
    deactivateContentScript();
  });

})();
