/**
 * ResourceMonitor.js
 * "The Heartbeat of the System"
 * 
 * Monitors performance metrics (FPS, Heap) and broadcasts a HealthState.
 * Used by the Adaptive Resource Governor to throttle the engine dynamically.
 */

export const HealthState = {
    GREEN: 'GREEN',   // High Performance (1000 Particles, 10Hz History)
    YELLOW: 'YELLOW', // Mid Range (200 Particles, 1Hz History)
    RED: 'RED'        // Low End (50 Particles, No History)
};

export class ResourceMonitor {
    constructor() {
        this.fps = 60;
        this.heapUsed = 0;
        this.state = HealthState.GREEN;
        this.listeners = [];
        
        // Internal tracking
        this.lastFrameTime = performance.now();
        this.frameCount = 0;
        this.lastCheck = performance.now();
        
        // Start monitoring loop
        this.loop();
    }

    addListener(callback) {
        this.listeners.push(callback);
    }

    loop() {
        requestAnimationFrame(() => this.loop());
        
        const now = performance.now();
        this.frameCount++;
        
        // Check every 1 second
        if (now - this.lastCheck >= 1000) {
            // Calculate FPS
            this.fps = Math.round((this.frameCount * 1000) / (now - this.lastCheck));
            this.frameCount = 0;
            this.lastCheck = now;
            
            // Measure Heap (Chrome only)
            if (performance.memory) {
                this.heapUsed = Math.round(performance.memory.usedJSHeapSize / 1024 / 1024); // MB
            }
            
            // Determine State
            this.updateState();
            
            // Broadcast
            this.notifyListeners();
        }
    }

    updateState() {
        // Logic:
        // GREEN: FPS > 50 AND Heap < 100MB
        // YELLOW: FPS > 30 OR Heap < 300MB
        // RED: FPS < 30 OR Heap > 300MB
        
        let newState = HealthState.GREEN;
        
        if (this.fps < 30 || this.heapUsed > 300) {
            newState = HealthState.RED;
        } else if (this.fps < 50 || this.heapUsed > 100) {
            newState = HealthState.YELLOW;
        }
        
        // Hysteresis: Only change if persistent? 
        // For V1, instant switch is fine.
        this.state = newState;
    }

    notifyListeners() {
        const report = {
            state: this.state,
            fps: this.fps,
            heap: this.heapUsed
        };
        
        this.listeners.forEach(cb => cb(report));
    }
}
