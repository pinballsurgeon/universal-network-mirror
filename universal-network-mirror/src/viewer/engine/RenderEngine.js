export class RenderEngine {
    constructor(canvas, historyManager) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.historyManager = historyManager;
        this.width = canvas.width;
        this.height = canvas.height;
        this.TIMELINE_HEIGHT = 80;
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

        // --- ACTIVITY HEATMAP (Adobe Premiere Style) ---
        // Use historyManager to get aggregated activity density
        // We map the *entire* history buffer to the screen width
        
        const heatmap = this.historyManager.getActivityHeatmap(100); // 100 bins
        const binWidth = this.width / heatmap.length;
        
        this.ctx.beginPath();
        this.ctx.moveTo(0, this.height);
        
        heatmap.forEach((val, i) => {
            const h = val * (this.TIMELINE_HEIGHT - 10);
            const bx = i * binWidth;
            const by = this.height - h;
            
            this.ctx.fillStyle = `hsl(${180 + val * 60}, 100%, 50%)`; // Cyan to Blue/Purple
            this.ctx.fillRect(bx, by, binWidth - 1, h);
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

    drawScene(physicsState, selectedObject, viewMode, aggregator, playbackTime, isPaused, projectionTick) {
        const { planets, particles, sunX, sunY } = physicsState;

        // Draw Planets
        for (const [id, planet] of planets.entries()) {
            // Find Fingerprint for visualizer (Equalizer)
            let fp = null;
            if (projectionTick && projectionTick.metrics.node_fingerprint) {
                const fps = projectionTick.metrics.node_fingerprint.fingerPrints;
                fp = fps.find(f => f.domainId === id);
            }
            
            planet.draw(this.ctx, selectedObject, viewMode, aggregator, playbackTime, isPaused, fp);
        }

        // Draw Particles
        this.ctx.globalCompositeOperation = 'lighter';
        for (const p of particles) {
            p.draw(this.ctx);
        }
        this.ctx.globalCompositeOperation = 'source-over';

        this.drawSun(sunX, sunY);
    }
}
