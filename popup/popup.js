let timeLeft = 25 * 60; // 25 minutes in seconds
let isRunning = false;
let isFocusSession = true;
let isEditing = false;
let focusSessionsCompleted = 0;
let dailyFocusSessions = 0;
let weeklyAverage = 0;
let isMusicOn = false;

const timerDisplay = document.getElementById('timer');
const timerContainer = document.getElementById('timerContainer');
const startPauseButton = document.getElementById('startPause');
const resetButton = document.getElementById('reset');
const sessionTypeDisplay = document.getElementById('sessionType');
const statsDisplay = document.getElementById('stats');
const musicToggle = document.getElementById('musicToggle');

function updateDisplay() {
    if (!isEditing) {
        const minutes = Math.floor(timeLeft / 60);
        const seconds = timeLeft % 60;
        timerDisplay.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        sessionTypeDisplay.textContent = isFocusSession ? 'Focus Session' : 'Break Time';
        statsDisplay.textContent = `Today: ${dailyFocusSessions} | Weekly Avg: ${weeklyAverage.toFixed(1)}`;
    }
}

function updateButtonState() {
    const icon = startPauseButton.querySelector('i');
    if (isRunning) {
        icon.classList.remove('fa-play');
        icon.classList.add('fa-pause');
    } else {
        icon.classList.remove('fa-pause');
        icon.classList.add('fa-play');
    }
}

function startPauseTimer() {
    if (!isRunning) {
        chrome.runtime.sendMessage({ action: 'startTimer', isMusicOn });
        isRunning = true;
    } else {
        chrome.runtime.sendMessage({ action: 'pauseTimer' });
        isRunning = false;
    }
    updateButtonState();
}

function resetTimer() {
    chrome.runtime.sendMessage({ action: 'resetTimer' });
    isRunning = false;
    isFocusSession = true;
    timeLeft = 25 * 60;
    updateDisplay();
    updateButtonState();
}

function editTimer() {
    if (isRunning) return; // Prevent editing while timer is running

    isEditing = true;
    chrome.runtime.sendMessage({ action: 'startEditing' });

    const currentMinutes = Math.floor(timeLeft / 60);
    timerDisplay.innerHTML = `<input type="number" id="minutesInput" min="1" max="60" value="${currentMinutes}">:00`;
    
    const minutesInput = document.getElementById('minutesInput');
    minutesInput.focus();
    minutesInput.select();

    function saveNewTime() {
        const newMinutes = parseInt(minutesInput.value, 10);
        if (newMinutes && newMinutes > 0 && newMinutes <= 60) {
            timeLeft = newMinutes * 60;
            isFocusSession = true; // Always set to focus session when manually setting time
            chrome.runtime.sendMessage({ 
                action: 'setTime', 
                time: timeLeft
            });
            isEditing = false;
            updateDisplay();
            chrome.runtime.sendMessage({ action: 'stopEditing' });
        } else {
            alert('Please enter a valid number of minutes (1-60).');
            editTimer(); // Re-open the edit mode if input was invalid
            return;
        }
    }

    minutesInput.addEventListener('blur', saveNewTime);
    minutesInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            saveNewTime();
        }
    });
}

startPauseButton.addEventListener('click', startPauseTimer);
resetButton.addEventListener('click', resetTimer);
timerContainer.addEventListener('click', editTimer);

// Add this function to update the music icon
function updateMusicIcon() {
    const icon = musicToggle.querySelector('i');
    if (isMusicOn) {
        icon.classList.remove('fa-volume-mute');
        icon.classList.add('fa-volume-up');
    } else {
        icon.classList.remove('fa-volume-up');
        icon.classList.add('fa-volume-mute');
    }
}

// Add this event listener for the music toggle
musicToggle.addEventListener('click', () => {
    isMusicOn = !isMusicOn;
    updateMusicIcon();
    chrome.runtime.sendMessage({ action: 'toggleMusic', isMusicOn });
});

// Update timer display from background
function updateFromBackground() {
    if (!isEditing) {
        chrome.runtime.sendMessage({ action: 'getTime' }, (response) => {
            if (response) {
                timeLeft = response.timeLeft;
                isRunning = response.isRunning;
                isFocusSession = response.isFocusSession;
                focusSessionsCompleted = response.focusSessionsCompleted;
                dailyFocusSessions = response.dailyFocusSessions;
                weeklyAverage = response.weeklyAverage;
                isMusicOn = response.isMusicOn;
                updateDisplay();
                updateButtonState();
                updateMusicIcon();
            }
        });
    }
}

// Initial display update
updateFromBackground();

// Set up an interval to periodically check the timer state
setInterval(updateFromBackground, 1000);
