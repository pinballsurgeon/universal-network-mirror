// content-script.js - Part of "The Devourer"
// "Ground Level Lowest Granularity Information Science Based Absoluteness"

const MSG_CAPTURE_PAYLOAD = 'CAPTURE_PAYLOAD';

// --- STATE ---
const observedRoots = new WeakSet();
let processingQueue = [];
let extractionTimer = null;

// --- DEEP FARMING LOGIC ---

// Helper to filter noise tags
function isNoise(tagName) {
    // Absoluteness: We removed NAV and FOOTER. We want everything.
    return ['SCRIPT', 'STYLE', 'NOSCRIPT', 'IFRAME', 'OBJECT', 'EMBED', 'SVG', 'IMG'].includes(tagName);
}

// Recursive Harvester that pierces Shadow DOMs
function deepHarvest(node, textBuffer, headlineBuffer) {
    if (!node) return;

    // 1. Text Node
    if (node.nodeType === Node.TEXT_NODE) {
        const txt = node.nodeValue.trim();
        // Lower threshold for "Absoluteness"
        if (txt.length >= 2) {
            // Determine context from parent
            const p = node.parentNode;
            if (p) {
                const tag = p.tagName;
                if (!isNoise(tag)) {
                    if (['H1','H2','H3','STRONG','B','TITLE'].includes(tag)) {
                        headlineBuffer.push(txt);
                    } else {
                        textBuffer.push(txt);
                    }
                }
            }
        }
        return;
    }

    // 2. Element Node
    if (node.nodeType === Node.ELEMENT_NODE) {
        if (isNoise(node.tagName)) return;

        // Check visibility (Absoluteness means we capture hidden content too? 
        // User said "cleanly farmed". Hidden text is often valid content (e.g. accordion, tabs).
        // Let's capture it. We filter noise tags, so hidden structural text is fair game.)

        // SHADOW DOM PIERCING
        if (node.shadowRoot && !observedRoots.has(node.shadowRoot)) {
            // Found a wild Shadow Root!
            // 1. Observe it for future changes
            attachObserver(node.shadowRoot);
            // 2. Dive into it now
            deepHarvest(node.shadowRoot, textBuffer, headlineBuffer);
        }
        
        // SLOT Handling: Content projected into slots is in the Light DOM (children of host).
        // We traverse children normally below, so slots are handled naturally.
    }

    // 3. Recurse Children (DocumentFragment / ShadowRoot / Element)
    let child = node.firstChild;
    while (child) {
        deepHarvest(child, textBuffer, headlineBuffer);
        child = child.nextSibling;
    }
}

function processQueue() {
    if (processingQueue.length === 0) return;

    const uniqueNodes = new Set(processingQueue);
    processingQueue = [];

    const textBuffer = [];
    const headlineBuffer = [];

    uniqueNodes.forEach(node => {
        // Absoluteness: Capture everything, even if detached (virtual DOM, fragments)
        // We removed the isConnected check to ensure we catch transient/streaming nodes
        deepHarvest(node, textBuffer, headlineBuffer);
    });

    if (textBuffer.length === 0 && headlineBuffer.length === 0) return;

    // --- TOKENIZATION ---
    const tokenize = (arr) => {
        return arr.join(" ").toLowerCase()
            .replace(/[^a-z\s]/g, ' ')
            .split(/\s+/)
            .filter(w => w.length > 3);
    };

    const words = tokenize(textBuffer);
    const headWords = tokenize(headlineBuffer);

    const tokenMap = {};
    const add = (w, weight) => { tokenMap[w] = (tokenMap[w] || 0) + weight; };

    // Body Weights
    words.forEach(w => add(w, 1));
    for(let i=0; i < words.length-1; i++) add(words[i] + " " + words[i+1], 2);
    
    // Headline Weights (Heavy Boost)
    headWords.forEach(w => add(w, 6)); 
    for(let i=0; i < headWords.length-1; i++) add(headWords[i] + " " + headWords[i+1], 10);

    const sortedTokens = Object.entries(tokenMap)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 300); // Increased buffer for "Absoluteness"

    // --- DEVELOPER SIGNAL DETECTION ---
    const devSignals = [];
    const fullContent = textBuffer.join(" "); // Scan raw text buffer
    
    // 1. Suspicious Variable Names (e.g., mmmmmmlli, camelCase with repeated chars)
    // Looking for 3+ identical chars inside a word
    const suspiciousVars = fullContent.match(/\b\w*([a-zA-Z])\1{3,}\w*\b/g);
    if (suspiciousVars) {
        suspiciousVars.forEach(v => devSignals.push({ type: 'WEIRD_VAR', value: v }));
    }

    // 2. UUIDs / API Keys / Hashes (Heuristic)
    const uuids = fullContent.match(/\b[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}\b/g);
    if (uuids) {
        uuids.forEach(u => devSignals.push({ type: 'UUID', value: u }));
    }

    // 3. Common Dev Keywords
    const devKeywords = fullContent.match(/\b(TODO|FIXME|DEBUG|console\.log|var_dump|traceback)\b/gi);
    if (devKeywords) {
        devKeywords.forEach(k => devSignals.push({ type: 'DEV_KEYWORD', value: k }));
    }

    if (sortedTokens.length > 0) {
        try {
            // Join full text for "Deep and Full" inspection
            const combinedText = textBuffer.join(" ");
            const headlines = headlineBuffer.join(" ");
            
            const fullText = headlines + "\n\n" + combinedText;
            
            // CHUNKED TRANSMISSION (Stream as Particles)
            // Instead of one giant message, we send "Packets of Reality".
            // This avoids size limits and visualizes "Mass" correctly in the Physics Engine.
            const CHUNK_SIZE = 10000; // 10KB chunks
            
            for (let i = 0; i < fullText.length; i += CHUNK_SIZE) {
                const chunk = fullText.substring(i, i + CHUNK_SIZE);
                
                chrome.runtime.sendMessage({
                    type: MSG_CAPTURE_PAYLOAD,
                    payload: "Deep Harvest Chunk", 
                    tokens: i === 0 ? Object.fromEntries(sortedTokens) : {}, // Only send tokens once to avoid skewing stats? Or send for all? Send for first.
                    sample: chunk.substring(0, 100), 
                    text: chunk, 
                    devSignals: i === 0 ? devSignals : [], 
                    meta: {
                        isIncremental: true,
                        timestamp: Date.now() + (i / 100), // Stagger timestamps slightly for particle stream effect
                        deep: true,
                        chunkIndex: i / CHUNK_SIZE
                    }
                });
            }
        } catch (e) { }
    }
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
                    // Always process new nodes. Deduplication happens in processQueue.
                    processingQueue.push(node);
                    hasWork = true;
                });
            } else if (m.type === 'characterData') {
                const node = m.target; 
                // Always re-process modified text.
                processingQueue.push(node); 
                hasWork = true;
            }
        });

        if (hasWork) {
            clearTimeout(extractionTimer);
            extractionTimer = setTimeout(processQueue, 1000);
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
    // 1. Observe Document
    attachObserver(document); // Catches direct body mutations

    // 2. Initial Deep Scan
    if (document.body) {
        processingQueue.push(document.body); // Queue entire body for deep harvest
        processQueue();
    } else {
        // Fallback for document_start execution if body not ready
        window.addEventListener('DOMContentLoaded', () => {
            processingQueue.push(document.body);
            processQueue();
        });
    }
}

init();
console.log("The Devourer V4: Deep Shadow Protocol Active.");
