// In-memory conversation history per user
const conversations = new Map();

const MAX_MESSAGES = 5;
const EXPIRE_MS = 30 * 60 * 1000; // 30 minutes

function addMessage(userId, role, content) {
    if (!conversations.has(userId)) {
        conversations.set(userId, {
            messages: [],
            lastActivity: Date.now(),
        });
    }

    const convo = conversations.get(userId);
    convo.messages.push({
        role,
        content,
        timestamp: Date.now(),
    });

    // Keep only last N messages
    if (convo.messages.length > MAX_MESSAGES * 2) {
        convo.messages = convo.messages.slice(-MAX_MESSAGES * 2);
    }

    convo.lastActivity = Date.now();
}

function getHistory(userId) {
    const convo = conversations.get(userId);
    if (!convo) return [];

    // Check if expired
    if (Date.now() - convo.lastActivity > EXPIRE_MS) {
        conversations.delete(userId);
        return [];
    }

    return convo.messages.map((m) => ({
        role: m.role,
        content: m.content,
    }));
}

function clearHistory(userId) {
    conversations.delete(userId);
}

// Periodic cleanup of expired conversations
setInterval(() => {
    const now = Date.now();
    for (const [userId, convo] of conversations) {
        if (now - convo.lastActivity > EXPIRE_MS) {
            conversations.delete(userId);
        }
    }
}, 5 * 60 * 1000); // Cleanup every 5 minutes

module.exports = { addMessage, getHistory, clearHistory };
