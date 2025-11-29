/**
 * Visual Density Metric
 * Estimates how crowded the screen is to prevent information overload.
 */
export const visualDensityMetric = {
    id: 'visual_density',
    version: '1.0',
    compute: (ctx) => {
        let totalObjectArea = 0;
        const screenArea = (ctx.width || 1000) * (ctx.height || 1000);

        // 1. Planet Area
        for (const planet of ctx.planets.values()) {
            totalObjectArea += Math.PI * (planet.radius * planet.radius);
            
            // 2. Moon Area
            for (const moon of planet.moons.values()) {
                totalObjectArea += Math.PI * (moon.radius * moon.radius);
            }

            // 3. Text Area (Estimate)
            if (planet.tokenState) {
                for (const state of planet.tokenState.values()) {
                    if (state.currentStrength > 0.1) {
                        const fontSize = 8 + Math.pow(state.currentStrength, 0.7) * 24;
                        // Approx area: width * height (assuming square-ish aspect for words is wrong, but helpful proxy)
                        // A word "hello" at 16px is approx 5 chars * 10px * 16px = 800px?
                        // Let's approximate text block area as fontSize^2 * length * 0.5
                        totalObjectArea += (fontSize * fontSize) * 4; 
                    }
                }
            }
        }

        const densityScore = totalObjectArea / screenArea;

        return {
            name: 'visual_density',
            version: '1.0',
            payload: {
                totalObjectArea,
                screenArea,
                densityScore,
                isCrowded: densityScore > 0.4
            }
        };
    }
};
