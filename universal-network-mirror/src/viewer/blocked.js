const params = new URLSearchParams(window.location.search);
const url = params.get('url');
const domain = url ? new URL(url).hostname : "THIS DOMAIN";

document.getElementById('domain').innerText = domain;

document.getElementById('btn-unblock').addEventListener('click', () => {
    if (domain === "THIS DOMAIN") {
        alert("Cannot determine domain. Please manage Black Holes from the Viewer.");
        return;
    }
    
    chrome.runtime.sendMessage({
        type: 'UNBLOCK_DOMAIN',
        domain: domain
    }, () => {
        // Redirect back
        if (url) window.location.href = url;
    });
});
