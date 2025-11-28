// Linguistic Aggregator
// Centralizes token merging, global TF stats, and per-planet
// topic scoring + light hysteresis so viewer.js can focus on
// physics / drawing.

export class LinguisticAggregator {
    constructor(options = {}) {
        const {
            maxVisualTopicsPerPlanet = 10,
            visualCandidateLimit = 30,
            enterThreshold = 0.3,
            exitThreshold = 0.12,
            minEnterDurationMs = 2000,
            maxIdleMs = 60000,
            globalDecayRate = 0.999,
        } = options;

        this.maxVisualTopicsPerPlanet = maxVisualTopicsPerPlanet;
        this.visualCandidateLimit = visualCandidateLimit;
        this.enterThreshold = enterThreshold;
        this.exitThreshold = exitThreshold;
        this.minEnterDurationMs = minEnterDurationMs;
        this.maxIdleMs = maxIdleMs;
        this.globalDecayRate = globalDecayRate;

        // Global TF statistics (rolling via explicit decay step)
        this.globalTokens = new Map();
        this.globalTokenCount = 0;

        // Per-planet topic state for hysteresis / smoothing
        // planetKey -> Map<token, TopicState>
        this.planetTopicState = new Map();
    }

    // Merge a new batch of raw counts into an entity-local map and
    // update global statistics used for TF/IDF scoring.
    mergeTokens(targetMap, sourceTokens) {
        if (!sourceTokens) return 0;
        let added = 0;
        for (const [token, count] of Object.entries(sourceTokens)) {
            const c = count || 0;
            if (!c) continue;

            targetMap.set(token, (targetMap.get(token) || 0) + c);

            const prevGlobal = this.globalTokens.get(token) || 0;
            const nextGlobal = prevGlobal + c;
            this.globalTokens.set(token, nextGlobal);
            this.globalTokenCount += c;
            added += c;
        }
        return added;
    }

    // Called once per frame from the render loop to keep global
    // token stats roughly aligned with the per-entity decay window.
    decayGlobalTokens() {
        if (this.globalTokens.size === 0) return;
        let newTotal = 0;
        for (const [token, count] of this.globalTokens.entries()) {
            const next = count * this.globalDecayRate;
            if (next < 0.1) {
                this.globalTokens.delete(token);
            } else {
                this.globalTokens.set(token, next);
                newTotal += next;
            }
        }
        this.globalTokenCount = newTotal;
    }

    // Internal: core TF/IDF + generic-penalty / specific-boost scoring,
    // adapted from the original getScoredTokens helper.
    _scoreTokens(localMap, localTotal, limit = 20) {
        if (!localMap || localMap.size === 0) return [];

        const scores = [];
        const globalTotal = this.globalTokenCount || 1;

        for (const [token, count] of localMap.entries()) {
            const tf = count / (localTotal || 1);
            const globalFreq = (this.globalTokens.get(token) || 1) / globalTotal;
            const score = tf / globalFreq;
            scores.push({ token, score, count });
        }

        scores.sort((a, b) => b.score - a.score);

        // Cluster / hub logic: penalize overly generic roots that appear
        // inside multiple n-grams, and slightly boost specific n-grams.
        const occurrences = new Map(); // token -> count of supersets
        for (let i = 0; i < scores.length; i++) {
            for (let j = 0; j < scores.length; j++) {
                if (i === j) continue;
                const ti = scores[i].token;
                const tj = scores[j].token;
                if (tj.includes(ti)) {
                    occurrences.set(ti, (occurrences.get(ti) || 0) + 1);
                }
            }
        }

        for (let i = 0; i < scores.length; i++) {
            const token = scores[i].token;
            const supersetCount = occurrences.get(token) || 0;

            if (supersetCount >= 2) {
                // Generic hub word present in many n-grams: damp it.
                scores[i].score *= 0.5;
            } else if (supersetCount === 1) {
                // Appears inside a single bigger phrase: mostly redundant.
                scores[i].score *= 0.3;
            } else {
                // Boost specific n-grams that contain a generic root that
                // itself appears in multiple distinct phrases.
                for (const [root, count] of occurrences) {
                    if (count >= 2 && token.includes(root)) {
                        scores[i].score *= 1.3;
                    }
                }
            }
        }

        scores.sort((a, b) => b.score - a.score);
        return scores.slice(0, limit);
    }

    // Inspector helper: get a simple "Top N" list for a local token map.
    getTopTokens(localMap, localTotal, limit = 10) {
        return this._scoreTokens(localMap, localTotal, limit);
    }

    // Global Top Topics: raw counts + n-gram specific/generic penalty logic.
    // We reuse the clustering logic but score based on pure count since TF/IDF
    // cancels out for the global set itself.
    getGlobalTopTokens(limit = 10) {
        if (this.globalTokens.size === 0) return [];
        
        const scores = [];
        for (const [token, count] of this.globalTokens.entries()) {
            scores.push({ token, score: count, count });
        }
        scores.sort((a, b) => b.score - a.score);

        // Apply n-gram hub/cluster logic to prioritize specific phrases
        const occurrences = new Map();
        // Only consider top candidates for n-gram checks to save cycles
        const candidates = scores.slice(0, limit * 3); 
        
        for (let i = 0; i < candidates.length; i++) {
            for (let j = 0; j < candidates.length; j++) {
                if (i === j) continue;
                const ti = candidates[i].token;
                const tj = candidates[j].token;
                if (tj.includes(ti)) {
                    occurrences.set(ti, (occurrences.get(ti) || 0) + 1);
                }
            }
        }

        for (let i = 0; i < candidates.length; i++) {
            const token = candidates[i].token;
            const supersetCount = occurrences.get(token) || 0;

            if (supersetCount >= 2) {
                // Generic hub word ("learning")
                candidates[i].score *= 0.5;
            } else if (supersetCount === 1) {
                // Redundant substring
                candidates[i].score *= 0.3;
            } else {
                // Boost specific n-grams containing popular roots
                for (const [root, count] of occurrences) {
                    if (count >= 2 && token.includes(root)) {
                        candidates[i].score *= 1.3;
                    }
                }
            }
        }

        candidates.sort((a, b) => b.score - a.score);
        return candidates.slice(0, limit);
    }

    _getPlanetState(planetKey) {
        if (!this.planetTopicState.has(planetKey)) {
            this.planetTopicState.set(planetKey, new Map());
        }
        return this.planetTopicState.get(planetKey);
    }

    // Main API for the visual layer: from a planet's token map and total,
    // produce a compact list of VisualTarget objects:
    // { token, strength (0..1), rank }
    //
    // `now` should be playbackTime so pausing / replay work as expected.
    getPlanetVisualTargets(planetKey, localMap, localTotal, now) {
        const state = this._getPlanetState(planetKey);

        // No local tokens: gently decay any existing topics.
        if (!localMap || localMap.size === 0 || !localTotal) {
            this._decayPlanetState(state, now);
            return this._collectVisibleTargets(state);
        }

        const rawScores = this._scoreTokens(
            localMap,
            localTotal,
            this.visualCandidateLimit
        );

        if (rawScores.length === 0) {
            this._decayPlanetState(state, now);
            return this._collectVisibleTargets(state);
        }

        const bestScore = rawScores[0].score || 1;
        const activeTokens = new Set();

        for (const { token, score } of rawScores) {
            activeTokens.add(token);
            const normalized = bestScore > 0 ? score / bestScore : 0;
            let topic = state.get(token);
            if (!topic) {
                topic = {
                    value: normalized,
                    lastValue: normalized,
                    visible: false,
                    enteredAt: null,
                    lastSeenAt: now,
                };
            } else {
                topic.lastValue = normalized;
                topic.value = topic.value * 0.7 + normalized * 0.3;
                topic.lastSeenAt = now;
            }
            state.set(token, topic);
        }

        // Decay topics that were not active in this scoring pass.
        for (const [token, topic] of state.entries()) {
            if (!activeTokens.has(token)) {
                topic.value *= 0.9;
            }
        }

        // Hysteresis: update visible flags and prune stale topics.
        for (const [token, topic] of state.entries()) {
            const age = now - (topic.lastSeenAt || now);
            if (age > this.maxIdleMs || topic.value < 0.02) {
                state.delete(token);
                continue;
            }

            if (!topic.visible) {
                if (topic.value >= this.enterThreshold) {
                    if (!topic.enteredAt) {
                        topic.enteredAt = now;
                    } else if (now - topic.enteredAt >= this.minEnterDurationMs) {
                        topic.visible = true;
                    }
                } else {
                    topic.enteredAt = null;
                }
            } else {
                if (topic.value < this.exitThreshold && age > this.minEnterDurationMs) {
                    topic.visible = false;
                    topic.enteredAt = null;
                }
            }
        }

        return this._collectVisibleTargets(state);
    }

    _collectVisibleTargets(state) {
        const visible = [];
        for (const [token, topic] of state.entries()) {
            if (!topic.visible || topic.value <= 0) continue;
            visible.push({
                token,
                strength: Math.max(0, Math.min(1, topic.value)),
            });
        }
        visible.sort((a, b) => b.strength - a.strength);

        const limited = visible.slice(0, this.maxVisualTopicsPerPlanet);
        return limited.map((t, index) => ({
            token: t.token,
            strength: t.strength,
            rank: index,
        }));
    }

    _decayPlanetState(state, now) {
        for (const [token, topic] of state.entries()) {
            const age = now - (topic.lastSeenAt || now);
            if (age > this.maxIdleMs) {
                state.delete(token);
                continue;
            }
            topic.value *= 0.9;
            if (topic.value < 0.02) {
                state.delete(token);
            }
        }
    }
}
