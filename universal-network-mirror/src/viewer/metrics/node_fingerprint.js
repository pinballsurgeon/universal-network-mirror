/**
 * Node Fingerprint Metric
 * Normalizes traffic and linguistic features to create a unique "signature" for each domain.
 * values are normalized to 0-1 range for easy visualization.
 */
export const nodeFingerprintMetric = {
    id: 'node_fingerprint',
    version: '1.0',
    compute: (ctx) => {
        const fingerPrints = [];
        let totalPackets = 0;
        let totalSize = 0;
        let maxPackets = 1;
        let maxSize = 1;

        // 1. First Pass: Global Stats & Maxima
        for (const planet of ctx.planets.values()) {
            const pCount = planet.packetCount || 0;
            const pSize = planet.internalTrafficSize + planet.externalTrafficSize;
            
            totalPackets += pCount;
            totalSize += pSize;
            maxPackets = Math.max(maxPackets, pCount);
            maxSize = Math.max(maxSize, pSize);
        }

        const avgPackets = totalPackets / (ctx.planets.size || 1);
        const avgSize = totalSize / (ctx.planets.size || 1);

        // 2. Second Pass: Compute Normalized Fingerprints
        for (const [id, planet] of ctx.planets.entries()) {
            const pCount = planet.packetCount || 0;
            const pSize = planet.internalTrafficSize + planet.externalTrafficSize;
            const internal = planet.internalTraffic || 0;
            const external = planet.externalTraffic || 0;

            // Metric A: I/O Balance (0 = All External, 1 = All Internal)
            const ioRatio = (internal + external) > 0 ? internal / (internal + external) : 0.5;

            // Metric B: Traffic Density (0..1 relative to max observed)
            const density = pCount / maxPackets;

            // Metric C: Payload Heaviness (Avg Bytes per Packet, normalized against a baseline of 10KB)
            const avgBytes = pCount > 0 ? pSize / pCount : 0;
            const heaviness = Math.min(1, avgBytes / 10000); 

            // Metric D: Linguistic Diversity (Unique Tokens / Total Tokens)
            // (1.0 = Every word is unique, 0.0 = All same word)
            const uniqueTokens = planet.tokens.size;
            const totalTokens = planet.tokenTotal;
            const complexity = totalTokens > 0 ? uniqueTokens / totalTokens : 0;

            fingerPrints.push({
                domainId: id,
                name: planet.name,
                metrics: {
                    io_ratio: ioRatio,
                    density: density,
                    heaviness: heaviness,
                    complexity: complexity
                },
                deviations: {
                    // How far from average? (Signed value)
                    packet_dev: (pCount - avgPackets) / avgPackets, 
                    size_dev: (pSize - avgSize) / avgSize
                }
            });
        }

        return {
            name: 'node_fingerprint',
            version: '1.0',
            payload: {
                fingerPrints,
                globalAverages: {
                    packets: avgPackets,
                    size: avgSize
                }
            }
        };
    }
};
