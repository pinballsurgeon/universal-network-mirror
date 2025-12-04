import { BlackHole } from './Entities.js';

export class RenderEngine {
    constructor(canvas, historyManager) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.historyManager = historyManager;
        this.width = canvas.width;
        this.height = canvas.height;
        this.TIMELINE_HEIGHT = 80;
        this.quality = 'HIGH'; // HIGH, MEDIUM, LOW
    }

    setQuality(q) {
        this.quality = q;
        // console.log(`[RenderEngine] Quality set to ${q}`);
    }

    resize(width, height) {
        this.width = this.canvas.width = width;
        this.height = this.canvas.height = height;
    }

    clear() {
        this.ctx.fillStyle = 'rgba(5, 5, 5, 0.2)'; 
        this.ctx.fillRect(0, 0, this.width, this.height);
    }

    drawSun(x, y) {
        this.ctx.beginPath();
        this.ctx.arc(x, y, 20, 0, Math.PI * 2);
        this.ctx.fillStyle = '#fff';
        this.ctx.fill();
    }

    drawTimeline(playbackTime, isLive, historyStartTime, historyEndTime) {
        const y = this.height - this.TIMELINE_HEIGHT;
        
        // Background
        this.ctx.fillStyle = 'rgba(10, 20, 30, 0.9)';
        this.ctx.fillRect(0, y, this.width, this.TIMELINE_HEIGHT);
        
        const totalDuration = historyEndTime - historyStartTime;
        if (totalDuration <= 0) return;

        // --- STORYLINE SCRUBBER (2026 UX) ---
        // Visualizes density AND semantic mode
        
        const storyline = this.historyManager.getStoryline(100); // 100 bins
        const binWidth = this.width / storyline.length;
        
        const MODE_COLORS = {
            'DEEP_WORK': '#00ffcc',
            'DOOMSCROLLING': '#ff0055',
            'MEDIA_IMMERSION': '#aa00ff',
            'DEV_MODE': '#ffff00',
            'UNKNOWN': '#444444'
        };

        storyline.forEach((segment, i) => {
            if (!segment) return;
            
            const h = Math.max(2, segment.density * (this.TIMELINE_HEIGHT - 10));
            const bx = i * binWidth;
            const by = this.height - h;
            
            // Mode Color
            this.ctx.fillStyle = MODE_COLORS[segment.mode] || MODE_COLORS.UNKNOWN;
            this.ctx.fillRect(bx, by, binWidth - 1, h);
            
            // Draw Mode Label if it changes (Transition)
            if (i > 0 && storyline[i-1] && storyline[i-1].mode !== segment.mode && segment.density > 0.1) {
                this.ctx.fillStyle = '#fff';
                this.ctx.font = '9px monospace';
                this.ctx.fillText(segment.mode, bx, this.height - this.TIMELINE_HEIGHT - 5);
            }
        });

        // Playhead
        const playheadX = ((playbackTime - historyStartTime) / totalDuration) * this.width;
        
        // Scrubber Line
        this.ctx.strokeStyle = isLive ? '#00ffcc' : '#ffff00';
        this.ctx.lineWidth = 2;
        this.ctx.beginPath();
        this.ctx.moveTo(playheadX, y);
        this.ctx.lineTo(playheadX, this.height);
        this.ctx.stroke();
        
        // Time Label
        this.ctx.fillStyle = '#fff';
        this.ctx.font = '10px monospace';
        this.ctx.fillText(new Date(playbackTime).toLocaleTimeString(), playheadX + 5, y + 15);
        
        // Zoom/Range Indicators (Mockup for V2)
        this.ctx.fillStyle = '#555';
        this.ctx.fillText("ZOOM: 1x [Full History]", 10, y + 15);
    }

    drawScene(physicsState, selectedObject, viewMode, aggregator, playbackTime, isPaused, projectionTick, showBlackHoles = true) {
        const { planets, particles, sunX, sunY } = physicsState;

        // Draw Planets
        for (const [id, planet] of planets.entries()) {
            if (!showBlackHoles && planet instanceof BlackHole) {
                continue;
            }

            // Find Fingerprint for visualizer (Equalizer)
            let fp = null;
            if (this.quality !== 'LOW' && projectionTick && projectionTick.metrics.node_fingerprint) {
                const fps = projectionTick.metrics.node_fingerprint.fingerPrints;
                fp = fps.find(f => f.domainId === id);
            }
            
            // Pass quality to planet.draw
            planet.draw(this.ctx, selectedObject, viewMode, aggregator, playbackTime, isPaused, fp, this.quality);
        }

        // Draw Particles
        if (this.quality === 'HIGH') {
            this.ctx.globalCompositeOperation = 'lighter';
        }
        for (const p of particles) {
            p.draw(this.ctx);
        }
        this.ctx.globalCompositeOperation = 'source-over';

        this.drawSun(sunX, sunY);
        
        // --- HUD OVERLAY (Current Mode) ---
        if (projectionTick && projectionTick.prediction) {
            const { mode, confidence, color } = projectionTick.prediction;
            
            // Top Center Badge
            this.ctx.textAlign = 'center';
            this.ctx.font = 'bold 16px monospace';
            
            // Glow
            this.ctx.shadowColor = color;
            this.ctx.shadowBlur = 10;
            this.ctx.fillStyle = color;
            this.ctx.fillText(`[ ${mode} ]`, this.width / 2, 30);
            
            this.ctx.font = '12px monospace';
            this.ctx.fillStyle = '#aaa';
            this.ctx.fillText(`CONFIDENCE: ${(confidence * 100).toFixed(0)}%`, this.width / 2, 50);
            
            this.ctx.shadowBlur = 0; // Reset
        }
    }
}
