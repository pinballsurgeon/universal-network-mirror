import { Planet, BlackHole } from '../engine/Entities.js';

export class UIManager {
    constructor() {
        // HUD
        this.statsEl = document.getElementById('stats');
        this.timeEl = document.getElementById('time-offset');

        // Controls
        this.btnPause = document.getElementById('btn-pause');
        this.btnLive = document.getElementById('btn-live');
        this.btnModeTraffic = document.getElementById('btn-mode-traffic');
        this.btnModeLinguistic = document.getElementById('btn-mode-linguistic');
        
        // Inspector
        this.inspector = document.getElementById('inspector');
        this.btnMinimize = document.getElementById('btn-minimize');
        this.inspName = document.getElementById('insp-name');
        this.btnBlackHole = document.getElementById('btn-black-hole');
        this.inspType = document.getElementById('insp-type');
        this.inspMass = document.getElementById('insp-mass');
        this.inspBloat = document.getElementById('insp-bloat');
        this.inspGrade = document.getElementById('insp-grade');
        this.inspInternal = document.getElementById('insp-internal');
        this.inspExternal = document.getElementById('insp-external');
        this.inspTokens = document.getElementById('insp-tokens');
        this.inspSample = document.getElementById('insp-sample');
        this.inspFingerprint = document.getElementById('insp-fingerprint');
        
        this.pieChartCount = document.getElementById('pie-chart-count');
        this.pieCtxCount = this.pieChartCount ? this.pieChartCount.getContext('2d') : null;
        this.pieChartSize = document.getElementById('pie-chart-size');
        this.pieCtxSize = this.pieChartSize ? this.pieChartSize.getContext('2d') : null;

        // Topic Inspector
        this.topicInspector = document.getElementById('topic-inspector');
        this.topicTitle = document.getElementById('topic-title');
        this.topicList = document.getElementById('topic-list');
        this.btnCloseTopic = document.getElementById('btn-close-topic');

        // Black Hole List
        this.btnBlackHoleList = document.getElementById('btn-blackhole-list');
        this.blackHoleInspector = document.getElementById('blackhole-inspector');
        this.blackHoleList = document.getElementById('blackhole-list');
        this.btnCloseBH = document.getElementById('btn-close-bh');
        this.btnToggleVoid = document.getElementById('btn-toggle-void');

        // Snapshot UI
        this.btnSnapshot = document.getElementById('btn-snapshot');
        this.inspSnapshots = document.getElementById('insp-snapshots');
        this.inspComparison = document.getElementById('insp-comparison');

        this.isMinimized = false;
        this.setupListeners();
    }

    setupListeners() {
        this.btnMinimize.addEventListener('click', () => this.toggleMinimize());
        this.btnCloseTopic.addEventListener('click', () => {
            this.topicInspector.style.display = 'none';
        });
        this.btnCloseBH.addEventListener('click', () => {
            this.blackHoleInspector.style.display = 'none';
        });
        
        // Handle expand/collapse of packet details
        if (this.topicList) {
            this.topicList.addEventListener('click', (e) => {
                const header = e.target.closest('.packet-header');
                if (header) {
                    const item = header.parentElement;
                    item.classList.toggle('expanded');
                }
            });
        }
    }

    bindControls(onPause, onLive, onModeTraffic, onModeLinguistic, onBlackHole, onShowBHList, onRestoreBH, onToggleVoid, onTakeSnapshot) {
        this.btnPause.addEventListener('click', onPause);
        this.btnLive.addEventListener('click', onLive);
        this.btnModeTraffic.addEventListener('click', onModeTraffic);
        this.btnModeLinguistic.addEventListener('click', onModeLinguistic);
        
        if (this.btnBlackHole && onBlackHole) {
            this.btnBlackHole.addEventListener('click', () => {
                onBlackHole();
            });
        }

        if (this.btnBlackHoleList && onShowBHList) {
            this.btnBlackHoleList.addEventListener('click', () => {
                onShowBHList();
            });
        }

        if (this.btnToggleVoid && onToggleVoid) {
            this.btnToggleVoid.addEventListener('click', () => {
                const isActive = this.btnToggleVoid.classList.contains('active');
                if (isActive) {
                    this.btnToggleVoid.classList.remove('active');
                    this.btnToggleVoid.innerText = "SHOW VOID";
                } else {
                    this.btnToggleVoid.classList.add('active');
                    this.btnToggleVoid.innerText = "HIDE VOID";
                }
                onToggleVoid(!isActive);
            });
        }

        if (this.btnSnapshot && onTakeSnapshot) {
            this.btnSnapshot.addEventListener('click', () => onTakeSnapshot());
        }

        this.onRestoreBH = onRestoreBH;
    }

    updateStats(fps, particles, planets) {
        this.statsEl.innerText = `FPS: ${fps} | P: ${particles} | PLANETS: ${planets}`;
    }

    updateTime(isLive) {
        this.timeEl.innerText = isLive ? "LIVE (DELAYED)" : "REPLAY";
    }

    setPauseState(isPaused) {
        this.btnPause.innerText = isPaused ? "RESUME" : "PAUSE";
        if (isPaused) this.btnLive.classList.remove('active');
    }

    setLiveState(isLive) {
        if (isLive) {
            this.btnLive.classList.add('active');
            this.btnPause.innerText = "PAUSE";
        } else {
            this.btnLive.classList.remove('active');
        }
    }

    setMode(mode) {
        if (mode === 'TRAFFIC') {
            this.btnModeTraffic.classList.add('active');
            this.btnModeLinguistic.classList.remove('active');
        } else {
            this.btnModeTraffic.classList.remove('active');
            this.btnModeLinguistic.classList.add('active');
        }
    }

    toggleMinimize() {
        this.isMinimized = !this.isMinimized;
        if (this.isMinimized) {
            this.inspector.classList.add('minimized');
            this.btnMinimize.innerText = '+';
        } else {
            this.inspector.classList.remove('minimized');
            this.btnMinimize.innerText = '_';
        }
    }

    showInspector(selectedObject) {
        this.inspector.style.display = 'block';
        this.isMinimized = false;
        this.inspector.classList.remove('minimized');
    }

    hideInspector() {
        this.inspector.style.display = 'none';
    }

    // Moved from viewer.js: updateHUD
    updateInspector(selectedObject, aggregator, projectionTick, historyManager) {
        if (!selectedObject) return;
        
        // Black Hole Button Logic
        if (selectedObject instanceof Planet && !(selectedObject instanceof BlackHole)) {
            this.btnBlackHole.style.display = 'block';
        } else {
            this.btnBlackHole.style.display = 'none';
        }

        this.inspName.innerText = selectedObject.name || "UNKNOWN";
        
        let typeStr = "UNKNOWN";
        if (selectedObject instanceof BlackHole) typeStr = "BLACK HOLE";
        else if (selectedObject instanceof Planet) typeStr = "PLANET (ROOT)";
        else if (selectedObject.isJunk) typeStr = "JUNK MOON";
        else typeStr = "MOON";
        
        this.inspType.innerText = typeStr;
        this.inspMass.innerText = Math.floor(selectedObject.mass);
        this.inspBloat.innerText = Math.floor(selectedObject.bloatScore);
        
        const score = selectedObject.bloatScore / (selectedObject.packetCount || 1);
        let grade = 'A';
        if (score > 10) grade = 'B';
        if (score > 50) grade = 'C';
        if (score > 100) grade = 'D';
        if (score > 500) grade = 'F';
        
        this.inspGrade.innerText = grade;
        this.inspGrade.className = 'stat-value ' + (grade === 'A' ? 'grade-A' : (grade === 'F' ? 'grade-F' : ''));
        
        // Traffic Source
        this.inspInternal.innerText = `${Math.floor(selectedObject.internalTraffic)} pkts / ${this.formatBytes(selectedObject.internalTrafficSize)}`;
        this.inspExternal.innerText = `${Math.floor(selectedObject.externalTraffic)} pkts / ${this.formatBytes(selectedObject.externalTrafficSize)}`;
        
        this.drawPieChart(this.pieCtxCount, selectedObject.internalTraffic, selectedObject.externalTraffic);
        this.drawPieChart(this.pieCtxSize, selectedObject.internalTrafficSize, selectedObject.externalTrafficSize);
        
        // Top Tokens
        const topTokens = aggregator.getTopTokens(selectedObject.tokens, selectedObject.tokenTotal);
        this.inspTokens.innerHTML = topTokens.map(t => 
            `<div class="token-item"><span>${t.token}</span><span style="color:#00ffcc">${Math.floor(t.count)}</span></div>`
        ).join('');
        
        // Sample
        if (selectedObject.samples.length > 0) {
            this.inspSample.innerText = '"' + selectedObject.samples[selectedObject.samples.length - 1] + '..."';
        } else {
            this.inspSample.innerText = "No content samples yet.";
        }

        // Fingerprint
        this.updateFingerprint(selectedObject, projectionTick, historyManager);

        // Snapshots
        this.updateSnapshots(selectedObject, historyManager);
    }

    updateSnapshots(selectedObject, historyManager) {
        if (!this.inspSnapshots) return;
        
        const snapshots = historyManager.getSnapshots(selectedObject.name);
        if (snapshots.length === 0) {
            this.inspSnapshots.innerHTML = '<div style="font-size:10px; color:#666;">No snapshots saved.</div>';
            this.inspComparison.style.display = 'none';
            return;
        }

        this.inspSnapshots.innerHTML = snapshots.slice().reverse().map((snap, i) => {
            return `
            <div class="token-item" style="cursor:pointer; border-bottom:1px dotted #333; padding:2px;" data-idx="${snapshots.length - 1 - i}">
                <span>${new Date(snap.ts).toLocaleTimeString()}</span>
                <span style="color:#aaa">${snap.label}</span>
            </div>`;
        }).join('');

        // Add Click Listeners for Comparison
        Array.from(this.inspSnapshots.children).forEach(el => {
            el.addEventListener('click', () => {
                const idx = parseInt(el.getAttribute('data-idx'));
                const snap = snapshots[idx];
                
                // Construct current state object mimicking snapshot structure
                // We need to pull current metrics from... selectedObject doesn't have raw metrics easily accessible in same format?
                // Actually, `updateFingerprint` gets them from `projectionTick`.
                // Let's use `selectedObject` derived stats or fetch from historyManager?
                // HistoryManager stores `domainStats` (cumulative).
                // Let's use `domainStats` as "Current Absolute".
                const currentStats = historyManager.getDomainHistory(selectedObject.name);
                
                if (currentStats) {
                    const diff = historyManager.compareSnapshots(snap, { metrics: currentStats.metrics });
                    this.showComparison(diff, snap);
                }
            });
        });
    }

    showComparison(diffData, snap) {
        if (!diffData || !this.inspComparison) return;
        this.inspComparison.style.display = 'block';
        
        const { diffs, similarity } = diffData;
        let html = `<div style="font-size:10px; margin-bottom:5px;">COMPARING TO: ${snap.label}</div>`;
        html += `<div style="font-size:11px; margin-bottom:5px; color:${similarity > 0.9 ? '#0f0' : '#ff0'};">SIMILARITY: ${(similarity * 100).toFixed(1)}%</div>`;
        
        // Show top 3 changers
        const topChanges = Object.entries(diffs)
            .sort((a, b) => Math.abs(b[1].pct) - Math.abs(a[1].pct))
            .slice(0, 3);
            
        topChanges.forEach(([k, d]) => {
            const color = d.diff > 0 ? '#0f0' : '#f00';
            const arrow = d.diff > 0 ? '↑' : '↓';
            html += `<div style="display:flex; justify-content:space-between; font-size:10px;">
                <span>${k.toUpperCase()}</span>
                <span style="color:${color}">${arrow} ${Math.abs(d.pct).toFixed(0)}%</span>
            </div>`;
        });
        
        this.inspComparison.innerHTML = html;
    }

    updateFingerprint(selectedObject, projectionTick, historyManager) {
        if (projectionTick && projectionTick.metrics.node_fingerprint) {
            const metricsData = projectionTick.metrics.node_fingerprint;
            const fps = metricsData.fingerPrints;
            const avg = metricsData.avgProfile;
            const totalNodes = fps.length;
            
            const fp = fps.find(f => f.domainId === selectedObject.domainId);
            const history = historyManager.getDomainHistory(selectedObject.name);
            
            if (fp) {
                const getOtherAvg = (key, myVal) => {
                    if (totalNodes <= 1) return 0;
                    return ((avg[key] * totalNodes) - myVal) / (totalNodes - 1);
                };

                const keys = [
                    { k: 'io_pkt', label: 'IO PKT' },
                    { k: 'io_vol', label: 'IO VOL' },
                    { k: 'upload', label: 'UPLOAD' },
                    { k: 'downld', label: 'DOWNLD' },
                    { k: 'density', label: 'DENSITY' },
                    { k: 'heavy', label: 'HEAVY' },
                    { k: 'sprawl', label: 'SPRAWL' },
                    { k: 'lingo', label: 'LINGO' }
                ];
                
                this.inspFingerprint.innerHTML = keys.map(obj => {
                    const myVal = fp.metrics[obj.k];
                    const otherAvg = getOtherAvg(obj.k, myVal);
                    const histVal = history ? history.metrics[obj.k] : 0;
                    const isMaxDev = (obj.k === fp.maxDevMetric);
                    
                    const histBar = history ? 
                        `<div style="position:absolute; top:0; left:0; height:100%; border:1px dashed rgba(255,255,255,0.6); width:${Math.min(100, histVal * 100)}%; z-index:2;"></div>` : '';

                    return `
                    <div class="finger-row">
                        <div class="finger-label" style="${isMaxDev ? 'color:#ff4444; font-weight:bold;' : ''}">${obj.label}</div>
                        <div class="finger-bar-bg" style="position:relative;">
                            <div style="position:absolute; top:0; left:0; height:100%; background:rgba(0, 255, 204, 0.2); width:${Math.min(100, otherAvg * 100)}%; z-index:1;"></div>
                            ${histBar}
                            <div class="finger-bar-fill ${isMaxDev ? 'high-dev' : ''}" style="width:${Math.min(100, Math.max(1, myVal * 100))}%"></div>
                        </div>
                        <div class="finger-val">${(myVal * 100).toFixed(0)}</div>
                    </div>`;
                }).join('');
            } else {
                this.inspFingerprint.innerHTML = '<div style="color:#666; font-size:10px; text-align:center;">Calculating...</div>';
            }
        }
    }

    // Helper
    formatBytes(bytes, decimals = 2) {
        if (!+bytes) return '0 B';
        const k = 1024;
        const dm = decimals < 0 ? 0 : decimals;
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
    }

    drawPieChart(ctx, internal, external) {
        if (!ctx) return;
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

    showBlackHoleInspector(planets) {
        this.blackHoleInspector.style.display = 'block';
        this.blackHoleList.innerHTML = '';
        
        const blackHoles = Array.from(planets.values()).filter(p => p instanceof BlackHole);
        
        if (blackHoles.length === 0) {
            this.blackHoleList.innerHTML = '<div style="color:#666; text-align:center; padding:20px;">No Active Black Holes.</div>';
            return;
        }

        blackHoles.forEach(bh => {
            const el = document.createElement('div');
            el.className = 'packet-item';
            el.innerHTML = `
                <div style="display:flex; justify-content:space-between; align-items:center;">
                    <span style="color:#ff4444; font-weight:bold;">${bh.name}</span>
                    <button class="btn-restore" style="background:#220000; border:1px solid #ff4444; color:#fff; cursor:pointer; font-size:10px;">RESTORE</button>
                </div>
            `;
            el.querySelector('.btn-restore').addEventListener('click', () => {
                if (this.onRestoreBH) this.onRestoreBH(bh);
                // Optimistically hide row
                el.style.opacity = '0.5';
                el.querySelector('.btn-restore').innerText = 'RESTORING...';
            });
            this.blackHoleList.appendChild(el);
        });
    }

    showTopicInspector(topic, packetBuffer, domainMap, FLAGS) {
        this.topicInspector.style.display = 'block';
        this.topicTitle.innerText = topic;
        this.topicList.innerHTML = '';

        // Filter logic moved here for UI update, but relies on data
        const relevant = [];
        // buffer must be passed or accessed. 
        // Let's assume packetBuffer is passed (the PhysicsEngine buffer or a History buffer)
        // viewer.js passed `buffer` which was the full list of particles.
        
        for (let i = packetBuffer.length - 1; i >= 0; i--) {
            const p = packetBuffer[i];
            if (p.tokens && p.tokens[topic]) {
                relevant.push(p);
                if (relevant.length >= 50) break;
            }
        }

        if (relevant.length === 0) {
            this.topicList.innerHTML = '<div style="color:#666; text-align:center; padding:20px;">No recent packets found for this topic.</div>';
            return;
        }

        this.topicList.innerHTML = relevant.map(p => {
            const date = new Date(p.time).toLocaleTimeString();
            const domain = domainMap.get(p.domainId) || "Unknown";
            const isReq = (p.flags & FLAGS.IS_REQUEST);
            const type = isReq ? "REQ" : "RES";
            
            let displayContent = p.sample || (p.tokens ? `Matched: ${p.tokens[topic]}x` : "No sample");
            
            if (p.text) {
                const idx = p.text.toLowerCase().indexOf(topic.toLowerCase());
                if (idx !== -1) {
                    const start = Math.max(0, idx - 100);
                    const end = Math.min(p.text.length, idx + topic.length + 100);
                    displayContent = (start > 0 ? "..." : "") + 
                                     p.text.substring(start, end) + 
                                     (end < p.text.length ? "..." : "");
                } else {
                    displayContent = p.text.substring(0, 300) + "..."; 
                }
            }

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
}
