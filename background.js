'use strict';

const INITIAL_FOCUS_SESSION_LENGTH = 25 * 60;
const BREAK_SESSION_LENGTH = 5 * 60;

let DEFAULT_FOCUS_SESSION_LENGTH = INITIAL_FOCUS_SESSION_LENGTH;
let timer;
let timeLeft = DEFAULT_FOCUS_SESSION_LENGTH;
let isRunning = false;
let isFocusSession = true;
let isEditing = false;
let focusSessionsCompleted = 0;
let dailyFocusSessions = {};
let isMusicOn = false;
let musicTab = null;
let isMusicPlaying = false; // New variable to track if music is currently playing

function updateTimer() {
    if (isRunning && !isEditing) {
        timeLeft--;
        if (timeLeft === 0) {
            handleSessionEnd();
        }
    }
}

function handleSessionEnd() {
    isRunning = false;
    clearInterval(timer);
    
    if (isFocusSession) {
        switchToBreakSession();
    } else {
        switchToFocusSession();
    }
    startTimer();
}

function switchToBreakSession() {
    isFocusSession = false;
    timeLeft = BREAK_SESSION_LENGTH;
    focusSessionsCompleted++;
    updateDailyFocusSessions();
    sendNotification('Focus session completed! Time for a 5-minute break.');
}

function switchToFocusSession() {
    isFocusSession = true;
    timeLeft = DEFAULT_FOCUS_SESSION_LENGTH;
    sendNotification('Break time over! Ready for another focus session?');
}

function sendNotification(message) {
    chrome.notifications.create({
        type: 'basic',
        iconUrl: 'images/demure_pomodoro_icon_128x128.png',
        title: 'MindfulMinutes',
        message: message,
        priority: 2
    });
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
    dailyFocusSessions[today] = (dailyFocusSessions[today] || 0) + 1;
    pruneOldSessions();
}

function pruneOldSessions() {
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    
    Object.keys(dailyFocusSessions).forEach(date => {
        if (new Date(date) < oneWeekAgo) {
            delete dailyFocusSessions[date];
        }
    });
}

function getWeeklyAverage() {
    const values = Object.values(dailyFocusSessions);
    return values.length > 0 ? values.reduce((a, b) => a + b) / values.length : 0;
}

function playMusic() {
    if (isMusicOn && !isMusicPlaying) { // Only start music if it's not already playing
        chrome.storage.sync.get(['musicUrl'], (result) => {
            if (result.musicUrl) {
                chrome.tabs.create({ url: result.musicUrl, active: false }, (tab) => {
                    musicTab = tab;
                    isMusicPlaying = true; // Set music as playing
                });
            }
        });
    }
}

function stopMusic() {
    if (musicTab) {
        chrome.tabs.remove(musicTab.id);
        musicTab = null;
        isMusicPlaying = false; // Set music as not playing
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
            timeLeft = DEFAULT_FOCUS_SESSION_LENGTH;
            break;
        case 'setTime':
            timeLeft = request.time;
            DEFAULT_FOCUS_SESSION_LENGTH = request.defaultTime;
            isFocusSession = true;
            chrome.storage.sync.set({ defaultFocusTime: DEFAULT_FOCUS_SESSION_LENGTH });
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
                playMusic();
            } else {
                stopMusic();
            }
            break;
        case 'getTime':
            sendResponse({
                timeLeft,
                isRunning,
                isFocusSession,
                focusSessionsCompleted,
                dailyFocusSessions: dailyFocusSessions[new Date().toLocaleDateString()] || 0,
                weeklyAverage: getWeeklyAverage(),
                isMusicOn,
                isMusicPlaying,
                DEFAULT_FOCUS_SESSION_LENGTH
            });
            return true;
    }
});

chrome.runtime.onInstalled.addListener(() => {
    chrome.storage.sync.set({ theme: 'auto', defaultFocusTime: INITIAL_FOCUS_SESSION_LENGTH }, () => {
        console.log('Default theme set to auto and default focus time set');
    });
});

// Start the timer when the background script loads
startTimer();
