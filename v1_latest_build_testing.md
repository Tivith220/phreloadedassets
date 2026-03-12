# PH Reloaded v1 Latest Build (v1.0.4) - Testing Work File

This document outlines the testing procedures for the v1.0.4 legacy build.

## 1. Environment Setup
- **Source**: Ensure you are on the `v1_legacy` branch or have the v1.0.4 files extracted.
- **Dependencies**: Run `npm install` (ensure `systeminformation` and `electron` 22.x are used).

## 2. Core Functional Tests

### A. Power Event Synchronization
1. **Plug/Unplug Test**: 
   - Observe the bar color (Blue when charging, White/Gray when discharging).
   - Expected: Instant transition (Windows Power API trigger).
2. **Tray Update**:
   - Check the tray icon tooltip.
   - Expected: Matches the percentage and status shown in the bar.

### B. AI Neural Prediction (Time Remaining)
1. **Observation**: Wait for 5-10 minutes of discharge.
   - Expected: The `prediction-text` (e.g., "120m") should appear after enough data points (history length > 2) are collected.
2. **Simulated Drop (Speed Test)**:
   - Use the `diagnostic/result.txt` mock or simulate battery depletion via `main.js` override.

### C. Health Shield (Health Management)
1. **Upper Limit Warning**:
   - Charge to >80% with Conservation Mode ON.
   - Expected: "ENERGON CORE: OPTIMAL // UNPLUG" message and pulsing glitch animation.
2. **Lower Limit Warning**:
   - Discharge below 20% (or user set limit).
   - Expected: "ALERT: ENERGON DEPLETED!" message and red/purple glitch state.

## 3. Visual & Performance Verification
- **RAM Usage**: Verify that RAM stays below 100MB (target 64MB via `js-flags`).
- **Always on Top**: Verify the bar stays visible above fullscreen applications (using `setAlwaysOnTop(true, 'screen-saver')`).
