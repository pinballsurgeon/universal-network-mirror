/**
 * Node Fingerprint Metric (V4 - Strict Relative Normalization)
 * Creates an 8-dimensional signature for each domain.
 * 
 * Strategy:
 * 1. Log-transform power-law metrics.
 * 2. Min-Max Normalize ALL metrics to strict 0.0 - 1.0 range based on population.
 * 3. This ensures all bars are relative to the current network context.
 */
export const nodeFingerprintMetric = {
    id: 'node_fingerprint',
    version: '4.0',
    compute: (ctx) => {
        const rawStats = [];
        
        // 1. Collect Raw Stats
        for (const [id, planet] of ctx.planets.entries()) {
            const pCount = planet.packetCount || 1;
            const tSize = planet.internalTrafficSize + planet.externalTrafficSize || 1;
            const iCount = planet.internalTraffic || 0;
            const eCount = planet.externalTraffic || 0;
            const iSize = planet.internalTrafficSize || 0;
            const eSize = planet.externalTrafficSize || 0;
            
            // Log transform power-law values immediately
            // Add 1 to avoid log(0)
            const logDensity = Math.log(pCount + 1);
            const logHeavy = Math.log((tSize / pCount) + 1);
            const logUpload = Math.log((iCount > 0 ? iSize / iCount : 0) + 1);
            const logDownld = Math.log((eCount > 0 ? eSize / eCount : 0) + 1);
            const logSprawl = Math.log((planet.moons ? planet.moons.size : 0) + 1);

            rawStats.push({
                id, 
                name: planet.name,
                // Ratios are already 0-1 linear
                io_pkt: iCount / pCount,
                io_vol: iSize / tSize,
                lingo: planet.tokenTotal > 0 ? planet.tokens.size / planet.tokenTotal : 0,
                // Log transformed values
                upload: logUpload,
                downld: logDownld,
                density: logDensity,
                heavy: logHeavy,
                sprawl: logSprawl
            });
        }

        // 2. Compute Min/Max for Normalization
        const keys = ['io_pkt', 'io_vol', 'upload', 'downld', 'density', 'heavy', 'sprawl', 'lingo'];
        const min = {};
        const max = {};
        
        keys.forEach(k => {
            min[k] = Infinity;
            max[k] = -Infinity;
        });

        rawStats.forEach(s => {
            keys.forEach(k => {
                min[k] = Math.min(min[k], s[k]);
                max[k] = Math.max(max[k], s[k]);
            });
        });

        // 3. Compute Strictly Normalized Fingerprints (0.0 - 1.0)
        const fingerPrints = rawStats.map(s => {
            const norm = {};
            keys.forEach(k => {
                const range = max[k] - min[k];
                // If range is 0 (all nodes same), default to 0.5 (neutral)
                norm[k] = range > 0.000001 ? (s[k] - min[k]) / range : 0.5;
            });

            return {
                domainId: s.id,
                name: s.name,
                metrics: norm
            };
        });

        // 4. Calculate Network Average Profile
        const avgProfile = {
            io_pkt: 0, io_vol: 0, upload: 0, downld: 0, 
            density: 0, heavy: 0, sprawl: 0, lingo: 0
        };
        
        if (fingerPrints.length > 0) {
            fingerPrints.forEach(fp => {
                keys.forEach(k => avgProfile[k] += fp.metrics[k]);
            });
            keys.forEach(k => avgProfile[k] /= fingerPrints.length);
        }

        // 5. Compute Deviations & Weirdness
        fingerPrints.forEach(fp => {
            let sumSq = 0;
            let maxDev = 0;
            let maxDevMetric = '';
            const deviations = {};
            
            keys.forEach(k => {
                const diff = fp.metrics[k] - avgProfile[k];
                const absDiff = Math.abs(diff);
                
                deviations[k + '_dev'] = diff;
                sumSq += diff * diff;
                
                if (absDiff > maxDev) {
                    maxDev = absDiff;
                    maxDevMetric = k;
                }
            });
            
            fp.weirdness = Math.sqrt(sumSq); 
            fp.deviations = deviations;
            fp.maxDevMetric = maxDevMetric; // The metric causing the weirdness
        });

        return {
            name: 'node_fingerprint',
            version: '4.0',
            payload: {
                fingerPrints,
                avgProfile
            }
        };
    }
};
