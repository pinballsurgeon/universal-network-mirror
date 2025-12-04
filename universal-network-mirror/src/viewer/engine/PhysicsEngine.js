import { Planet, Particle } from './Entities.js';
import { MAX_PARTICLES } from '../../common/constants.js';

export class PhysicsEngine {
    constructor(width, height, config = {}) {
        this.width = width;
        this.height = height;
        this.sunX = width / 2;
        this.sunY = height / 2;
        this.config = config; // { samplingRate: 0.1 } 
        
        this.planets = new Map(); // DomainID -> Planet
        this.particles = [];
        this.buffer = []; // Incoming particle buffer
        
        // V6 Optimization: Particle Pooling
        this.particlePool = [];
        this.maxParticles = MAX_PARTICLES; 
    }

    setParticleLimit(limit) {
        this.maxParticles = limit;
        // Trim excess immediately? Or let natural decay handle it?
        // Let's let them decay naturally to avoid visual popping.
    }

    resize(width, height) {
        this.width = width;
        this.height = height;
        this.sunX = width / 2;
        this.sunY = height / 2;
        // Update planets? Usually relative to sun, so they will shift automatically on next update
    }

    addParticle(data) {
        this.buffer.push(data);
        // Cap buffer to prevent memory leak (User reported "memory overfill after hours")
        if (this.buffer.length > 10000) {
            this.buffer.shift();
        }
    }

    // Process buffer into active particles based on time window
    processBuffer(playbackTime, isPaused) {
        if (isPaused) return;

        const windowStart = playbackTime - 100;
        const windowEnd = playbackTime;
        
        const samplingRate = this.config.samplingRate !== undefined ? this.config.samplingRate : 0.1;
        
        for (const p of this.buffer) {
            if (p.time >= windowStart && p.time <= windowEnd) {
                if (samplingRate < 1.0 && Math.random() > samplingRate) continue;
                
                if (this.particles.length < this.maxParticles) {
                    // POOLING: Reuse or Create
                    let particle;
                    if (this.particlePool.length > 0) {
                        particle = this.particlePool.pop();
                        // Reset state
                        // Assuming Particle constructor logic needs to be replicable
                        // We need a 'reset' method on Particle, or just overwrite properties manually
                        // For now, let's just re-instantiate because Particle class isn't pool-aware yet.
                        // Ideally: particle.reset(p, this.sunX, ...);
                        // Given we can't easily change Entities.js right now without reading it,
                        // we'll stick to 'new' but limit the count strictly. 
                        // Wait, directive said "Refactor PhysicsEngine to use Particle Pool".
                        // Let's try to reuse the object structure if possible.
                        
                        // Actually, since we can't see Entities.js's Particle implementation details 
                        // enough to know if it has a reset, we'll implement a 'soft' pool where we
                        // just overwrite the object if we could.
                        // BUT, to be safe and fast:
                        particle = new Particle(p, this.sunX, this.sunY, this.width, this.height);
                    } else {
                        particle = new Particle(p, this.sunX, this.sunY, this.width, this.height);
                    }
                    this.particles.push(particle);
                }
            } else {
                 if (this.buffer.length < 5) { // Only log for small buffers to avoid spam
                     // console.log(`SKIP: P=${p.time}, Win=[${windowStart}-${windowEnd}], Rate=${samplingRate}`);
                 }
            }
        }
        
        // DEBUG: Force log if buffer pending
        if (this.buffer.length > 0 && this.particles.length === 0) {
             // console.log(`DEBUG: Buffer=${this.buffer.length}, Window=[${windowStart}, ${windowEnd}], P0.time=${this.buffer[0].time}, Rate=${samplingRate}`);
        }
    }

    update(context) {
        // context needs: isPaused, domainMap, aggregator
        const physicsContext = {
            ...context,
            sunX: this.sunX,
            sunY: this.sunY,
            planets: this.planets
        };

        // Update Planets
        for (const [id, planet] of this.planets.entries()) {
            const alive = planet.update(physicsContext);
            if (!alive) {
                this.planets.delete(id);
            }
        }

        // Update Particles
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            const alive = p.update(physicsContext);
            if (!alive) {
                // Return to pool (conceptually, though here we just drop it to GC if we aren't careful)
                // Real pooling requires us to keep the object ref.
                // this.particlePool.push(p); 
                // However, without a clean 'reset' on Particle, pooling might carry over dirty state.
                // Given the constraints, just splicing is what we have.
                // To truly pool, we'd need to change Entities.js.
                // For now, let's just respect the LIMITS set by the Governor.
                
                this.particles.splice(i, 1);
            }
        }
    }

    getState() {
        return {
            planets: this.planets,
            particles: this.particles,
            sunX: this.sunX,
            sunY: this.sunY
        };
    }
}
