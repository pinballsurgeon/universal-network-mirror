# Universal Network Mirror: Architect's Directive (V2)

**To:** Research & Engineering Team (Code Name: "The Zen Masters")
**From:** Chief Architect
**Subject:** COMPLETE REWRITE OF LINGUISTIC VISUALIZATION LAYER

---

## 1. Mission Critical: The "Readability" Pivot

We have successfully built a high-throughput network ingestion engine (`background.js`) and a robust semantic extractor (`content-script.js`). The data is good. The algorithms work.

**HOWEVER, the visualization is failing.**

It is currently:
*   **Too Fast**: Words spin and revolve at speeds that induce cognitive overload.
*   **Too Noisy**: Background text creates a "clutter layer" that distracts from key insights.
*   **Too Volatile**: The "Top Concepts" list jitters and flickers as scores change frame-by-frame.

**Your Mandate**: Rewrite the `Linguistic Mode` visualization from scratch. The goal is no longer "physics accuracy" or "packet-level fidelity" in the visual layer. The goal is **"Clean, Consistent Smoothness"**.

---

## 2. The New Architecture: "Rolling Aggregation"

We are moving away from "Real-Time Packet Firehose" to "Smooth Rolling Windows".

### The "River" Concept
Imagine the data not as a machine gun, but as a river.
1.  **Ingest**: Packets arrive in bursts (current behavior).
2.  **Buffer**: A new "Aggregator" module holds data for a sliding window (e.g., 30-60 seconds).
3.  **Distill**: Every 1-2 seconds, the Aggregator calculates a **Stable State** of the Top 20 concepts based on the full window.
4.  **Render**: The Visual Layer *gently* transitions to this new state.

### Key Technical Requirements

#### A. The Aggregator (Logic)
*   **Rolling TF-IDF**: Maintain global term counts and local (planet) term counts over a time window.
*   **Hysteresis**: A concept must "prove" itself to enter the Top 20 and must "fade" slowly when leaving. No instant popping.
*   **Scoring Refinement**:
    *   **Generic Penalty**: Penalize "Hub" words (e.g., "Learning") if they appear in multiple specific n-grams.
    *   **Specific Boost**: Boost specific n-grams (e.g., "Machine Learning", "Deep Learning").
    *   **Preference**: Show the *Single Word* if it's the core concept, but show the *N-gram* if the single word is too generic.

#### B. The Visualizer (Physics & UX)
*   **Lo-Fi & Clean**: Remove "background noise". If a word isn't important enough to read, **don't draw it**. No "50% transparent background layer".
*   **Slow Orbits**: Orbits should be majestic and slow (e.g., 1 revolution per minute), not "spinning".
*   **Pause Sync**: The visualization must respect the global `isPaused` state. When paused, **everything freezes**. Text, orbits, breathing, fading.
*   **Readable Typography**: Font sizes must be calculated for readability first, frequency second.

---

## 3. Testing & Validation Workflow

This is how you will validate your work. You must follow this "End-to-End" loop:

1.  **The "News Test"**:
    *   Use `browser_action` to open a content-rich page (e.g., `https://news.ycombinator.com/` or a specific Wikipedia article).
    *   *Expectation*: You should see the browser open.
2.  **The Stream Check**:
    *   Observe the `viewer.js` output (console logs or visual inspection via screenshot).
    *   *Expectation*: You should see relevant terms ("Startup", "YC", "Funding") appearing.
3.  **The "Zen" Check**:
    *   Watch the visualization for **10 seconds**.
    *   *Fail Condition*: If you cannot read a word because it's moving, FAIL. If words flicker, FAIL.
    *   *Pass Condition*: You can comfortably read the Top 5 concepts. They drift slowly. New concepts fade in gently.

---

## 4. System Manifesto & File Intelligence

To aid your rewrite, here is the deep-dive intelligence on the current codebase.

### `src/content/content-script.js` (The Sensor)
*   **Status**: **STABLE**. Do not rewrite unless necessary for data quality.
*   **Function**: Scrapes DOM `innerText`. Calculates "Bloat Score" (scripts vs text).
*   **Key Algorithm**: Weighted N-grams (Unigrams=1x, Bigrams=2x, Trigrams=3x). Sends top 100 tokens to background.

### `src/background/background.js` (The Router)
*   **Status**: **STABLE**.
*   **Function**: Intercepts `webRequest`. Normalizes data into "Particles".
*   **Key Mechanism**: `ringBuffer` (Short-term history). Broadcasts `NEW_PARTICLE` messages.

### `src/viewer/viewer.js` (The Renderer - **TARGET FOR REWRITE**)
*   **Status**: **UNSTABLE / NEEDS REWRITE**.
*   **Current Architecture**:
    *   `Planet` class: Holds `tokens` map.
    *   `getScoredTokens()`: Implements the TF-IDF and Cluster logic. **(Needs extraction to a helper/class)**.
    *   `draw()`: Handles both logic and rendering. **(Needs splitting)**.
    *   `tokenState`: Attempts to handle smoothing, but is currently coupled to the render loop.

### `src/common/constants.js`
*   **Status**: **STABLE**. Tuning parameters.

---

## 5. Implementation Guide for the New Team

### Phase 1: The "Aggregator" Class
Create a dedicated class/module (e.g., `src/viewer/Aggregator.js`) that handles the math.
*   **Input**: Stream of Particles.
*   **Process**: Add to time-window buckets. Calculate TF-IDF. Apply "Hub/Satellite" logic.
*   **Output**: A clean array of `VisualTarget` objects (Text, TargetSize, TargetColor).

### Phase 2: The "Render" Loop
Refactor `viewer.js` to simply consume `VisualTarget` objects.
*   **Logic**: `CurrentState` -> lerp -> `VisualTarget`.
*   **Physics**: Simple circular motion. Use `playbackTime` for ALL motion to ensure pausing works.

### Phase 3: Tuning
Use the **Testing Workflow**. Tune `DECAY_RATES`, `LERP_SPEED`, and `ORBIT_SPEED` until the experience is "Zen".

---

*Signed,*
*Architect Lead (Outgoing)*
*Universal Network Mirror Project*
