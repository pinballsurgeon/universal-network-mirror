import { FLAGS } from '../common/constants.js';
import { LinguisticAggregator } from './aggregator.js';
import { ProjectionCollector } from './projections/ProjectionCollector.js';
import { HistoryManager } from './history/HistoryManager.js';
import { PhysicsEngine } from './engine/PhysicsEngine.js';
import { RenderEngine } from './engine/RenderEngine.js';
import { UIManager } from './ui/UIManager.js';
import { Planet } from './engine/Entities.js';

// --- INITIALIZATION ---
const canvas = document.getElementById('canvas');
const historyManager = new HistoryManager();
const renderEngine = new RenderEngine(canvas, historyManager);
const physicsEngine = new PhysicsEngine(canvas.width, canvas.height);
const uiManager = new UIManager();
const aggregator = new LinguisticAggregator();
const projectionCollector = new ProjectionCollector();

// --- STATE ---
let domainMap = new Map(); 
let reverseDomainMap = new Map(); 
let selectedObject = null;

let historyStartTime = Date.now();
let historyEndTime = Date.now();
let playbackTime = Date.now();
let isLive = true;
let isPaused = false;
let viewMode = 'TRAFFIC'; // 'TRAFFIC' or 'LINGUISTIC'

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
    () => { viewMode = 'LINGUISTIC'; uiManager.setMode('LINGUISTIC'); } // Linguistic Mode
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

    // 1. Time & Data Processing
    if (!isPaused) {
        aggregator.decayGlobalTokens();
    }

    if (isLive && !isPaused) {
        playbackTime = Date.now() - 500;
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
        projectionCollector.lastTick
    );
    
    renderEngine.drawTimeline(playbackTime, isLive, historyStartTime, historyEndTime);

    // 4. UI Updates
    if (selectedObject && !uiManager.isMinimized) {
        uiManager.updateInspector(selectedObject, aggregator, projectionCollector.lastTick, historyManager);
    }
    uiManager.updateStats(60, physicsState.particles.length, physicsState.planets.size);
    uiManager.updateTime(isLive);

    // 5. Metrics & Projection
    // Collect stats for external validation (Cline / Tests)
    const engineState = {
        time: playbackTime,
        planets: physicsState.planets,
        particles: physicsState.particles,
        viewMode,
        selectedObject,
        width: canvas.width,
        height: canvas.height,
        aggregator
    };
    projectionCollector.collectAndBroadcast(engineState);
    
    // Save to History Tape
    if (projectionCollector.lastTick) {
        const lastRecorded = historyManager.tape.length > 0 ? historyManager.tape[historyManager.tape.length-1] : null;
        if (!lastRecorded || lastRecorded.ts !== projectionCollector.lastTick.ts) {
            historyManager.push(projectionCollector.lastTick);
            if (projectionCollector.lastTick.metrics.node_fingerprint) {
                historyManager.updateFingerprints(projectionCollector.lastTick.metrics.node_fingerprint.fingerPrints);
            }
        }
    }
}

loop();
