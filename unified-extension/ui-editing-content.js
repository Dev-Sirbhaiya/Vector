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
    adhd: false
};

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
