import { FLAGS, MAX_PARTICLES } from '../common/constants.js';
import { LinguisticAggregator } from './aggregator.js';
import { Planet, Particle } from './engine/Entities.js';
import { ProjectionCollector } from './projections/ProjectionCollector.js';

const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const statsEl = document.getElementById('stats');
const timeEl = document.getElementById('time-offset');

// UI Elements
const btnPause = document.getElementById('btn-pause');
const btnLive = document.getElementById('btn-live');
const btnModeTraffic = document.getElementById('btn-mode-traffic');
const btnModeLinguistic = document.getElementById('btn-mode-linguistic');
const inspector = document.getElementById('inspector');
const btnMinimize = document.getElementById('btn-minimize');

// Topic Inspector Elements
const topicInspector = document.getElementById('topic-inspector');
const topicTitle = document.getElementById('topic-title');
const topicList = document.getElementById('topic-list');
const btnCloseTopic = document.getElementById('btn-close-topic');

// Inspector Fields
const inspName = document.getElementById('insp-name');
const inspType = document.getElementById('insp-type');
const inspMass = document.getElementById('insp-mass');
const inspBloat = document.getElementById('insp-bloat');
const inspGrade = document.getElementById('insp-grade');
const inspInternal = document.getElementById('insp-internal');
const inspExternal = document.getElementById('insp-external');
const inspTokens = document.getElementById('insp-tokens');
const inspSample = document.getElementById('insp-sample');
const inspFingerprint = document.getElementById('insp-fingerprint');
const pieChartCount = document.getElementById('pie-chart-count');
const pieCtxCount = pieChartCount.getContext('2d');
const pieChartSize = document.getElementById('pie-chart-size');
const pieCtxSize = pieChartSize.getContext('2d');

let width, height;
function resize() {
    width = canvas.width = window.innerWidth;
    height = canvas.height = window.innerHeight;
}
window.addEventListener('resize', resize);
resize();

// --- STATE ---
let domainMap = new Map(); 
let reverseDomainMap = new Map(); 
let planets = new Map(); 
let particles = [];
let buffer = [];
let selectedObject = null;
let isMinimized = false;

// Linguistic Aggregator (TF/IDF + hysteresis)
const aggregator = new LinguisticAggregator();

// Projection Collector (Metrics & Testing)
const projectionCollector = new ProjectionCollector();

// Time State
let historyStartTime = Date.now();
let historyEndTime = Date.now();
let playbackTime = Date.now();
let isLive = true;
let isPaused = false;
let viewMode = 'TRAFFIC'; // 'TRAFFIC' or 'LINGUISTIC'

// Load Domain Map
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

// --- ANALYTICS HELPERS ---
function formatBytes(bytes, decimals = 2) {
    if (!+bytes) return '0 B';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

// --- PHYSICS HELPERS ---
const SUN_X = () => width / 2;
const SUN_Y = () => height / 2;

// --- UI CONTROLS ---
function togglePause() {
    isPaused = !isPaused;
    isLive = false;
    btnPause.innerText = isPaused ? "RESUME" : "PAUSE";
    btnLive.classList.remove('active');
}

function goLive() {
    isLive = true;
    isPaused = false;
    btnLive.classList.add('active');
    btnPause.innerText = "PAUSE";
    particles = []; 
}

function toggleMinimize() {
    isMinimized = !isMinimized;
    if (isMinimized) {
        inspector.classList.add('minimized');
        btnMinimize.innerText = '+';
    } else {
        inspector.classList.remove('minimized');
        btnMinimize.innerText = '_';
    }
}

function setMode(mode) {
    viewMode = mode;
    if (mode === 'TRAFFIC') {
        btnModeTraffic.classList.add('active');
        btnModeLinguistic.classList.remove('active');
    } else {
        btnModeTraffic.classList.remove('active');
        btnModeLinguistic.classList.add('active');
    }
}

btnPause.addEventListener('click', togglePause);
btnLive.addEventListener('click', goLive);
btnMinimize.addEventListener('click', toggleMinimize);
btnModeTraffic.addEventListener('click', () => setMode('TRAFFIC'));
btnModeLinguistic.addEventListener('click', () => setMode('LINGUISTIC'));
btnCloseTopic.addEventListener('click', closeTopicInspector);

// Handle expand/collapse of packet details via delegation
topicList.addEventListener('click', (e) => {
    const header = e.target.closest('.packet-header');
    if (header) {
        const item = header.parentElement;
        item.classList.toggle('expanded');
    }
});

canvas.addEventListener('click', (e) => {
    const mx = e.clientX;
    const my = e.clientY;
    
    // 1. Check Topic Words (Linguistic Mode)
    if (viewMode === 'LINGUISTIC') {
        // Iterate backwards through planets (top first)
        for (const p of planets.values()) {
            if (p.tokenState) {
                for (const [token, state] of p.tokenState) {
                    if (state.currentStrength < 0.01) continue;
                    
                    // Simple Box Hit Test
                    const fontSize = 8 + Math.pow(state.currentStrength, 0.7) * 24;
                    // Approximate text width (monospace ~0.6em width)
                    const width = token.length * fontSize * 0.6;
                    const height = fontSize;
                    
                    // Text is centered at state.angle, state.radius (fixed prop name)
                    const tx = p.x + Math.cos(state.angle) * state.radius;
                    const ty = p.y + Math.sin(state.angle) * state.radius;
                    
                    // Hit box centered on tx, ty
                    // Generous padding to ensure easy clicking
                    const padding = 30; 
                    if (Math.abs(mx - tx) < width / 2 + padding && Math.abs(my - ty) < height / 2 + padding) {
                        console.log("Clicked topic:", token);
                        openTopicInspector(token);
                        return; // Stop after finding one word
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
        inspector.style.display = 'block';
        isMinimized = false;
        inspector.classList.remove('minimized');
        updateHUD();
    } else {
        inspector.style.display = 'none';
    }
});

function openTopicInspector(topic) {
    topicInspector.style.display = 'block';
    topicTitle.innerText = topic;
    topicList.innerHTML = ''; // Clear old

    // Find relevant packets in buffer (reverse order for recent first)
    // Buffer contains particles.
    const relevant = [];
    for (let i = buffer.length - 1; i >= 0; i--) {
        const p = buffer[i];
        if (p.tokens && p.tokens[topic]) {
            relevant.push(p);
            if (relevant.length >= 50) break; // Limit to 50 items
        }
    }

    if (relevant.length === 0) {
        topicList.innerHTML = '<div style="color:#666; text-align:center; padding:20px;">No recent packets found for this topic.</div>';
        return;
    }

    topicList.innerHTML = relevant.map(p => {
        const date = new Date(p.time).toLocaleTimeString();
        const domain = domainMap.get(p.domainId) || "Unknown";
        const isReq = (p.flags & FLAGS.IS_REQUEST);
        const type = isReq ? "REQ" : "RES";
        
        let displayContent = p.sample || (p.tokens ? `Matched: ${p.tokens[topic]}x` : "No sample");
        
        // Use full text if available to find context
        if (p.text) {
            const idx = p.text.toLowerCase().indexOf(topic.toLowerCase());
            if (idx !== -1) {
                const start = Math.max(0, idx - 100); // Context window
                const end = Math.min(p.text.length, idx + topic.length + 100);
                displayContent = (start > 0 ? "..." : "") + 
                                 p.text.substring(start, end) + 
                                 (end < p.text.length ? "..." : "");
            } else {
                displayContent = p.text.substring(0, 300) + "..."; 
            }
        }

        // Highlight the topic word
        const cleanSample = displayContent.replace(/</g, "<").replace(/>/g, ">");
        const highlighted = cleanSample.replace(
            new RegExp(`(${topic})`, 'gi'), 
            '<strong style="color:#ffffff; background:rgba(0, 255, 204, 0.2); padding:0 2px; border-radius:2px;">$1</strong>'
        );

        return `
            <div class="packet-item">
                <div class="packet-header">
                    <span class="packet-time">${date}</span>
                    <span class="packet-domain">[${type}] ${domain}</span>
                </div>
                <div class="packet-body">${highlighted}</div>
            </div>
        `;
    }).join('');
}

function closeTopicInspector() {
    topicInspector.style.display = 'none';
}

function drawPieChart(ctx, internal, external) {
    const total = internal + external;
    ctx.clearRect(0, 0, 100, 100);
    if (total === 0) return;
    
    const center = 50;
    const radius = 40;
    
    // Internal Slice (Yellow)
    const internalAngle = (internal / total) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(center, 50);
    ctx.arc(center, 50, radius, 0, internalAngle);
    ctx.fillStyle = '#ffff00';
    ctx.fill();
    
    // External Slice (Blue)
    ctx.beginPath();
    ctx.moveTo(center, 50);
    ctx.arc(center, 50, radius, internalAngle, Math.PI * 2);
    ctx.fillStyle = '#5555ff';
    ctx.fill();
}


function updateHUD() {
    if (!selectedObject) return;
    
    inspName.innerText = selectedObject.name || "UNKNOWN";
    inspType.innerText = selectedObject instanceof Planet ? "PLANET (ROOT)" : (selectedObject.isJunk ? "JUNK MOON" : "MOON");
    inspMass.innerText = Math.floor(selectedObject.mass);
    inspBloat.innerText = Math.floor(selectedObject.bloatScore);
    // inspTraffic removed as it is now redundant with detailed breakdown
    
    const score = selectedObject.bloatScore / (selectedObject.packetCount || 1);
    let grade = 'A';
    if (score > 10) grade = 'B';
    if (score > 50) grade = 'C';
    if (score > 100) grade = 'D';
    if (score > 500) grade = 'F';
    
    inspGrade.innerText = grade;
    inspGrade.className = 'stat-value ' + (grade === 'A' ? 'grade-A' : (grade === 'F' ? 'grade-F' : ''));
    
    // Traffic Source
    const intSize = formatBytes(selectedObject.internalTrafficSize);
    const extSize = formatBytes(selectedObject.externalTrafficSize);
    
    inspInternal.innerText = `${Math.floor(selectedObject.internalTraffic)} pkts / ${intSize}`;
    inspExternal.innerText = `${Math.floor(selectedObject.externalTraffic)} pkts / ${extSize}`;
    
    drawPieChart(pieCtxCount, selectedObject.internalTraffic, selectedObject.externalTraffic);
    drawPieChart(pieCtxSize, selectedObject.internalTrafficSize, selectedObject.externalTrafficSize);
    
    // Top Tokens (uses same scoring as visual layer, without hysteresis)
    const topTokens = aggregator.getTopTokens(selectedObject.tokens, selectedObject.tokenTotal);
    inspTokens.innerHTML = topTokens.map(t => 
        `<div class="token-item"><span>${t.token}</span><span style="color:#00ffcc">${Math.floor(t.count)}</span></div>`
    ).join('');
    
    // Sample
    if (selectedObject.samples.length > 0) {
        inspSample.innerText = '"' + selectedObject.samples[selectedObject.samples.length - 1] + '..."';
    } else {
        inspSample.innerText = "No content samples yet.";
    }

    // Fingerprint Visualization
    if (projectionCollector.lastTick && projectionCollector.lastTick.metrics.node_fingerprint) {
        const fps = projectionCollector.lastTick.metrics.node_fingerprint.fingerPrints;
        const fp = fps.find(f => f.domainId === selectedObject.domainId);
        
        if (fp) {
            const bars = [
                { label: 'I/O BAL', val: fp.metrics.io_ratio, dev: 0 },
                { label: 'DENSITY', val: fp.metrics.density, dev: fp.deviations.packet_dev },
                { label: 'HEAVY', val: fp.metrics.heaviness, dev: fp.deviations.size_dev },
                { label: 'COMPLEX', val: fp.metrics.complexity, dev: 0 }
            ];
            
            inspFingerprint.innerHTML = bars.map(b => `
                <div class="finger-row">
                    <div class="finger-label">${b.label}</div>
                    <div class="finger-bar-bg">
                        <div class="finger-bar-fill ${Math.abs(b.dev) > 2 ? 'high-dev' : ''}" style="width:${Math.min(100, Math.max(5, b.val * 100))}%"></div>
                    </div>
                    <div class="finger-val">${(b.val * 100).toFixed(0)}</div>
                </div>
            `).join('');
        } else {
            inspFingerprint.innerHTML = '<div style="color:#666; font-size:10px; text-align:center;">Calculating...</div>';
        }
    }
}

chrome.runtime.onMessage.addListener((message) => {
    if (message.type === 'NEW_PARTICLE') {
        buffer.push(message.payload);
        historyEndTime = Math.max(historyEndTime, message.payload.time);
        if (isLive) playbackTime = historyEndTime - 500; 
    }
});
chrome.runtime.sendMessage({ type: 'QUERY_BUFFER' }, (response) => {
    if (response && response.buffer) {
        buffer = response.buffer;
        if (buffer.length > 0) {
            historyStartTime = buffer[0].time;
            historyEndTime = buffer[buffer.length-1].time;
        }
    }
});

const TIMELINE_HEIGHT = 60;
function drawTimeline() {
    const y = height - TIMELINE_HEIGHT;
    ctx.fillStyle = '#111';
    ctx.fillRect(0, y, width, TIMELINE_HEIGHT);
    const totalDuration = historyEndTime - historyStartTime;
    if (totalDuration <= 0) return;
    const playheadX = ((playbackTime - historyStartTime) / totalDuration) * width;
    ctx.fillStyle = isLive ? '#00ffcc' : '#ffff00';
    ctx.fillRect(playheadX, y, 2, TIMELINE_HEIGHT);
    ctx.fillStyle = '#fff';
    ctx.font = '10px monospace';
    ctx.fillText(new Date(playbackTime).toLocaleTimeString(), playheadX + 5, y + 15);
}

canvas.addEventListener('mousedown', (e) => {
    if (e.clientY > height - TIMELINE_HEIGHT) {
        const x = e.clientX;
        const totalDuration = historyEndTime - historyStartTime;
        playbackTime = historyStartTime + (x / width) * totalDuration;
        isLive = false; 
        isPaused = false; 
        btnLive.classList.remove('active');
        particles = [];
    }
});

function loop() {
    requestAnimationFrame(loop);

    const sx = SUN_X();
    const sy = SUN_Y();

    // Context object to pass to entities
    const context = {
        isPaused,
        sunX: sx,
        sunY: sy,
        planets,
        domainMap,
        aggregator
    };

    // Keep global linguistic stats in sync with the same
    // rolling window behavior as per-entity decay.
    if (!isPaused) {
        aggregator.decayGlobalTokens();
    }

    if (isLive && !isPaused) {
        playbackTime = Date.now() - 500;
        historyEndTime = Math.max(historyEndTime, playbackTime);
    } else if (!isPaused) {
        playbackTime += 16; 
    }

    ctx.fillStyle = 'rgba(5, 5, 5, 0.2)'; 
    ctx.fillRect(0, 0, width, height);

    if (!isPaused) {
        const windowStart = playbackTime - 100;
        const windowEnd = playbackTime;
        for (const p of buffer) {
            if (p.time >= windowStart && p.time <= windowEnd) {
                if (Math.random() > 0.9) continue; 
                if (particles.length < MAX_PARTICLES) {
                    particles.push(new Particle(p, sx, sy, width, height));
                }
            }
        }
    }

    for (const [id, planet] of planets.entries()) {
        const alive = planet.update(context);
        if (!alive) {
            planets.delete(id); 
        } else {
            planet.draw(ctx, selectedObject, viewMode, aggregator, playbackTime, isPaused);
        }
    }

    ctx.globalCompositeOperation = 'lighter';
    for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        const alive = p.update(context);
        if (!alive) {
            particles.splice(i, 1);
        } else {
            p.draw(ctx);
        }
    }
    ctx.globalCompositeOperation = 'source-over';

    ctx.beginPath();
    ctx.arc(sx, sy, 20, 0, Math.PI * 2);
    ctx.fillStyle = '#fff';
    ctx.fill();
    
    drawTimeline();
    if (selectedObject && !isMinimized) updateHUD();

    statsEl.innerText = `FPS: 60 | P: ${particles.length} | PLANETS: ${planets.size}`;
    timeEl.innerText = isLive ? "LIVE (DELAYED)" : "REPLAY";

    // --- METRICS & PROJECTION ---
    // Collect stats for external validation (Cline / Tests)
    const engineState = {
        time: playbackTime,
        planets,
        particles,
        viewMode,
        selectedObject,
        width,
        height,
        aggregator
    };
    projectionCollector.collectAndBroadcast(engineState);
}

loop();
