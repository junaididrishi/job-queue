"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleEmail = handleEmail;
async function handleEmail(task) {
    const { to, subject, body } = task.payload;
    if (!to || !subject)
        throw new Error('Missing required fields: to, subject');
    // Simulate SMTP send with realistic latency
    await sleep(300 + Math.random() * 400);
    // Simulate occasional transient failures (10% chance) to demonstrate retry logic
    if (Math.random() < 0.10)
        throw new Error('SMTP connection timeout');
    return {
        message_id: `msg_${Date.now()}`,
        to,
        subject,
        sent_at: new Date().toISOString(),
        provider: 'simulated-smtp',
    };
}
function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }
//# sourceMappingURL=email.js.map