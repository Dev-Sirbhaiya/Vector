/**
 * permission.js
 * Handles granting microphone OR camera permissions.
 * Opened via: permission.html?type=microphone  (default)
 *         or: permission.html?type=camera
 */
const grantBtn = document.getElementById('grantBtn');
const requestUI = document.getElementById('requestUI');
const successUI = document.getElementById('successUI');
const permIcon = document.getElementById('permIcon');
const permTitle = document.getElementById('permTitle');
const permDesc = document.getElementById('permDesc');

// Determine which permission to request from query params
const urlParams = new URLSearchParams(window.location.search);
const permType = urlParams.get('type') === 'camera' ? 'camera' : 'microphone';

// Update UI text based on permission type
if (permType === 'camera') {
    permIcon.textContent = '📷';
    permTitle.textContent = 'Camera Access Needed';
    permDesc.textContent = 'Vector Buddy needs access to your camera for eye and finger tracking. Chrome requires you to grant this permission in a tab once.';
    grantBtn.textContent = 'Allow Camera';
}

grantBtn.addEventListener('click', async () => {
    try {
        const constraints = permType === 'camera'
            ? { video: true }
            : { audio: true };

        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        // Stop immediately, we just needed the permission grant
        stream.getTracks().forEach(track => track.stop());

        // Show success
        requestUI.style.display = 'none';
        successUI.style.display = 'flex';
    } catch (err) {
        console.error(err);
        const label = permType === 'camera' ? 'camera' : 'microphone';
        alert('Permission was denied. Please try again and click "Allow" when prompted for ' + label + ' access.');
    }
});

// Auto-check on load if already granted
navigator.permissions.query({ name: permType }).then(permissionStatus => {
    if (permissionStatus.state === 'granted') {
        requestUI.style.display = 'none';
        successUI.style.display = 'flex';
    }
}).catch(() => {
    // Some browsers may not support querying camera permission
});
