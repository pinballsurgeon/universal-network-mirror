import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// --- MOCKS ---
const window = {
    innerWidth: 1200,
    innerHeight: 800,
    postMessage: () => {}
};
global.window = window;

// Mock Canvas Context for Entities.draw calls (even if we don't draw, we might need to support the call if code calls it)
const mockCtx = {
    beginPath: () => {},
    moveTo: () => {},
    lineTo: () => {},
    arc: () => {},
    fill: () => {},
    stroke: () => {},
    closePath: () => {},
    fillText: () => {},
    measureText: () => ({ width: 10 }),
    font: '',
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 0,
    textAlign: '',
    textBaseline: '',
    globalAlpha: 1,
    lineCap: ''
};

// --- IMPORTS ---
// We need to resolve paths relative to this file
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SRC_ROOT = path.resolve(__dirname, '../src');

// Import Modules dynamically or rely on relative paths if standard
import { LinguisticAggregator } from '../src/viewer/aggregator.js';
import { ProjectionCollector } from '../src/viewer/projections/ProjectionCollector.js';
import { PhysicsEngine } from '../src/viewer/engine/PhysicsEngine.js';
import { FLAGS } from '../src/common/constants.js';
import { LearningEngine } from '../src/learning/LearningEngine.js';
import { VectorMath } from '../src/learning/VectorMath.js';

// --- HEADLESS EXTENSION BACKEND ---
// Mimics background.js state and logic
class HeadlessExtension {
    constructor() {
        this.domainMap = new Map();
        this.nextDomainId = 1;
        this.buffer = []; // "Ring of Fire"
    }

    getDomainId(hostname) {
        if (this.domainMap.has(hostname)) return this.domainMap.get(hostname);
        const id = this.nextDomainId++;
        this.domainMap.set(hostname, id);
        return id;
    }

    parseDomainInfo(url) {
        try {
            const hostname = new URL(url).hostname;
            const parts = hostname.split('.');
            // Simple root domain logic
            const rootDomain = parts.slice(-2).join('.'); 
            return { hostname, rootDomain, isSubdomain: hostname !== rootDomain };
        } catch (e) {
            return { hostname: 'unknown', rootDomain: 'unknown', isSubdomain: false };
        }
    }

    ingestPacket(url, method, type, size, time, content = '', meta = {}, initiator = null, isRequest = false) {
        let { hostname, rootDomain, isSubdomain } = this.parseDomainInfo(url);
        
        // Simplified initiator logic
        let finalRootDomain = rootDomain;
        let finalIsSubdomain = isSubdomain;

        const domainId = this.getDomainId(hostname);
        const rootDomainId = this.getDomainId(finalRootDomain);
        
        let flags = 0;
        if (isRequest) flags |= FLAGS.IS_REQUEST;
        else flags |= FLAGS.IS_RESPONSE;
        if (content) flags |= FLAGS.HAS_CONTENT;

        const particle = {
            time: time,
            domainId: domainId,
            rootDomainId: rootDomainId,
            vectorId: 0, // Simplified
            size: size,
            flags: flags,
            url: url,
            bloatScore: meta.bloatScore || 0,
            tokens: meta.tokens,
            devSignals: meta.devSignals, // Pass dev signals
            isClean: meta.isClean !== undefined ? meta.isClean : true,
            isSubdomain: finalIsSubdomain
        };

        // Broadcast to "Viewer" (push to local buffer for the Engine)
        return particle;
    }
}

// --- HEADLESS VIEWER ENGINE ---
class HeadlessViewer {
    constructor(extension) {
        this.extension = extension;
        this.planets = new Map();
        this.particles = [];
        this.aggregator = new LinguisticAggregator();
        this.projectionCollector = new ProjectionCollector();
        this.width = window.innerWidth;
        this.height = window.innerHeight;
        this.sunX = this.width / 2;
        this.sunY = this.height / 2;
        this.playbackTime = Date.now();
        
        // Reverse map for Entity creation
        this.reverseDomainMap = new Map(); // id -> name
        
        // Use the new Physics Engine
        this.physics = new PhysicsEngine(this.width, this.height, { samplingRate: 1.0 });
    }

    updateDomainMap() {
        // Sync map
        for (const [name, id] of this.extension.domainMap.entries()) {
            this.reverseDomainMap.set(id, name);
        }
    }

    addParticle(particleData) {
        this.updateDomainMap();
        this.physics.addParticle(particleData);
    }

    tick() {
        this.playbackTime += 16; // 60fps sim
        
        // 1. Ingest
        this.physics.processBuffer(this.playbackTime, false);

        // 2. Physics Update
        const context = {
            isPaused: false,
            domainMap: this.reverseDomainMap, // Viewer expects Map<id, name>
            aggregator: this.aggregator
        };
        this.physics.update(context);

        // 3. Get State
        const state = this.physics.getState();

        // 4. Collect Metrics
        const engineState = {
            time: this.playbackTime,
            planets: state.planets,
            particles: state.particles,
            viewMode: 'TRAFFIC',
            selectedObject: null,
            width: this.width,
            height: this.height,
            aggregator: this.aggregator
        };
        
        // Force broadcast for test
        this.projectionCollector.collectAndBroadcast(engineState, true);
        
        return this.projectionCollector.lastTick;
    }
}

// --- TRAFFIC SIMULATOR (REAL DATA FETCHER) ---
async function runGauntlet(label, urls) {
    console.log(`\n=== RUNNING GAUNTLET: ${label} ===`);
    const extension = new HeadlessExtension();
    const viewer = new HeadlessViewer(extension);
    
    // 1. Fetch & Feed
    console.log(`Fetching ${urls.length} sites...`);
    
    for (const url of urls) {
        try {
            console.log(`  GET ${url}`);
            const startTime = Date.now();
            const res = await fetch(url);
            const text = await res.text();
            const duration = Date.now() - startTime;
            const size = text.length;
            
            // Feed Main Request
            const p1 = extension.ingestPacket(url, 'GET', 'document', 500, startTime, '', {}, null, true);
            viewer.addParticle(p1);
            
            // FEED CONTENT STREAM (Chunked Mode Verification)
            const CHUNK_SIZE = 10000;
            if (text.length > CHUNK_SIZE) {
                console.log(`    Streaming ${Math.ceil(text.length/CHUNK_SIZE)} chunks...`);
                for (let i = 0; i < text.length; i += CHUNK_SIZE) {
                    const chunk = text.substring(i, i + CHUNK_SIZE);
                    const pChunk = extension.ingestPacket(
                        url, 'GET', 'document', 
                        chunk.length, 
                        startTime + duration + (i/100), // Staggered arrival
                        chunk, 
                        { isIncremental: true, chunkIndex: i/CHUNK_SIZE }, 
                        null, false
                    );
                    viewer.addParticle(pChunk);
                }
            } else {
                const p2 = extension.ingestPacket(url, 'GET', 'document', size, startTime + duration, text, {}, null, false);
                viewer.addParticle(p2);
            }

            // Simple Parse for Resources (img, script, link)
            // This approximates the "cascade" of traffic
            const resourceRegex = /<[a-z]+[^>]+(src|href)=["']([^"']+)["'][^>]*>/g;
            let match;
            let count = 0;
            while ((match = resourceRegex.exec(text)) !== null) {
                if (count++ > 50) break; // Limit per page
                let resUrl = match[2];
                if (resUrl.startsWith('//')) resUrl = 'https:' + resUrl;
                if (resUrl.startsWith('/')) resUrl = new URL(url).origin + resUrl;
                
                if (!resUrl.startsWith('http')) continue;

                // Simulate fetch of resource (mock latency/size)
                const resStart = startTime + Math.random() * 2000;
                const resSize = Math.floor(Math.random() * 50000);
                
                const rp1 = extension.ingestPacket(resUrl, 'GET', 'resource', 300, resStart, '', {}, url, true);
                viewer.addParticle(rp1);
                
                // Response 50% of time (some fail/block)
                if (Math.random() > 0.1) {
                    const rp2 = extension.ingestPacket(resUrl, 'GET', 'resource', resSize, resStart + 100 + Math.random()*500, '', {}, url, false);
                    viewer.addParticle(rp2);
                }
            }
        } catch (e) {
            console.log(`  Failed ${url}: ${e.message}`);
        }
    }

    // 2. Run Physics Engine to Settle
    console.log("Simulating physics (5 seconds)...");
    let lastStats = null;
    for (let i = 0; i < 300; i++) { // 300 frames @ 60fps = 5s
        lastStats = viewer.tick();
    }

    // 3. Report
    if (lastStats) {
        console.log(`\nRESULTS [${label}]:`);
        console.log(`  Particles Active: ${lastStats.particleCount}`);
        
        const density = lastStats.metrics.visual_density;
        console.log(`  Visual Density:   ${density.densityScore.toFixed(4)} (Target: ${label === 'CLEAN' ? '< 0.1' : '> 0.2'})`);
        
        const bloatStats = lastStats.metrics.planet_bloat_grade; // Array of planet stats
        let totalMass = 0;
        let topPlanet = null;
        if (bloatStats && bloatStats.length > 0) {
            bloatStats.forEach(p => {
                totalMass += p.mass;
                if (!topPlanet || p.mass > topPlanet.mass) topPlanet = p;
            });
        }
        
        console.log(`  Total Mass:       ${totalMass.toFixed(0)}`);
        console.log(`  Top Planet:       ${topPlanet ? topPlanet.name : 'None'}`);
        
        const fps = lastStats.metrics.node_fingerprint.fingerPrints;
        console.log(`  Nodes Tracked:    ${fps.length}`);
    }
}

// --- MAIN ---
(async () => {
    // Clean Sites
    await runGauntlet('CLEAN', [
        'https://www.wikipedia.org',
        'https://news.google.com'
    ]);

    // Messy Sites
    await runGauntlet('MESSY', [
        'https://www.yahoo.com',
        'https://www.reddit.com'
    ]);

    // Stress Test
    await runStressTest(1000); // 1000 particles
    await runStressTest(5000); // 5000 particles

    // Consistency Check
    await runConsistencyCheck('https://www.wikipedia.org', 3);

    // Vector Diagnostic (2026 World Model)
    await runVectorDiagnostic();

    // Learning Diagnostic (The Mind)
    await runLearningDiagnostic();

    // Security Scan (Dev Signals)
    await runSecurityScan();
})();

// --- LEARNING DIAGNOSTIC (THE MIND) ---
async function runLearningDiagnostic() {
    console.log(`\n=== RUNNING LEARNING DIAGNOSTIC: Centroid Classifier ===`);
    const brain = new LearningEngine();
    
    // 1. Test "Deep Work" Vector
    const deepVec = VectorMath.create();
    deepVec.fill(0.5); // Baseline
    deepVec[7] = 0.95; // LINGUISTIC_DENSITY (High)
    deepVec[9] = 0.85; // TEXT_ENTROPY (High)
    deepVec[0] = 0.1;  // IO_PACKET_RATE (Low)
    
    const result1 = brain.classify(deepVec);
    console.log(`  [Deep Work Sim] Prediction: ${result1.mode} (${(result1.confidence*100).toFixed(1)}%)`);
    
    if (result1.mode === 'DEEP_WORK') console.log("  [PASS] Correctly identified Deep Work.");
    else console.log(`  [FAIL] Expected DEEP_WORK, got ${result1.mode}`);

    // 2. Test "Doomscrolling" Vector
    const doomVec = VectorMath.create();
    doomVec.fill(0.5);
    doomVec[7] = 0.2;  // LINGUISTIC_DENSITY (Low)
    doomVec[0] = 0.95; // IO_PACKET_RATE (High)
    doomVec[6] = 0.9;  // SPRAWL_SCORE (High)
    
    const result2 = brain.classify(doomVec);
    console.log(`  [Doomscroll Sim] Prediction: ${result2.mode} (${(result2.confidence*100).toFixed(1)}%)`);
    
    if (result2.mode === 'DOOMSCROLLING') console.log("  [PASS] Correctly identified Doomscrolling.");
    else console.log(`  [FAIL] Expected DOOMSCROLLING, got ${result2.mode}`);
}

// --- VECTOR DIAGNOSTIC (2026) ---
async function runVectorDiagnostic() {
    console.log(`\n=== RUNNING VECTOR DIAGNOSTIC: 2026 World Model ===`);
    const extension = new HeadlessExtension();
    const viewer = new HeadlessViewer(extension);
    const startTime = Date.now();

    // Scenario A: "Deep Work / Chat" (High Lingo, Low IO)
    // - Lots of small text tokens
    // - Low packet volume
    const chatTokens = {}; // Object, not Map, for Object.entries() compatibility
    for(let i=0; i<500; i++) chatTokens[`token_${i}`] = 1;
    
    const pChat = extension.ingestPacket(
        'https://chat.openai.com/backend', 'POST', 'json', 
        2000, startTime, 
        '', 
        { tokens: chatTokens }, // High unique tokens
        null, true
    );
    viewer.addParticle(pChat);

    // Scenario B: "Video Stream" (Low Lingo, High IO)
    // - Huge packet
    // - Zero tokens
    const pVideo = extension.ingestPacket(
        'https://netflix.com/stream', 'GET', 'media', 
        5000000, startTime, 
        '', 
        {}, // No tokens
        null, false
    );
    viewer.addParticle(pVideo);

    // Settle
    console.log("  Simulating 200 frames...");
    for (let i = 0; i < 200; i++) viewer.tick();

    // Analyze Vectors
    const fps = viewer.projectionCollector.lastTick.metrics.node_fingerprint.fingerPrints;
    const chatPlanet = fps.find(f => f.name.includes('OPENAI'));
    const videoPlanet = fps.find(f => f.name.includes('NETFLIX'));

    if (!chatPlanet || !videoPlanet) {
        console.log("  [FAIL] Planets not found.");
        return;
    }

    console.log(`  [Chat Planet] LLM Likelihood: ${chatPlanet.metrics.llm_likelihood.toFixed(2)} (Target: > 0.8)`);
    console.log(`  [Chat Planet] Text Entropy:   ${chatPlanet.metrics.text_entropy.toFixed(2)} (Target: > 0.8)`);
    
    console.log(`  [Video Planet] LLM Likelihood: ${videoPlanet.metrics.llm_likelihood.toFixed(2)} (Target: < 0.2)`);
    console.log(`  [Video Planet] Text Entropy:   ${videoPlanet.metrics.text_entropy.toFixed(2)} (Target: < 0.2)`);

    if (chatPlanet.metrics.llm_likelihood > 0.8 && videoPlanet.metrics.llm_likelihood < 0.2) {
        console.log("  [PASS] Semantic Differentiation Successful.");
    } else {
        console.log("  [FAIL] Semantic Differentiation Failed.");
    }
}

// --- SECURITY SCAN ---
async function runSecurityScan() {
    console.log(`\n=== RUNNING SECURITY SCAN: Developer Signals ===`);
    const extension = new HeadlessExtension();
    const viewer = new HeadlessViewer(extension);
    const startTime = Date.now();

    // Ingest packet with Dev Signals
    const signals = [
        { type: 'UUID', value: '12345678-1234-1234-1234-1234567890ab' },
        { type: 'WEIRD_VAR', value: 'mmmmmlli' }
    ];
    
    // Create particle directly to bypass fetch parsing
    const p1 = extension.ingestPacket(
        'https://api.dev-test.com/endpoint', 
        'GET', 'json', 
        1000, startTime, 
        '', 
        { devSignals: signals }, // Meta
        null, 
        true
    );
    viewer.addParticle(p1);

    // Run Physics
    console.log("  Simulating 500 frames...");
    for (let i = 0; i < 500; i++) {
        viewer.tick();
        // Check mid-flight
        if (i % 100 === 0) {
             const state = viewer.physics.getState();
             // console.log(`    Frame ${i}: ${state.particles.length} particles`);
        }
    }

    // Inspect Planets
    const state = viewer.physics.getState();
    let artifactsFound = 0;
    for (const planet of state.planets.values()) {
        if (planet.artifacts && planet.artifacts.length > 0) {
            console.log(`  Planet ${planet.name} has ${planet.artifacts.length} artifacts.`);
            planet.artifacts.forEach(a => console.log(`    - [${a.type}] ${a.value}`));
            artifactsFound += planet.artifacts.length;
        }
    }

    if (artifactsFound === 2) console.log("  [PASS] Artifacts spawned correctly.");
    else console.log(`  [FAIL] Expected 2 artifacts, found ${artifactsFound}.`);
}

// --- STRESS TESTING ---
async function runStressTest(particleCount) {
    console.log(`\n=== RUNNING STRESS TEST: ${particleCount} particles ===`);
    const extension = new HeadlessExtension();
    const viewer = new HeadlessViewer(extension);
    
    const startTime = Date.now();
    
    // Flood
    for (let i = 0; i < particleCount; i++) {
        const domain = `stress-${i % 50}.test.com`;
        const p = extension.ingestPacket(
            `https://${domain}/resource-${i}`, 
            'GET', 'image', 
            Math.random() * 1000, 
            startTime + (i * 2), // Staggered slightly
            '', 
            { bloatScore: Math.random() * 100 }
        );
        viewer.addParticle(p);
    }
    
    console.log(`  Ingested ${particleCount} particles.`);
    
    // Measure Simulation Performance
    const simStart = performance.now();
    let totalFrameTime = 0;
    const FRAMES = 100;
    
    for (let i = 0; i < FRAMES; i++) {
        const fStart = performance.now();
        viewer.tick();
        totalFrameTime += (performance.now() - fStart);
    }
    
    const avgFrameTime = totalFrameTime / FRAMES;
    const estimatedFPS = 1000 / avgFrameTime;
    
    console.log(`  Avg Frame Time: ${avgFrameTime.toFixed(2)}ms`);
    console.log(`  Estimated FPS:  ${estimatedFPS.toFixed(0)}`);
    
    if (estimatedFPS < 30) console.log("  [WARNING] Slowness detected!");
    else console.log("  [PASS] Performance within limits.");
}

// --- CONSISTENCY CHECK ---
async function runConsistencyCheck(url, iterations) {
    console.log(`\n=== RUNNING CONSISTENCY CHECK: ${url} (${iterations} runs) ===`);
    
    const results = [];
    
    for (let i = 0; i < iterations; i++) {
        // We need a fresh extension/viewer per run to ensure isolation
        const extension = new HeadlessExtension();
        const viewer = new HeadlessViewer(extension);
        
        // Fetch (cached likely, but request logic runs)
        try {
            const res = await fetch(url);
            const text = await res.text();
            
            // Ingest
            const p1 = extension.ingestPacket(url, 'GET', 'document', 500, Date.now(), '', {}, null, true);
            viewer.addParticle(p1);
            
            const p2 = extension.ingestPacket(url, 'GET', 'document', text.length, Date.now()+100, text, {}, null, false);
            viewer.addParticle(p2);
            
            // Settle
            for (let f = 0; f < 100; f++) viewer.tick();
            
            // Capture Metric
            const tick = viewer.projectionCollector.lastTick;
            const density = tick.metrics.visual_density.densityScore;
            results.push(density);
            console.log(`  Run ${i+1}: Density = ${density.toFixed(6)}`);
        } catch (e) {
            console.log(`  Run ${i+1}: Failed (${e.message})`);
        }
    }
    
    // Calc Variance
    const mean = results.reduce((a,b) => a+b, 0) / results.length;
    const variance = results.reduce((a,b) => a + Math.pow(b - mean, 2), 0) / results.length;
    const stdDev = Math.sqrt(variance);
    
    console.log(`  Mean Density: ${mean.toFixed(6)}`);
    console.log(`  Std Deviation: ${stdDev.toFixed(8)}`);
    
    if (stdDev < 0.000001) console.log("  [PASS] High Consistency");
    else console.log("  [WARN] Variance detected");
}
