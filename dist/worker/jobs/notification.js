"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleNotification = handleNotification;
async function handleNotification(task) {
    const { channel, recipient, title, message } = task.payload;
    if (!channel || !recipient || !message) {
        throw new Error('Missing required fields: channel, recipient, message');
    }
    await sleep(100 + Math.random() * 200);
    return {
        notification_id: `ntf_${Date.now()}`,
        channel,
        recipient,
        title: title || 'Notification',
        delivered: true,
        sent_at: new Date().toISOString(),
    };
}
function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }
//# sourceMappingURL=notification.js.map