# PH Reloaded v1 Latest Build (v1.0.4) - Implementation Work File

Logical design and architectural details for the v1.0.4 release.

## 1. Project Overview
- **Build ID**: v1.0.4
- **Project Name**: PH Reloaded (Traditional)
- **Framework**: Electron (Main + Renderer)

## 2. Component Architecture

### PowerPredictor (Main Process)
Handles the background polling and event listeners for battery state.
- **Polling**: 5-minute interval fallback.
- **Events**: `powerMonitor.on('on-ac')`, `powerMonitor.on('on-battery')`.
- **IPC**: Sends `battery-data` to Renderer.

### AI Neural Link (Renderer Process)
The "Predictive" intelligence layer.
- **State Storage**: `history[]` array stores level/time pairs.
- **Calculation**: 
  - `velocity = (level_first - level_last) / time_delta`
  - `remaining_time = current_level / velocity`
- **Minimum Data**: Requires at least 2 points where levels differ.

### Health Shield (Logic Flow)
The threshold-based alert system.
```javascript
if (percent < lowerLimit) {
    // Critical Alert State
} else if (isCharging && percent > 80 && conservationMode) {
    // Conservation Alert State
} else {
    // Healthy/Standard State
}
```

## 3. Build Configuration (package.json v1.0.4)
- **AppId**: `com.phreloaded.v1`
- **Build Target**: Windows NSIS Installer.
- **Optimization**: JS Heap limited to 64MB via Electron command line switches.
