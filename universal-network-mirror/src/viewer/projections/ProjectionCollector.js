import { planetBloatMetric } from '../metrics/planet_bloat.js';
import { topicProminenceMetric } from '../metrics/topic_prominence.js';
import { visualDensityMetric } from '../metrics/visual_density.js';
import { nodeFingerprintMetric } from '../metrics/node_fingerprint.js';

// The Registry of active metrics
const METRICS = [
    planetBloatMetric,
    topicProminenceMetric,
    visualDensityMetric,
    nodeFingerprintMetric
];

export class ProjectionCollector {
    constructor() {
        this.lastBroadcast = 0;
        this.broadcastInterval = 100; // 10Hz
        this.lastTick = null; // Store last computed tick for UI access
    }

    /**
     * Collects all metrics and broadcasts a snapshot if needed.
     * @param {Object} engineState - The full state of the viewer
     * @param {boolean} force - Force broadcast regardless of timing
     */
    collectAndBroadcast(engineState, force = false) {
        const now = Date.now();
        if (!force && (now - this.lastBroadcast < this.broadcastInterval)) {
            return;
        }
        this.lastBroadcast = now;

        // 1. Compute all metrics
        const metricsOutput = {};
        for (const metric of METRICS) {
            try {
                const result = metric.compute(engineState);
                metricsOutput[result.name] = result.payload;
            } catch (e) {
                console.warn(`Metric ${metric.id} failed:`, e);
            }
        }

        // 2. Build the ProjectionTick
        const tick = {
            schemaVersion: "1.0",
            ts: now,
            viewMode: engineState.viewMode,
            particleCount: engineState.particles ? engineState.particles.length : 0,
            metrics: metricsOutput
        };
        
        this.lastTick = tick;

        // 3. Broadcast
        // We use window.postMessage for local tools (e.g. Cline in browser)
        // and chrome.runtime.sendMessage for external debuggers if needed.
        
        try {
            // For Cline (if inspecting the page context)
            window.postMessage({ type: 'DEV_PROJECTION_TICK', tick }, '*');
            
            // For Background/Extension inspectors
            // chrome.runtime.sendMessage({ type: 'DEV_PROJECTION_TICK', tick }).catch(() => {});
        } catch (e) {
            // Ignore broadcast errors
        }
    }
}
