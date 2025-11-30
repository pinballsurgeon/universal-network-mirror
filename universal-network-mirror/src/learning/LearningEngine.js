import { VectorMath, V_LABELS, V_DIM } from './VectorMath.js';

/**
 * LearningEngine (V1: Centroid Classifier)
 * 
 * "The Mind" of the World Model.
 * Classifies the current state of reality (Slice) into semantic modes.
 * Uses lightweight VectorMath for 60fps inference.
 */

// --- PRE-TRAINED CENTROIDS (The "Prior" Knowledge) ---
// These are hypothetical ideal vectors for each mode.
// 0.0 - 1.0 range (Normalized Space).

const CENTROIDS = {
    'DEEP_WORK': {
        vector: null, // Init on load
        def: {
            LINGUISTIC_DENSITY: 0.9,
            TEXT_ENTROPY: 0.8,
            IO_PACKET_RATE: 0.1, // Calm
            SPRAWL_SCORE: 0.1,   // Focused
            UPLOAD_RATIO: 0.3    // Interactive (forms/chat)
        },
        color: '#00ffcc' // Cyan
    },
    'DOOMSCROLLING': {
        vector: null,
        def: {
            LINGUISTIC_DENSITY: 0.3,
            TEXT_ENTROPY: 0.2, // Repetitive/Short
            IO_PACKET_RATE: 0.9, // Hyperactive
            SPRAWL_SCORE: 0.9,   // Jumping domains
            DOWNLOAD_RATIO: 0.8
        },
        color: '#ff0055' // Neon Red
    },
    'MEDIA_IMMERSION': {
        vector: null,
        def: {
            IO_VOLUME_SIZE: 0.9, // Huge bytes
            IO_PACKET_RATE: 0.2, // Steady stream
            LINGUISTIC_DENSITY: 0.05,
            DOWNLOAD_RATIO: 0.95
        },
        color: '#aa00ff' // Purple
    },
    'DEV_MODE': {
        vector: null,
        def: {
            SPRAWL_SCORE: 0.4,
            HEAVY_RESOURCE_SCORE: 0.1,
            // Dev signals aren't in vector yet (latent), but we infer from structure
            UPLOAD_RATIO: 0.5,
            LINGUISTIC_DENSITY: 0.6
        },
        color: '#ffff00' // Yellow
    }
};

export class LearningEngine {
    constructor() {
        this.initCentroids();
        this.currentMode = 'UNKNOWN';
        this.confidence = 0;
        this.history = []; // Rolling window of classifications
    }

    initCentroids() {
        // Convert definitions to Float32Array vectors
        for (const key in CENTROIDS) {
            const c = CENTROIDS[key];
            c.vector = VectorMath.create();
            
            // Fill vector based on definition
            // Default rest to 0.5 (Neutral) if not specified
            c.vector.fill(0.5);

            for (const dimName in c.def) {
                // Find index from V_LABELS (Reverse lookup needed or manual map)
                // Since V_LABELS is index->name, we scan. 
                // Optimization: Pre-compute map.
                const index = this.getDimensionIndex(dimName);
                if (index !== -1) {
                    c.vector[index] = c.def[dimName];
                }
            }
        }
    }

    getDimensionIndex(name) {
        // Simple linear scan for V1 (Optimization: Map)
        for (const k in V_LABELS) {
            if (V_LABELS[k] === name) return parseInt(k);
        }
        return -1;
    }

    /**
     * Classify a World Slice Vector
     * @param {Float32Array} sliceVector - The aggregated state of the universe
     * @returns {Object} { mode: string, confidence: number, color: string }
     */
    classify(sliceVector) {
        let bestMode = 'UNKNOWN';
        let minDist = Infinity;

        // 1. Nearest Neighbor Search
        for (const mode in CENTROIDS) {
            const centroid = CENTROIDS[mode];
            const dist = VectorMath.distanceSq(sliceVector, centroid.vector);
            
            if (dist < minDist) {
                minDist = dist;
                bestMode = mode;
            }
        }

        // 2. Confidence Calculation (Inverse Distance)
        // Max possible distSq in 50-dim unit hypercube is 50.
        // If dist is 0, confidence is 1. If dist is > 2, confidence drops.
        const confidence = Math.max(0, 1 - (minDist / 5.0));

        // 3. Hysteresis (Smoothing)
        // Only switch if confidence is high enough or sustained
        this.history.push({ mode: bestMode, confidence });
        if (this.history.length > 5) this.history.shift();

        // Simple majority vote for stability
        const counts = {};
        this.history.forEach(h => counts[h.mode] = (counts[h.mode] || 0) + h.confidence);
        
        let stableMode = bestMode;
        let maxScore = -1;
        for (const m in counts) {
            if (counts[m] > maxScore) {
                maxScore = counts[m];
                stableMode = m;
            }
        }

        this.currentMode = stableMode;
        this.confidence = confidence;

        return {
            mode: this.currentMode,
            confidence: this.confidence,
            color: CENTROIDS[this.currentMode].color
        };
    }

    // --- ANOMALY DETECTION ---
    
    /**
     * Check if a Planet Vector is weird.
     * @param {Float32Array} planetVector 
     */
    scoreAnomaly(planetVector) {
        // Distance from "Average Planet" (0.5 vector)
        // In reality, we compare against the Rolling Average of THIS planet (Personalized)
        // For V1, we use generic outlier logic.
        
        const center = VectorMath.create();
        center.fill(0.5);
        
        const dist = VectorMath.distanceSq(planetVector, center);
        // distSq > 5.0 implies significant deviation in multiple dimensions
        
        return Math.sqrt(dist); // Return Euclidean distance
    }
}
