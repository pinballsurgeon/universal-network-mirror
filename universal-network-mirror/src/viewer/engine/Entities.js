import { FLAGS } from '../../common/constants.js';

// Helper for decay logic
function decayStats(entity) {
    const DECAY_RATE_TOKENS = 0.998;
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

// Helper for drawing Fingerprint Equalizer
function drawEqualizer(ctx, x, y, radius, fp) {
    if (!fp) return;
    
    // 8 Metrics to visualize around the planet
    const metrics = [
        { val: fp.metrics.io_pkt, dev: fp.deviations.io_pkt_dev },
        { val: fp.metrics.io_vol, dev: fp.deviations.io_vol_dev },
        { val: fp.metrics.upload, dev: fp.deviations.upload_dev },
        { val: fp.metrics.downld, dev: fp.deviations.downld_dev },
        { val: fp.metrics.density, dev: fp.deviations.density_dev },
        { val: fp.metrics.heavy, dev: fp.deviations.heavy_dev },
        { val: fp.metrics.sprawl, dev: fp.deviations.sprawl_dev },
        { val: fp.metrics.lingo, dev: fp.deviations.lingo_dev }
    ];

    const segmentAngle = (Math.PI * 2) / metrics.length;

    metrics.forEach((m, i) => {
        const angle = i * segmentAngle;
        
        // Length based on value (0..1) -> 4px..30px
        const barLen = 4 + (m.val * 26);
        
        // Color: Red if deviation > 0.8 (significant in 0-1 space), else Cyan
        const color = (Math.abs(m.dev) > 0.8) ? '#ff4444' : '#00ffcc';
        
        const startR = radius + 5;
        const endR = startR + barLen;
        
        const bx = x + Math.cos(angle) * startR;
        const by = y + Math.sin(angle) * startR;
        const ex = x + Math.cos(angle) * endR;
        const ey = y + Math.sin(angle) * endR;
        
        ctx.beginPath();
        ctx.moveTo(bx, by);
        ctx.lineTo(ex, ey);
        ctx.strokeStyle = color;
        ctx.lineWidth = 3;
        ctx.lineCap = 'round';
        ctx.stroke();
    });
}

export class Artifact {
    constructor(signal, parent) {
        this.type = signal.type; // UUID, WEIRD_VAR, DEV_KEYWORD
        this.value = signal.value;
        this.parent = parent;
        this.angle = Math.random() * Math.PI * 2;
        this.distance = parent.radius + 15 + Math.random() * 10;
        this.speed = (Math.random() > 0.5 ? 1 : -1) * (0.01 + Math.random() * 0.02);
        this.color = this.type === 'UUID' ? '#ff00ff' : (this.type === 'WEIRD_VAR' ? '#ffff00' : '#00ffff');
        this.creationTime = Date.now();
    }

    update(ctx) {
        if (ctx.isPaused) return true;
        this.angle += this.speed;
        this.x = this.parent.x + Math.cos(this.angle) * this.distance;
        this.y = this.parent.y + Math.sin(this.angle) * this.distance;
        return true;
    }

    draw(ctx) {
        ctx.beginPath();
        // Draw as a small triangle or diamond
        const s = 3; 
        ctx.moveTo(this.x, this.y - s);
        ctx.lineTo(this.x + s, this.y + s);
        ctx.lineTo(this.x - s, this.y + s);
        ctx.closePath();
        ctx.fillStyle = this.color;
        ctx.fill();
    }
}

export class Moon {
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
        this.tokenState = new Map(); // Stores visual state for smooth transitions
        this.tokenTotal = 0;
        this.samples = [];
        
        this.angle = Math.random() * Math.PI * 2;
        this.distance = 40 + Math.random() * 40; 
        this.speed = (Math.random() > 0.5 ? 1 : -1) * (0.02 + Math.random() * 0.03);
        
        this.x = 0;
        this.y = 0;
        this.lastActive = Date.now();
    }

    absorb(particle, aggregator) {
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
            const added = aggregator.mergeTokens(this.tokens, particle.data.tokens);
            this.tokenTotal += added;
        }
        
        if (particle.data.sample) {
            this.samples.push(particle.data.sample);
            if (this.samples.length > 5) this.samples.shift();
        }

        // Roll up to Parent
        this.parent.ingestStats(particle.data, aggregator);

        this.lastActive = Date.now();
    }

    update(ctx) {
        // ctx = { isPaused }
        if (ctx.isPaused) return true;

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

    draw(ctx, selectedObject) {
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

export class Planet {
    constructor(domainId, name, sunX, sunY) {
        this.domainId = domainId;
        this.name = this.cleanName(name);
        this.mass = 10; 
        this.radius = 10;
        this.bloatScore = 0;
        this.packetCount = 0;
        this.moons = new Map(); 
        this.artifacts = []; // Developer Signals
        
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
        
        this.sunX = sunX; // Store reference or value? Value is safer but assumes static sun unless updated
        this.sunY = sunY;
        
        this.x = sunX + Math.cos(this.angle) * this.distance;
        this.y = sunY + Math.sin(this.angle) * this.distance;
        
        this.color = `hsl(${Math.random() * 360}, 70%, 50%)`;
        this.lastActive = Date.now();
        this.gravity = 0.2; // Default gravity
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

    ingestStats(data, aggregator) {
        if (data.flags & FLAGS.IS_REQUEST) {
            this.internalTraffic++;
            this.internalTrafficSize += data.size || 0;
        } else {
            this.externalTraffic++;
            this.externalTrafficSize += data.size || 0;
        }

        if (data.tokens) {
            const added = aggregator.mergeTokens(this.tokens, data.tokens);
            this.tokenTotal += added;
        }
        
        if (data.sample) {
            this.samples.push(data.sample);
            if (this.samples.length > 5) this.samples.shift();
        }
    }

    absorb(particle, aggregator) {
        this.mass += 0.5;
        this.packetCount++;
        
        this.ingestStats(particle.data, aggregator);

        if (particle.data.bloatScore) this.bloatScore += particle.data.bloatScore;
        
        // Spawn Artifacts from Dev Signals
        if (particle.data.devSignals && particle.data.devSignals.length > 0) {
            particle.data.devSignals.forEach(signal => {
                if (this.artifacts.length < 50) { // Limit clutter
                    this.artifacts.push(new Artifact(signal, this));
                }
            });
        }

        this.lastActive = Date.now();
    }

    update(ctx) {
        // ctx = { isPaused, sunX, sunY }
        decayStats(this);
        if (ctx.isPaused) return true;

        // Physics / Solar System Logic (Same for both modes)
        this.angle += this.speed;
        this.x = ctx.sunX + Math.cos(this.angle) * this.distance;
        this.y = ctx.sunY + Math.sin(this.angle) * this.distance;

        if (this.mass > 0) {
            this.mass *= 0.999;
            this.mass -= 0.001;
        }

        let totalMoonMass = 0;
        for (const [id, moon] of this.moons.entries()) {
            const alive = moon.update(ctx);
            if (!alive) {
                this.moons.delete(id); 
            } else {
                totalMoonMass += moon.mass;
            }
        }

        // Update Artifacts
        for (const art of this.artifacts) {
            art.update(ctx);
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

    draw(ctx, selectedObject, viewMode, aggregator, playbackTime, isPaused, fingerprint) {
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

        // Anomaly Color Override - THRESHOLD INCREASED TO 2.5
        if (fingerprint && fingerprint.weirdness > 2.5) {
            ctx.fillStyle = '#ff4444'; // Red for anomalous nodes
        } else {
            ctx.fillStyle = this.color;
        }
        
        ctx.fill();
        ctx.globalAlpha = 1.0;

        // Draw Fingerprint Equalizer
        if (fingerprint) {
            drawEqualizer(ctx, this.x, this.y, this.radius, fingerprint);
        }

        if (this.mass > 2 || selectedObject === this) {
            ctx.fillStyle = '#fff';
            ctx.font = '12px monospace';
            ctx.textAlign = 'center';
            ctx.fillText(this.name, this.x, this.y + this.radius + 15);
        }

        if (viewMode === 'TRAFFIC') {
            for (const moon of this.moons.values()) {
                moon.draw(ctx, selectedObject);
            }
            for (const art of this.artifacts) {
                art.draw(ctx);
            }
        } else {
            // --- NEW LINGUISTIC MODE: SEMANTIC ATMOSPHERE ---
            // "Semantic Cloud" - Words float organically around the planet.
            // No lines, no slots. Pure size/opacity hierarchy.

            if (!this.tokenState) this.tokenState = new Map();

            // 1. Update Targets (1Hz throttle)
            if (!isPaused && (playbackTime - (this.lastTokenUpdate || 0) > 1000)) {
                this.lastTokenUpdate = playbackTime;
                const targets = aggregator.getPlanetVisualTargets(
                    this.domainId, this.tokens, this.tokenTotal, playbackTime
                );
                
                // Mark active tokens
                const active = new Set();
                targets.forEach((t, i) => {
                    active.add(t.token);
                    if (!this.tokenState.has(t.token)) {
                        // Init new word particle
                        // Random placement in a cloud band
                        const angle = Math.random() * Math.PI * 2;
                        // Radius distribution: Top words closer? Or random?
                        // User said "growing and smooth". 
                        // Let's spawn them randomly in the "atmosphere" (50px to 150px out)
                        const radius = this.radius + 40 + Math.random() * 100;
                        
                        this.tokenState.set(t.token, {
                            currentStrength: 0,
                            radius: radius,
                            angle: angle,
                            speed: (Math.random() > 0.5 ? 1 : -1) * (0.000005 + Math.random() * 0.00001), // Very slow drift
                            targetStrength: t.strength
                        });
                    } else {
                        // Update target strength
                        const s = this.tokenState.get(t.token);
                        s.targetStrength = t.strength;
                    }
                });

                // Mark dead tokens
                for (const [k, v] of this.tokenState) {
                    if (!active.has(k)) {
                        v.targetStrength = 0; // Fade out
                    }
                }
            }

            // 2. Render Loop
            for (const [token, state] of this.tokenState) {
                // Smoothly lerp strength - SLOWER for more "rolling window" feel
                state.currentStrength = state.currentStrength * 0.98 + (state.targetStrength || 0) * 0.02;

                // Cleanup invisible
                if (state.currentStrength < 0.01 && state.targetStrength === 0) {
                    this.tokenState.delete(token);
                    continue;
                }

                // Physics: Slow Drift
                if (!isPaused) {
                    // Drift angle based on speed
                    state.angle += state.speed * 16; // 16ms frame approx
                }

                const tx = this.x + Math.cos(state.angle) * state.radius;
                const ty = this.y + Math.sin(state.angle) * state.radius;

                // Visuals based on strength
                // Big words = Big score. Small words = Small score.
                // Adjusted curve for "frequency based size"
                const size = 8 + Math.pow(state.currentStrength, 0.7) * 24; // 8px to ~32px
                // Alpha strictly tied to frequency, smooth gradient appearance
                const alpha = Math.min(1, Math.pow(state.currentStrength, 0.6)); 

                ctx.font = `${Math.floor(size)}px monospace`;
                ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                
                // Optional: Draw faint background glow for big words to make them pop?
                // Or just the text. User said "clean".
                ctx.fillText(token, tx, ty);
            }
        }
    }
}

export class BlackHole extends Planet {
    constructor(planet) {
        super(planet.domainId, planet.name, planet.sunX, planet.sunY);
        // Transfer stats
        this.mass = planet.mass * 2; // Increased mass
        this.radius = planet.radius;
        this.angle = planet.angle;
        this.distance = planet.distance;
        this.speed = planet.speed;
        this.moons = planet.moons;
        this.artifacts = planet.artifacts;
        this.internalTraffic = planet.internalTraffic;
        this.externalTraffic = planet.externalTraffic;
        
        this.gravity = 2.0; // 10x gravity
        this.accretionDisk = [];
    }

    update(ctx) {
        super.update(ctx);
        
        // Accretion Disk Animation
        if (Math.random() > 0.5) {
            this.accretionDisk.push({
                angle: Math.random() * Math.PI * 2,
                dist: this.radius + Math.random() * 20,
                speed: 0.1 + Math.random() * 0.1,
                size: Math.random() * 2
            });
        }
        
        this.accretionDisk.forEach(p => {
            p.angle += p.speed;
            p.dist *= 0.99; // Spiral in
        });
        
        this.accretionDisk = this.accretionDisk.filter(p => p.dist > this.radius);
        
        return true;
    }

    draw(ctx, selectedObject, viewMode, aggregator, playbackTime, isPaused, fingerprint) {
        // Event Horizon
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = '#000000';
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.stroke();
        
        // Accretion Disk
        ctx.fillStyle = '#ff4400';
        this.accretionDisk.forEach(p => {
            const px = this.x + Math.cos(p.angle) * p.dist;
            const py = this.y + Math.sin(p.angle) * p.dist;
            ctx.beginPath();
            ctx.arc(px, py, p.size, 0, Math.PI * 2);
            ctx.fill();
        });

        // Label
        if (selectedObject === this) {
            ctx.fillStyle = '#ff0000';
            ctx.font = 'bold 12px monospace';
            ctx.textAlign = 'center';
            ctx.fillText("TERMINATED: " + this.name, this.x, this.y + this.radius + 20);
        }
    }

    absorb(particle, aggregator) {
        // Destruction
        return; 
    }
}

export class Particle {
    constructor(data, sunX, sunY, width, height) {
        this.data = data;
        if (data.flags & FLAGS.IS_REQUEST) {
            this.x = sunX;
            this.y = sunY;
        } else {
            const spawnAngle = Math.random() * Math.PI * 2;
            const spawnDist = Math.max(width, height) * 0.8; 
            this.x = sunX + Math.cos(spawnAngle) * spawnDist;
            this.y = sunY + Math.sin(spawnAngle) * spawnDist;
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

    update(ctx) {
        // ctx = { isPaused, planets, domainMap, sunX, sunY, aggregator }
        if (ctx.isPaused) return true;

        // console.log(`Particle update: Domain ${this.data.rootDomainId}`);

        let planet = ctx.planets.get(this.data.rootDomainId);
        if (!planet && ctx.domainMap.has(this.data.rootDomainId)) {
            planet = new Planet(this.data.rootDomainId, ctx.domainMap.get(this.data.rootDomainId), ctx.sunX, ctx.sunY);
            ctx.planets.set(this.data.rootDomainId, planet);
        }

        if (planet) {
            let target = planet;
            if (this.data.isSubdomain && ctx.domainMap.has(this.data.domainId) && !(planet instanceof BlackHole)) {
                 target = planet.getMoon(this.data.domainId, ctx.domainMap.get(this.data.domainId));
            }
            const dx = target.x - this.x;
            const dy = target.y - this.y;
            const dist = Math.sqrt(dx*dx + dy*dy);

            if (dist < target.radius + this.radius) {
                target.absorb(this, ctx.aggregator);
                return false; 
            }
            
            const gravity = target.gravity || 0.2;
            this.vx += (dx / dist) * gravity;
            this.vy += (dy / dist) * gravity;
        } else {
             const dx = ctx.sunX - this.x;
             const dy = ctx.sunY - this.y;
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
