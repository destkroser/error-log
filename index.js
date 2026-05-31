const express = require('express');
const cors = require('cors');

const app = express();

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const DEFAULT_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

// Parse the allowed domains from Dokploy environment variables
// Expected format: "https://mywebsite.com,https://another-site.com"
const allowedDomains = process.env.ALLOWED_DOMAINS
    ? process.env.ALLOWED_DOMAINS.split(',').map(d => d.trim())
    : [];

// Strict CORS Configuration
const corsOptions = {
    origin: function (origin, callback) {
        // Reject requests that have no origin (e.g., direct curl requests or server-to-server)
        // If you want to allow your own server scripts to test it, remove the '!origin' check.
        if (!origin) {
            return callback(new Error('Blocked: Missing Origin Header'), false);
        }

        if (allowedDomains.includes(origin)) {
            callback(null, true);
        } else {
            callback(new Error(`Blocked: Origin ${origin} is not allowed`), false);
        }
    },
    methods: ['POST', 'OPTIONS'], // Only allow POST requests (and preflight OPTIONS)
    allowedHeaders: ['Content-Type']
};

// Apply CORS strictly to the reporting endpoint, then parse the JSON body
app.post('/report-error', cors(corsOptions), express.json(), async (req, res) => {
    const {
        app_id,
        error_message,
        error_stack,
        url_path,
        api_action,
        user_agent,
        timestamp
    } = req.body;

    const escapeHtml = (text) => {
        if (!text) return "N/A";
        return text.toString()
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;");
    };

    const messageText = `
🚨 <b>New Technical Error</b>
<b>App:</b> ${escapeHtml(app_id)}
<b>Time:</b> ${escapeHtml(timestamp)}
<b>URL:</b> ${escapeHtml(url_path)}

<b>Error Message:</b>
<code>${escapeHtml(error_message)}</code>

<b>Action/API:</b> ${escapeHtml(api_action)}
<b>User Agent:</b> ${escapeHtml(user_agent)}

<b>Stack Trace:</b>
<code>${escapeHtml(error_stack)}</code>
  `.trim();

    const payload = {
        chat_id: DEFAULT_CHAT_ID,
        text: messageText,
        parse_mode: 'HTML'
    };

    try {
        const response = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            console.error('Telegram API Error:', await response.text());
            return res.status(500).json({ success: false, message: 'Failed to send report' });
        }

        res.status(200).json({ success: true, message: 'Error reported' });
    } catch (error) {
        console.error('Service Error:', error);
        res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
});

// Custom error handler to catch CORS rejections gracefully and return JSON instead of HTML
app.use((err, req, res, next) => {
    if (err.message && err.message.startsWith('Blocked:')) {
        return res.status(403).json({ success: false, message: 'Forbidden: Unauthorized Origin' });
    }
    next(err);
});

app.get('/health', (req, res) => res.send('OK'));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Error Reporter Service running on port ${PORT}`);
});