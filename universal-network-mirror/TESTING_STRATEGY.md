# Testing Strategy: The Projection & Metrics Layer

> "Where do I put the soft tissue so I can keep adding new brain cells, senses, and tricks… without surgery every time?"

The Universal Network Mirror uses a **Projection & Metrics Layer** to ensure that the visualization remains "human-aligned" as it scales. Instead of testing raw packet logs or pixel buffers, we assert against high-level "human-friendly" summaries of the world state.

---

## 1. The Architecture

We separate the system into three layers:

1.  **Source Layer (The Firehose)**: Low-level data extraction (`content-script.js`, `background.js`). Fast, messy, timing-critical.
2.  **Core Model Layer (The Physics)**: The domain objects (`Entities.js`). Calculates mass, gravity, linguistic scores.
3.  **Projection Layer (The Story)**: Bundles the state into structured snapshots for validation.

### Data Flow
`EngineState` -> `Metrics Plugins` -> `ProjectionCollector` -> `DEV_PROJECTION_TICK` Event

---

## 2. The Metrics (`src/viewer/metrics/`)

Metrics are **pure functions** that take the current `EngineState` and output a JSON summary.

*   **`planet_bloat`**: Measures the "health" of a domain (mass vs packet count).
*   **`topic_prominence`**: Captures the top linguistic topics to validate semantic stability.
*   **`visual_density`**: estimates screen crowding to prevent information overload.

**To add a new metric:**
1.  Create a file in `src/viewer/metrics/my_new_metric.js`.
2.  Register it in `src/viewer/projections/ProjectionCollector.js`.
3.  It automatically appears in the projection tick.

---

## 3. How to Test (Using Cline)

Cline (or any test runner) listens for `DEV_PROJECTION_TICK` messages via the browser console or `window.postMessage`.

**Example Prompt for Cline:**
> "Navigate to reddit.com and verify that the 'planet_bloat' grade stabilizes at 'C' or better within 5 seconds, and that 'visual_density' remains below 0.4."

**Cline's Verification Logic:**
1.  Listen to the stream of ticks.
2.  Filter for `tick.metrics.planet_bloat`.
3.  Assert values over time (e.g., ensure `radius` doesn't jitter wildly).

---

## 4. Key Files

*   `src/viewer/projections/ProjectionCollector.js`: The engine that runs the metrics loop (default 10Hz).
*   `src/viewer/viewer.js`: Orchestrates the loop and feeds `EngineState` to the collector.
