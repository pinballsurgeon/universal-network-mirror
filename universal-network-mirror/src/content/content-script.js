// content-script.js - Part of "The Devourer" (V5: Streaming Vacuum)
// "Ground Level Lowest Granularity Information Science Based Absoluteness"

const MSG_CAPTURE_PAYLOAD = 'CAPTURE_PAYLOAD';

// --- STATE ---
const observedRoots = new WeakSet();
let processingQueue = [];
let extractionTimer = null;

// --- STREAMING VACUUM CLASS ---
class TextStreamer {
    constructor() {
        this.chunkSize = 10000; // 10KB chunks
        this.buffer = "";
        this.headlineBuffer = "";
        this.tokenBuffer = {}; // Accumulate tokens for the current chunk
    }

    addText(text, isHeadline) {
        if (!text) return;
        
        if (isHeadline) {
            this.headlineBuffer += text + " ";
            this.addTokens(text, 10); // Boost headlines
        } else {
            this.buffer += text + " ";
            this.addTokens(text, 1);
        }

        // Flush if buffer full
        if (this.buffer.length + this.headlineBuffer.length >= this.chunkSize) {
            this.flush();
        }
    }

    addTokens(text, weight) {
        // Fast tokenization (regex is expensive, simple split is better for streaming)
        // We filter noise later in backend or simple regex here
        const words = text.toLowerCase().match(/[a-z]{3,}/g);
        if (words) {
            for (const w of words) {
                this.tokenBuffer[w] = (this.tokenBuffer[w] || 0) + weight;
            }
        }
    }

    flush() {
        if (this.buffer.length === 0 && this.headlineBuffer.length === 0) return;

        const fullChunk = (this.headlineBuffer + "\n" + this.buffer).trim();
        
        // Developer Signal Detection (On Chunk)
        const devSignals = this.scanDevSignals(fullChunk);

        try {
            chrome.runtime.sendMessage({
                type: MSG_CAPTURE_PAYLOAD,
                payload: "Deep Harvest Stream",
                tokens: this.tokenBuffer, // Send tokens relevant to THIS chunk
                text: fullChunk,
                devSignals: devSignals,
                meta: {
                    isIncremental: true,
                    timestamp: Date.now(),
                    deep: true,
                    streamId: Math.random().toString(36).substring(7)
                }
            });
        } catch (e) {
            // Extension context invalidated? Stop processing.
            console.warn("Stream interrupted:", e);
        }

        // Reset
        this.buffer = "";
        this.headlineBuffer = "";
        this.tokenBuffer = {};
    }

    scanDevSignals(text) {
        const signals = [];
        // 1. Suspicious Variable Names (repeated chars)
        const suspiciousVars = text.match(/\b\w*([a-zA-Z])\1{3,}\w*\b/g);
        if (suspiciousVars) {
            suspiciousVars.forEach(v => signals.push({ type: 'WEIRD_VAR', value: v }));
        }
        // 2. UUIDs
        const uuids = text.match(/\b[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}\b/g);
        if (uuids) {
            uuids.forEach(u => signals.push({ type: 'UUID', value: u }));
        }
        // 3. Keywords
        const devKeywords = text.match(/\b(TODO|FIXME|DEBUG|console\.log|var_dump|traceback)\b/gi);
        if (devKeywords) {
            devKeywords.forEach(k => signals.push({ type: 'DEV_KEYWORD', value: k }));
        }
        return signals;
    }
}

const streamer = new TextStreamer();

// --- DEEP FARMING LOGIC ---

function isNoise(tagName) {
    return ['SCRIPT', 'STYLE', 'NOSCRIPT', 'IFRAME', 'OBJECT', 'EMBED', 'SVG', 'IMG', 'VIDEO', 'CANVAS', 'MAP', 'AREA'].includes(tagName);
}

// Recursive Harvester that pierces Shadow DOMs and Feeds Streamer
function deepHarvest(node) {
    if (!node) return;

    // 1. Text Node
    if (node.nodeType === Node.TEXT_NODE) {
        const txt = node.nodeValue.trim();
        if (txt.length >= 2) {
            const p = node.parentNode;
            if (p) {
                const tag = p.tagName;
                if (!isNoise(tag)) {
                    const isHeadline = ['H1','H2','H3','STRONG','B','TITLE'].includes(tag);
                    streamer.addText(txt, isHeadline);
                }
            }
        }
        return;
    }

    // 2. Element Node
    if (node.nodeType === Node.ELEMENT_NODE) {
        if (isNoise(node.tagName)) return;

        // SHADOW DOM PIERCING
        if (node.shadowRoot && !observedRoots.has(node.shadowRoot)) {
            attachObserver(node.shadowRoot);
            deepHarvest(node.shadowRoot);
        }
    }

    // 3. Recurse
    let child = node.firstChild;
    while (child) {
        deepHarvest(child);
        child = child.nextSibling;
    }
}

function processQueue() {
    if (processingQueue.length === 0) return;

    const uniqueNodes = new Set(processingQueue);
    processingQueue = [];

    // Process nodes
    uniqueNodes.forEach(node => {
        deepHarvest(node);
    });

    // Flush any remaining data in the streamer
    streamer.flush();
}

// --- OBSERVER INFRASTRUCTURE ---

function attachObserver(targetNode) {
    if (observedRoots.has(targetNode)) return;
    observedRoots.add(targetNode);

    const observer = new MutationObserver((mutations) => {
        let hasWork = false;
        mutations.forEach(m => {
            if (m.type === 'childList') {
                m.addedNodes.forEach(node => {
                    processingQueue.push(node);
                    hasWork = true;
                });
            } else if (m.type === 'characterData') {
                processingQueue.push(m.target); 
                hasWork = true;
            }
        });

        if (hasWork) {
            clearTimeout(extractionTimer);
            extractionTimer = setTimeout(processQueue, 1000); // Debounce
        }
    });

    observer.observe(targetNode, {
        childList: true,
        subtree: true,
        characterData: true
    });
}

// --- INITIALIZATION ---

function init() {
    attachObserver(document); 
    if (document.body) {
        processingQueue.push(document.body);
        processQueue();
    } else {
        window.addEventListener('DOMContentLoaded', () => {
            processingQueue.push(document.body);
            processQueue();
        });
    }
}

init();
console.log("The Devourer V5: Streaming Vacuum Active.");
