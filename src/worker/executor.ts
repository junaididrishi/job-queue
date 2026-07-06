import { Task, TaskType } from '../types';
import { handleEmail } from './jobs/email';
import { handleImageResize } from './jobs/imageResize';
import { handleReportGeneration } from './jobs/reportGeneration';
import { handleDataExport } from './jobs/dataExport';
import { handleNotification } from './jobs/notification';

type JobHandler = (task: Task) => Promise<Record<string, unknown>>;

const handlers: Record<TaskType, JobHandler> = {
  email: handleEmail,
  image_resize: handleImageResize,
  report_generation: handleReportGeneration,
  data_export: handleDataExport,
  notification: handleNotification,
};

export async function executeJob(task: Task): Promise<Record<string, unknown>> {
  const handler = handlers[task.type as TaskType];
  if (!handler) throw new Error(`No handler registered for task type: ${task.type}`);
  return handler(task);
}
