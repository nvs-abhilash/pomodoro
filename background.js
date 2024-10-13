'use strict';

// Constants
const INITIAL_FOCUS_SESSION_LENGTH = 25 * 60;
const BREAK_SESSION_LENGTH = 5 * 60;

// State
const state = {
    DEFAULT_FOCUS_SESSION_LENGTH: INITIAL_FOCUS_SESSION_LENGTH,
    timeLeft: INITIAL_FOCUS_SESSION_LENGTH,
    isRunning: false,
    isFocusSession: true,
    isEditing: false,
    focusSessionsCompleted: 0,
    dailyFocusSessions: {},
    isMusicOn: false,
    isMusicPlaying: false
};

let timer;
let musicTab = null;

// Timer functions
function updateTimer() {
    if (state.isRunning && !state.isEditing) {
        state.timeLeft--;
        if (state.timeLeft === 0) handleSessionEnd();
    }
}

function handleSessionEnd() {
    state.isRunning = false;
    clearInterval(timer);
    state.isFocusSession ? switchToBreakSession() : switchToFocusSession();
    startTimer();
}

function switchToBreakSession() {
    state.isFocusSession = false;
    state.timeLeft = BREAK_SESSION_LENGTH;
    state.focusSessionsCompleted++;
    updateDailyFocusSessions();
    sendNotification('Focus session completed! Time for a 5-minute break.');
}

function switchToFocusSession() {
    state.isFocusSession = true;
    state.timeLeft = state.DEFAULT_FOCUS_SESSION_LENGTH;
    sendNotification('Break time over! Ready for another focus session?');
}

function startTimer() {
    if (!state.isRunning && !state.isEditing) {
        state.isRunning = true;
        timer = setInterval(updateTimer, 1000);
        playMusic();
    }
}

function stopTimer(stopMusicFlag = false) {
    clearInterval(timer);
    state.isRunning = false;
    if (stopMusicFlag) stopMusic();
}

// Utility functions
function sendNotification(message) {
    chrome.notifications.create({
        type: 'basic',
        iconUrl: 'images/demure_pomodoro_icon_128x128.png',
        title: 'MindfulMinutes',
        message,
        priority: 2
    });
}

function updateDailyFocusSessions() {
    const today = new Date().toLocaleDateString();
    state.dailyFocusSessions[today] = (state.dailyFocusSessions[today] || 0) + 1;
    pruneOldSessions();
}

function pruneOldSessions() {
    const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    Object.keys(state.dailyFocusSessions).forEach(date => {
        if (new Date(date) < oneWeekAgo) delete state.dailyFocusSessions[date];
    });
}

function getWeeklyAverage() {
    const values = Object.values(state.dailyFocusSessions);
    return values.length > 0 ? values.reduce((a, b) => a + b) / values.length : 0;
}

// Music functions
function playMusic() {
    if (state.isMusicOn && !state.isMusicPlaying) {
        chrome.storage.sync.get(['musicUrl'], (result) => {
            if (result.musicUrl) {
                chrome.tabs.create({ url: result.musicUrl, active: false }, (tab) => {
                    musicTab = tab;
                    state.isMusicPlaying = true;
                });
            }
        });
    }
}

function stopMusic() {
    if (musicTab) {
        chrome.tabs.remove(musicTab.id);
        musicTab = null;
        state.isMusicPlaying = false;
    }
}

// Message handler
function handleMessage(request, sender, sendResponse) {
    const actions = {
        startTimer: () => startTimer(),
        pauseTimer: () => stopTimer(request.stopMusicOnPause),
        resetTimer: () => {
            stopTimer();
            state.isFocusSession = true;
            state.timeLeft = state.DEFAULT_FOCUS_SESSION_LENGTH;
        },
        setTime: () => {
            state.timeLeft = request.time;
            state.DEFAULT_FOCUS_SESSION_LENGTH = request.defaultTime;
            state.isFocusSession = true;
            chrome.storage.sync.set({ defaultFocusTime: state.DEFAULT_FOCUS_SESSION_LENGTH });
        },
        startEditing: () => {
            state.isEditing = true;
            stopTimer();
        },
        stopEditing: () => {
            state.isEditing = false;
            if (state.isRunning) startTimer();
        },
        toggleMusic: () => {
            state.isMusicOn = request.isMusicOn;
            state.isMusicOn ? playMusic() : stopMusic();
        },
        getTime: () => {
            sendResponse({
                ...state,
                dailyFocusSessions: state.dailyFocusSessions[new Date().toLocaleDateString()] || 0,
                weeklyAverage: getWeeklyAverage()
            });
            return true;
        }
    };

    if (actions[request.action]) actions[request.action]();
}

// Event listeners
chrome.runtime.onMessage.addListener(handleMessage);

chrome.runtime.onInstalled.addListener(() => {
    chrome.storage.sync.set({ theme: 'auto', defaultFocusTime: INITIAL_FOCUS_SESSION_LENGTH }, () => {
        console.log('Default theme set to auto and default focus time set');
    });
});

// Initialize
startTimer();
