import { TaskPriority, QueueMessage } from '../types';
export declare function enqueue(taskId: string, type: string, priority: TaskPriority): Promise<void>;
export declare function dequeue(timeoutSeconds: number): Promise<QueueMessage | null>;
export declare function enqueueDeadLetter(taskId: string, reason: string): Promise<void>;
export declare function getQueueDepths(): Promise<Record<string, number>>;
//# sourceMappingURL=queue.d.ts.map