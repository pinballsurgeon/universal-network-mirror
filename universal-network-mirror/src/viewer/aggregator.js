// Linguistic Aggregator
// Centralizes token merging, global TF stats, and per-planet
// topic scoring + light hysteresis so viewer.js can focus on
// physics / drawing.

const STOP_WORDS = new Set([
    // Standard English
    "a", "about", "above", "after", "again", "against", "all", "am", "an", "and", "any", "are", "aren't", "as", "at", "be", "because", "been", "before", "being", "below", "between", "both", "but", "by", "can't", "cannot", "could", "couldn't", "did", "didn't", "do", "does", "doesn't", "doing", "don't", "down", "during", "each", "few", "for", "from", "further", "had", "hadn't", "has", "hasn't", "have", "haven't", "having", "he", "he'd", "he'll", "he's", "her", "here", "here's", "hers", "herself", "him", "himself", "his", "how", "how's", "i", "i'd", "i'll", "i'm", "i've", "if", "in", "into", "is", "isn't", "it", "it's", "its", "itself", "let's", "me", "more", "most", "mustn't", "my", "myself", "no", "nor", "not", "of", "off", "on", "once", "only", "or", "other", "ought", "our", "ours", "ourselves", "out", "over", "own", "same", "shan't", "she", "she'd", "she'll", "she's", "should", "shouldn't", "so", "some", "such", "than", "that", "that's", "the", "their", "theirs", "them", "themselves", "then", "there", "there's", "these", "they", "they'd", "they'll", "they're", "they've", "this", "those", "through", "to", "too", "under", "until", "up", "very", "was", "wasn't", "we", "we'd", "we'll", "we're", "we've", "were", "weren't", "what", "what's", "when", "when's", "where", "where's", "which", "while", "who", "who's", "whom", "why", "why's", "with", "won't", "would", "wouldn't", "you", "you'd", "you'll", "you're", "you've", "your", "yours", "yourself", "yourselves",
    "will", "just", "now", "one", "like", "can", "get", "time", "new", "us", "use", "make", "made", "see", "way", "day", "go", "come", "back", "many", "much", "good", "know", "think", "take", "people", "year", "say", "well", "work", "want", "also", "even",
    // UI / Navigation Noise
    "follow", "like", "subscribe", "full", "coverage", "text", "courier", "journal", "new", "journal", "report", "news", "times", "hour", "hours", "view", "views", "sync", "user sync", "user", "full coverage", "opinion", "more", "yesterday", "days", "https", "http", "wwww", "com", "privacy", "show", "less", "show more", "show less", "last", "chat", "message", "select", "last message", "container", "safeframe", "browser", "preferences", "icon", "comment", "comments", "advertisement", "container safeframe", "recommedn",
    // V5 AUDIT ADDITIONS (Cleaned from 20-domain scan)
    "cnn", "x27", "video", "apple", "business", "amp", "github", "microsoft", "best", "newsletters", "world", "read", "bull", "learn", "deals", "help", "quot", "watch", "shop", "code", "stories", "ago", "games", "tech", "images", "sign", "data", "policy", "2025", "free", "save", "copilot", "live", "top", "cyber", "courses", "support", "find", "explore", "stack", "week", "podcasts", "getty", "000", "travel", "home", "min", "health", "crossword", "rights", "reserved", "menu", "search", "login", "terms"
]);

export class LinguisticAggregator {
    constructor(options = {}) {
        const {
            maxVisualTopicsPerPlanet = 30,
            visualCandidateLimit = 60,
            enterThreshold = 0.01,
            exitThreshold = 0.005,
            minEnterDurationMs = 0,
            maxIdleMs = 60000,
            globalDecayRate = 0.992, // Faster decay to match viewer (1.5s half-life)
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
            // Apply massive stop word list filtering immediately
            if (STOP_WORDS.has(token.toLowerCase()) || token.length < 3) continue;

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

        // 1. Cluster / hub logic: REMOVED penalty for generic roots. 
        // User wants frequent constituents ("learning") to be the LARGEST topics ("boss"),
        // while the n-grams ("machine learning") are smaller.
        // We still track occurrences to potentially boost the root further later.

        // 2. "Top Level Heuristics": Constituent Boosting
        // "Words that show up as members of ngrams are weighted high based on frequency of showing up in the top ngrams"
        const topCandidates = scores.slice(0, 40); // Look at top 40 for constituent analysis
        const constituentFreq = new Map();
        
        // Count unigram frequencies within the top n-grams
        for (const cand of topCandidates) {
            // Split phrase into words
            const parts = cand.token.split(/[\s-_]+/);
            if (parts.length > 1) {
                for (const p of parts) {
                    const cleanP = p.toLowerCase();
                    if (!STOP_WORDS.has(cleanP) && cleanP.length > 2) {
                        constituentFreq.set(cleanP, (constituentFreq.get(cleanP) || 0) + 1);
                    }
                }
            }
        }

        // Boost unigrams that appear frequently in top phrases
        for (let i = 0; i < scores.length; i++) {
            const t = scores[i].token.toLowerCase();
            if (constituentFreq.has(t)) {
                const freq = constituentFreq.get(t);
                // EXTREME boost for key ingredients ("Boss" words)
                // If "learning" appears in 3 top n-grams, boost it significantly
                // making it the dominant visual element.
                scores[i].score *= (1 + freq * 1.5); 
            }
        }

        // 3. High Variance Weighting
        // "More variance between small and big frequency topic weighting"
        for (let i = 0; i < scores.length; i++) {
            // Reduced curve to 1.3 to ensure we don't squash everything
            // This is the safety fix for "lost words".
            scores[i].score = Math.pow(scores[i].score, 1.3); 
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

        // Removed n-gram damping logic for global tokens as well,
        // to maintain consistency with the "Boss" word logic.

        // Apply variance
        const candidates = scores.slice(0, limit * 3);
        for (let i = 0; i < candidates.length; i++) {
            candidates[i].score = Math.pow(candidates[i].score, 1.3);
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
            // Normalize with high variance
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

    // New V6 Maintenance: Prune stale planet states to prevent memory leaks
    // caused by infinite accumulation of dead domain histories.
    prune(activePlanetKeys) {
        const activeSet = new Set(activePlanetKeys);
        for (const key of this.planetTopicState.keys()) {
            if (!activeSet.has(key)) {
                this.planetTopicState.delete(key);
            }
        }
        // Also ensure global stats don't grow infinitely if mostly junk
        if (this.globalTokens.size > 20000) {
            // Emergency trim of low-frequency global tokens
            for (const [t, count] of this.globalTokens.entries()) {
                if (count < 1.0) this.globalTokens.delete(t);
            }
        }
    }
}
