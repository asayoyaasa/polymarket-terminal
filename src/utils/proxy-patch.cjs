/**
 * proxy-patch.cjs
 * CommonJS module to patch https.request BEFORE any axios imports.
 * This ensures @polymarket/clob-client uses the proxy.
 *
 * Must be imported as very first thing in the app.
 * In ES modules: import './proxy-patch.cjs'
 */

const PROXY_URL = process.env.PROXY_URL || '';

if (PROXY_URL) {
    // Load https-proxy-agent which patches https.request properly
    const { HttpsProxyAgent } = require('https-proxy-agent');
    const https = require('https');

    // Create agent that routes everything through proxy
    const agent = new HttpsProxyAgent(PROXY_URL);

    // Store original request
    const originalRequest = https.request;

    // Polymarket domains
    const POLY_DOMAINS = [
        'polymarket.com',
        'clob.polymarket.com',
        'gamma-api.polymarket.com',
        'data-api.polymarket.com',
    ];

    function shouldProxy(url) {
        try {
            const hostname = new URL(url).hostname;
            return POLY_DOMAINS.some(domain => hostname === domain || hostname.endsWith(`.${domain}`));
        } catch {
            return false;
        }
    }

    // Override https.request globally
    https.request = function(options, callback) {
        // Handle both string URL and options object
        let url;
        if (typeof options === 'string') {
            url = options;
        } else if (options.hostname || options.host) {
            const protocol = options.protocol || 'https:';
            const hostname = options.hostname || options.host;
            const port = options.port ? `:${options.port}` : '';
            const path = options.path || '/';
            url = `${protocol}//${hostname}${port}${path}`;
        }

        // If it's a Polymarket domain, force agent
        if (url && shouldProxy(url)) {
            if (typeof options === 'string') {
                // Convert to options object with agent
                options = {
                    agent: agent,
                };
            } else {
                options.agent = agent;
            }
        }

        return originalRequest.call(https, options, callback);
    };

    // Also patch https.get
    https.get = function(options, callback) {
        const req = https.request(options, callback);
        req.end();
        return req;
    };

    // Set global agent as fallback
    https.globalAgent = agent;

    console.log(`[proxy-patch] HTTPS agent patched for Polymarket routing via proxy`);
} else {
    console.log('[proxy-patch] No PROXY_URL set, skipping patch');
}
