import { HistoryManager } from '../src/viewer/history/HistoryManager.js';
import { PhysicsEngine } from '../src/viewer/engine/PhysicsEngine.js';
import { Planet } from '../src/viewer/engine/Entities.js';

// --- MOCK ENVIRONMENT ---
const window = { innerWidth: 1000, innerHeight: 1000 };
global.window = window;
global.chrome = { storage: { local: { get: () => {}, set: () => {} } } };

// --- UTILS ---
function getMemoryMB() {
    const used = process.memoryUsage().heapUsed / 1024 / 1024;
    return Math.round(used * 100) / 100;
}

// --- PROFILE: HISTORY TAPE ---
function profileHistory() {
    console.log("--- PROFILING: HISTORY TAPE ---");
    const history = new HistoryManager();
    const startMem = getMemoryMB();
    
    console.log(`Start Memory: ${startMem} MB`);
    
    // Simulate 10,000 ticks (Full Tape)
    // Each tick has 50 planets with metrics
    for (let i = 0; i < 10000; i++) {
        const tick = {
            ts: Date.now() + i * 16,
            particleCount: 500,
            metrics: {
                node_fingerprint: {
                    fingerPrints: []
                }
            }
        };
        
        // Add 50 planets per tick
        for (let p = 0; p < 50; p++) {
            tick.metrics.node_fingerprint.fingerPrints.push({
                domainId: p,
                name: `example-${p}.com`,
                metrics: { io_pkt: 0.5, lingo: 0.2 }, // Small object
                vector: new Array(50).fill(0.5) // 50 floats
            });
        }
        
        history.push(tick);
        
        if (i % 2000 === 0) {
            console.log(`  ${i} ticks: ${getMemoryMB()} MB`);
        }
    }
    
    const endMem = getMemoryMB();
    console.log(`End Memory (10k ticks): ${endMem} MB`);
    console.log(`Delta: ${endMem - startMem} MB`);
    
    // Estimate size per tick
    const sizePerTick = ((endMem - startMem) * 1024 * 1024) / 10000;
    console.log(`Est. Size per Tick: ${Math.round(sizePerTick)} bytes`);
}

// --- PROFILE: PLANET TOKENS ---
function profileTokens() {
    console.log("\n--- PROFILING: PLANET TOKENS ---");
    const physics = new PhysicsEngine(1000, 1000);
    const startMem = getMemoryMB();
    
    // Create 1 heavy planet
    const planet = new Planet(1, "wikipedia.org", 500, 500);
    physics.planets.set(1, planet);
    
    console.log(`Start Memory: ${startMem} MB`);
    
    // Add 10,000 unique tokens
    for (let i = 0; i < 10000; i++) {
        planet.tokens.set(`word_${i}`, 1);
    }
    
    const endMem = getMemoryMB();
    console.log(`End Memory (10k tokens): ${endMem} MB`);
    console.log(`Delta: ${endMem - startMem} MB`);
}

// --- RUN ---
console.log("=== MEMORY PROFILER ===");
profileHistory();
if (global.gc) { global.gc(); console.log("GC Run."); }
profileTokens();
