# The Universal Network Mirror: Ultimate Research Handoff (Vision 2026)

**"Turning the invisible pulse of the internet into a living, breathing digital universe."**

---

## 1. Project Philosophy & Core Metaphor
The Universal Network Mirror is a **gamified cybersecurity and linguistic visualization tool**. It rejects the dry, tabular presentation of network traffic (like Wireshark or DevTools) in favor of a **Solar System Metaphor**.

*   **Planets** represent Root Domains (e.g., `google.com`).
*   **Moons** represent Subdomains (e.g., `mail.google.com`).
*   **Particles** represent Network Packets flowing between the Sun (User) and Planets.
*   **Atmosphere** represents the Linguistic Content extracted from pages.

**Key Design Pillars:**
1.  **Visceral & Intuitive**: Understanding traffic volume through "mass" and "gravity".
2.  **Gamified & Fun**: Exploration should feel like playing a game.
3.  **Local & Private**: All analysis happens on-device. No data leaves the machine.
4.  **Agentic Control**: Moving from observation to **active manipulation**.

---

## 2. Current Architecture (The "As-Is")

### A. The Harvester (`src/content/content-script.js`)
*   **Role**: The "Devourer". Injected into every page.
*   **Function**: Recursively scans DOM (piercing Shadow DOMs) to extract text/headlines.
*   **Capabilities**: Detects "Developer Signals" (`TODO` comments, UUIDs, `mmmmmmlli`) to fingerprint the human behind the code.

### B. The Physics Engine (`src/viewer/engine/Entities.js`)
*   **Role**: The Simulation.
*   **Function**: Simulates gravity, orbits, and particle collisions.
*   **Visualization**: Renders the **8-Bar Equalizer** around planets, visualizing the site's fingerprint in real-time.

### C. The Fingerprint Engine (`src/viewer/metrics/node_fingerprint.js`)
*   **Role**: The Analyst.
*   **Function**: Computes an 8-dimensional signature for every domain (IO Ratio, Traffic Density, Payload Heaviness, etc.), normalized against the entire network session.
*   **Anomaly Detection**: Calculates "Weirdness" (Euclidean distance from average). High weirdness turns planets **RED**.

### D. The History Manager (`src/viewer/history/HistoryManager.js`)
*   **Role**: The Archivist.
*   **Function**: Records "Projection Ticks" to a tape for playback. Persists domain fingerprints to `chrome.storage.local` to enable "Current vs Historical" comparisons.

---

## 3. The Next Generation: Vision 2026

We are evolving from a "Passive Mirror" to an "Active Agentic Browser".

### Pillar A: AI & Gemini Integration
**Goal**: Use LLMs to understand the *meaning* of the traffic.
*   **Packet Summarization**: "Gemini, why is this site sending 5MB of JSON?" -> "It's pre-loading chat history."
*   **Research Assistant**: Auto-summarize the linguistic atmosphere of visited planets.
*   **Integration Point**: A new `AnalysisAgent` module that consumes `ProjectionTick` data and queries the LLM.

### Pillar B: Active Cyber-Defense (Manipulation)
**Goal**: Give the user god-mode control over their traffic.
*   **Black Hole Redirects**: Drag a planet into a "Black Hole" UI element to block all traffic to that domain instantly.
*   **Content Mutation**: "Replace all instances of 'Sale' with 'Scam'".
*   **Protocol Damping**: "Slow down all tracking pixels by 90%".
*   **Implementation**: Requires `chrome.declarativeNetRequest` integration in `background.js`.

### Pillar C: Startup Maps (The "First 30 Seconds")
**Goal**: Fingerprint the *loading phase* distinct from the *steady state*.
*   **Concept**: Record a high-resolution "Trace" of the first 30s of visiting a domain.
*   **Metrics**: Packets/sec, Waterfall shape, Initial payload size.
*   **Overlay**: When visiting a domain again, overlay the "Average Startup Trace" on the timeline to spot delays or new trackers.

### Pillar D: The Agentic Browser
**Goal**: The extension *becomes* the user's agent.
*   **Containerization**: "Open this site in a sandbox" (Planets isolated from each other).
*   **Data Ownership**: Full exportable history of your digital life, stored locally in `OPFS` (Origin Private File System).

---

## 4. Technical Inventory & Handoff

| File | Purpose | Key Complexity |
| :--- | :--- | :--- |
| `src/viewer/viewer.js` | Main Loop & UI | Orchestrates Physics, History, and HUD. |
| `src/viewer/metrics/node_fingerprint.js` | Analysis | V4 Log-Normalizer for 8D Signatures. |
| `src/viewer/engine/Entities.js` | Visuals | Draws Equalizers and Red Anomalies. |
| `src/viewer/history/HistoryManager.js` | Storage | Manages the "Tape" and Persistent Stats. |
| `src/background/background.js` | Networking | The raw packet firehose. |

**Immediate Next Steps for the Team:**
1.  **Refine Storage**: Move `HistoryManager` from RAM/Local to `IndexedDB` for massive scale.
2.  **Gemini Prototype**: Connect `Aggregator` text data to an LLM API for summaries.
3.  **Active Defense**: Build the "Drag to Block" interaction in the Viewer.

**This is the blueprint for the ultimate, safe, and fun interactive world model of the web.**

---

## 5. Validation Protocol: The Human Perception Lab

To ensure the visualization remains "visceral" and "intuitive", we do not rely solely on unit tests. We simulate the **User Experience** by streaming real-world traffic sessions through the projection engine offline.

### A. The "Clean vs. Messy" Gauntlet
We validate our metrics (Signal vs. Noise) against two distinct classes of websites.

**Class 1: The "Clean" Baseline (High Signal)**
*   **Targets**: `wikipedia.org`, `nba.com`, `news.google.com`.
*   **Expectation**:
    *   **Structure**: Low Sprawl score. Clear, dominant linguistic topics.
    *   **Physics**: Planets should orbit calmly. Few "Junk Moons".
    *   **Visuals**: Fingerprint bars should be Green/Cyan.
*   **Goal**: Verify that legitimate content is maximized and beautiful.

**Class 2: The "Messy" Stress Test (High Noise)**
*   **Targets**: `yahoo.com`, `facebook.com`, `linkedin.com`.
*   **Expectation**:
    *   **Structure**: High Sprawl (hundreds of tracking subdomains).
    *   **Physics**: High Density scores. Potential "Red Planet" anomaly alerts.
    *   **Visuals**: Verify that the "Visual Density" metric triggers correctly to prevent UI clutter.
*   **Goal**: Ensure the system "tidies the noise" (e.g., grouping trackers into junk clusters) rather than overwhelming the user.

### B. Tuning for Human Perception
*   **The "Feel" Test**: Replay recorded sessions at 1x, 2x, and 10x speed. Does the "pulse" of the network feel organic?
*   **Metric Calibration**: Adjust Log-Normalization constants (`src/viewer/metrics/node_fingerprint.js`) until the "Messy" sites hit ~0.8-0.9 density, while "Clean" sites sit comfortably at ~0.2-0.4.
*   **Historical Accuracy**: Capture a session of `google.com` today. Replay it next month. Does the "Ghost Bar" accurately reflect the change?

This rigorous, experience-first testing methodology ensures that the tool remains a **joy to use**, not just a debugging utility.
