'use strict';

const INITIAL_FOCUS_SESSION_LENGTH = 25 * 60;
let DEFAULT_FOCUS_SESSION_LENGTH = INITIAL_FOCUS_SESSION_LENGTH;

let timeLeft = DEFAULT_FOCUS_SESSION_LENGTH;
let isRunning = false;
let isFocusSession = true;
let isEditing = false;
let focusSessionsCompleted = 0;
let dailyFocusSessions = 0;
let weeklyAverage = 0;
let isMusicOn = false;
let musicUrl = '';

const elements = {
    timerDisplay: document.getElementById('timer'),
    timerContainer: document.getElementById('timerContainer'),
    startPauseButton: document.getElementById('startPause'),
    resetButton: document.getElementById('reset'),
    sessionTypeDisplay: document.getElementById('sessionType'),
    statsDisplay: document.getElementById('stats'),
    musicToggle: document.getElementById('musicToggle'),
    settingsButton: document.getElementById('settingsButton'),
    mainView: document.getElementById('mainView'),
    settingsView: document.getElementById('settingsView'),
    settingsForm: document.getElementById('settingsForm'),
    musicUrlInput: document.getElementById('musicUrl'),
    themeSelect: document.getElementById('themeSelect'),
    editIcon: document.getElementById('editIcon')
};

function updateDisplay() {
    if (!isEditing) {
        const minutes = Math.floor(timeLeft / 60);
        const seconds = timeLeft % 60;
        elements.timerDisplay.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        elements.sessionTypeDisplay.textContent = isFocusSession ? 'Focus Session' : 'Break Time';
        elements.statsDisplay.textContent = `Today: ${dailyFocusSessions} | Weekly Avg: ${weeklyAverage.toFixed(1)}`;
        
        // Hide or show the edit icon based on whether the timer is running
        elements.editIcon.style.display = isRunning ? 'none' : 'block';
    }
}

function updateButtonState() {
    const icon = elements.startPauseButton.querySelector('i');
    icon.classList.toggle('fa-play', !isRunning);
    icon.classList.toggle('fa-pause', isRunning);
    
    // Update edit icon visibility when button state changes
    elements.editIcon.style.display = isRunning ? 'none' : 'block';
}

function startPauseTimer() {
    chrome.runtime.sendMessage({ action: isRunning ? 'pauseTimer' : 'startTimer', isMusicOn });
    isRunning = !isRunning;
    updateButtonState();
    updateDisplay(); // Add this line to update edit icon visibility
}

function resetTimer() {
    chrome.runtime.sendMessage({ action: 'resetTimer' });
    isRunning = false;
    isFocusSession = true;
    timeLeft = DEFAULT_FOCUS_SESSION_LENGTH;
    updateDisplay();
    updateButtonState();
}

function editTimer() {
    if (isRunning) return;

    isEditing = true;
    chrome.runtime.sendMessage({ action: 'startEditing' });

    const currentMinutes = Math.floor(timeLeft / 60);
    elements.timerDisplay.innerHTML = `<input type="number" id="minutesInput" min="1" max="60" value="${currentMinutes}">:00`;
    
    const minutesInput = document.getElementById('minutesInput');
    minutesInput.focus();
    minutesInput.select();

    minutesInput.addEventListener('blur', saveNewTime);
    minutesInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            saveNewTime();
        }
    });
}

function saveNewTime() {
    const minutesInput = document.getElementById('minutesInput');
    const newMinutes = parseInt(minutesInput.value, 10);
    if (newMinutes && newMinutes > 0 && newMinutes <= 60) {
        timeLeft = newMinutes * 60;
        DEFAULT_FOCUS_SESSION_LENGTH = timeLeft; // Set new default
        isFocusSession = true;
        chrome.runtime.sendMessage({ 
            action: 'setTime', 
            time: timeLeft,
            defaultTime: DEFAULT_FOCUS_SESSION_LENGTH
        });
        isEditing = false;
        updateDisplay();
        chrome.runtime.sendMessage({ action: 'stopEditing' });
    } else {
        alert('Please enter a valid number of minutes (1-60).');
        editTimer();
    }
}

function updateMusicIcon() {
    const icon = elements.musicToggle.querySelector('i');
    icon.classList.toggle('fa-volume-mute', !isMusicOn);
    icon.classList.toggle('fa-music', isMusicOn);
}

function showSettingsView() {
    elements.mainView.style.display = 'none';
    elements.settingsView.style.display = 'block';
    chrome.storage.sync.get(['musicUrl', 'theme'], (result) => {
        elements.musicUrlInput.value = result.musicUrl || '';
        elements.themeSelect.value = result.theme || 'auto';
    });
}

function showMainView() {
    elements.settingsView.style.display = 'none';
    elements.mainView.style.display = 'block';
}

function updateFromBackground() {
    if (!isEditing) {
        chrome.runtime.sendMessage({ action: 'getTime' }, (response) => {
            if (response) {
                ({timeLeft, isRunning, isFocusSession, focusSessionsCompleted, dailyFocusSessions, weeklyAverage, isMusicOn, DEFAULT_FOCUS_SESSION_LENGTH} = response);
                musicUrl = response.musicUrl || '';
                updateDisplay();
                updateButtonState();
                updateMusicIcon();
            }
        });
    }
}

function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
}

// Event Listeners
elements.startPauseButton.addEventListener('click', startPauseTimer);
elements.resetButton.addEventListener('click', resetTimer);
elements.timerContainer.addEventListener('click', editTimer);

elements.musicToggle.addEventListener('click', () => {
    isMusicOn = !isMusicOn;
    updateMusicIcon();
    chrome.runtime.sendMessage({ action: 'toggleMusic', isMusicOn });
});

elements.settingsButton.addEventListener('click', showSettingsView);

elements.settingsForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const newMusicUrl = elements.musicUrlInput.value;
    const newTheme = elements.themeSelect.value;
    chrome.storage.sync.set({ musicUrl: newMusicUrl, theme: newTheme }, () => {
        console.log('Settings saved');
        showMainView();
        applyTheme(newTheme);
    });
});

// Initial setup
chrome.storage.sync.get(['theme', 'defaultFocusTime'], (result) => {
    const theme = result.theme || 'auto';
    applyTheme(theme);
    if (result.defaultFocusTime) {
        DEFAULT_FOCUS_SESSION_LENGTH = result.defaultFocusTime;
        timeLeft = DEFAULT_FOCUS_SESSION_LENGTH;
    }
});

updateFromBackground();
updateMusicIcon();

// Set up an interval to periodically check the timer state
setInterval(updateFromBackground, 1000);

console.log('Popup script loaded');
