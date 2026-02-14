
// Connect to the extension
// Note: calibration.js is an extension page script, so it can use chrome.runtime.sendMessage
// and chrome.runtime.onMessage directly.

const instructions = document.getElementById("instructions");
const dot = document.getElementById("calibration-dot");
const progress = document.getElementById("progress");

let isCalibrating = false;

// Listen for messages from extension (tracking-manager.js)
chrome.runtime.onMessage.addListener((msg) => {
    switch (msg.type) {
        case "SHOW_POINT":
            showPoint(msg.x, msg.y, msg.index, msg.total);
            break;
        case "STOP_RECORDING":
            stopRecording();
            break;
        case "CALIBRATION_COMPLETE":
            finishCalibration();
            break;
    }
});

document.body.addEventListener("click", () => {
    if (!isCalibrating) {
        isCalibrating = true;
        instructions.classList.add("hidden");
        // Send start signal to tracking-manager.js
        chrome.runtime.sendMessage({ type: "CALIBRATION_START" });
    }
});

function showPoint(x, y, index, total) {
    // Update position
    const px = x * window.innerWidth;
    const py = y * window.innerHeight;

    dot.style.left = `${px}px`;
    dot.style.top = `${py}px`;
    dot.style.display = "block";
    dot.classList.remove("recording"); // Ensure red

    progress.innerText = `Point ${index} of ${total}`;

    // Wait 1.5s for fixation
    setTimeout(() => {
        // Turn green and tell extension to start recording
        dot.classList.add("recording");
        chrome.runtime.sendMessage({ type: "START_RECORDING" });
    }, 1500);
}

function stopRecording() {
    dot.style.display = "none";
    dot.classList.remove("recording");
    // Tell extension we are done with this point
    chrome.runtime.sendMessage({ type: "POINT_FINISHED" });
}

function finishCalibration() {
    dot.style.display = "none";
    progress.innerText = "";
    instructions.innerHTML = "<h1>Calibration Complete!</h1><p>You can close this tab.</p>";
    instructions.classList.remove("hidden");

    setTimeout(() => {
        window.close();
    }, 2000);
}
