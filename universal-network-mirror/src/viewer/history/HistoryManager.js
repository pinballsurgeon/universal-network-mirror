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
        
        // Snapshots: "google.com" -> [{ ts, metrics, label }]
        this.snapshots = new Map();
        
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

    getStoryline(bins = 100) {
        if (this.tape.length === 0) return new Array(bins).fill(null);
        const start = this.getStartTime();
        const duration = this.getDuration();
        const binSize = duration / bins;
        const result = new Array(bins).fill(null);

        // Temp storage for mode voting per bin
        const binVotes = new Array(bins).fill(null).map(() => ({}));

        for (const tick of this.tape) {
            const bucket = Math.min(bins - 1, Math.floor((tick.ts - start) / binSize));
            
            // Track Density
            if (!result[bucket]) result[bucket] = { density: 0, mode: 'UNKNOWN', color: '#555' };
            result[bucket].density += tick.particleCount || 0;

            // Track Mode Votes
            if (tick.prediction && tick.prediction.mode) {
                const m = tick.prediction.mode;
                binVotes[bucket][m] = (binVotes[bucket][m] || 0) + 1;
            }
        }

        // Resolve Modes
        const maxDensity = Math.max(1, ...result.map(r => r ? r.density : 0));
        
        for (let i = 0; i < bins; i++) {
            if (result[i]) {
                // Normalize density
                result[i].density /= maxDensity;
                
                // Find winner
                let winner = 'UNKNOWN';
                let maxVote = -1;
                const votes = binVotes[i];
                if (votes) {
                    for (const [mode, count] of Object.entries(votes)) {
                        if (count > maxVote) {
                            maxVote = count;
                            winner = mode;
                        }
                    }
                }
                result[i].mode = winner;
                // We rely on RenderEngine to map Mode -> Color, or store it in tick. 
                // Tick has prediction.color!
                // Let's grab color from the last tick in bucket (approximate)
                // Or better, just return mode and let RenderEngine decide visuals.
            }
        }
        return result;
    }

    // --- LONG TERM HISTORY (PERSISTENCE) ---

    loadHistory() {
        chrome.storage.local.get(['domainStats', 'domainSnapshots'], (result) => {
            if (result.domainStats) {
                try {
                    Object.entries(result.domainStats).forEach(([k, v]) => this.domainStats.set(k, v));
                } catch (e) { console.error("Failed to load history", e); }
            }
            if (result.domainSnapshots) {
                try {
                    Object.entries(result.domainSnapshots).forEach(([k, v]) => this.snapshots.set(k, v));
                } catch (e) { console.error("Failed to load snapshots", e); }
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
        const objStats = Object.fromEntries(this.domainStats);
        const objSnaps = Object.fromEntries(this.snapshots);
        chrome.storage.local.set({ 
            domainStats: objStats,
            domainSnapshots: objSnaps
        });
    }

    getDomainHistory(domainName) {
        return this.domainStats.get(domainName);
    }

    // --- SNAPSHOTS & COMPARATIVES ---

    takeSnapshot(domainName, currentMetrics, label = "Manual Snapshot") {
        if (!this.snapshots.has(domainName)) {
            this.snapshots.set(domainName, []);
        }
        const snaps = this.snapshots.get(domainName);
        snaps.push({
            ts: Date.now(),
            metrics: { ...currentMetrics },
            label: label
        });
        // Limit snapshots per domain
        if (snaps.length > 10) snaps.shift();
        this.saveHistory();
    }

    getSnapshots(domainName) {
        return this.snapshots.get(domainName) || [];
    }

    compareSnapshots(snapA, snapB) {
        if (!snapA || !snapB) return null;
        
        const diffs = {};
        let dotProduct = 0;
        let magA = 0;
        let magB = 0;

        Object.keys(snapA.metrics).forEach(k => {
            const valA = snapA.metrics[k] || 0;
            const valB = snapB.metrics[k] || 0;
            
            diffs[k] = {
                valA, valB,
                diff: valB - valA,
                pct: valA !== 0 ? ((valB - valA) / valA) * 100 : 0
            };

            // Cosine Sim Prep
            dotProduct += valA * valB;
            magA += valA * valA;
            magB += valB * valB;
        });

        const similarity = (magA > 0 && magB > 0) ? (dotProduct / (Math.sqrt(magA) * Math.sqrt(magB))) : 0;

        return { diffs, similarity };
    }
}
