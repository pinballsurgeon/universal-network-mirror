import { nodeFingerprintMetric } from '../src/viewer/metrics/node_fingerprint.js';
import { HistoryManager } from '../src/viewer/history/HistoryManager.js';
import { VectorMath } from '../src/learning/VectorMath.js';

// --- MOCKS ---
const mockStorage = new Map();
global.chrome = {
    storage: {
        local: {
            get: (keys, cb) => {
                const res = {};
                keys.forEach(k => res[k] = mockStorage.get(k));
                cb(res);
            },
            set: (obj) => {
                Object.entries(obj).forEach(([k, v]) => mockStorage.set(k, v));
            }
        }
    }
};

// --- TEST SUITE ---
async function runVerification() {
    console.log("=== V6 ROADMAP VERIFICATION: Sentient Features ===");
    let failures = 0;

    // --- TEST 1: REAL SHANNON ENTROPY (Via Lingo Proxy) ---
    console.log("\n[Test 1] Real Entropy Calculation");
    
    // P1: Repetitive (Low Entropy)
    // 1 unique token appears 100 times.
    // Lingo = 1/100 = 0.01
    // Exp Entropy = sqrt(0.01) = 0.1
    
    // P2: Random (High Entropy)
    // 100 unique tokens appear 100 times.
    // Lingo = 100/100 = 1.0
    // Exp Entropy = sqrt(1.0) = 1.0
    
    const ctx = {
        planets: new Map()
    };
    
    // Planet 1: Low Entropy (Repetitive)
    ctx.planets.set(1, {
        name: 'low_entropy.com',
        packetCount: 1,
        internalTraffic: 0,
        externalTraffic: 0,
        tokens: { size: 1 },
        tokenTotal: 100, // Lingo = 0.01
        moons: new Set()
    });

    // Planet 2: High Entropy (Random)
    ctx.planets.set(2, {
        name: 'high_entropy.com',
        packetCount: 1,
        internalTraffic: 0,
        externalTraffic: 0,
        tokens: { size: 100 },
        tokenTotal: 100, // Lingo = 1.0
        moons: new Set()
    });

    // Run Metric
    const result = nodeFingerprintMetric.compute(ctx);
    const p1 = result.payload.fingerPrints.find(f => f.name === 'low_entropy.com');
    const p2 = result.payload.fingerPrints.find(f => f.name === 'high_entropy.com');

    console.log(`  P1 (Repetitive) Entropy: ${p1.metrics.text_entropy.toFixed(4)}`);
    console.log(`  P2 (Random) Entropy:     ${p2.metrics.text_entropy.toFixed(4)}`);

    if (p1.metrics.text_entropy > 0.3) {
        console.log("  [FAIL] Low Entropy planet score too high.");
        failures++;
    }
    if (p2.metrics.text_entropy < 0.7) {
        console.log("  [FAIL] High Entropy planet score too low.");
        failures++;
    }
    
    if (Math.abs(p1.metrics.text_entropy - p2.metrics.text_entropy) > 0.5) {
         console.log("  [PASS] Entropy calculation correctly differentiates content types.");
    } else {
         console.log("  [FAIL] Differentiation too weak.");
         failures++;
    }


    // --- TEST 2: TRUE PERSISTENCE (REWIND) ---
    console.log("\n[Test 2] True Persistence (Rewind Capability)");
    
    // 1. Session A: Record Data
    const historyA = new HistoryManager();
    historyA.isRecording = true;
    historyA.push({ ts: 1000, particleCount: 50 }); // Add a tick
    historyA.push({ ts: 2000, particleCount: 100 });
    
    // Force Save
    historyA.saveHistory(); 
    
    // 2. Session B: Reload
    const historyB = new HistoryManager();
    // Simulate reload delay (mock async read)
    await new Promise(r => setTimeout(r, 50));
    
    console.log(`  Session A Tape Length: ${historyA.tape.length}`);
    console.log(`  Session B Tape Length: ${historyB.tape.length}`);

    if (historyB.tape.length === 2 && historyB.tape[1].particleCount === 100) {
        console.log("  [PASS] History Tape persisted and restored.");
    } else {
        console.log("  [FAIL] History Tape lost or corrupt.");
        console.log(`         Expected length 2, got ${historyB.tape.length}`);
        failures++;
    }

    // --- SUMMARY ---
    console.log(`\n=== VERIFICATION COMPLETE: ${failures} Failures ===`);
    if (failures > 0) {
        console.log("V6 Validation FAILED.");
        process.exit(1);
    } else {
        console.log("V6 Validation SUCCESS. Features Unlocked.");
    }
}

runVerification();
