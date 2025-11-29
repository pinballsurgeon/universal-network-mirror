# Universal Network Mirror - Lead Architect Handoff

**Status**: V2 Architecture (Modularized)
**Next Phase**: V3 "Active Defense" (Black Holes & Interaction)

---

## 1. The Vision: "Absoluteness"

The Universal Network Mirror is not just a visualizer. It is a **Visceral Cybersecurity Interface**.
We do not hide data behind tables. We render it as a living, breathing universe.
Every packet is a particle. Every domain is a planet. Every byte has mass.

**Core Philosophy:**
1.  **Real Data Only**: No mocks. We test against the chaos of the live web.
2.  **Ground Truth**: If it happened on the network, it must be represented.
3.  **Visceral Physics**: Big data feels heavy. Fast data feels energetic. Danger feels red.

---

## 2. Architecture V2: The Engine

We have successfully fractured the monolith. The codebase is now structured for scale.

### 2.1 The Trinity
The `viewer.js` is now just a conductor. The real work happens in three engines:

1.  **PhysicsEngine (`src/viewer/engine/PhysicsEngine.js`)**
    -   **Responsibility**: Pure math. Coagulation, gravity, orbital mechanics.
    -   **Input**: `ingestPacket` (from Background).
    -   **Output**: `getState()` (Map of Planets, Array of Particles).
    -   **Key Logic**: `processBuffer` handles the "Time Window" to synchronize asynchronous network events with the 60fps render loop.

2.  **RenderEngine (`src/viewer/engine/RenderEngine.js`)**
    -   **Responsibility**: Pixels. Canvas context management.
    -   **Features**:
        -   **Space View**: Planets, Moons, Artifacts (Space Junk).
        -   **Timeline**: The "Adobe Premiere" style heatmap at the bottom (`HistoryManager`).
        -   **Linguistic Mode**: "Semantic Atmosphere" (Floating words).

3.  **UIManager (`src/viewer/ui/UIManager.js`)**
    -   **Responsibility**: DOM. HUD, Inspector Panel, Buttons.
    -   **Philosophy**: The UI is a "Helmet HUD" overlaid on the reality of the simulation.

### 2.2 The Data Pipeline
`Content Script` (Harvester) -> `Background.js` (Ingest) -> `Viewer.js` (Orchestrator) -> `PhysicsEngine` (Simulation)

-   **Harvester**: Now includes **Developer Signal Detection** (UUIDs, weird vars).
-   **Background**: Buffers packets in a "Ring of Fire" (Circular Buffer) before streaming to Viewer.

---

## 3. The Protocol: "Hard Testing"

We do not use mocks. We use **Real Data Harnesses**.

### 3.1 The Perception Harness (`test/perception-harness.mjs`)
This Node.js script is your primary weapon. It does NOT fake data.
1.  **Fetches** live HTML from Wikipedia, Yahoo, Reddit.
2.  **Parses** static resources to simulate the "Cascade".
3.  **Feeds** the *actual* `PhysicsEngine` logic.
4.  **Asserts** on `Visual Density`, `FPS`, and `Consistency`.

**Run it daily:** `node test/perception-harness.mjs`

### 3.2 The Standard
-   **Clean Sites** (Wiki): Must remain calm (< 0.1 Density).
-   **Messy Sites** (Yahoo): Must show complexity (> 0.2 Density).
-   **Performance**: Must sustain >1000 particles at 60fps (Headless benchmark: >200k fps).
-   **Consistency**: Variance must be **0.000000**.

---

## 4. The Roadmap: V3 & Beyond

### 4.1 IMMEDIATE PRIORITY: The Black Hole
*User Request: "Select a node and just black hole it."*

**Concept**: Active Traffic Control.
-   **Interaction**: Click a Planet -> Select "Black Hole" from Inspector.
-   **Visuals**: Planet collapses into a singularity (black circle, accretion disk).
-   **Physics**: 
    -   Gravity massively increases.
    -   Particles destined for this domain are sucked in and destroyed (removed from memory).
    -   **Background Integration**: The Viewer sends a message to `background.js` to **BLOCK** future requests to this domain (`declarativeNetRequest` or `webRequest.cancel`).

**Implementation Plan:**
1.  **UI**: Add "BLACK HOLE" button to `UIManager` Inspector.
2.  **Entity**: Create `BlackHole` class (inherits/replaces `Planet`).
3.  **Physics**: Update `Particle.update` to check if target is Black Hole -> Accelerate fast -> Kill.
4.  **Backend**: Add `BLOCK_DOMAIN` message handler in `background.js`.

### 4.2 Linguistic Intelligence
-   **Context Awareness**: Differentiate "News" (many topics) vs "Deep Reading" (one topic).
-   **Sentiment**: Color-code words based on sentiment analysis (Local execution).

### 4.3 Gamification
-   **Drag & Drop**: Let users rearrange the solar system.
-   **Shields**: Visual representations of TLS/Security headers.

---

## 5. Handoff Checklist for New Team

- [ ] **Review `Entities.js`**: Understand the `Planet` -> `Moon` -> `Artifact` hierarchy.
- [ ] **Run the Harness**: Verify your machine matches our baseline performance.
- [ ] **Check `background.js`**: Understand the "Ring of Fire" buffer.
- [ ] **Implement Black Hole**: This is your first task. Make it visceral. Make it satisfying.

**The code is yours. Keep it real. Keep it fast. Don't look back.**
