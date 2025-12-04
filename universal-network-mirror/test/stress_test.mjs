import { PhysicsEngine } from '../src/viewer/engine/PhysicsEngine.js';
import { HistoryManager } from '../src/viewer/history/HistoryManager.js';
import { LinguisticAggregator } from '../src/viewer/aggregator.js';
import { Planet } from '../src/viewer/engine/Entities.js';

// --- MOCK ENV ---
global.window = { innerWidth: 1000, innerHeight: 1000 };
global.chrome = { storage: { local: { get: () => {}, set: () => {} } } };

function getMemoryMB() {
    if (global.gc) global.gc();
    return Math.round(process.memoryUsage().heapUsed / 1024 / 1024);
}

// --- CONFIG ---
const ITERATIONS = 100000;
const UNIQUE_DOMAINS = 20000; // Simulate visiting 20k unique sites
const BATCH_SIZE = 1000;

console.log("=== STRESS TEST: MEMORY LEAK ANALYSIS ===");
console.log(`Target: ${ITERATIONS} ticks, ${UNIQUE_DOMAINS} unique domains`);

// --- SETUP ---
const physics = new PhysicsEngine(1000, 1000);
const history = new HistoryManager();
const aggregator = new LinguisticAggregator();
const domainMap = new Map();

let startMem = getMemoryMB();
console.log(`Start Memory: ${startMem} MB`);

// --- RUN ---
for (let i = 0; i < ITERATIONS; i++) {
    // Simulate Time
    const now = Date.now() + i * 16;
    
    // Simulate Input (New Particle)
    // Every 10 ticks, new particle
    if (i % 10 === 0) {
        // Rotate through unique domains
        const domainId = (i / 10) % UNIQUE_DOMAINS;
        
        // Add to Physics Buffer
        physics.addParticle({
            time: now,
            rootDomainId: domainId,
            size: 500,
            flags: 1, // IS_REQUEST
            // Simulate unique tokens per request to stress Aggregator
            tokens: { [`word_${i}_a`]: 1, [`word_${i}_b`]: 1, "common": 1 }
        });
        
        // Populate DomainMap (Simulate loading)
        if (!domainMap.has(domainId)) {
            domainMap.set(domainId, `example-${domainId}.com`);
        }
    }

    // Process Physics
    physics.processBuffer(now, false);
    
    // Update Physics (Planets creation etc)
    const ctx = {
        isPaused: false,
        domainMap: domainMap,
        aggregator: aggregator,
        sunX: 500,
        sunY: 500
    };
    physics.update(ctx);

    // Collect Stats (History)
    const tick = {
        ts: now,
        particleCount: physics.particles.length,
        metrics: {
            node_fingerprint: {
                fingerPrints: [] // Mock
            }
        }
    };
    
    // Push to History (Throttled 1Hz)
    if (i % 60 === 0) {
        history.push(tick);
    }

    // Prune Aggregator (Every 300 ticks ~ 5s)
    if (i % 300 === 0) {
        aggregator.prune(physics.planets.keys());
    }

    // Log
    if (i % BATCH_SIZE === 0) {
        const mem = getMemoryMB();
        const planets = physics.planets.size;
        const particles = physics.particles.length;
        const buffer = physics.buffer.length;
        const tape = history.tape.length;
        console.log(`Tick ${i}: ${mem} MB | Planets: ${planets} | Particles: ${particles} | Buffer: ${buffer} | Tape: ${tape}`);
    }
}

const endMem = getMemoryMB();
console.log(`End Memory: ${endMem} MB`);
console.log(`Growth: ${endMem - startMem} MB`);

// Check if growth is acceptable
// 20k domains map size ~2MB.
// Planets should decay.
// Buffer should be capped.
// Tape should be capped.
// If growth > 100MB, we have a problem.
