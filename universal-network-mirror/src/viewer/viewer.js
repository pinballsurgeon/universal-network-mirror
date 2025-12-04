import { FLAGS } from '../common/constants.js';
import { LinguisticAggregator } from './aggregator.js';
import { ProjectionCollector } from './projections/ProjectionCollector.js';
import { HistoryManager } from './history/HistoryManager.js';
import { PhysicsEngine } from './engine/PhysicsEngine.js';
import { RenderEngine } from './engine/RenderEngine.js';
import { UIManager } from './ui/UIManager.js';
import { Planet, BlackHole } from './engine/Entities.js';
import { LearningEngine } from '../learning/LearningEngine.js';
import { VectorMath } from '../learning/VectorMath.js';
import { ResourceMonitor, HealthState } from '../common/ResourceMonitor.js';

// --- INITIALIZATION ---
const canvas = document.getElementById('canvas');
const historyManager = new HistoryManager();
const renderEngine = new RenderEngine(canvas, historyManager);
const physicsEngine = new PhysicsEngine(canvas.width, canvas.height);
const uiManager = new UIManager();
const aggregator = new LinguisticAggregator();
const projectionCollector = new ProjectionCollector();
const learningEngine = new LearningEngine();
const resourceMonitor = new ResourceMonitor();

// --- STATE ---
let domainMap = new Map(); 
let reverseDomainMap = new Map(); 
let selectedObject = null;
let currentHealthState = HealthState.GREEN;

let historyStartTime = Date.now();
let historyEndTime = Date.now();
let playbackTime = Date.now();
let lastHistoryPush = 0; // Throttling
let lastPrune = 0; // Aggregator pruning
let isLive = true;
let isPaused = false;
let viewMode = 'TRAFFIC'; // 'TRAFFIC' or 'LINGUISTIC'
let showBlackHoles = false; // Hidden by default (User Request)

// --- RESOURCE GOVERNANCE ---
resourceMonitor.addListener((report) => {
    // Adaptive Logic
    currentHealthState = report.state;
    
    // Adjust Engine Limits
    if (report.state === HealthState.GREEN) {
        physicsEngine.setParticleLimit(1000);
        renderEngine.setQuality('HIGH');
    } else if (report.state === HealthState.YELLOW) {
        physicsEngine.setParticleLimit(200);
        renderEngine.setQuality('MEDIUM');
    } else {
        physicsEngine.setParticleLimit(50);
        renderEngine.setQuality('LOW');
        // Force GC if possible by clearing arrays?
    }
    
    console.log(`[Health] ${report.state} | FPS: ${report.fps} | Heap: ${report.heap}MB`);
});

function resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    renderEngine.resize(w, h);
    physicsEngine.resize(w, h);
}
window.addEventListener('resize', resize);
resize();

// --- DATA LOADING ---
function loadDomainMap() {
    chrome.storage.local.get(['domainMap'], (result) => {
        if (result.domainMap) {
            reverseDomainMap = new Map(Object.entries(result.domainMap));
            domainMap = new Map();
            for (let [name, id] of reverseDomainMap) {
                domainMap.set(id, name);
            }
        }
    });
}
loadDomainMap();
setInterval(loadDomainMap, 5000); 

// --- MESSAGE HANDLING ---
chrome.runtime.onMessage.addListener((message) => {
    if (message.type === 'NEW_PARTICLE') {
        physicsEngine.addParticle(message.payload);
        historyEndTime = Math.max(historyEndTime, message.payload.time);
        if (isLive) playbackTime = historyEndTime - 500; 
    }
});

// Initial Buffer Load
chrome.runtime.sendMessage({ type: 'QUERY_BUFFER' }, (response) => {
    if (response && response.buffer) {
        response.buffer.forEach(p => physicsEngine.addParticle(p));
        if (response.buffer.length > 0) {
            historyStartTime = response.buffer[0].time;
            historyEndTime = response.buffer[response.buffer.length-1].time;
        }
    }
});

// Load Persisted Black Holes
function loadBlackHoles() {
    chrome.storage.local.get(['blackHoles'], (result) => {
        if (result.blackHoles) {
            // Let's retry if domainMap is empty.
            if (domainMap.size === 0) {
                setTimeout(loadBlackHoles, 1000);
                return;
            }

            const blackHoles = result.blackHoles;
            const matchedRules = new Set();
            
            // OPTIMIZED LOOKUP: O(Visited * Depth) instead of O(Visited * Blocked)
            // Iterate visited domains once and check against blackHoles keys
            for (const [hostname, id] of reverseDomainMap.entries()) {
                const parts = hostname.split('.');
                // Check all sub-parts: "mail.google.com" -> "mail.google.com", "google.com", "com"
                // Usually we just care about "google.com" (root) or full match.
                // Scan from full length down to 2 parts.
                
                let current = hostname;
                let foundMatch = false;
                
                // Optimized suffix check
                // We construct potential rules from the hostname
                for (let i = 0; i < parts.length - 1; i++) {
                    const ruleCandidate = parts.slice(i).join('.');
                    if (blackHoles[ruleCandidate]) {
                        // HIT!
                        matchedRules.add(ruleCandidate);
                        const numId = Number(id);
                        
                        // Convert/Create BlackHole
                        if (!physicsEngine.planets.has(numId)) {
                            // Create BlackHole from scratch
                            const dummy = new Planet(numId, hostname, physicsEngine.sunX, physicsEngine.sunY);
                            dummy.angle = Math.random() * Math.PI * 2;
                            dummy.distance = 200 + Math.random() * 200;
                            
                            const bh = new BlackHole(dummy);
                            physicsEngine.planets.set(numId, bh);
                        } else {
                           // Convert existing planet
                           const existing = physicsEngine.planets.get(numId);
                           if (!(existing instanceof BlackHole)) {
                               const bh = new BlackHole(existing);
                               physicsEngine.planets.set(numId, bh);
                           }
                        }
                        foundMatch = true;
                        break; // Stop checking other suffixes if blocked
                    }
                }
            }

            // Restore "Cold" Black Holes (Rules not matched by any visited domain)
            Object.keys(blackHoles).forEach(blockedDomain => {
                if (!matchedRules.has(blockedDomain)) {
                   // Fallback for "Cold" Black Holes (Not in DomainMap)
                   // We must render them so they can be managed/unblocked.
                   let hash = 0;
                   for (let i = 0; i < blockedDomain.length; i++) {
                       hash = ((hash << 5) - hash) + blockedDomain.charCodeAt(i);
                       hash |= 0;
                   }
                   const syntheticId = -Math.abs(hash || 1); // Ensure negative
                   
                   if (!physicsEngine.planets.has(syntheticId)) {
                        const dummy = new Planet(syntheticId, blockedDomain, physicsEngine.sunX, physicsEngine.sunY);
                        dummy.angle = Math.random() * Math.PI * 2;
                        dummy.distance = 300 + Math.random() * 200; 
                        
                        const bh = new BlackHole(dummy);
                        physicsEngine.planets.set(syntheticId, bh);
                        console.log(`[BLACK HOLE] Restored COLD ${blockedDomain} (ID: ${syntheticId})`);
                   }
                }
            });
            console.log(`[BLACK HOLE] Restoration Complete. Matched ${matchedRules.size} rules.`);
        }
    });
}
// Call after a delay to ensure domainMap is loaded
setTimeout(loadBlackHoles, 2000); 

// --- UI BINDING ---
uiManager.bindControls(
    () => { // Toggle Pause
        isPaused = !isPaused;
        isLive = false;
        uiManager.setPauseState(isPaused);
    },
    () => { // Go Live
        isLive = true;
        isPaused = false;
        uiManager.setLiveState(true);
        physicsEngine.particles = []; // Clear visual particles on jump
    },
    () => { viewMode = 'TRAFFIC'; uiManager.setMode('TRAFFIC'); }, // Traffic Mode
    () => { viewMode = 'LINGUISTIC'; uiManager.setMode('LINGUISTIC'); }, // Linguistic Mode
    () => { // Black Hole Action
        if (selectedObject && selectedObject instanceof Planet && !(selectedObject instanceof BlackHole)) {
            const domain = selectedObject.name.toLowerCase();
            console.log(`[BLACK HOLE] Initiated for ${domain}`);
            
            // 1. Transform Entity
            const blackHole = new BlackHole(selectedObject);
            physicsEngine.planets.set(selectedObject.domainId, blackHole);
            
            // 2. Update Selection Reference
            selectedObject = blackHole;
            
            // 3. Send Signal to Background
            chrome.runtime.sendMessage({
                type: 'BLOCK_DOMAIN',
                domain: domain
            });
            
            // 4. Force UI Update
            uiManager.updateInspector(selectedObject, aggregator, projectionCollector.lastTick, historyManager);
        }
    },
    () => { // Show Black Hole List
        const { planets } = physicsEngine.getState();
        uiManager.showBlackHoleInspector(planets);
    },
    (blackHole) => { // Restore Black Hole
        const domain = blackHole.name.toLowerCase();
        console.log(`[BLACK HOLE] Restoring ${domain}`);

        // 1. Transform Entity Back
        const planet = new Planet(blackHole.domainId, blackHole.name, blackHole.sunX, blackHole.sunY);
        // Restore stats (approximate)
        planet.mass = blackHole.mass / 2;
        planet.radius = blackHole.radius;
        planet.angle = blackHole.angle;
        planet.distance = blackHole.distance;
        planet.speed = blackHole.speed;
        planet.moons = blackHole.moons;
        planet.artifacts = blackHole.artifacts;
        planet.internalTraffic = blackHole.internalTraffic;
        planet.externalTraffic = blackHole.externalTraffic;

        physicsEngine.planets.set(blackHole.domainId, planet);
        
        // 2. Update Selection if needed
        if (selectedObject === blackHole) {
            selectedObject = planet;
            uiManager.updateInspector(selectedObject, aggregator, projectionCollector.lastTick, historyManager);
        }

        // 3. Send Signal to Background
        chrome.runtime.sendMessage({
            type: 'UNBLOCK_DOMAIN',
            domain: domain
        });

        // 4. Refresh List
        const { planets } = physicsEngine.getState();
        uiManager.showBlackHoleInspector(planets);
    },
    (isVisible) => { // Toggle Void
        showBlackHoles = isVisible;
    },
    () => { // Take Snapshot
        if (selectedObject && selectedObject.name) {
            const stats = historyManager.getDomainHistory(selectedObject.name);
            if (stats) {
                const label = prompt("Snapshot Label:", new Date().toLocaleTimeString());
                if (label) {
                    historyManager.takeSnapshot(selectedObject.name, stats.metrics, label);
                    uiManager.updateInspector(selectedObject, aggregator, projectionCollector.lastTick, historyManager);
                }
            } else {
                alert("No history data available for this domain yet.");
            }
        }
    }
);

// --- INTERACTION ---
// Click Handler (Still complex enough to keep here for now, or move to InputSystem later)
canvas.addEventListener('click', (e) => {
    const mx = e.clientX;
    const my = e.clientY;
    const { planets } = physicsEngine.getState();
    
    // 1. Check Topic Words (Linguistic Mode)
    if (viewMode === 'LINGUISTIC') {
        for (const p of planets.values()) {
            if (p.tokenState) {
                for (const [token, state] of p.tokenState) {
                    if (state.currentStrength < 0.01) continue;
                    const fontSize = 8 + Math.pow(state.currentStrength, 0.7) * 24;
                    const width = token.length * fontSize * 0.6;
                    const height = fontSize;
                    const tx = p.x + Math.cos(state.angle) * state.radius;
                    const ty = p.y + Math.sin(state.angle) * state.radius;
                    const padding = 30; 
                    if (Math.abs(mx - tx) < width / 2 + padding && Math.abs(my - ty) < height / 2 + padding) {
                        console.log("Clicked topic:", token);
                        // We need access to the FULL buffer for topic inspection?
                        // Or just what PhysicsEngine has?
                        // PhysicsEngine keeps `particles` (active) and `buffer` (raw).
                        // Let's pass the raw buffer from PhysicsEngine.
                        uiManager.showTopicInspector(token, physicsEngine.buffer, domainMap, FLAGS);
                        return; 
                    }
                }
            }
        }
    }

    // 2. Check Physical Objects
    let found = null;
    for (const p of planets.values()) {
        for (const m of p.moons.values()) {
            const dx = mx - m.x;
            const dy = my - m.y;
            if (dx*dx + dy*dy < m.radius * m.radius + 100) { 
                found = m;
                break;
            }
        }
        if (found) break;
        const dx = mx - p.x;
        const dy = my - p.y;
        if (dx*dx + dy*dy < p.radius * p.radius) {
            found = p;
            break;
        }
    }
    
    selectedObject = found;
    if (selectedObject) {
        uiManager.showInspector(selectedObject);
        uiManager.updateInspector(selectedObject, aggregator, projectionCollector.lastTick, historyManager);
    } else {
        uiManager.hideInspector();
    }
});

// Timeline Scrub
canvas.addEventListener('mousedown', (e) => {
    if (e.clientY > canvas.height - 80) { // TIMELINE_HEIGHT
        const x = e.clientX;
        const totalDuration = historyEndTime - historyStartTime;
        playbackTime = historyStartTime + (x / canvas.width) * totalDuration;
        isLive = false; 
        isPaused = false; 
        uiManager.setLiveState(false);
        physicsEngine.particles = [];
    }
});

// --- GAME LOOP ---
function loop() {
    requestAnimationFrame(loop);

    const now = Date.now();

    // 1. Time & Data Processing
    if (!isPaused) {
        aggregator.decayGlobalTokens();
    }

    if (isLive && !isPaused) {
        playbackTime = now - 500;
        historyEndTime = Math.max(historyEndTime, playbackTime);
    } else if (!isPaused) {
        playbackTime += 16; 
    }

    physicsEngine.processBuffer(playbackTime, isPaused);

    // 2. Physics Update
    const context = {
        isPaused,
        domainMap, // Map<id, name>
        aggregator
    };
    physicsEngine.update(context);

    // 3. Render
    renderEngine.clear();
    const physicsState = physicsEngine.getState();
    
    renderEngine.drawScene(
        physicsState, 
        selectedObject, 
        viewMode, 
        aggregator, 
        playbackTime, 
        isPaused, 
        projectionCollector.lastTick,
        showBlackHoles
    );
    
    renderEngine.drawTimeline(playbackTime, isLive, historyStartTime, historyEndTime);

    // 4. UI Updates
    if (selectedObject && !uiManager.isMinimized) {
        uiManager.updateInspector(selectedObject, aggregator, projectionCollector.lastTick, historyManager);
    }
    uiManager.updateStats(60, physicsState.particles.length, physicsState.planets.size);
    uiManager.updateTime(isLive);

    // 5. Intelligence (The Mind)
    // Compute Global Slice Vector
    const sliceVector = VectorMath.create();
    let totalWeight = 0;
    
    for (const p of physicsState.planets.values()) {
        const weight = p.mass; // Use mass as importance weight
        VectorMath.scale(p.vector, p.vector, 1); // Ensure we have the vector (it's updated in Entities.js)
        // Accumulate: slice += planet_vec * weight
        // We need a temp vector for scaling to not mutate planet vector
        // Optimization: In JS just multiply in loop for V1
        for(let i=0; i<sliceVector.length; i++) {
            sliceVector[i] += p.vector[i] * weight;
        }
        totalWeight += weight;
    }
    
    if (totalWeight > 0) {
        // Normalize by total weight to get average
        for(let i=0; i<sliceVector.length; i++) {
            sliceVector[i] /= totalWeight;
        }
    }

    // Classify
    const prediction = learningEngine.classify(sliceVector);
    
    // Update Systems
    // renderEngine.setMode(prediction); // Need to implement
    // uiManager.updateMode(prediction); // Need to implement
    
    // Store in History for Scrubber
    // historyManager.pushSlice(playbackTime, prediction); // Need to implement

    // 6. Metrics & Projection
    // Collect stats for external validation (Cline / Tests)
    const engineState = {
        time: playbackTime,
        planets: physicsState.planets,
        particles: physicsState.particles,
        viewMode,
        selectedObject,
        width: canvas.width,
        height: canvas.height,
        aggregator,
        prediction // Broadcast intelligence
    };
    projectionCollector.collectAndBroadcast(engineState);
    
    // Save to History Tape (Throttled)
    if (projectionCollector.lastTick) {
        // V6 Optimization: Only push 1Hz (every 1 second) to history
        // ADAPTIVE: If RED state, disable history recording entirely to save RAM
        const interval = currentHealthState === HealthState.RED ? Infinity : 1000;
        
        if (now - lastHistoryPush > interval) {
            historyManager.push(projectionCollector.lastTick);
            if (projectionCollector.lastTick.metrics.node_fingerprint) {
                historyManager.updateFingerprints(projectionCollector.lastTick.metrics.node_fingerprint.fingerPrints);
            }
            lastHistoryPush = now;
        }
    }

    // Prune Aggregator (Every 5 seconds) to prevent infinite memory growth from dead planets
    if (now - lastPrune > 5000) {
        const activeKeys = physicsEngine.planets.keys();
        aggregator.prune(activeKeys);
        lastPrune = now;
    }
}

loop();
