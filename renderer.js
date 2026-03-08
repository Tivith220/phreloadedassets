const bar = document.getElementById('horizon-bar');
const fill = document.getElementById('energon-fill');
const statusText = document.getElementById('status-text');
const percentDisplay = document.getElementById('percent-display');

const soundUp = document.getElementById('sound-transform-up');
const soundDown = document.getElementById('sound-transform-down');
const soundAlert = document.getElementById('sound-alert');

let isExpanded = false;
let lastIsCharging = null;
let lastIsLow = false;

// Function to play sound safely
const playSound = (audio) => {
    if (audio) {
        audio.currentTime = 0;
        audio.play().catch(e => console.warn("Audio play failed:", e));
    }
};

// Handle Hover Expansion
bar.addEventListener('mouseenter', () => {
    if (!isExpanded) {
        isExpanded = true;
        bar.classList.add('expanded');
        window.electronAPI.send('set-window-height', 40);
        playSound(soundUp);
    }
});

bar.addEventListener('mouseleave', () => {
    if (isExpanded) {
        isExpanded = false;
        bar.classList.remove('expanded');
        window.electronAPI.send('set-window-height', 5);
        playSound(soundDown);
    }
});

const updateUI = (percent, isCharging) => {
    const displayPercent = Math.round(percent);
    percentDisplay.innerText = `${displayPercent}%`;
    fill.style.width = `${displayPercent}%`;

    // Reset Classes
    fill.classList.remove('fill-charging', 'fill-low');
    percentDisplay.classList.remove('text-low');

    let msg = "AUTOBOTS, READY TO ROLL...";
    let isLow = percent < 20;

    if (isCharging) {
        fill.classList.add('fill-charging');
        msg = "ENERGON CORE RECHARGING...";
        if (lastIsCharging === false) playSound(soundUp);
    } else {
        if (isLow) {
            fill.classList.add('fill-low');
            percentDisplay.classList.add('text-low');
            msg = "ENERGON DEPLETED! DECEPTICONS ATTACKING!";
            if (!lastIsLow) playSound(soundAlert);
        } else if (percent > 80) {
            msg = "PRIME STATUS: OPTIMAL";
        } else if (percent < 40) {
            msg = "ENERGON RESERVES LOW...";
        }
        if (lastIsCharging === true) playSound(soundDown);
    }

    statusText.innerText = msg;
    lastIsCharging = isCharging;
    lastIsLow = isLow;

    // Update Tray Tooltip via IPC
    window.electronAPI.send('update-tray-tooltip', {
        percent: displayPercent,
        status: isCharging ? "Recharging" : (isLow ? "Depleted" : "Optimal"),
        warning: isLow ? "CONNECT ENERGON SOURCE!" : ""
    });
};

// Web Battery API
if (navigator.getBattery) {
    navigator.getBattery().then(battery => {
        updateUI(battery.level * 100, battery.charging);

        battery.addEventListener('levelchange', () => updateUI(battery.level * 100, battery.charging));
        battery.addEventListener('chargingchange', () => updateUI(battery.level * 100, battery.charging));
    });
}

// Fallback Heartbeat from Main
window.electronAPI.onBatteryData((data) => {
    updateUI(data.percent, data.isCharging);
});

// Windows Power Events
window.electronAPI.on('power-source-changed', (source) => {
    if (navigator.getBattery) {
        navigator.getBattery().then(battery => updateUI(battery.level * 100, battery.charging));
    }
});
