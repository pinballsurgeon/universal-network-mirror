/**
 * Topic Prominence Metric
 * Captures the top linguistic topics per planet to validate semantic stability.
 */
export const topicProminenceMetric = {
    id: 'topic_prominence',
    version: '1.0',
    compute: (ctx) => {
        const results = [];
        for (const [id, planet] of ctx.planets.entries()) {
            // Re-use aggregator logic to get consistent scoring
            // ctx.aggregator must be available in context
            const topTokens = ctx.aggregator.getTopTokens(planet.tokens, planet.tokenTotal, 5);
            
            results.push({
                domainId: id,
                name: planet.name,
                topTokens: topTokens.map(t => ({
                    token: t.token,
                    score: t.score,
                    count: t.count
                }))
            });
        }
        return {
            name: 'topic_prominence',
            version: '1.0',
            payload: results
        };
    }
};
