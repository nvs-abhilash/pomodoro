const settingsForm = document.getElementById('settingsForm');
const musicUrlInput = document.getElementById('musicUrl');

// Load saved settings
chrome.storage.sync.get(['musicUrl'], (result) => {
    if (result.musicUrl) {
        musicUrlInput.value = result.musicUrl;
    }
});

// Save settings
settingsForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const musicUrl = musicUrlInput.value;
    chrome.storage.sync.set({ musicUrl }, () => {
        alert('Settings saved!');
    });
});
