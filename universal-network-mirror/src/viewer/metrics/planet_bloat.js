/**
 * Planet Bloat Metric
 * Measures the "health" vs "bloat" of domains based on traffic size relative to packet count.
 */
export const planetBloatMetric = {
    id: 'planet_bloat',
    version: '1.0',
    compute: (ctx) => {
        const results = [];
        for (const [id, planet] of ctx.planets.entries()) {
            const score = planet.bloatScore / (planet.packetCount || 1);
            let grade = 'A';
            if (score > 10) grade = 'B';
            if (score > 50) grade = 'C';
            if (score > 100) grade = 'D';
            if (score > 500) grade = 'F';

            results.push({
                domainId: id,
                name: planet.name,
                mass: planet.mass,
                radius: planet.radius,
                bloatScore: planet.bloatScore,
                packetCount: planet.packetCount,
                bloatGrade: grade,
                avgBytesPerPacket: (planet.internalTrafficSize + planet.externalTrafficSize) / (planet.packetCount || 1)
            });
        }
        return {
            name: 'planet_bloat_grade',
            version: '1.0',
            payload: results
        };
    }
};
