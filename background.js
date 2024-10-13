let timer;
let timeLeft = 25 * 60; // 25 minutes in seconds for focus session
let isRunning = false;
let isFocusSession = true;
let isEditing = false;
let focusSessionsCompleted = 0;
let dailyFocusSessions = {};
const FOCUS_SESSION_LENGTH = 25 * 60;
const BREAK_SESSION_LENGTH = 5 * 60;
let isMusicOn = false;
let musicTab = null;
let musicUrl = '';

function updateTimer() {
    if (isRunning && !isEditing) {
        timeLeft--;
        if (timeLeft === 0) {
            isRunning = false;
            clearInterval(timer);
            
            if (isFocusSession) {
                // Switch to break session
                isFocusSession = false;
                timeLeft = BREAK_SESSION_LENGTH;
                focusSessionsCompleted++;
                updateDailyFocusSessions();
                chrome.notifications.create({
                    type: 'basic',
                    iconUrl: 'images/demure_pomodoro_icon_128x128.png',
                    title: 'Zen Pomodoro',
                    message: 'Focus session completed! Time for a 5-minute break.',
                    priority: 2
                });
            } else {
                // Switch back to focus session
                isFocusSession = true;
                timeLeft = FOCUS_SESSION_LENGTH;
                chrome.notifications.create({
                    type: 'basic',
                    iconUrl: 'images/demure_pomodoro_icon_128x128.png',
                    title: 'Zen Pomodoro',
                    message: 'Break time over! Ready for another focus session?',
                    priority: 2
                });
            }
            startTimer(); // Automatically start the next session
        }
    }
}

function startTimer() {
    if (!isRunning && !isEditing) {
        isRunning = true;
        timer = setInterval(updateTimer, 1000);
        playMusic();
    }
}

function stopTimer() {
    clearInterval(timer);
    isRunning = false;
    stopMusic();
}

function updateDailyFocusSessions() {
    const today = new Date().toLocaleDateString();
    if (dailyFocusSessions[today]) {
        dailyFocusSessions[today]++;
    } else {
        dailyFocusSessions[today] = 1;
    }
    // Keep only the last 7 days
    const lastWeek = Object.keys(dailyFocusSessions).sort().slice(-7);
    dailyFocusSessions = lastWeek.reduce((acc, date) => {
        acc[date] = dailyFocusSessions[date];
        return acc;
    }, {});
}

function getWeeklyAverage() {
    const values = Object.values(dailyFocusSessions);
    return values.length > 0 ? values.reduce((a, b) => a + b) / values.length : 0;
}

function playMusic() {
    if (isMusicOn) {
        chrome.storage.sync.get(['musicUrl'], (result) => {
            if (result.musicUrl) {
                chrome.tabs.create({ url: result.musicUrl, active: false }, (tab) => {
                    musicTab = tab;
                });
            } else {
                // Play local music file if no URL is set
                chrome.tabs.create({ url: chrome.runtime.getURL('music/focus_music.mp3'), active: false }, (tab) => {
                    musicTab = tab;
                });
            }
        });
    }
}

function stopMusic() {
    if (musicTab) {
        chrome.tabs.remove(musicTab.id);
        musicTab = null;
    }
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    switch (request.action) {
        case 'startTimer':
            startTimer();
            break;
        case 'pauseTimer':
            stopTimer();
            break;
        case 'resetTimer':
            stopTimer();
            isFocusSession = true;
            timeLeft = FOCUS_SESSION_LENGTH;
            break;
        case 'setTime':
            timeLeft = request.time;
            isFocusSession = true; // Always set to focus session when manually setting time
            break;
        case 'startEditing':
            isEditing = true;
            stopTimer();
            break;
        case 'stopEditing':
            isEditing = false;
            if (isRunning) {
                startTimer();
            }
            break;
        case 'toggleMusic':
            isMusicOn = request.isMusicOn;
            if (isMusicOn) {
                chrome.storage.sync.get(['musicUrl'], (result) => {
                    musicUrl = result.musicUrl || '';
                    if (musicUrl && isRunning) {
                        chrome.tabs.create({ url: musicUrl, active: false }, (tab) => {
                            musicTab = tab;
                        });
                    }
                });
            } else {
                stopMusic();
            }
            break;
        case 'getTime':
            sendResponse({ 
                timeLeft: timeLeft, 
                isRunning: isRunning,
                isFocusSession: isFocusSession,
                focusSessionsCompleted: focusSessionsCompleted,
                dailyFocusSessions: dailyFocusSessions[new Date().toLocaleDateString()] || 0,
                weeklyAverage: getWeeklyAverage(),
                isMusicOn: isMusicOn,
                musicUrl: musicUrl
            });
            return true;
    }
});

// Start the timer when the background script loads
startTimer();
