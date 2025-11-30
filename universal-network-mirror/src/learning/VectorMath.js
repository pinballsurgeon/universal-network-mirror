/**
 * VectorMath.js - 2026 World Model Core Math
 * 
 * Provides optimized operations for 50-dimensional feature vectors.
 * Designed for potential WebAssembly / WebGPU upgrade paths.
 */

export const V_DIM = 50; // Standard dimensionality for Particle/Planet/Slice

// Semantic Labels for key dimensions (for debugging/viz)
export const V_LABELS = {
    0: 'IO_PACKET_RATE',
    1: 'IO_VOLUME_SIZE',
    2: 'UPLOAD_RATIO',
    3: 'DOWNLOAD_RATIO',
    4: 'DENSITY_SCORE',
    5: 'HEAVY_RESOURCE_SCORE',
    6: 'SPRAWL_SCORE',
    7: 'LINGUISTIC_DENSITY',
    8: 'LLM_LIKELIHOOD',
    9: 'TEXT_ENTROPY',
    // ... 10-49 Reserved for latent features
};

export class VectorMath {
    
    static create() {
        return new Float32Array(V_DIM);
    }

    static zero(v) {
        v.fill(0);
        return v;
    }

    static add(out, a, b) {
        for (let i = 0; i < V_DIM; i++) {
            out[i] = a[i] + b[i];
        }
        return out;
    }

    static scale(out, a, s) {
        for (let i = 0; i < V_DIM; i++) {
            out[i] = a[i] * s;
        }
        return out;
    }

    static lerp(out, a, b, t) {
        for (let i = 0; i < V_DIM; i++) {
            out[i] = a[i] * (1 - t) + b[i] * t;
        }
        return out;
    }

    static normalize(out, a) {
        let magSq = 0;
        for (let i = 0; i < V_DIM; i++) magSq += a[i] * a[i];
        if (magSq === 0) return VectorMath.zero(out);
        
        const invMag = 1.0 / Math.sqrt(magSq);
        for (let i = 0; i < V_DIM; i++) out[i] = a[i] * invMag;
        return out;
    }

    static distanceSq(a, b) {
        let sum = 0;
        for (let i = 0; i < V_DIM; i++) {
            const d = a[i] - b[i];
            sum += d * d;
        }
        return sum;
    }

    static dot(a, b) {
        let sum = 0;
        for (let i = 0; i < V_DIM; i++) {
            sum += a[i] * b[i];
        }
        return sum;
    }

    // Min-Max Normalization relative to a population range
    // out[i] = (val[i] - min[i]) / (max[i] - min[i])
    static normalizeRelative(out, val, min, max) {
        for (let i = 0; i < V_DIM; i++) {
            const range = max[i] - min[i];
            if (range < 0.000001) {
                out[i] = 0.5; // Default neutral if no variance
            } else {
                out[i] = (val[i] - min[i]) / range;
            }
            // Clamp 0..1
            if (out[i] < 0) out[i] = 0;
            if (out[i] > 1) out[i] = 1;
        }
        return out;
    }
}
