console.log("iNTUition: Nuclear Engine Loaded");

let state = {
    dyslexia: false,
    contrast: false,
    calm: false,
    cognitive: false,
    large: false,
    neon: false,
    seizure: false,
    neuro: false,
    adhd: false,
    // Color blindness modes (mutually exclusive)
    deuteranopia: false,
    protanopia: false,
    tritanopia: false,
    achromatopsia: false
};

// SVG filter injection flag
let svgFiltersInjected = false;

// 1. Get initial state
chrome.storage.sync.get(['preferences'], (res) => {
    if (res.preferences) {
        mapState(res.preferences);
    }
});

// 2. Listen for updates
chrome.runtime.onMessage.addListener((req) => {
    if (req.action === "updateSettings") {
        mapState(req.settings);
    }
});

function mapState(prefs) {
    state.dyslexia = prefs['mode-dyslexia'];
    state.contrast = prefs['mode-contrast'];
    state.calm = prefs['mode-calm'];
    state.cognitive = prefs['mode-cognitive'];
    state.large = prefs['mode-large-text'];
    state.neon = prefs['mode-neon'];
    state.seizure = prefs['mode-seizure'];
    state.neuro = prefs['mode-neuro'];
    state.adhd = prefs['mode-adhd'];

    // Color blindness modes
    state.deuteranopia = prefs['mode-deuteranopia'];
    state.protanopia = prefs['mode-protanopia'];
    state.tritanopia = prefs['mode-tritanopia'];
    state.achromatopsia = prefs['mode-achromatopsia'];

    // Inject SVG filters if any color blindness mode is active
    if (state.deuteranopia || state.protanopia || state.tritanopia || state.achromatopsia) {
        injectColorBlindSVGFilters();
    }

    // ADHD separate handler
    handleADHD(state.adhd);
}

// 3. THE NUCLEAR LOOP (Runs every 500ms)
setInterval(() => {
    const html = document.documentElement;

    // Apply Classes
    applyClass(html, 'intuition-dyslexia-mode', state.dyslexia);
    applyClass(html, 'intuition-contrast-mode', state.contrast);
    applyClass(html, 'intuition-calm-mode', state.calm);
    applyClass(html, 'intuition-cognitive-mode', state.cognitive);
    applyClass(html, 'intuition-large-text', state.large);
    applyClass(html, 'intuition-neon-mode', state.neon);
    applyClass(html, 'intuition-seizure-mode', state.seizure);

    // Color blindness modes (mutually exclusive - CSS handles the visuals)
    applyClass(html, 'intuition-deuteranopia-mode', state.deuteranopia);
    applyClass(html, 'intuition-protanopia-mode', state.protanopia);
    applyClass(html, 'intuition-tritanopia-mode', state.tritanopia);
    applyClass(html, 'intuition-achromatopsia-mode', state.achromatopsia);

    // Seizure Guard Logic (Repeatedly enforce)
    if (state.seizure) {
        // Pause videos
        document.querySelectorAll('video').forEach(v => {
            if (!v.paused) v.pause();
        });
        // Hide canvases (often used for complex animations)
        document.querySelectorAll('canvas').forEach(c => {
            c.style.display = 'none';
        });
    } else {
        // Restore canvases
        document.querySelectorAll('canvas').forEach(c => {
            c.style.display = '';
        });
    }

    // Neuro Bolding Logic (Incremental)
    if (state.neuro) {
        document.body.classList.add('neuro-active');
        // Find unprocessed text blocks
        const blocks = document.querySelectorAll('p:not(.neuro-done), li:not(.neuro-done), h1:not(.neuro-done), h2:not(.neuro-done), h3:not(.neuro-done)');
        blocks.forEach(el => {
            // Apply bionic reading
            bionicfy(el);
            el.classList.add('neuro-done');
        });
    } else {
        document.body.classList.remove('neuro-active');
    }

}, 500);

// Helper
function applyClass(el, cls, active) {
    if (active && !el.classList.contains(cls)) el.classList.add(cls);
    if (!active && el.classList.contains(cls)) el.classList.remove(cls);
}

// Bionic Logic
function bionicfy(el) {
    // Only process if it has simple text content to avoid breaking nested HTML
    // A smarter check: iterate child nodes
    Array.from(el.childNodes).forEach(node => {
        if (node.nodeType === 3) { // Text
            const text = node.nodeValue;
            if (text.trim().length > 0) {
                const span = document.createElement('span');
                span.innerHTML = text.split(' ').map(w => {
                    const len = w.length;
                    if (len < 2) return w;
                    const mid = Math.ceil(len / 2);
                    return `<b>${w.slice(0, mid)}</b>${w.slice(mid)}`;
                }).join(' ');
                el.replaceChild(span, node);
            }
        }
    });
}

// ADHD Ruler Logic (Separate from loop)
let adhdRuler = null;
function handleADHD(active) {
    if (!adhdRuler) {
        adhdRuler = document.createElement('div');
        adhdRuler.id = 'intuition-reading-ruler';
        document.body.appendChild(adhdRuler);
        document.addEventListener('mousemove', e => {
            if (adhdRuler.style.display === 'block') {
                adhdRuler.style.top = (e.clientY - 60) + 'px';
            }
        });
    }

    if (active) adhdRuler.style.display = 'block';
    else adhdRuler.style.display = 'none';
}

// =============================================
// COLOR BLINDNESS SVG FILTER INJECTION
// Daltonization matrices for accurate color simulation
// These are visible in DevTools and not hidden by CSS
// =============================================

function injectColorBlindSVGFilters() {
    if (svgFiltersInjected) return;

    const svgNS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(svgNS, 'svg');
    svg.setAttribute('id', 'intuition-colorblind-filters');
    svg.setAttribute('xmlns', svgNS);
    svg.setAttribute('version', '1.1');
    // Position off-screen but NOT display:none (browsers need it visible)
    svg.style.cssText = 'position: absolute; width: 0; height: 0; overflow: hidden;';

    // Create defs element to contain filters
    const defs = document.createElementNS(svgNS, 'defs');

    // Protanopia filter (Red-cone deficiency)
    const protFilter = document.createElementNS(svgNS, 'filter');
    protFilter.setAttribute('id', 'intuition-protanopia-filter');
    protFilter.setAttribute('color-interpolation-filters', 'sRGB');
    protFilter.innerHTML = `<feColorMatrix type="matrix" values="0.567, 0.433, 0, 0, 0, 0.558, 0.442, 0, 0, 0, 0, 0.242, 0.758, 0, 0, 0, 0, 0, 1, 0" />`;
    defs.appendChild(protFilter);

    // Deuteranopia filter (Green-cone deficiency)
    const deutFilter = document.createElementNS(svgNS, 'filter');
    deutFilter.setAttribute('id', 'intuition-deuteranopia-filter');
    deutFilter.setAttribute('color-interpolation-filters', 'sRGB');
    deutFilter.innerHTML = `<feColorMatrix type="matrix" values="0.625, 0.375, 0, 0, 0, 0.7, 0.3, 0, 0, 0, 0, 0.3, 0.7, 0, 0, 0, 0, 0, 1, 0" />`;
    defs.appendChild(deutFilter);

    // Tritanopia filter (Blue-cone deficiency)
    const tritFilter = document.createElementNS(svgNS, 'filter');
    tritFilter.setAttribute('id', 'intuition-tritanopia-filter');
    tritFilter.setAttribute('color-interpolation-filters', 'sRGB');
    tritFilter.innerHTML = `<feColorMatrix type="matrix" values="0.95, 0.05, 0, 0, 0, 0, 0.433, 0.567, 0, 0, 0, 0.475, 0.525, 0, 0, 0, 0, 0, 1, 0" />`;
    defs.appendChild(tritFilter);

    // Achromatopsia filter (Complete color blindness / Monochromacy)
    const achroFilter = document.createElementNS(svgNS, 'filter');
    achroFilter.setAttribute('id', 'intuition-achromatopsia-filter');
    achroFilter.setAttribute('color-interpolation-filters', 'sRGB');
    achroFilter.innerHTML = `<feColorMatrix type="matrix" values="0.299, 0.587, 0.114, 0, 0, 0.299, 0.587, 0.114, 0, 0, 0.299, 0.587, 0.114, 0, 0, 0, 0, 0, 1, 0" />`;
    defs.appendChild(achroFilter);

    svg.appendChild(defs);

    // Insert at beginning of body to ensure it's available
    if (document.body) {
        document.body.insertBefore(svg, document.body.firstChild);
        svgFiltersInjected = true;
        console.log('iNTUition: Color blindness SVG filters injected');
    } else {
        // Fallback: wait for body
        document.addEventListener('DOMContentLoaded', () => {
            document.body.insertBefore(svg, document.body.firstChild);
            svgFiltersInjected = true;
            console.log('iNTUition: Color blindness SVG filters injected (deferred)');
        });
    }
}
