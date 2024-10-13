let audio = new Audio();

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    switch (request.action) {
        case 'playMusic':
            audio.src = request.musicUrl;
            audio.loop = true;
            audio.play().catch(error => console.error('Error playing audio:', error));
            break;
        case 'stopMusic':
            audio.pause();
            audio.currentTime = 0;
            break;
    }
});
