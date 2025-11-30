# Universal Network Mirror - Product Owner Handoff (V4)

**Role**: Chief Architect & Product Owner
**Target**: Engineering & Research Team (The "New Team")
**Mission**: The Digital Life World Model (Absoluteness)

---

## 1. The Grand Vision: "The Universe in a Mirror"

We are building a **Lossless, Reversible, 4D Solar System of Digital Life**.
This is not a "traffic sniffer". This is a **World Model**.
When a user browses the web, we are not just logging requests. We are **ingesting reality**.

**Core Tenets:**
1.  **Absoluteness**: If it appeared on the screen or the network, we MUST capture it. No compromises.
2.  **Unification**: HTML DOM, Network Packets, Time, and Domain Identity must be fused into a single Entity (The Planet).
3.  **Reversibility**: We must be able to "rewind" time and see exactly what the digital world looked like at `t-minus 10 minutes`.
4.  **Intutition**: Data is not rows and columns. It is Mass, Gravity, and Light.

---

## 2. Current State Analysis

**We have:**
-   **The Physics Engine**: A working gravity simulation where domains are planets and packets are particles.
-   **The Black Hole**: Active defense capability to block/redirect domains.
-   **The History Tape**: Local storage persistence of domain states.

**We are failing at:**
-   **Content Completeness**: We are missing crucial text content (e.g., MIT articles, Gemini responses).
-   **Aggressive Filtering**: Our "Noise" filters are destroying valuable signal.
-   **Capacity**: Our ingestion buffers (50KB) are too small for the modern web.

---

## 3. Engineering Requirements (The "Hard" Handoff)

### 3.1 The "Devourer" (Content Ingestion)
The `content-script.js` is the tip of the spear. It must be upgraded from a "scraper" to a **"Digital Vacuum"**.

**Directives:**
*   **Zero Loss**: Capture ALL text content. If it renders, we keep it.
*   **Deep Shadow Protocol**: Pierce all Shadow DOMs, iframes (cross-origin limitation acknowledged, but aim for max coverage), and dynamic frameworks (Angular/React).
*   **Chunked Transmission**: 50KB limits are unacceptable. Implement a **Streamed Payload Protocol** to send Megabytes of text data to the background in chunks.
*   **Context Preservation**: Don't just grab text. Grab structure. Know that "In the future..." came from a `<p>` tag inside a `<main>` article.

### 3.2 The "Collider" (Data Fusion)
We currently loosely associate Traffic with Text. This must be tightened.
*   **Temporal alignment**: Correlate the arrival of a JSON packet with the appearance of a DOM node.
*   **Causality**: Did this XHR request cause this Text Node to appear? (Heuristic analysis needed).

### 3.3 The "Observatory" (Testing & QA)
We need a rigorous **Ground Truth Baseline**.
*   **Automated Validation**: Run a headless browser. Visit `mit.edu`. Extract text via `puppeteer` (Ground Truth). Compare with `Universal Network Mirror` captured text.
*   **Variance Tolerance**: 0%.
*   **Stress Testing**: Feed it the entire Wikipedia database. Ensure the Physics Engine doesn't explode.

---

## 4. Research Directives (The "Soft" Handoff)

**To the Research Team:**
*   **Semantic Weighting**: How do we weigh the "importance" of a word? Frequency is too simple. Use TF-IDF relative to the User's History.
*   **Sentiment Physics**: Should "Angry" content (hate speech, errors) have higher gravity? Heavier mass? Redder color?
*   **The "World Model"**: How do we serialize this entire simulation so it can be reloaded 5 years from now as a perfect historical archive of the user's life?

---

## 5. Immediate Action Items (The "Sprint")

1.  **Refactor Harvester**: Remove size limits. Implement chunking.
2.  **Fix "Missing Content"**: Specifically debug `mit.edu` and `Gemini Studio` use cases. Likely DOM Mutation timing or aggressive tag filtering.
3.  **Unified Data Model**: Ensure `PhysicsEngine` entities hold the *full* text content (referenced by ID/Hash) for deep inspection.
4.  **UI Scale**: The Inspector currently shows a snippet. We need a "Full Text Reader" mode for captured content.

**"We are not building a tool. We are building a memory."**
