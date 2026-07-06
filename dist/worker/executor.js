"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.executeJob = executeJob;
const email_1 = require("./jobs/email");
const imageResize_1 = require("./jobs/imageResize");
const reportGeneration_1 = require("./jobs/reportGeneration");
const dataExport_1 = require("./jobs/dataExport");
const notification_1 = require("./jobs/notification");
const handlers = {
    email: email_1.handleEmail,
    image_resize: imageResize_1.handleImageResize,
    report_generation: reportGeneration_1.handleReportGeneration,
    data_export: dataExport_1.handleDataExport,
    notification: notification_1.handleNotification,
};
async function executeJob(task) {
    const handler = handlers[task.type];
    if (!handler)
        throw new Error(`No handler registered for task type: ${task.type}`);
    return handler(task);
}
//# sourceMappingURL=executor.js.map