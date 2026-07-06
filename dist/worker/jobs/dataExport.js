"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleDataExport = handleDataExport;
async function handleDataExport(task) {
    const { entity, format, query } = task.payload;
    if (!entity || !format)
        throw new Error('Missing required fields: entity, format');
    await sleep(800 + Math.random() * 1200);
    return {
        export_id: `exp_${Date.now()}`,
        entity,
        format,
        download_url: `https://exports.example.com/${entity}_${Date.now()}.${format}`,
        record_count: Math.floor(Math.random() * 50000) + 1000,
        file_size_bytes: Math.floor(Math.random() * 10000000) + 100000,
        query: query ?? {},
        exported_at: new Date().toISOString(),
    };
}
function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }
//# sourceMappingURL=dataExport.js.map