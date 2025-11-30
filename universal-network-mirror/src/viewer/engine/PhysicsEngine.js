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
        // console.log(`PhysicsEngine: Added particle to buffer. Size: ${this.buffer.length}`);
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
                
                if (this.particles.length < MAX_PARTICLES) {
                    this.particles.push(new Particle(p, this.sunX, this.sunY, this.width, this.height));
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
