import { FLAGS, MAX_PARTICLES, COAGULATION_THRESHOLD, ATTRACTION_FORCE } from '../common/constants.js';

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
const inspectorBody = document.getElementById('inspector-body');
const btnMinimize = document.getElementById('btn-minimize');

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

// Global Stats for TF-IDF
let globalTokens = new Map(); 
let globalTokenCount = 0;

// Time State
let historyStartTime = Date.now();
let historyEndTime = Date.now();
let playbackTime = Date.now();
let isLive = true;
let isPaused = false;
let viewMode = 'TRAFFIC'; // 'TRAFFIC' or 'LINGUISTIC'
let timeWindowSize = 1000 * 60; 

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

function mergeTokens(targetMap, sourceTokens) {
    if (!sourceTokens) return;
    for (const [token, count] of Object.entries(sourceTokens)) {
        targetMap.set(token, (targetMap.get(token) || 0) + count);
        
        // Update Global
        globalTokens.set(token, (globalTokens.get(token) || 0) + count);
        globalTokenCount += count;
    }
}

function getTopTokens(localMap, localTotal) {
    // Calculate TF-IDF Score
    // Score = (LocalFreq) / (GlobalFreq + epsilon)
    const scores = [];
    for (const [token, count] of localMap.entries()) {
        const tf = count / (localTotal || 1);
        const gf = (globalTokens.get(token) || 1) / (globalTokenCount || 1);
        const score = tf / gf;
        scores.push({ token, score, count });
    }
    // Sort by uniqueness (score) then count
    return scores.sort((a, b) => b.score - a.score).slice(0, 10);
}

function decayStats(entity) {
    const DECAY_RATE_TOKENS = 0.995;
    const DECAY_RATE_TRAFFIC = 0.999;

    // Decay Traffic
    entity.internalTraffic *= DECAY_RATE_TRAFFIC;
    entity.internalTrafficSize *= DECAY_RATE_TRAFFIC;
    entity.externalTraffic *= DECAY_RATE_TRAFFIC;
    entity.externalTrafficSize *= DECAY_RATE_TRAFFIC;

    // Decay Tokens
    entity.tokenTotal = 0;
    for (const [token, count] of entity.tokens.entries()) {
        const newCount = count * DECAY_RATE_TOKENS;
        if (newCount < 0.1) {
            entity.tokens.delete(token);
        } else {
            entity.tokens.set(token, newCount);
            entity.tokenTotal += newCount;
        }
    }
}

// --- PHYSICS ENTITIES ---
const SUN_X = () => width / 2;
const SUN_Y = () => height / 2;

class Moon {
    constructor(domainId, name, parent) {
        this.domainId = domainId;
        this.fullName = name;
        this.name = name.split('.')[0].toUpperCase(); 
        this.parent = parent;
        this.isJunk = !this.fullName.toUpperCase().includes(this.parent.name);
        
        this.mass = 2; 
        this.radius = 4;
        this.bloatScore = 0;
        this.packetCount = 0;
        
        // Analytics
        this.internalTraffic = 0;
        this.internalTrafficSize = 0;
        this.externalTraffic = 0;
        this.externalTrafficSize = 0;
        this.tokens = new Map();
        this.tokenTotal = 0;
        this.samples = [];
        
        this.angle = Math.random() * Math.PI * 2;
        this.distance = 40 + Math.random() * 40; 
        this.speed = (Math.random() > 0.5 ? 1 : -1) * (0.02 + Math.random() * 0.03);
        
        this.x = 0;
        this.y = 0;
        this.lastActive = Date.now();
    }

    absorb(particle) {
        this.mass += 0.5; 
        this.packetCount++;
        this.parent.mass += 0.1; 
        
        // Update Local Stats
        if (particle.data.flags & FLAGS.IS_REQUEST) {
            this.internalTraffic++;
            this.internalTrafficSize += particle.data.size || 0;
        } else {
            this.externalTraffic++;
            this.externalTrafficSize += particle.data.size || 0;
        }
        
        if (particle.data.bloatScore) this.bloatScore += particle.data.bloatScore;
        
        if (particle.data.tokens) {
            mergeTokens(this.tokens, particle.data.tokens);
            // Approximate token total increase
            this.tokenTotal += Object.values(particle.data.tokens).reduce((a, b) => a + b, 0);
        }
        
        if (particle.data.sample) {
            this.samples.push(particle.data.sample);
            if (this.samples.length > 5) this.samples.shift();
        }

        // Roll up to Parent
        this.parent.ingestStats(particle.data);

        this.lastActive = Date.now();
    }

    update() {
        if (isPaused) return true;

        decayStats(this);

        this.angle += this.speed;
        this.x = this.parent.x + Math.cos(this.angle) * this.distance;
        this.y = this.parent.y + Math.sin(this.angle) * this.distance;

        if (this.mass > 0) {
            this.mass *= 0.999; 
            this.mass -= 0.001; 
        }
        
        const timeSinceActive = Date.now() - this.lastActive;
        if (this.mass <= 0.1 && timeSinceActive > 2000) return false;

        const densityFactor = this.bloatScore > 500 ? 1.5 : 1; 
        this.radius = 4 + Math.log(Math.max(1, this.mass)) * 3 * densityFactor; 
        
        return true; 
    }

    draw(ctx) {
        ctx.beginPath();
        if (this.bloatScore > 500 || this.isJunk) {
             for (let i = 0; i < Math.PI * 2; i += 0.8) {
                const r = this.radius + Math.random() * 2;
                ctx.lineTo(this.x + Math.cos(i) * r, this.y + Math.sin(i) * r);
            }
            ctx.closePath();
            ctx.fillStyle = this.isJunk ? '#552222' : '#aaaaff';
        } else {
            ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
            ctx.fillStyle = '#ffffff';
        }
        
        if (selectedObject === this) {
            ctx.strokeStyle = '#00ffcc';
            ctx.lineWidth = 2;
            ctx.stroke();
        }
        
        ctx.fill();

        if (this.mass > 2 || selectedObject === this) {
            ctx.fillStyle = '#aaa';
            ctx.font = '8px monospace';
            ctx.textAlign = 'center';
            ctx.fillText(this.name, this.x, this.y + this.radius + 8);
        }
    }
}

class Planet {
    constructor(domainId, name) {
        this.domainId = domainId;
        this.name = this.cleanName(name);
        this.mass = 10; 
        this.radius = 10;
        this.bloatScore = 0;
        this.packetCount = 0;
        this.moons = new Map(); 
        
        // Analytics
        this.internalTraffic = 0;
        this.internalTrafficSize = 0;
        this.externalTraffic = 0;
        this.externalTrafficSize = 0;
        this.tokens = new Map();
        this.tokenTotal = 0;
        this.samples = [];
        
        this.angle = Math.random() * Math.PI * 2;
        this.distance = 150 + Math.random() * 200;
        this.speed = (Math.random() > 0.5 ? 1 : -1) * (0.002 + Math.random() * 0.005);
        
        this.x = SUN_X() + Math.cos(this.angle) * this.distance;
        this.y = SUN_Y() + Math.sin(this.angle) * this.distance;
        
        this.color = `hsl(${Math.random() * 360}, 70%, 50%)`;
        this.lastActive = Date.now();
    }

    cleanName(name) {
        return name.replace(/^www\./, '').toUpperCase();
    }

    getMoon(subdomainId, name) {
        if (!this.moons.has(subdomainId)) {
            this.moons.set(subdomainId, new Moon(subdomainId, name, this));
        }
        return this.moons.get(subdomainId);
    }

    ingestStats(data) {
        if (data.flags & FLAGS.IS_REQUEST) {
            this.internalTraffic++;
            this.internalTrafficSize += data.size || 0;
        } else {
            this.externalTraffic++;
            this.externalTrafficSize += data.size || 0;
        }

        if (data.tokens) {
            mergeTokens(this.tokens, data.tokens);
            this.tokenTotal += Object.values(data.tokens).reduce((a, b) => a + b, 0);
        }
        
        if (data.sample) {
            this.samples.push(data.sample);
            if (this.samples.length > 5) this.samples.shift();
        }
    }

    absorb(particle) {
        this.mass += 0.5;
        this.packetCount++;
        
        this.ingestStats(particle.data);

        if (particle.data.bloatScore) this.bloatScore += particle.data.bloatScore;
        
        this.lastActive = Date.now();
    }

    update() {
        decayStats(this);
        if (isPaused) return true;

        // Physics / Solar System Logic (Same for both modes)
        this.angle += this.speed;
        this.x = SUN_X() + Math.cos(this.angle) * this.distance;
        this.y = SUN_Y() + Math.sin(this.angle) * this.distance;

        if (this.mass > 0) {
            this.mass *= 0.999;
            this.mass -= 0.001;
        }

        let totalMoonMass = 0;
        for (const [id, moon] of this.moons.entries()) {
            const alive = moon.update();
            if (!alive) {
                this.moons.delete(id); 
            } else {
                totalMoonMass += moon.mass;
            }
        }
        
        const timeSinceActive = Date.now() - this.lastActive;
        if (this.mass <= 0.5 && this.moons.size === 0 && timeSinceActive > 5000) return false;

        const densityFactor = this.bloatScore > 500 ? 2 : 1;
        const baseRadius = 10 + Math.log(Math.max(1, this.mass)) * 5 * densityFactor;
        const moonRadiusContribution = Math.sqrt(totalMoonMass) * 2;
        
        let targetRadius = Math.max(10, baseRadius + moonRadiusContribution);
        this.radius = this.radius * 0.95 + targetRadius * 0.05;
        
        return true;
    }

    draw(ctx) {
        ctx.beginPath();
        if (this.bloatScore > 500) {
            for (let i = 0; i < Math.PI * 2; i += 0.5) {
                const r = this.radius + Math.random() * 5;
                ctx.lineTo(this.x + Math.cos(i) * r, this.y + Math.sin(i) * r);
            }
            ctx.closePath();
            ctx.globalAlpha = 0.8;
        } else {
            ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        }
        
        if (selectedObject === this) {
            ctx.strokeStyle = '#00ffcc';
            ctx.lineWidth = 3;
            ctx.stroke();
        }

        ctx.fillStyle = this.color;
        ctx.fill();
        ctx.globalAlpha = 1.0;

        if (this.mass > 2 || selectedObject === this) {
            ctx.fillStyle = '#fff';
            ctx.font = '12px monospace';
            ctx.textAlign = 'center';
            ctx.fillText(this.name, this.x, this.y + this.radius + 15);
        }

        if (viewMode === 'TRAFFIC') {
            for (const moon of this.moons.values()) {
                moon.draw(ctx);
            }
        } else {
            // Linguistic Mode: Draw Word Moons
            let angle = 0;
            // Show top 20 tokens instead of 5
            const sortedTokens = [...this.tokens.entries()].sort((a, b) => b[1] - a[1]).slice(0, 20);
            
            if (sortedTokens.length > 0) {
                const maxCount = sortedTokens[0][1];
                
                for (const [token, count] of sortedTokens) {
                    // Relative ratio (0.0 to 1.0)
                    const ratio = count / maxCount;
                    
                    // 1. Radius: More frequent = Closer (Lower)
                    // Range: Planet Radius + 15px to + 85px
                    const r = this.radius + 15 + (1 - ratio) * 70;
                    
                    // 2. Speed: More frequent = Slower
                    // Inverse relationship
                    const orbitSpeed = (0.0005 + (1 - ratio) * 0.002) * 0.25;
                    const currentAngle = angle + (Date.now() * orbitSpeed);

                    const tx = this.x + Math.cos(currentAngle) * r;
                    const ty = this.y + Math.sin(currentAngle) * r;
                    
                    // 3. Size: More frequent = Larger
                    const fontSize = 8 + Math.floor(ratio * 14); // 8px to 22px
                    
                    ctx.fillStyle = '#00ffcc';
                    ctx.font = `${fontSize}px monospace`;
                    ctx.fillText(token, tx, ty);
                    
                    // Draw connection line shooting out
                    // Fade line for smaller/distant words
                    ctx.strokeStyle = `rgba(0, 255, 204, ${0.1 + ratio * 0.4})`;
                    ctx.beginPath();
                    ctx.moveTo(this.x, this.y);
                    ctx.lineTo(tx, ty);
                    ctx.stroke();
                    
                    // Distribute angles but add some randomness/jitter based on index to prevent stacking
                    angle += (Math.PI * 2) / sortedTokens.length;
                }
            }
        }
    }
}

class Particle {
    constructor(data) {
        this.data = data;
        if (data.flags & FLAGS.IS_REQUEST) {
            this.x = SUN_X();
            this.y = SUN_Y();
        } else {
            const spawnAngle = Math.random() * Math.PI * 2;
            const spawnDist = Math.max(width, height) * 0.8; 
            this.x = SUN_X() + Math.cos(spawnAngle) * spawnDist;
            this.y = SUN_Y() + Math.sin(spawnAngle) * spawnDist;
        }
        this.radius = Math.max(2, Math.min(5, data.size / 100));
        this.mass = 1;
        this.vx = 0;
        this.vy = 0;
        if (data.flags & FLAGS.IS_ERROR) this.color = '#ff0055';
        else if (data.flags & FLAGS.HAS_CONTENT) this.color = '#00ffcc';
        else if (data.flags & FLAGS.IS_REQUEST) this.color = '#ffff00';
        else this.color = '#5555ff';
    }

    update() {
        if (isPaused) return true;

        let planet = planets.get(this.data.rootDomainId);
        if (!planet && domainMap.has(this.data.rootDomainId)) {
            planet = new Planet(this.data.rootDomainId, domainMap.get(this.data.rootDomainId));
            planets.set(this.data.rootDomainId, planet);
        }

        if (planet) {
            let target = planet;
            if (this.data.isSubdomain && domainMap.has(this.data.domainId)) {
                 target = planet.getMoon(this.data.domainId, domainMap.get(this.data.domainId));
            }
            const dx = target.x - this.x;
            const dy = target.y - this.y;
            const dist = Math.sqrt(dx*dx + dy*dy);

            if (dist < target.radius + this.radius) {
                target.absorb(this);
                return false; 
            }
            this.vx += (dx / dist) * 0.2;
            this.vy += (dy / dist) * 0.2;
        } else {
             const dx = SUN_X() - this.x;
             const dy = SUN_Y() - this.y;
             this.vx += (dx / 1000) * 0.1;
             this.vy += (dy / 1000) * 0.1;
        }
        this.x += this.vx;
        this.y += this.vy;
        this.vx *= 0.96;
        this.vy *= 0.96;
        return true; 
    }

    draw(ctx) {
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = this.color;
        ctx.fill();
        if (Math.abs(this.vx) + Math.abs(this.vy) > 2) {
             ctx.beginPath();
             ctx.moveTo(this.x, this.y);
             ctx.lineTo(this.x - this.vx * 3, this.y - this.vy * 3);
             ctx.strokeStyle = this.color;
             ctx.stroke();
        }
    }
}

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

canvas.addEventListener('click', (e) => {
    const mx = e.clientX;
    const my = e.clientY;
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
    
    // Top Tokens
    const topTokens = getTopTokens(selectedObject.tokens, selectedObject.tokenTotal);
    inspTokens.innerHTML = topTokens.map(t => 
        `<div class="token-item"><span>${t.token}</span><span style="color:#00ffcc">${Math.floor(t.count)}</span></div>`
    ).join('');
    
    // Sample
    if (selectedObject.samples.length > 0) {
        inspSample.innerText = '"' + selectedObject.samples[selectedObject.samples.length - 1] + '..."';
    } else {
        inspSample.innerText = "No content samples yet.";
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
                    particles.push(new Particle(p));
                }
            }
        }
    }

    for (const [id, planet] of planets.entries()) {
        const alive = planet.update();
        if (!alive) {
            planets.delete(id); 
        } else {
            planet.draw(ctx);
        }
    }

    ctx.globalCompositeOperation = 'lighter';
    for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        const alive = p.update();
        if (!alive) {
            particles.splice(i, 1);
        } else {
            p.draw(ctx);
        }
    }
    ctx.globalCompositeOperation = 'source-over';

    ctx.beginPath();
    ctx.arc(SUN_X(), SUN_Y(), 20, 0, Math.PI * 2);
    ctx.fillStyle = '#fff';
    ctx.fill();
    
    drawTimeline();
    if (selectedObject && !isMinimized) updateHUD();

    statsEl.innerText = `FPS: 60 | P: ${particles.length} | PLANETS: ${planets.size}`;
    timeEl.innerText = isLive ? "LIVE (DELAYED)" : "REPLAY";
}

loop();
