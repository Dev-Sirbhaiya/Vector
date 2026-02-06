// iNTUition Interceptor (Main World)
// Runs in page context to hijack API calls

(function () {
    console.log("iNTUition: Main World Interceptor Started");

    let seizureModeEnabled = false;
    let killInterval = null;
    const originalRAF = window.requestAnimationFrame;

    // 1. Hijack requestAnimationFrame
    window.requestAnimationFrame = function (callback) {
        if (seizureModeEnabled) {
            // Drop the frame request
            return -1;
        }
        return originalRAF.call(window, callback);
    };

    function freezeAnimations() {
        // Pause Web Animations API
        if (document.getAnimations) {
            document.getAnimations().forEach(anim => {
                try {
                    anim.pause();
                } catch (e) { } // ignore invalid state
            });
        }

        // Pause Videos
        document.querySelectorAll('video').forEach(vid => {
            if (!vid.paused) vid.pause();
        });
    }

    // Listen for toggle
    document.addEventListener('intuition-seizure-toggle', (e) => {
        seizureModeEnabled = e.detail.enabled;
        console.log("iNTUition: Seizure Mode ->", seizureModeEnabled);

        if (seizureModeEnabled) {
            freezeAnimations();
            // Polling loop to catch new animations (React re-renders, etc)
            if (killInterval) clearInterval(killInterval);
            killInterval = setInterval(freezeAnimations, 500);

            // Force CSS variable override if needed
            document.documentElement.style.setProperty('--intuition-play-state', 'paused');
        } else {
            if (killInterval) clearInterval(killInterval);
            killInterval = null;

            // Resume
            if (document.getAnimations) {
                document.getAnimations().forEach(anim => anim.play());
            }
            document.querySelectorAll('video').forEach(vid => vid.play());
            document.documentElement.style.removeProperty('--intuition-play-state');
        }
    });

})();
