# The Universal Network Mirror: Ultimate Research Handoff (2025-2026 Vision)

**"Turning the invisible pulse of the internet into a living, breathing digital universe."**

---

## 1. Project Overview & Philosophy
The Universal Network Mirror is a **gamified cybersecurity and linguistic visualization tool**. It rejects the dry, tabular presentation of network traffic (like Wireshark or DevTools) in favor of a **Solar System Metaphor**.

*   **Planets** represent Root Domains (e.g., `google.com`).
*   **Moons** represent Subdomains (e.g., `mail.google.com`, `analytics.google.com`).
*   **Particles** represent Network Packets (Requests/Responses) flowing between the Sun (the User/Browser) and the Planets.
*   **Atmosphere** represents the Linguistic Content (words, topics) extracted from the pages.

**Key Design Pillars:**
1.  **Visceral & Intuitive**: Understanding traffic volume through "mass" and "gravity", not just numbers.
2.  **Gamified & Fun**: Exploration should feel like playing a game.
3.  **Low-Fi & Lightweight**: Must run efficiently on consumer hardware, storing years of history without bloating storage.
4.  **Local & Private**: All analysis happens on-device. No data leaves the user's machine.

---

## 2. Current Architecture (The "As-Is")

### A. The Harvester (`src/content/content-script.js`)
*   **Role**: The "Devourer". Injected into every page.
*   **Function**: recursively scans the DOM (piercing Shadow DOMs) to extract text and headlines.
*   **New Capability**: "Developer Signal Detection". Scans for `TODO` comments, UUIDs, and suspicious variable names (e.g., `mmmmmmlli`) to fingerprint the *human* behind the code.

### B. The Bus (`src/background/background.js`)
*   **Role**: The Central Nervous System.
*   **Function**:
    *   Intercepts all `webRequest` events (headers, bodies, sizes).
    *   Receives extracted text from the Harvester.
    *   Normalizes data into "Particles".
    *   Maintains a "Ring Buffer" of recent events.
    *   Broadcasts `NEW_PARTICLE` events to the Viewer.

### C. The Aggregator (`src/viewer/aggregator.js`)
*   **Role**: The Mathematician.
*   **Function**:
    *   Calculates TF-IDF scores for words.
    *   Implements "Hysteresis" to smooth out visual jitter (words fade in/out slowly).
    *   Identifies "Boss Words" (constituents of common n-grams) to boost meaningful topics.

### D. The Viewer (`src/viewer/viewer.js` & `src/viewer/engine/Entities.js`)
*   **Role**: The Window.
*   **Function**:
    *   **Physics Engine**: Simulates gravity, orbit, and collision.
    *   **Renderer**: Draws the Solar System on an HTML5 Canvas.
    *   **UI**: Provides the Inspector and Heads-Up Display (HUD).
    *   **Modes**:
        *   **Traffic Mode**: Visualizes subdomains as orbiting moons.
        *   **Linguistic Mode**: Visualizes topics as a floating "Semantic Atmosphere".

---

## 3. The Future: Vision 2026 Requirements

We are moving from "Observation" to "Deep Understanding & Interaction". The goal is to allow users to **fingerprint** the internet and **manipulate** their experience.

### A. Anomaly Detection & Historical Fingerprinting
**Goal**: The system must "learn" what a normal visit to `reddit.com` looks like for *you*, and flag when it changes.

*   **Fingerprint Metrics**:
    *   **Traffic Ratios**: Ratio of `GET` vs `POST`. Ratio of `Image` vs `JSON` vs `HTML`.
    *   **Subdomain Topology**: Does this site usually spawn 5 analytic moons? Why are there 50 today?
    *   **Linguistic Signature**: "Vocabulary Complexity" score.
*   **Low-Fi Implementation**: Store normalized histograms (not raw logs) to save space. Compare current session against the historical baseline (e.g., utilizing Cosine Similarity).

### B. "Human Signal" Signatures
**Goal**: Identify the "flavor" of the developers who built the site.

*   **Detect**:
    *   **Frameworks**: React vs Vue vs Vanilla (detected via specific DOM patterns or variable names).
    *   **Coding Style**: Verbose variable names vs minified obfuscation.
    *   **Debug Artifacts**: Leftover `console.log` or test flags.
*   **Visualize**: Display these as "Space Junk" or "Artifacts" orbiting the planet.

### C. Interactive Manipulation (Agentic Features)
**Goal**: Move beyond passive viewing.

*   **Traffic Shaping**: Ability to "mask" words in outgoing packets (e.g., PII redaction).
*   **Obfuscation**: Injecting "Noise Particles" to confuse external trackers? (Research needed on viability/safety).
*   **Tactile Control**: "Throw" planets to re-arrange the dashboard.

### D. Ubiquitous Storage (The Archive)
**Goal**: Years of history, accessible instantly, zero cloud cost.

*   **Challenge**: Raw packet logs are huge.
*   **Solution**: "Lossy Compression" via Statistical Summaries.
    *   Don't store every packet. Store the *hourly average* size, count, and top 5 keywords per domain.
    *   Use **Vector Embeddings** to compress complex site states into small numerical arrays for 3D visualization and comparison.

---

## 4. Research Directives (The "To-Do" for Researchers)

### Directive 1: Low-Fi Fingerprinting Algorithms (Implemented v2.0)
*   **Implementation**: `src/viewer/metrics/node_fingerprint.js`
*   **Features (8 Dimensions)**:
    1.  **IO_PKT**: Ratio of Internal vs Total Packets (Requests vs Responses).
    2.  **IO_VOL**: Ratio of Internal vs Total Volume (Upload vs Download).
    3.  **UPLOAD**: Upload Intensity (Avg Request Size).
    4.  **DOWNLD**: Download Intensity (Avg Response Size).
    5.  **DENSITY**: Traffic volume relative to peer max.
    6.  **HEAVY**: Global avg packet size relative to peer max.
    7.  **SPRAWL**: Subdomain topology (Moons per log(traffic)).
    8.  **LINGO**: Linguistic Complexity (Unique/Total tokens).
*   **Anomaly Detection**: Nodes with a high Euclidean distance from the network average are rendered in **RED** to signal "Weirdness".
*   **Next Steps**: 
    *   Store these signatures over time to detect anomalies (e.g., "Why did Google's complexity drop 50%?").
    *   Vectorize these 4 dimensions into a format suitable for clustering (e.g., UMAP/t-SNE) to create a "Galaxy Map" of similar sites.

### Directive 2: Vectorization & Dimensionality Reduction
*   **Task**: Explore using `CounterVectorizer` or lightweight on-device ML (e.g., TensorFlow.js) to classify sites.
*   **Goal**: Create a "Galaxy Map" where similar sites (e.g., all News sites, all Shopping sites) naturally cluster together based on their traffic/linguistic signature.

### Directive 3: Creative Visualization Mechanics
*   **Task**: Invent new "Moons".
    *   *Current*: Subdomain Moon, Word Particle.
    *   *Idea*: **Security Moon** (Shield strength based on HTTPS/Headers).
    *   *Idea*: **Cookie Asteroids** (Visualizing tracking data).
    *   *Idea*: **Agent Drones** (Visualizing background workers/Service Workers).

### Directive 4: Safe Local Storage Architecture
*   **Task**: Benchmark `IndexedDB` vs `OPFS` (Origin Private File System) for storing 5+ years of statistical data.
*   **Requirement**: Must be queryable in milliseconds for the "Time Travel" timeline feature.

---

## 5. Technical Inventory (Handover Artifacts)

| File | Purpose | Key Functions |
| :--- | :--- | :--- |
| `src/content/content-script.js` | DOM Harvesting | `deepHarvest`, `processQueue` |
| `src/background/background.js` | Networking | `ingestPacket`, `getVectorId` |
| `src/viewer/viewer.js` | Main Loop & UI | `loop`, `updateHUD`, `resize` |
| `src/viewer/engine/Entities.js` | Physics & Logic | `Planet.update`, `Moon.absorb`, `Particle.draw` |
| `src/viewer/aggregator.js` | Math & Stats | `_scoreTokens`, `decayGlobalTokens` |
| `docs/V2_ROADMAP.md` | Strategic Plan | Feature checklist for V2 |

**This document represents the bridge from our current MVP to a world-class, enthusiast-grade Cyber-Linguistic Explorer.**
