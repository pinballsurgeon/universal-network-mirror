/**
 * History Manager
 * Responsible for recording, compressing, and replaying the "Universe State".
 * 
 * Strategy:
 * 1. Capture ProjectionTicks from Collector.
 * 2. Filter idle ticks (Time Compression).
 * 3. Store in chunks to allow infinite scrolling/playback.
 * 4. Provide "Seek" capability for the renderer.
 * 5. Persist Long-Term Fingerprints to Chrome Storage.
 */
export class HistoryManager {
    constructor() {
        this.tape = []; // The active timeline
        this.maxTapeLength = 10000; // Keep 15 mins approx in RAM at 10Hz
        this.isRecording = true;
        
        // Long-term stats: "google.com" -> { metrics: {...}, count: 100, lastSeen: ts }
        this.domainStats = new Map();
        this.lastSave = 0;
        this.loadHistory();
    }

    // --- SESSION HISTORY (TAPE) ---

    push(tick) {
        if (!this.isRecording) return;

        // Compression 1: Skip completely empty ticks if previous was also empty?
        this.tape.push(tick);

        if (this.tape.length > this.maxTapeLength) {
            this.tape.shift(); 
        }

        // Periodic Save of Fingerprints (every 10s)
        if (Date.now() - this.lastSave > 10000) {
            this.saveHistory();
            this.lastSave = Date.now();
        }
    }

    getDuration() {
        if (this.tape.length === 0) return 0;
        return this.tape[this.tape.length - 1].ts - this.tape[0].ts;
    }

    getStartTime() {
        return this.tape.length > 0 ? this.tape[0].ts : Date.now();
    }

    getEndTime() {
        return this.tape.length > 0 ? this.tape[this.tape.length - 1].ts : Date.now();
    }

    getFrameAt(timestamp) {
        if (this.tape.length === 0) return null;
        let low = 0, high = this.tape.length - 1;
        while (low <= high) {
            const mid = Math.floor((low + high) / 2);
            if (this.tape[mid].ts < timestamp) low = mid + 1;
            else high = mid - 1;
        }
        const idx = Math.min(Math.max(low, 0), this.tape.length - 1);
        return this.tape[idx];
    }

    getActivityHeatmap(bins = 100) {
        if (this.tape.length === 0) return new Array(bins).fill(0);
        const start = this.getStartTime();
        const duration = this.getDuration();
        const binSize = duration / bins;
        const result = new Array(bins).fill(0);
        for (const tick of this.tape) {
            const bucket = Math.min(bins - 1, Math.floor((tick.ts - start) / binSize));
            result[bucket] += tick.particleCount || 0;
        }
        const max = Math.max(...result, 1);
        return result.map(v => v / max);
    }

    // --- LONG TERM HISTORY (PERSISTENCE) ---

    loadHistory() {
        chrome.storage.local.get(['domainStats'], (result) => {
            if (result.domainStats) {
                try {
                    // Convert object back to Map if needed, or just use Object
                    // Storage stores as Object.
                    Object.entries(result.domainStats).forEach(([k, v]) => {
                        this.domainStats.set(k, v);
                    });
                } catch (e) {
                    console.error("Failed to load history", e);
                }
            }
        });
    }

    /**
     * Integrate current session fingerprints into long-term history.
     * Uses incremental averaging.
     */
    updateFingerprints(fingerPrints) {
        if (!fingerPrints) return;

        fingerPrints.forEach(fp => {
            const domain = fp.name;
            let stats = this.domainStats.get(domain);
            
            if (!stats) {
                stats = { metrics: { ...fp.metrics }, count: 1, lastSeen: Date.now() };
            } else {
                // Incremental Average: NewAvg = OldAvg + (NewVal - OldAvg) / NewCount
                stats.count++;
                Object.keys(fp.metrics).forEach(k => {
                    stats.metrics[k] = stats.metrics[k] + (fp.metrics[k] - stats.metrics[k]) / stats.count;
                });
                stats.lastSeen = Date.now();
            }
            this.domainStats.set(domain, stats);
        });
    }

    saveHistory() {
        const obj = Object.fromEntries(this.domainStats);
        chrome.storage.local.set({ domainStats: obj });
    }

    getDomainHistory(domainName) {
        return this.domainStats.get(domainName);
    }
}
