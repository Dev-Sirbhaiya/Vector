/**
 * Dashboard Integration Orchestrator
 * Connects all features: TTS, STT, DOM Description, Voice Workflow, Accessibility Toggles
 * Does NOT modify the Browser AI Agent - only communicates via message passing.
 */
(function () {
  'use strict';

  // =============================================
  // SECTION 1: TAB NAVIGATION
  // =============================================

  const navTabs = document.querySelectorAll('.nav-tab');
  const tabPanels = document.querySelectorAll('.tab-panel');

  navTabs.forEach(function (tab) {
    tab.addEventListener('click', function () {
      var targetTab = tab.dataset.tab;

      navTabs.forEach(function (t) { t.classList.remove('active'); });
      tabPanels.forEach(function (p) {
        p.style.display = 'none';
        p.classList.remove('active');
      });

      tab.classList.add('active');
      var panel = document.getElementById('tab-' + targetTab);
      if (panel) {
        panel.style.display = 'block';
        panel.classList.add('active');
      }
    });
  });

  // =============================================
  // SECTION 2: TEXT TO SPEECH
  // Reuses exact logic from text-to-speech/sidepanel.js
  // API: window.speechSynthesis + SpeechSynthesisUtterance
  // =============================================

  var ttsSpeakBtn = document.getElementById('tts-speak-btn');
  var ttsStopBtn = document.getElementById('tts-stop-btn');
  var ttsTextArea = document.getElementById('tts-text-input');
  var ttsRateInput = document.getElementById('tts-rate-input');
  var ttsRateValue = document.getElementById('tts-rate-value');
  var ttsVoiceSelect = document.getElementById('tts-voice-select');

  var synth = window.speechSynthesis;
  var ttsVoices = [];
  var currentUtterance = null;

  // Populate voice list - filters for Microsoft George, fallback to all
  // (Same logic as text-to-speech/sidepanel.js populateVoices)
  function populateVoices() {
    var allVoices = synth.getVoices();
    ttsVoices = allVoices.filter(function (voice) {
      return voice.name.toLowerCase().includes('george');
    });

    ttsVoiceSelect.innerHTML = '';

    if (ttsVoices.length === 0) {
      ttsVoices = allVoices;
    }

    ttsVoices.forEach(function (voice, index) {
      var option = document.createElement('option');
      option.value = index;
      option.textContent = voice.name + ' (' + voice.lang + ')';
      ttsVoiceSelect.appendChild(option);
    });
  }

  if (synth.onvoiceschanged !== undefined) {
    synth.onvoiceschanged = populateVoices;
  }
  populateVoices();

  // Update speed display (same as original)
  ttsRateInput.addEventListener('input', function (e) {
    ttsRateValue.textContent = e.target.value;
  });

  /**
   * speakText - Core TTS function
   * Same logic as text-to-speech/sidepanel.js speak handler
   * Added onEndCallback param for voice workflow integration
   */
  function speakText(text, onEndCallback) {
    if (!text) {
      if (onEndCallback) onEndCallback();
      return;
    }

    if (synth.speaking) {
      synth.cancel();
    }

    currentUtterance = new SpeechSynthesisUtterance(text);
    currentUtterance.rate = parseFloat(ttsRateInput.value);
    currentUtterance.pitch = 1.0;

    var selectedVoiceIndex = ttsVoiceSelect.value;
    if (ttsVoices[selectedVoiceIndex]) {
      currentUtterance.voice = ttsVoices[selectedVoiceIndex];
    }

    currentUtterance.onstart = function () {
      ttsSpeakBtn.disabled = true;
      ttsStopBtn.disabled = false;
    };

    currentUtterance.onend = function () {
      ttsSpeakBtn.disabled = false;
      ttsStopBtn.disabled = true;
      if (onEndCallback) onEndCallback();
    };

    currentUtterance.onerror = function (event) {
      console.error('Speech synthesis error:', event);
      ttsSpeakBtn.disabled = false;
      ttsStopBtn.disabled = true;
      if (onEndCallback) onEndCallback();
    };

    synth.speak(currentUtterance);
  }

  // Speak button click (same as original)
  ttsSpeakBtn.addEventListener('click', function () {
    speakText(ttsTextArea.value.trim());
  });

  // Stop button click (same as original)
  ttsStopBtn.addEventListener('click', function () {
    if (synth.speaking) {
      synth.cancel();
    }
    ttsSpeakBtn.disabled = false;
    ttsStopBtn.disabled = true;
  });

  // =============================================
  // SECTION 3: SPEECH TO TEXT
  // Reuses exact logic from system_mic/sidepanel.js
  // API: webkitSpeechRecognition + AudioContext + Canvas
  // =============================================

  var sttToggleBtn = document.getElementById('stt-toggle-btn');
  var sttBtnText = document.getElementById('stt-btn-text');
  var sttMicIcon = document.getElementById('stt-mic-icon');
  var sttSubtitlesContainer = document.getElementById('stt-subtitles-container');
  var sttCanvas = document.getElementById('stt-audio-visualizer');
  var sttCanvasCtx = sttCanvas.getContext('2d');
  var sttEmptyState = document.getElementById('stt-empty-state');
  var sttPermissionModal = document.getElementById('stt-permission-modal');
  var sttFixPermissionBtn = document.getElementById('stt-fix-permission-btn');

  var sttIsListening = false;
  var sttRecognition = null;
  var sttAudioContext = null;
  var sttAnalyser = null;
  var sttMicrophoneStream = null;
  var sttAnimationId = null;
  var sttCurrentInterimBubble = null;

  // Speech Recognition Setup (same as system_mic/sidepanel.js setupRecognition)
  function setupRecognition() {
    if (!('webkitSpeechRecognition' in window)) {
      showSTTSystemMessage('Your browser does not support speech recognition.', 'error');
      return null;
    }

    var r = new webkitSpeechRecognition();
    r.continuous = true;
    r.interimResults = true;
    r.lang = 'en-US';

    r.onstart = function () {
      sttIsListening = true;
      updateSTTUI(true);
      sttEmptyState.style.display = 'none';
    };

    r.onend = function () {
      if (sttIsListening) {
        try {
          r.start();
        } catch (e) {
          console.warn('Restart exception', e);
        }
      } else {
        updateSTTUI(false);
      }
    };

    r.onresult = function (event) {
      var finalTranscript = '';
      var interimTranscript = '';

      for (var i = event.resultIndex; i < event.results.length; ++i) {
        var transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += transcript;
        } else {
          interimTranscript += transcript;
        }
      }

      updateSubtitles(finalTranscript, interimTranscript);

      // Voice workflow hook: when active and final transcript received, send to agent
      if (finalTranscript && voiceWorkflowActive) {
        stopSTT();
        voiceWorkflowSendCommand(finalTranscript.trim());
      }

      // Voice commands mode: simple speak → execute → speak result
      if (finalTranscript && voiceCommandsActive) {
        voiceCommandsSendCommand(finalTranscript.trim());
      }
    };

    r.onerror = function (event) {
      console.warn('Speech error:', event.error);
      if (event.error === 'not-allowed') {
        sttIsListening = false;
        updateSTTUI(false);
        showSTTPermissionModal();
      } else if (event.error === 'no-speech') {
        // Ignore silence
      } else {
        showSTTSystemMessage('Error: ' + event.error, 'error');
      }
    };

    return r;
  }

  // Visualizer Setup (same as system_mic/sidepanel.js setupVisualizer)
  async function setupVisualizer() {
    try {
      sttMicrophoneStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      sttAudioContext = new (window.AudioContext || window.webkitAudioContext)();
      sttAnalyser = sttAudioContext.createAnalyser();
      var source = sttAudioContext.createMediaStreamSource(sttMicrophoneStream);
      source.connect(sttAnalyser);
      sttAnalyser.fftSize = 256;
      sttAnalyser.smoothingTimeConstant = 0.8;
      drawVisualizer();
    } catch (err) {
      console.error('Visualizer setup denied:', err);
      if (err.name === 'NotAllowedError') {
        showSTTPermissionModal();
      }
    }
  }

  // Draw Visualizer (same as system_mic/sidepanel.js drawVisualizer)
  function drawVisualizer() {
    if (!sttIsListening) {
      sttCanvasCtx.clearRect(0, 0, sttCanvas.width, sttCanvas.height);
      return;
    }

    sttAnimationId = requestAnimationFrame(drawVisualizer);

    var bufferLength = sttAnalyser.frequencyBinCount;
    var dataArray = new Uint8Array(bufferLength);
    sttAnalyser.getByteFrequencyData(dataArray);

    sttCanvasCtx.clearRect(0, 0, sttCanvas.width, sttCanvas.height);

    var centerX = sttCanvas.width / 2;
    var centerY = sttCanvas.height / 2;
    var gradient = sttCanvasCtx.createLinearGradient(0, centerY - 50, 0, centerY + 50);
    gradient.addColorStop(0, '#a78bfa');
    gradient.addColorStop(1, '#3b82f6');
    sttCanvasCtx.fillStyle = gradient;

    var barWidth = (sttCanvas.width / bufferLength) * 1.5;

    for (var i = 0; i < bufferLength; i++) {
      var barHeight = (dataArray[i] / 255) * (sttCanvas.height * 0.4);
      var x = centerX - (i * barWidth);
      if (x > 0) {
        sttCanvasCtx.fillRect(x, centerY - barHeight / 2, barWidth - 1, barHeight);
        sttCanvasCtx.fillRect(centerX + (i * barWidth), centerY - barHeight / 2, barWidth - 1, barHeight);
      }
    }
  }

  // Update STT UI (same as system_mic/sidepanel.js updateUI)
  function updateSTTUI(active) {
    if (active) {
      sttBtnText.textContent = 'Pause Listening';
      sttToggleBtn.classList.add('active-state');
      sttMicIcon.innerHTML = '&#x23F8;&#xFE0F;';
    } else {
      sttBtnText.textContent = 'Start Listening';
      sttToggleBtn.classList.remove('active-state');
      sttMicIcon.innerHTML = '&#x1F3A4;';
    }
  }

  // Update Subtitles (same as system_mic/sidepanel.js updateSubtitles)
  function updateSubtitles(finalText, interimText) {
    if (finalText) {
      addSTTBubble(finalText, 'final');
      if (sttCurrentInterimBubble) {
        sttCurrentInterimBubble.remove();
        sttCurrentInterimBubble = null;
      }
    }

    if (interimText) {
      if (!sttCurrentInterimBubble) {
        sttCurrentInterimBubble = document.createElement('div');
        sttCurrentInterimBubble.className = 'bubble interim';
        sttSubtitlesContainer.appendChild(sttCurrentInterimBubble);
      }
      sttCurrentInterimBubble.textContent = interimText + '...';
      sttSubtitlesContainer.scrollTop = sttSubtitlesContainer.scrollHeight;
    } else {
      if (sttCurrentInterimBubble && !finalText) {
        sttCurrentInterimBubble.remove();
        sttCurrentInterimBubble = null;
      }
    }
  }

  function addSTTBubble(text, type) {
    var div = document.createElement('div');
    div.className = 'bubble ' + type;
    div.textContent = text;
    sttSubtitlesContainer.appendChild(div);
    sttSubtitlesContainer.scrollTop = sttSubtitlesContainer.scrollHeight;
  }

  function showSTTSystemMessage(msg, type) {
    var div = document.createElement('div');
    div.className = 'system-message ' + (type || 'info');
    div.textContent = msg;
    sttSubtitlesContainer.appendChild(div);
    sttSubtitlesContainer.scrollTop = sttSubtitlesContainer.scrollHeight;
  }

  function showSTTPermissionModal() {
    sttPermissionModal.classList.add('visible');
  }

  sttFixPermissionBtn.addEventListener('click', function () {
    chrome.tabs.create({ url: chrome.runtime.getURL('permission.html') });
    sttPermissionModal.classList.remove('visible');
  });

  // STT start/stop helpers
  function startSTT() {
    if (sttRecognition && !sttIsListening) {
      sttRecognition.start();
      setupVisualizer();
    }
  }

  function stopSTT() {
    if (sttIsListening) {
      sttIsListening = false;
      if (sttRecognition) sttRecognition.stop();
      if (sttAudioContext) {
        sttAudioContext.close().catch(function () { });
        sttAudioContext = null;
      }
      if (sttMicrophoneStream) {
        sttMicrophoneStream.getTracks().forEach(function (t) { t.stop(); });
        sttMicrophoneStream = null;
      }
      cancelAnimationFrame(sttAnimationId);
      sttCanvasCtx.clearRect(0, 0, sttCanvas.width, sttCanvas.height);
      updateSTTUI(false);
    }
  }

  // Canvas sizing (same as system_mic/sidepanel.js)
  function resizeCanvas() {
    sttCanvas.width = sttCanvas.offsetWidth;
    sttCanvas.height = sttCanvas.offsetHeight || 60;
  }
  window.addEventListener('resize', resizeCanvas);
  resizeCanvas();

  // Initialize recognition
  sttRecognition = setupRecognition();

  // Toggle button (same as system_mic/sidepanel.js)
  sttToggleBtn.addEventListener('click', function () {
    if (sttIsListening) {
      stopSTT();
    } else {
      startSTT();
    }
  });

  // =============================================
  // SECTION 4: DOM DESCRIPTION
  // Uses dom-extractor content script for extraction,
  // then calls Claude/OpenAI API directly using stored API key
  // (replaces the Flask server proxy from dom/server.py)
  // Prompt derived from dom/sidepanel.js
  // =============================================

  var describePageBtn = document.getElementById('describe-page-btn');
  var pageDescriptionOutput = document.getElementById('page-description-output');

  /**
   * Get AI settings from chrome.storage.local
   * Same keys the agent uses: provider, apiKey, codeGenModel
   */
  function getAISettings() {
    return new Promise(function (resolve) {
      chrome.storage.local.get(['provider', 'apiKey', 'codeGenModel'], function (result) {
        resolve({
          provider: result.provider || 'claude',
          apiKey: result.apiKey || '',
          model: result.codeGenModel || 'claude-sonnet-4-20250514'
        });
      });
    });
  }

  /**
   * Call AI API directly from the sidepanel
   * Supports Claude, OpenAI, and Grok providers
   * Same API structure as the agent's background.js aiClient
   */
  async function callAI(provider, apiKey, model, systemPrompt, userMessage) {
    if (provider === 'claude') {
      var response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true'
        },
        body: JSON.stringify({
          model: model,
          max_tokens: 500,
          temperature: 0.3,
          system: systemPrompt,
          messages: [{ role: 'user', content: userMessage }]
        })
      });
      if (!response.ok) throw new Error('Claude API error: ' + response.status);
      var data = await response.json();
      return data.content[0].text;
    } else if (provider === 'openai') {
      var resp = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + apiKey
        },
        body: JSON.stringify({
          model: model,
          max_tokens: 500,
          temperature: 0.3,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userMessage }
          ]
        })
      });
      if (!resp.ok) throw new Error('OpenAI API error: ' + resp.status);
      var oData = await resp.json();
      return oData.choices[0].message.content;
    } else if (provider === 'grok') {
      // Grok uses OpenAI-compatible API at api.x.ai
      var grokResp = await fetch('https://api.x.ai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + apiKey
        },
        body: JSON.stringify({
          model: model,
          max_tokens: 500,
          temperature: 0.3,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userMessage }
          ]
        })
      });
      if (!grokResp.ok) throw new Error('Grok API error: ' + grokResp.status);
      var grokData = await grokResp.json();
      return grokData.choices[0].message.content;
    }
    throw new Error('Unknown provider: ' + provider);
  }

  /**
   * Extract DOM from active tab using the dom-extractor content script
   * Sends {action: 'extractDOM'} - handled by dom-extractor-content.js
   */
  async function extractDOMFromTab() {
    var tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    var tab = tabs[0];
    if (!tab || !tab.id) throw new Error('No active tab');

    try {
      return await chrome.tabs.sendMessage(tab.id, {
        action: 'extractDOM',
        options: { includeHidden: false }
      });
    } catch (err) {
      // Content script may not be injected yet, try manual injection
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['dom-extractor-content.js']
      });
      await new Promise(function (r) { setTimeout(r, 200); });
      return await chrome.tabs.sendMessage(tab.id, {
        action: 'extractDOM',
        options: { includeHidden: false }
      });
    }
  }

  /**
   * Generate a page description using AI
   * Prompt derived from dom/sidepanel.js (lines 324-347)
   */
  async function describePageWithAI(extractedData) {
    var settings = await getAISettings();
    if (!settings.apiKey) {
      throw new Error('API key not configured. Set it in Extension Settings (options page).');
    }

    // Prepare compact version (same logic as dom/sidepanel.js lines 309-322)
    var pageContext = {
      title: extractedData.title,
      url: extractedData.url,
      structuredText: (extractedData.formats.structuredText || '').substring(0, 8000),
      interactiveElements: (extractedData.formats.interactiveElements || []).slice(0, 30).map(function (el) {
        return {
          type: el.type,
          text: (el.text || '').substring(0, 100)
        };
      }),
      semanticRegions: (extractedData.formats.semanticRegions || []).map(function (r) {
        return {
          type: r.type,
          label: r.label,
          preview: r.textPreview
        };
      })
    };

    // Same prompt structure as dom/sidepanel.js (lines 324-347)
    var systemPrompt = 'You are a screen reader assistant. Describe web pages concisely for users who cannot see the screen.';

    var userMessage = 'Based on the extracted DOM information below, provide a clear, concise description of what\'s displayed on this webpage.\n\n' +
      'The description should:\n' +
      '1. Start with what type of page/application this is\n' +
      '2. Describe the main content and purpose\n' +
      '3. List key sections and what they contain\n' +
      '4. Mention important interactive elements (buttons, links, forms)\n' +
      '5. Be easy to understand without seeing the actual page\n\n' +
      'Keep the description under 200 words. Use plain language.\n\n' +
      'PAGE TITLE: ' + pageContext.title + '\n' +
      'URL: ' + pageContext.url + '\n\n' +
      'SEMANTIC REGIONS:\n' + JSON.stringify(pageContext.semanticRegions, null, 2) + '\n\n' +
      'KEY INTERACTIVE ELEMENTS:\n' + JSON.stringify(pageContext.interactiveElements, null, 2) + '\n\n' +
      'STRUCTURED CONTENT (truncated):\n' + pageContext.structuredText.substring(0, 4000) + '\n\n' +
      'Provide a clean, human-readable description:';

    return await callAI(settings.provider, settings.apiKey, settings.model, systemPrompt, userMessage);
  }

  /**
   * Get Grok settings from chrome.storage.local
   * Used specifically for voice workflow
   */
  function getGrokSettings() {
    return new Promise(function (resolve) {
      chrome.storage.local.get(['grokApiKey', 'grokModel'], function (result) {
        resolve({
          apiKey: result.grokApiKey || '',
          model: result.grokModel || 'grok-2-latest'
        });
      });
    });
  }

  /**
   * Generate a page description for Voice Workflow
   * Uses Grok as primary, falls back to Claude if Grok fails
   */
  async function describePageForVoiceWorkflow(extractedData) {
    // Prepare the page context (same as describePageWithAI)
    var pageContext = {
      title: extractedData.title,
      url: extractedData.url,
      structuredText: (extractedData.formats.structuredText || '').substring(0, 8000),
      interactiveElements: (extractedData.formats.interactiveElements || []).slice(0, 30).map(function (el) {
        return {
          type: el.type,
          text: (el.text || '').substring(0, 100)
        };
      }),
      semanticRegions: (extractedData.formats.semanticRegions || []).map(function (r) {
        return {
          type: r.type,
          label: r.label,
          preview: r.textPreview
        };
      })
    };

    var systemPrompt = 'You are a screen reader assistant. Describe web pages concisely for users who cannot see the screen.';

    var userMessage = 'Based on the extracted DOM information below, provide a clear, concise description of what\'s displayed on this webpage.\n\n' +
      'The description should:\n' +
      '1. Start with what type of page/application this is\n' +
      '2. Describe the main content and purpose\n' +
      '3. List key sections and what they contain\n' +
      '4. Mention important interactive elements (buttons, links, forms)\n' +
      '5. Be easy to understand without seeing the actual page\n\n' +
      'Keep the description under 200 words. Use plain language.\n\n' +
      'PAGE TITLE: ' + pageContext.title + '\n' +
      'URL: ' + pageContext.url + '\n\n' +
      'SEMANTIC REGIONS:\n' + JSON.stringify(pageContext.semanticRegions, null, 2) + '\n\n' +
      'KEY INTERACTIVE ELEMENTS:\n' + JSON.stringify(pageContext.interactiveElements, null, 2) + '\n\n' +
      'STRUCTURED CONTENT (truncated):\n' + pageContext.structuredText.substring(0, 4000) + '\n\n' +
      'Provide a clean, human-readable description:';

    // Try Grok first
    var grokSettings = await getGrokSettings();
    if (grokSettings.apiKey) {
      try {
        console.log('[VoiceWorkflow] Trying Grok API...');
        var result = await callAI('grok', grokSettings.apiKey, grokSettings.model, systemPrompt, userMessage);
        console.log('[VoiceWorkflow] Grok succeeded');
        return result;
      } catch (grokError) {
        console.warn('[VoiceWorkflow] Grok failed, falling back to Claude:', grokError.message);
      }
    } else {
      console.log('[VoiceWorkflow] No Grok API key, using Claude directly');
    }

    // Fallback to Claude
    var settings = await getAISettings();
    if (!settings.apiKey) {
      throw new Error('No API key configured. Please set up Grok or Claude API key in Settings.');
    }

    console.log('[VoiceWorkflow] Using Claude as fallback');
    return await callAI(settings.provider, settings.apiKey, settings.model, systemPrompt, userMessage);
  }

  // Describe Page button click
  describePageBtn.addEventListener('click', async function () {
    describePageBtn.disabled = true;
    describePageBtn.textContent = 'Analyzing...';
    pageDescriptionOutput.textContent = 'Extracting page DOM and generating description...';

    try {
      var domData = await extractDOMFromTab();
      var description = await describePageWithAI(domData);
      pageDescriptionOutput.textContent = description;
    } catch (err) {
      pageDescriptionOutput.textContent = 'Error: ' + err.message;
    } finally {
      describePageBtn.disabled = false;
      describePageBtn.innerHTML = '<span>&#x1F50D;</span> Describe Current Page';
    }
  });

  // =============================================
  // SECTION 5.5: VOICE COMMANDS MODE (Simple)
  // Just speak → send to agent → speak result
  // No automatic page description cycle
  // =============================================

  var voiceCommandsActive = false;
  var voiceCommandsToggle = document.getElementById('voice-commands-toggle');
  var voiceCommandsStatus = document.getElementById('voice-commands-status');
  var voiceCommandsFeedback = document.getElementById('voice-commands-feedback');

  if (voiceCommandsToggle) {
    voiceCommandsToggle.addEventListener('change', function () {
      if (voiceCommandsToggle.checked) {
        // Turn off voice workflow if it's on
        if (voiceWorkflowActive && voiceWorkflowToggle) {
          voiceWorkflowToggle.checked = false;
          voiceWorkflowActive = false;
          workflowStatusEl.textContent = 'Off';
          workflowStatusEl.classList.remove('active');
        }

        voiceCommandsActive = true;
        voiceCommandsStatus.textContent = 'Listening';
        voiceCommandsStatus.classList.add('active');
        updateVoiceCommandsFeedback('Listening for your command...');
        startSTT();
      } else {
        voiceCommandsActive = false;
        voiceCommandsStatus.textContent = 'Off';
        voiceCommandsStatus.classList.remove('active');
        updateVoiceCommandsFeedback('');
        stopSTT();
        if (synth.speaking) synth.cancel();
      }
    });
  }

  function updateVoiceCommandsFeedback(text) {
    if (voiceCommandsFeedback) {
      voiceCommandsFeedback.textContent = text;
    }
  }

  /**
   * Handle voice command: send to agent and speak result
   * Uses Grok → Claude fallback for command processing
   */
  async function voiceCommandsSendCommand(command) {
    if (!voiceCommandsActive) return;

    try {
      updateVoiceCommandsFeedback('Processing: "' + command + '" (Grok → Claude)...');

      var tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      var tabId = tabs[0] ? tabs[0].id : undefined;

      // Try Grok first
      var grokSettings = await getGrokSettings();
      var resultMessage = null;

      if (grokSettings.apiKey) {
        try {
          console.log('[VoiceCommands] Trying Grok for command...');

          var domData = await extractDOMFromTab();
          var elements = (domData.formats.interactiveElements || []).slice(0, 15).map(function (el) {
            return el.type + ': "' + (el.text || '').substring(0, 40) + '"';
          }).join('\n');

          var systemPrompt = 'You are a browser assistant. Respond briefly to confirm the action. Keep under 20 words.';
          var userMessage = 'Page: ' + domData.title + '\nElements:\n' + elements + '\n\nCommand: "' + command + '"';

          var grokResponse = await callAI('grok', grokSettings.apiKey, grokSettings.model, systemPrompt, userMessage);
          console.log('[VoiceCommands] Grok response:', grokResponse);

          // Execute via background.js
          var response = await chrome.runtime.sendMessage({
            type: 'PROCESS_COMMAND',
            payload: { command: command, tabId: tabId },
            timestamp: Date.now()
          });

          if (response && response.data && response.data.message) {
            resultMessage = response.data.message;
          } else if (response && response.error) {
            resultMessage = 'Error: ' + response.error;
          } else {
            resultMessage = grokResponse.substring(0, 80);
          }

        } catch (grokError) {
          console.warn('[VoiceCommands] Grok failed, using Claude:', grokError.message);
        }
      }

      // Fallback to just background.js
      if (!resultMessage) {
        console.log('[VoiceCommands] Using Claude/background agent');
        var response = await chrome.runtime.sendMessage({
          type: 'PROCESS_COMMAND',
          payload: { command: command, tabId: tabId },
          timestamp: Date.now()
        });

        resultMessage = 'Done.';
        if (response && response.data && response.data.message) {
          resultMessage = response.data.message;
        } else if (response && response.error) {
          resultMessage = 'Error: ' + response.error;
        } else if (response && response.message) {
          resultMessage = response.message;
        }
      }

      if (!voiceCommandsActive) return;

      updateVoiceCommandsFeedback('Agent: ' + resultMessage);

      // Speak the result
      speakText(resultMessage, function () {
        if (voiceCommandsActive) {
          updateVoiceCommandsFeedback('Listening for your command...');
        }
      });

    } catch (err) {
      updateVoiceCommandsFeedback('Error: ' + err.message);
      if (voiceCommandsActive) {
        setTimeout(function () {
          updateVoiceCommandsFeedback('Listening for your command...');
        }, 2000);
      }
    }
  }

  // =============================================
  // SECTION 6: VOICE WORKFLOW ORCHESTRATION
  // Cycle: Extract DOM -> AI describe -> TTS -> STT listen -> PROCESS_COMMAND -> repeat
  // =============================================

  var voiceWorkflowActive = false;
  var voiceWorkflowToggle = document.getElementById('voice-workflow-toggle');
  var workflowStatusEl = document.getElementById('workflow-status');
  var stepIndicator = document.getElementById('workflow-step-indicator');

  voiceWorkflowToggle.addEventListener('change', function () {
    if (voiceWorkflowToggle.checked) {
      // Turn off voice commands if it's on
      if (voiceCommandsActive && voiceCommandsToggle) {
        voiceCommandsToggle.checked = false;
        voiceCommandsActive = false;
        voiceCommandsStatus.textContent = 'Off';
        voiceCommandsStatus.classList.remove('active');
        updateVoiceCommandsFeedback('');
      }

      voiceWorkflowActive = true;
      workflowStatusEl.textContent = 'Active';
      workflowStatusEl.classList.add('active');
      startVoiceWorkflowCycle();
    } else {
      voiceWorkflowActive = false;
      workflowStatusEl.textContent = 'Off';
      workflowStatusEl.classList.remove('active');
      stopSTT();
      if (synth.speaking) synth.cancel();
      updateStepIndicator('');
    }
  });

  async function startVoiceWorkflowCycle() {
    if (!voiceWorkflowActive) return;

    try {
      // Step 1: Extract DOM (only needed if describing page)
      var domData = null;
      var description = null;

      // Step 2: Try to get AI description (optional - if it fails, skip to listening)
      try {
        updateStepIndicator('Extracting page information...');
        domData = await extractDOMFromTab();
        if (!voiceWorkflowActive) return;

        updateStepIndicator('AI is describing the page (Grok → Claude)...');
        description = await describePageForVoiceWorkflow(domData);
        pageDescriptionOutput.textContent = description;
        if (!voiceWorkflowActive) return;

        // Step 3: Speak the description via TTS
        updateStepIndicator('Speaking page description...');
        await new Promise(function (resolve) {
          speakText(description, resolve);
        });
        if (!voiceWorkflowActive) return;

      } catch (descErr) {
        // If page description fails (no API key, etc), skip to listening
        console.warn('[VoiceWorkflow] Page description failed, skipping to listen:', descErr.message);
        updateStepIndicator('Skipping description (API error). Listening for your command...');

        // Speak a brief notification
        await new Promise(function (resolve) {
          speakText('Ready for your command.', resolve);
        });
        if (!voiceWorkflowActive) return;
      }

      // Step 4: Listen for user command via STT
      updateStepIndicator('Listening for your command...');
      startSTT();
      // The STT onresult handler (Section 3) will detect voiceWorkflowActive
      // and call voiceWorkflowSendCommand() when a final transcript arrives.

    } catch (err) {
      updateStepIndicator('Error: ' + err.message);
      voiceWorkflowActive = false;
      voiceWorkflowToggle.checked = false;
      workflowStatusEl.textContent = 'Off';
      workflowStatusEl.classList.remove('active');
    }
  }

  /**
   * Voice workflow send command with Grok → Claude fallback.
   * Called by STT onresult when voice workflow is active and final transcript received.
   * Tries Grok for intent analysis first, then falls back to PROCESS_COMMAND.
   */
  async function voiceWorkflowSendCommand(command) {
    if (!voiceWorkflowActive) return;

    try {
      updateStepIndicator('Processing: "' + command + '" (Grok → Claude)...');

      var tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      var tabId = tabs[0] ? tabs[0].id : undefined;

      // Try Grok first for natural language understanding
      var grokSettings = await getGrokSettings();
      var resultMessage = null;

      if (grokSettings.apiKey) {
        try {
          console.log('[VoiceWorkflow] Trying Grok for command processing...');

          // Get DOM context for command processing
          var domData = await extractDOMFromTab();
          var elements = (domData.formats.interactiveElements || []).slice(0, 20).map(function (el) {
            return el.type + ': "' + (el.text || '').substring(0, 50) + '"';
          }).join('\n');

          var systemPrompt = 'You are a browser assistant. Based on the user command and page context, respond with a brief action confirmation. If the command is a scroll/click/navigate action, confirm what you would do. Keep responses under 30 words.';

          var userMessage = 'Page: ' + domData.title + '\nURL: ' + domData.url +
            '\n\nInteractive elements:\n' + elements +
            '\n\nUser command: "' + command + '"\n\nBriefly confirm what action to take:';

          var grokResponse = await callAI('grok', grokSettings.apiKey, grokSettings.model, systemPrompt, userMessage);
          console.log('[VoiceWorkflow] Grok response:', grokResponse);

          // Now still send to background.js for actual execution
          var response = await chrome.runtime.sendMessage({
            type: 'PROCESS_COMMAND',
            payload: {
              command: command,
              tabId: tabId
            },
            timestamp: Date.now()
          });

          if (response && response.data && response.data.message) {
            resultMessage = response.data.message;
          } else if (response && response.error) {
            resultMessage = 'Error: ' + response.error;
          } else {
            resultMessage = grokResponse.substring(0, 100); // Use Grok response as fallback
          }

        } catch (grokError) {
          console.warn('[VoiceWorkflow] Grok failed for command, using background agent only:', grokError.message);
        }
      }

      // Fallback to just PROCESS_COMMAND if Grok wasn't available or failed
      if (!resultMessage) {
        console.log('[VoiceWorkflow] Using Claude/background agent for command');
        var response = await chrome.runtime.sendMessage({
          type: 'PROCESS_COMMAND',
          payload: {
            command: command,
            tabId: tabId
          },
          timestamp: Date.now()
        });

        resultMessage = 'Action completed.';
        if (response && response.payload && response.payload.message) {
          resultMessage = response.payload.message;
        } else if (response && response.data && response.data.message) {
          resultMessage = response.data.message;
        } else if (response && response.error) {
          resultMessage = 'Error: ' + response.error;
        } else if (response && response.message) {
          resultMessage = response.message;
        }
      }

      if (!voiceWorkflowActive) return;

      updateStepIndicator('Agent: ' + resultMessage);

      // Speak the result
      await new Promise(function (resolve) {
        speakText(resultMessage, resolve);
      });

      if (!voiceWorkflowActive) return;

      // Brief pause then repeat cycle
      await new Promise(function (r) { setTimeout(r, 500); });
      startVoiceWorkflowCycle();

    } catch (err) {
      updateStepIndicator('Error: ' + err.message);
      // Try to continue the cycle despite errors
      if (voiceWorkflowActive) {
        await new Promise(function (r) { setTimeout(r, 2000); });
        startVoiceWorkflowCycle();
      }
    }
  }

  // Also listen for COMMAND_RESULT messages from background
  // (in case the agent responds via separate message instead of sendResponse)
  chrome.runtime.onMessage.addListener(function (message) {
    if (message && message.type === 'COMMAND_RESULT' && voiceWorkflowActive) {
      // The sendMessage response handler already handles this,
      // but this serves as a backup listener
      var msg = (message.payload && message.payload.message) || '';
      if (msg) {
        updateStepIndicator('Agent: ' + msg);
      }
    }
  });

  function updateStepIndicator(text) {
    if (stepIndicator) stepIndicator.textContent = text;
  }

  // =============================================
  // SECTION 6: ACCESSIBILITY TOGGLES
  // Reuses exact logic from UI editing/popup/popup.js
  // Storage: chrome.storage.sync with key 'preferences'
  // Message: {action: 'updateSettings', settings: {...}}
  // =============================================

  var accessibilityToggles = [
    { dashId: 'dash-mode-dyslexia', storageKey: 'mode-dyslexia' },
    { dashId: 'dash-mode-adhd', storageKey: 'mode-adhd' },
    { dashId: 'dash-mode-contrast', storageKey: 'mode-contrast' },
    { dashId: 'dash-mode-cognitive', storageKey: 'mode-cognitive' },
    { dashId: 'dash-mode-large-text', storageKey: 'mode-large-text' },
    { dashId: 'dash-mode-calm', storageKey: 'mode-calm' },
    { dashId: 'dash-mode-neuro', storageKey: 'mode-neuro' },
    { dashId: 'dash-mode-seizure', storageKey: 'mode-seizure' },
    { dashId: 'dash-mode-neon', storageKey: 'mode-neon' }
  ];

  // Load saved settings (same as UI editing/popup/popup.js)
  chrome.storage.sync.get(['preferences'], function (result) {
    var prefs = result.preferences || {};
    accessibilityToggles.forEach(function (item) {
      var toggle = document.getElementById(item.dashId);
      if (toggle) {
        toggle.checked = prefs[item.storageKey] || false;
        toggle.addEventListener('change', function () {
          saveAccessibilityPreferences();
          applyAccessibilityToActiveTab();
        });
      }
    });
  });

  // Display current site (same as UI editing/popup/popup.js)
  chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
    if (tabs[0] && tabs[0].url) {
      try {
        var url = new URL(tabs[0].url);
        document.getElementById('dash-current-site').textContent = url.hostname;
      } catch (e) {
        document.getElementById('dash-current-site').textContent = 'Extension Page';
      }
    }
  });

  // Get current toggle settings (same as UI editing/popup/popup.js getCurrentSettings)
  function getAccessibilitySettings() {
    var prefs = {};
    accessibilityToggles.forEach(function (item) {
      var toggle = document.getElementById(item.dashId);
      if (toggle) prefs[item.storageKey] = toggle.checked;
    });
    return prefs;
  }

  // Save to chrome.storage.sync (same as UI editing/popup/popup.js savePreferences)
  function saveAccessibilityPreferences() {
    var prefs = getAccessibilitySettings();
    chrome.storage.sync.set({ preferences: prefs }, function () {
      console.log('Accessibility settings saved');
    });
  }

  // Send updateSettings to content script (same as UI editing/popup/popup.js applySettingsToActiveTab)
  function applyAccessibilityToActiveTab() {
    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
      if (tabs[0] && tabs[0].id) {
        chrome.tabs.sendMessage(tabs[0].id, {
          action: 'updateSettings',
          settings: getAccessibilitySettings()
        });
      }
    });
  }

  // =============================================
  // SECTION 7: SETTINGS MANAGEMENT
  // Allows users to configure API key, provider, and models
  // Saves to chrome.storage.local (same storage as background.js)
  // =============================================

  var settingsProvider = document.getElementById('settings-provider');
  var settingsApiKey = document.getElementById('settings-api-key');
  var settingsToggleKey = document.getElementById('settings-toggle-key');
  var settingsIntentModel = document.getElementById('settings-intent-model');
  var settingsCodegenModel = document.getElementById('settings-codegen-model');
  var settingsSaveBtn = document.getElementById('settings-save-btn');
  var settingsStatus = document.getElementById('settings-status');

  // Grok settings for voice workflow
  var settingsGrokKey = document.getElementById('settings-grok-key');
  var settingsToggleGrokKey = document.getElementById('settings-toggle-grok-key');
  var settingsGrokModel = document.getElementById('settings-grok-model');

  // Default model names for each provider
  var defaultModels = {
    claude: {
      intent: 'claude-3-5-haiku-20241022',
      codegen: 'claude-sonnet-4-20250514'
    },
    openai: {
      intent: 'gpt-4o-mini',
      codegen: 'gpt-4o'
    }
  };

  // Load saved settings on panel open
  function loadSettings() {
    chrome.storage.local.get(['provider', 'apiKey', 'intentModel', 'codeGenModel', 'grokApiKey', 'grokModel'], function (result) {
      if (settingsProvider) {
        settingsProvider.value = result.provider || 'claude';
      }
      if (settingsApiKey) {
        settingsApiKey.value = result.apiKey || '';
      }
      if (settingsIntentModel) {
        settingsIntentModel.value = result.intentModel || '';
        settingsIntentModel.placeholder = defaultModels[result.provider || 'claude'].intent;
      }
      if (settingsCodegenModel) {
        settingsCodegenModel.value = result.codeGenModel || '';
        settingsCodegenModel.placeholder = defaultModels[result.provider || 'claude'].codegen;
      }
      // Load Grok settings
      if (settingsGrokKey) {
        settingsGrokKey.value = result.grokApiKey || '';
      }
      if (settingsGrokModel) {
        settingsGrokModel.value = result.grokModel || '';
      }
    });
  }

  // Update placeholder models when provider changes
  if (settingsProvider) {
    settingsProvider.addEventListener('change', function () {
      var provider = settingsProvider.value;
      if (settingsIntentModel) {
        settingsIntentModel.placeholder = defaultModels[provider].intent;
      }
      if (settingsCodegenModel) {
        settingsCodegenModel.placeholder = defaultModels[provider].codegen;
      }
    });
  }

  // Toggle API key visibility
  if (settingsToggleKey && settingsApiKey) {
    settingsToggleKey.addEventListener('click', function () {
      if (settingsApiKey.type === 'password') {
        settingsApiKey.type = 'text';
        settingsToggleKey.innerHTML = '&#x1F512;'; // Lock icon
      } else {
        settingsApiKey.type = 'password';
        settingsToggleKey.innerHTML = '&#x1F441;'; // Eye icon
      }
    });
  }

  // Toggle Grok API key visibility
  if (settingsToggleGrokKey && settingsGrokKey) {
    settingsToggleGrokKey.addEventListener('click', function () {
      if (settingsGrokKey.type === 'password') {
        settingsGrokKey.type = 'text';
        settingsToggleGrokKey.innerHTML = '&#x1F512;'; // Lock icon
      } else {
        settingsGrokKey.type = 'password';
        settingsToggleGrokKey.innerHTML = '&#x1F441;'; // Eye icon
      }
    });
  }

  // Show status message
  function showSettingsStatus(message, isError) {
    if (settingsStatus) {
      settingsStatus.textContent = message;
      settingsStatus.className = 'settings-status ' + (isError ? 'error' : 'success');
      // Clear after 3 seconds
      setTimeout(function () {
        settingsStatus.textContent = '';
        settingsStatus.className = 'settings-status';
      }, 3000);
    }
  }

  // Save settings
  if (settingsSaveBtn) {
    settingsSaveBtn.addEventListener('click', function () {
      var provider = settingsProvider ? settingsProvider.value : 'claude';
      var apiKey = settingsApiKey ? settingsApiKey.value.trim() : '';
      var intentModel = settingsIntentModel ? settingsIntentModel.value.trim() : '';
      var codeGenModel = settingsCodegenModel ? settingsCodegenModel.value.trim() : '';

      // Grok settings
      var grokApiKey = settingsGrokKey ? settingsGrokKey.value.trim() : '';
      var grokModel = settingsGrokModel ? settingsGrokModel.value.trim() : '';

      // Use defaults if not specified
      if (!intentModel) {
        intentModel = defaultModels[provider].intent;
      }
      if (!codeGenModel) {
        codeGenModel = defaultModels[provider].codegen;
      }
      if (!grokModel) {
        grokModel = 'grok-2-latest';
      }

      // Validate - need at least one API key
      if (!apiKey && !grokApiKey) {
        showSettingsStatus('Please enter at least one API key (Grok or Claude/OpenAI)', true);
        return;
      }

      // Save to chrome.storage.local
      chrome.storage.local.set({
        provider: provider,
        apiKey: apiKey,
        intentModel: intentModel,
        codeGenModel: codeGenModel,
        grokApiKey: grokApiKey,
        grokModel: grokModel
      }, function () {
        if (chrome.runtime.lastError) {
          showSettingsStatus('Error saving settings: ' + chrome.runtime.lastError.message, true);
        } else {
          showSettingsStatus('Settings saved successfully!', false);

          // Notify background script that settings were updated
          chrome.runtime.sendMessage({
            type: 'SETTINGS_UPDATED',
            timestamp: Date.now()
          });
        }
      });
    });
  }

  // Load settings when panel opens
  loadSettings();

})();

