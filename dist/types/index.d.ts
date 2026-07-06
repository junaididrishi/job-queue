export type TaskType = 'email' | 'image_resize' | 'report_generation' | 'data_export' | 'notification';
export type TaskStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'dead';
export type TaskPriority = 'high' | 'normal' | 'low';
export interface Task {
    id: string;
    type: TaskType;
    status: TaskStatus;
    priority: TaskPriority;
    payload: Record<string, unknown>;
    result: Record<string, unknown> | null;
    error_message: string | null;
    retry_count: number;
    max_retries: number;
    next_retry_at: Date | null;
    worker_id: string | null;
    webhook_url: string | null;
    webhook_delivered: boolean;
    created_at: Date;
    updated_at: Date;
    started_at: Date | null;
    completed_at: Date | null;
}
export interface TaskLog {
    id: string;
    task_id: string;
    worker_id: string | null;
    event: string;
    message: string;
    metadata: Record<string, unknown> | null;
    created_at: Date;
}
export interface Worker {
    id: string;
    hostname: string;
    pid: number;
    status: 'idle' | 'busy' | 'offline';
    current_task_id: string | null;
    tasks_processed: number;
    tasks_failed: number;
    last_heartbeat: Date;
    created_at: Date;
}
export interface User {
    id: string;
    email: string;
    password_hash: string;
    name: string;
    created_at: Date;
}
export interface QueueMessage {
    task_id: string;
    type: TaskType;
    priority: TaskPriority;
    enqueued_at: string;
}
export interface CreateTaskRequest {
    type: TaskType;
    priority?: TaskPriority;
    payload: Record<string, unknown>;
    webhook_url?: string;
    max_retries?: number;
}
export interface AuthenticatedRequest extends Express.Request {
    user?: {
        id: string;
        email: string;
    };
}
//# sourceMappingURL=index.d.ts.map