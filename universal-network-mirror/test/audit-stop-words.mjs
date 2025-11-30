import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// --- CONFIG ---
const DOMAINS = [
    'https://www.google.com',
    'https://www.wikipedia.org',
    'https://github.com',
    'https://stackoverflow.com',
    'https://www.reddit.com',
    'https://www.nytimes.com',
    'https://www.bbc.com',
    'https://www.cnn.com',
    'https://www.amazon.com',
    'https://www.apple.com',
    'https://www.microsoft.com',
    'https://www.youtube.com',
    'https://twitter.com', // X.com
    'https://www.linkedin.com',
    'https://www.instagram.com',
    'https://www.netflix.com',
    'https://www.spotify.com',
    'https://www.twitch.tv',
    'https://discord.com',
    'https://chat.openai.com'
];

// Current Stop List (from aggregator.js)
// We duplicate it here to check against it.
const CURRENT_STOP_WORDS = new Set([
    "a", "about", "above", "after", "again", "against", "all", "am", "an", "and", "any", "are", "aren't", "as", "at", "be", "because", "been", "before", "being", "below", "between", "both", "but", "by", "can't", "cannot", "could", "couldn't", "did", "didn't", "do", "does", "doesn't", "doing", "don't", "down", "during", "each", "few", "for", "from", "further", "had", "hadn't", "has", "hasn't", "have", "haven't", "having", "he", "he'd", "he'll", "he's", "her", "here", "here's", "hers", "herself", "him", "himself", "his", "how", "how's", "i", "i'd", "i'll", "i'm", "i've", "if", "in", "into", "is", "isn't", "it", "it's", "its", "itself", "let's", "me", "more", "most", "mustn't", "my", "myself", "no", "nor", "not", "of", "off", "on", "once", "only", "or", "other", "ought", "our", "ours", "ourselves", "out", "over", "own", "same", "shan't", "she", "she'd", "she'll", "she's", "should", "shouldn't", "so", "some", "such", "than", "that", "that's", "the", "their", "theirs", "them", "themselves", "then", "there", "there's", "these", "they", "they'd", "they'll", "they're", "they've", "this", "those", "through", "to", "too", "under", "until", "up", "very", "was", "wasn't", "we", "we'd", "we'll", "we're", "we've", "were", "weren't", "what", "what's", "when", "when's", "where", "where's", "which", "while", "who", "who's", "whom", "why", "why's", "with", "won't", "would", "wouldn't", "you", "you'd", "you'll", "you're", "you've", "your", "yours", "yourself", "yourselves",
    "will", "just", "now", "one", "like", "can", "get", "time", "new", "us", "use", "make", "made", "see", "way", "day", "go", "come", "back", "many", "much", "good", "know", "think", "take", "people", "year", "say", "well", "work", "want", "also", "even",
    "follow", "like", "subscribe", "full", "coverage", "text", "courier", "journal", "new", "journal", "report", "news", "times", "hour", "hours", "view", "views", "sync", "user sync", "user", "full coverage", "full", "coverage", "opinion", "more", "yesterday", "days", "view", "views", "https", "http", "wwww", "com", "privacy","show", "less", "show more", "show less", "last", "chat", "message", "select", "last message", "container", "safeframe", "browser", "preferences", "icon", "comment", "comments", "advertisement", "container safeframe"
]);

// --- HELPERS ---

function cleanText(html) {
    // Basic Node.js "innerText" simulation
    // 1. Remove scripts/styles
    let text = html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gmi, " ");
    text = text.replace(/<style\b[^>]*>[\s\S]*?<\/style>/gmi, " ");
    // 2. Remove tags
    text = text.replace(/<[^>]+>/g, " ");
    // 3. Decode entities (basic)
    text = text.replace(/&nbsp;/g, " ").replace(/&/g, "&").replace(/</g, "<").replace(/>/g, ">");
    // 4. Collapse whitespace
    return text.replace(/\s+/g, " ").trim();
}

function tokenize(text) {
    return text.toLowerCase()
        .replace(/[^a-z0-9]/g, ' ')
        .split(/\s+/)
        .filter(w => w.length > 2); // Min length 3
}

// --- MAIN AUDIT ---

async function audit() {
    console.log(`=== STOP WORD AUDIT: ${DOMAINS.length} Domains ===`);
    
    const globalFreq = new Map();
    let totalWords = 0;

    for (const url of DOMAINS) {
        process.stdout.write(`Fetching ${url}... `);
        try {
            const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36' } });
            if (!res.ok) {
                console.log(`HTTP ${res.status}`);
                continue;
            }
            const html = await res.text();
            const text = cleanText(html);
            const words = tokenize(text);
            
            console.log(`${words.length} words.`);
            
            words.forEach(w => {
                globalFreq.set(w, (globalFreq.get(w) || 0) + 1);
                totalWords++;
            });

        } catch (e) {
            console.log(`FAILED: ${e.message}`);
        }
    }

    console.log(`\n=== RESULTS ===`);
    console.log(`Total Words Scanned: ${totalWords}`);
    console.log(`Unique Words: ${globalFreq.size}`);

    // Sort by Frequency
    const sorted = [...globalFreq.entries()].sort((a, b) => b[1] - a[1]);

    console.log(`\n--- TOP 50 CANDIDATES FOR STOP LIST (Not currently blocked) ---`);
    console.log(`(Word : Frequency)`);
    
    let count = 0;
    for (const [word, freq] of sorted) {
        if (count >= 50) break;
        
        // Filter out existing stop words
        if (!CURRENT_STOP_WORDS.has(word)) {
            // Heuristic: If it appears > 0.1% of all text, it's likely noise
            // or just a very common word like "search", "login", "menu"
            console.log(`- ${word.padEnd(15)} : ${freq}`);
            count++;
        }
    }
}

audit();
