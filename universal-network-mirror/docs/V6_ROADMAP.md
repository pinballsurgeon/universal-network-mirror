# Universal Network Mirror - V6 Roadmap: "True Sentience"

**Status**: Planning / Ready for Implementation
**Pre-Requisite**: V5 "Sentient" Release (Completed)

## 1. Executive Summary
The V5 release established the "Body" (Physics) and the "Eyes" (Ingestion). V6 focuses on the "Mind" (Real Intelligence) and "Memory" (Persistence).

We have confirmed via `test/v6_roadmap_verification.mjs` that the current "Sentient" metrics are based on mock logic and that history is volatile. V6 aims to close these gaps.

## 2. Feature Specification

### 2.1 Feature: Real Cyber-Semantics (Entropy Engine)
*   **Problem**: Currently, `text_entropy` and `llm_likelihood` are inferred from simple token ratios (`lingo`). This fails to distinguish between repetitive text ("aaaaa") and random high-entropy text (UUIDs, encryption keys).
*   **Solution**: Implement Shannon Entropy calculation in `src/viewer/metrics/node_fingerprint.js`.
*   **Implementation Details**:
    ```javascript
    function calculateEntropy(text) {
        const len = text.length;
        const freqs = {};
        for (let i = 0; i < len; i++) {
            const char = text[i];
            freqs[char] = (freqs[char] || 0) + 1;
        }
        let entropy = 0;
        for (const char in freqs) {
            const p = freqs[char] / len;
            entropy -= p * Math.log2(p);
        }
        return entropy;
    }
    ```
*   **Target**: High entropy (> 4.5) indicates "Machine Data" (UUIDs, Hash). Low entropy (< 3.0) indicates "Human Language" or "Boilerplate".

### 2.2 Feature: The Chronosphere (IndexedDB Persistence)
*   **Problem**: `HistoryManager` stores the simulation tape in RAM. Reloading the extension wipes the "Rewind" timeline.
*   **Solution**: Offload the `tape` to IndexedDB using a circular buffer strategy.
*   **Implementation Details**:
    - Use `idb` or raw `indexedDB` API.
    - Store chunks of 1000 ticks as Blobs.
    - On boot, hydrate `HistoryManager.tape` from the latest chunks.

## 3. Verification & Acceptance Criteria
We have established a rigorous test suite to validate these features.

**Test File**: `universal-network-mirror/test/v6_roadmap_verification.mjs`

### Acceptance Steps:
1.  **Run Verification (Baseline)**:
    - Command: `node universal-network-mirror/test/v6_roadmap_verification.mjs`
    - Expected Result: **FAIL** (Confirming current mock state).
2.  **Implement Features**:
    - Update `node_fingerprint.js` with Shannon Entropy.
    - Update `HistoryManager.js` with IndexedDB.
3.  **Run Verification (Final)**:
    - Command: `node universal-network-mirror/test/v6_roadmap_verification.mjs`
    - Expected Result: **PASS** (Entropy differentiates text; History survives reload).

## 4. Timeline
- [ ] Phase 1: Entropy Engine (2 Days)
- [ ] Phase 2: IndexedDB Layer (3 Days)
- [ ] Phase 3: Integration Testing (1 Day)
