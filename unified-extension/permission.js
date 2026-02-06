const grantBtn = document.getElementById('grantBtn');
const requestUI = document.getElementById('requestUI');
const successUI = document.getElementById('successUI');

grantBtn.addEventListener('click', async () => {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        // Stop immediately, we just needed the permission grant
        stream.getTracks().forEach(track => track.stop());

        // Show success
        requestUI.style.display = 'none';
        successUI.style.display = 'flex';
    } catch (err) {
        console.error(err);
        alert('Permission was denied. Please try again and click "Allow" when prompted.');
    }
});

// Auto-try on load just in case it was already granted but forgot
navigator.permissions.query({ name: 'microphone' }).then(permissionStatus => {
    if (permissionStatus.state === 'granted') {
        requestUI.style.display = 'none';
        successUI.style.display = 'flex';
    }
});
