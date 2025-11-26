// content-script.js - Part of "The Devourer"

const MSG_CAPTURE_PAYLOAD = 'CAPTURE_PAYLOAD';

function captureContent() {
    // "Weak Learner" v2: Structure Analysis
    if (!document.body) return;

    const textContent = document.body.innerText;
    
    // Calculate "Bloat Score" (Structure Density)
    const scriptCount = document.getElementsByTagName('script').length;
    const iframeCount = document.getElementsByTagName('iframe').length;
    const divCount = document.getElementsByTagName('div').length;
    
    // Heuristic: Yahoo has tons of iframes/scripts vs content
    const bloatScore = (scriptCount * 2 + iframeCount * 5 + divCount * 0.1);

    if (textContent.length > 0) {
        // Tokenization Strategy:
        // 1. Lowercase, remove punctuation/digits
        // 2. Split by whitespace
        // 3. Filter stop words (simple list) and short words
        // 4. Count frequency
        
        const words = textContent.toLowerCase()
            .replace(/[^a-z\s]/g, ' ')
            .split(/\s+/)
            .filter(w => w.length > 3); // Skip short words
            
        const tokenMap = {};
        words.forEach(w => {
            tokenMap[w] = (tokenMap[w] || 0) + 1;
        });
        
        // Sort and take top 50 to save bandwidth
        const sortedTokens = Object.entries(tokenMap)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 50);
            
        try {
            chrome.runtime.sendMessage({
                type: MSG_CAPTURE_PAYLOAD,
                // Send summary instead of raw text for efficiency
                payload: "Tokenized Content", 
                tokens: Object.fromEntries(sortedTokens),
                sample: textContent.substring(0, 200), // Small snippet
                meta: {
                    bloatScore: bloatScore,
                    isClean: bloatScore < 50 
                }
            });
        } catch (e) {
            // Extension context invalidated (updated/reloaded). 
            // Silent fail is expected behavior here.
        }
    }
}

// Observe for significant changes (SPA navigation, dynamic loading)
// For now, we just capture on load and then debounce subsequent checks
window.addEventListener('load', () => {
    captureContent();
    
    // Simple observer for dynamic content
    let timeout;
    const observer = new MutationObserver(() => {
        clearTimeout(timeout);
        timeout = setTimeout(captureContent, 2000);
    });
    
    if (document.body) {
        observer.observe(document.body, { childList: true, subtree: true });
    }
});

console.log("Network Mirror Observer Active.");
