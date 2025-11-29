# Universal Network Mirror - V2 Roadmap: "The Living Digital World"

**Vision:** A world-class, gamified cybersecurity and linguistic visualization tool that turns dry network traffic and page content into an intuitive, explorable, and manipulatable universe.

## 1. Architectural Evolution (Modularization)
*Objective: Transform the monolithic `viewer.js` into a maintainable, scalable system.*

- [ ] **Core Systems Split**:
    - `PhysicsEngine.js`: Pure math and entity updates (Planets, Moons, Particles).
    - `RenderEngine.js`: Canvas drawing, camera control, visual effects.
    - `InputSystem.js`: Handling clicks, drags, and camera movement.
    - `UIManager.js`: DOM overlays, Inspector panels, HUDs.
- [ ] **State Management**: Centralized store for the "World State" to allow easy save/load/replay.
- [ ] **Performance**: Investigate `OffscreenCanvas` for rendering on a separate thread to ensure 60fps smoothness even with heavy logic.

## 2. Linguistic Engine V2: "Context Aware Intelligence"
*Objective: Move beyond simple TF-IDF to detect meaning, intent, and origin.*

- [ ] **Hybrid Scoring Model**:
    - **News/Showroom Mode**: Use `CountVectorizer` style logic for pages with many titles/topics (high variety, short length).
    - **Deep Content Mode**: Use TF-IDF for long-form articles to find the "signal" amidst the noise.
    - *Auto-Detection*: Heuristic to switch modes based on DOM structure (e.g., density of `<a>` tags vs `<p>` tags).
- [ ] **Developer Signature Detection**:
    - Detect "Human Signals" in code/text: weird variable names (`mmmmmlli`), debug flags, test signals.
    - Pattern match for UUIDs, API keys, Base64 strings.
    - Visualize these as distinct "Artifacts" or "Space Junk" orbiting the planet.
- [ ] **Cyber-Semantics**:
    - Analyze HTTP Methods: `POST` (uploading/sending) vs `GET` (consuming).
    - Visualize this flow: `POST` particles could be heavier/hotter colors (Red/Orange) moving *away* from the viewer or *into* the planet?

## 3. Gamification & Interaction
*Objective: Make the network "feel" real and manipulatable.*

- [ ] **Tactile Feedback**:
    - Draggable Planets: Re-arrange the solar system.
    - "Gravity Wells": Click and hold to attract particles.
- [ ] **Security Context**:
    - "Shields": Visualize HTTPS/TLS status as planetary shields.
    - "Breaches": Failed requests or insecure content puncturing the shield.
- [ ] **Agentic Workflows**:
    - Visualize "Agents" (background scripts/workers) as autonomous drones moving between planets.

## 4. Low-Fi & On-Device
*Objective: High performance history and analysis without the cloud.*

- [ ] **Compressed History**: Efficient storage of hours of traffic data.
- [ ] **Local Pattern Matching**: Run lightweight regex/heuristics on the client side.

---

**Next Immediate Steps:**
1.  **Modularize `viewer.js`**: Break the monolith to prepare for complex features.
2.  **Enhance Harvester**: Add "Developer Signal" detection to the Content Script.
