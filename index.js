const express = require('express');

const app = express();
app.use(express.json());

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const DEFAULT_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

// Phase 2: Add your Topic Thread IDs here later
const topicMap = {
    // "portfolio-site": "12345",
    // "client-dashboard": "67890"
};

// Utility to prevent unescaped characters from breaking Telegram's HTML parser
const escapeHtml = (text) => {
    if (!text) return "N/A";
    return text.toString()
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
};

app.post('/report-error', async (req, res) => {
    const {
        app_id,
        error_message,
        error_stack,
        url_path,
        api_action,
        user_agent,
        timestamp
    } = req.body;

    // Determine destination (Topic or Default Chat)
    const threadId = topicMap[app_id] || null;

    // Build the formatted message
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

    // Prepare Telegram API payload
    const payload = {
        chat_id: DEFAULT_CHAT_ID,
        text: messageText,
        parse_mode: 'HTML'
    };

    if (threadId) {
        payload.message_thread_id = threadId;
    }

    try {
        const response = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const errorData = await response.text();
            console.error('Telegram API Error:', errorData);
            return res.status(500).json({ success: false, message: 'Failed to send to Telegram' });
        }

        res.status(200).json({ success: true, message: 'Error reported successfully' });
    } catch (error) {
        console.error('Service Error:', error);
        res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
});

// Health check endpoint for Dokploy
app.get('/health', (req, res) => res.send('OK'));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Error Reporter Service running on port ${PORT}`);
});