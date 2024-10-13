'use strict';

const INITIAL_FOCUS_SESSION_LENGTH = 25 * 60;
let DEFAULT_FOCUS_SESSION_LENGTH = INITIAL_FOCUS_SESSION_LENGTH;

const state = {
    timeLeft: DEFAULT_FOCUS_SESSION_LENGTH,
    isRunning: false,
    isFocusSession: true,
    isEditing: false,
    focusSessionsCompleted: 0,
    dailyFocusSessions: 0,
    weeklyAverage: 0,
    isMusicOn: false,
    musicUrl: ''
};

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
    editIcon: document.getElementById('editIcon'),
    stopMusicOnPause: document.getElementById('stopMusicOnPause')
};

function updateDisplay() {
    if (!state.isEditing) {
        const minutes = Math.floor(state.timeLeft / 60);
        const seconds = state.timeLeft % 60;
        elements.timerDisplay.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        elements.sessionTypeDisplay.textContent = state.isFocusSession ? 'Focus Session' : 'Break Time';
        elements.statsDisplay.textContent = `Today: ${state.dailyFocusSessions} | Weekly Avg: ${state.weeklyAverage.toFixed(1)}`;
        elements.editIcon.style.display = state.isRunning ? 'none' : 'block';
    }
}

function updateButtonState() {
    const icon = elements.startPauseButton.querySelector('i');
    icon.classList.toggle('fa-play', !state.isRunning);
    icon.classList.toggle('fa-pause', state.isRunning);
    elements.editIcon.style.display = state.isRunning ? 'none' : 'block';
}

function startPauseTimer() {
    chrome.storage.sync.get(['stopMusicOnPause'], (result) => {
        const stopMusicOnPause = result.stopMusicOnPause || false;
        chrome.runtime.sendMessage({ 
            action: state.isRunning ? 'pauseTimer' : 'startTimer', 
            isMusicOn: state.isMusicOn,
            stopMusicOnPause
        });
        state.isRunning = !state.isRunning;
        updateButtonState();
        updateDisplay();
    });
}

function resetTimer() {
    chrome.runtime.sendMessage({ action: 'resetTimer' });
    state.isRunning = false;
    state.isFocusSession = true;
    state.timeLeft = DEFAULT_FOCUS_SESSION_LENGTH;
    updateDisplay();
    updateButtonState();
}

function editTimer() {
    if (state.isRunning) return;

    state.isEditing = true;
    chrome.runtime.sendMessage({ action: 'startEditing' });

    const currentMinutes = Math.floor(state.timeLeft / 60);
    elements.timerDisplay.innerHTML = `<input type="number" id="minutesInput" min="1" max="60" value="${currentMinutes}">:00`;
    
    const minutesInput = document.getElementById('minutesInput');
    minutesInput.focus();
    minutesInput.select();

    minutesInput.addEventListener('blur', saveNewTime);
    minutesInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') saveNewTime();
    });
}

function saveNewTime() {
    const minutesInput = document.getElementById('minutesInput');
    const newMinutes = parseInt(minutesInput.value, 10);
    if (newMinutes && newMinutes > 0 && newMinutes <= 60) {
        state.timeLeft = newMinutes * 60;
        DEFAULT_FOCUS_SESSION_LENGTH = state.timeLeft;
        state.isFocusSession = true;
        chrome.runtime.sendMessage({ 
            action: 'setTime', 
            time: state.timeLeft,
            defaultTime: DEFAULT_FOCUS_SESSION_LENGTH
        });
        state.isEditing = false;
        updateDisplay();
        chrome.runtime.sendMessage({ action: 'stopEditing' });
    } else {
        alert('Please enter a valid number of minutes (1-60).');
        editTimer();
    }
}

function updateMusicIcon() {
    const icon = elements.musicToggle.querySelector('i');
    icon.classList.toggle('fa-volume-mute', !state.isMusicOn);
    icon.classList.toggle('fa-music', state.isMusicOn);
}

function showSettingsView() {
    elements.mainView.style.display = 'none';
    elements.settingsView.style.display = 'block';
    chrome.storage.sync.get(['musicUrl', 'theme', 'stopMusicOnPause'], (result) => {
        elements.musicUrlInput.value = result.musicUrl || '';
        elements.themeSelect.value = result.theme || 'auto';
        elements.stopMusicOnPause.checked = result.stopMusicOnPause || false;
    });
}

function showMainView() {
    elements.settingsView.style.display = 'none';
    elements.mainView.style.display = 'block';
}

function updateFromBackground() {
    if (!state.isEditing) {
        chrome.runtime.sendMessage({ action: 'getTime' }, (response) => {
            if (response) {
                Object.assign(state, response);
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
    state.isMusicOn = !state.isMusicOn;
    updateMusicIcon();
    chrome.runtime.sendMessage({ action: 'toggleMusic', isMusicOn: state.isMusicOn });
});
elements.settingsButton.addEventListener('click', showSettingsView);
elements.settingsForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const newMusicUrl = elements.musicUrlInput.value;
    const newTheme = elements.themeSelect.value;
    const stopMusicOnPause = elements.stopMusicOnPause.checked;
    chrome.storage.sync.set({ 
        musicUrl: newMusicUrl, 
        theme: newTheme, 
        stopMusicOnPause 
    }, () => {
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
        state.timeLeft = DEFAULT_FOCUS_SESSION_LENGTH;
    }
});

updateFromBackground();
updateMusicIcon();

// Set up an interval to periodically check the timer state
setInterval(updateFromBackground, 1000);

console.log('Popup script loaded');