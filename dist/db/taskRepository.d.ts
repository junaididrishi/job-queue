import { Task, TaskStatus, TaskLog } from '../types';
export declare function createTask(params: {
    id: string;
    type: string;
    priority: string;
    payload: Record<string, unknown>;
    max_retries: number;
    webhook_url?: string;
}): Promise<Task>;
export declare function getTaskById(id: string): Promise<Task | null>;
export declare function listTasks(filters: {
    status?: TaskStatus;
    type?: string;
    limit?: number;
    offset?: number;
}): Promise<{
    tasks: Task[];
    total: number;
}>;
export declare function updateTaskStatus(id: string, status: TaskStatus, extra?: Partial<Pick<Task, 'worker_id' | 'result' | 'error_message' | 'started_at' | 'completed_at' | 'retry_count' | 'next_retry_at'>>): Promise<Task | null>;
export declare function markWebhookDelivered(id: string): Promise<void>;
export declare function addTaskLog(params: {
    task_id: string;
    worker_id?: string;
    event: string;
    message: string;
    metadata?: Record<string, unknown>;
}): Promise<void>;
export declare function getTaskLogs(task_id: string): Promise<TaskLog[]>;
export declare function getStats(): Promise<{
    total: number;
    pending: number;
    processing: number;
    completed: number;
    failed: number;
    dead: number;
    avg_processing_ms: number;
    success_rate: number;
}>;
//# sourceMappingURL=taskRepository.d.ts.map