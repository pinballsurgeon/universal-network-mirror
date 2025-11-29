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
        
        const timeSinceActive = Date.now() - this.lastActive;
        if (this.mass <= 0.5 && this.moons.size === 0 && timeSinceActive > 5000) return false;

        const densityFactor = this.bloatScore > 500 ? 2 : 1;
        const baseRadius = 10 + Math.log(Math.max(1, this.mass)) * 5 * densityFactor;
        const moonRadiusContribution = Math.sqrt(totalMoonMass) * 2;
        
        let targetRadius = Math.max(10, baseRadius + moonRadiusContribution);
        this.radius = this.radius * 0.95 + targetRadius * 0.05;
        
        return true;
    }

    draw(ctx, selectedObject, viewMode, aggregator, playbackTime, isPaused) {
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
                moon.draw(ctx, selectedObject);
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

        let planet = ctx.planets.get(this.data.rootDomainId);
        if (!planet && ctx.domainMap.has(this.data.rootDomainId)) {
            planet = new Planet(this.data.rootDomainId, ctx.domainMap.get(this.data.rootDomainId), ctx.sunX, ctx.sunY);
            ctx.planets.set(this.data.rootDomainId, planet);
        }

        if (planet) {
            let target = planet;
            if (this.data.isSubdomain && ctx.domainMap.has(this.data.domainId)) {
                 target = planet.getMoon(this.data.domainId, ctx.domainMap.get(this.data.domainId));
            }
            const dx = target.x - this.x;
            const dy = target.y - this.y;
            const dist = Math.sqrt(dx*dx + dy*dy);

            if (dist < target.radius + this.radius) {
                target.absorb(this, ctx.aggregator);
                return false; 
            }
            this.vx += (dx / dist) * 0.2;
            this.vy += (dy / dist) * 0.2;
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
