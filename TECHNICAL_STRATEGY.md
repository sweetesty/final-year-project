# Dual-Engine Fall Detection Strategy

Vitals Fusion employs a hybrid approach to fall detection, balancing high precision with ultra-low battery consumption. This is accomplished through our "Dual-Engine" architecture.

## 1. Background Monitor (The "Wake-up" Trigger)
-   **Service**: `BackgroundMonitorService.ts`
-   **Goal**: Zero-latency detection while the app is closed or in the background.
-   **Logic**: Uses a simplified **Single-Axis G-Force Threshold (3.0G)**.
-   **Battery Strategy**: By using a simpler numerical threshold instead of a continuous AI inference, we significantly extend the patient's battery life. The background task samples data at set intervals (100ms updates during a 500ms sample window) when triggered by the OS.

## 2. Foreground Detection (The "High-Accuracy" Model)
-   **Component**: State-Machine Logic / TensorFlow Lite
-   **Goal**: Minimize false positives when the user is actively using the phone.
-   **Logic**: Uses a complex **State Machine** that monitors the trajectory of a fall:
    1.  **Free Fall**: Near-zero G acceleration.
    2.  **Impact**: High-G spike.
    3.  **Inactivity**: Post-fall lack of movement.
-   **Verification**: If a fall is detected in the foreground, we trigger an immediate interactive prompt for the user to "Confirm" or "Cancel" the alert, preventing unnecessary emergency dispatches.

## Summary Table

| Engine | Context | Model | Accuracy | Battery Impact |
|---|---|---|---|---|
| **Background** | App closed | 3.0G Threshold | Medium | Low |
| **Foreground** | App open | AI State Machine | High | Moderate |

---
*Document Version: 1.0.0*
*Developer Note: This strategy ensures that patients are protected 24/7 without needing to charge their device multiple times a day.*
