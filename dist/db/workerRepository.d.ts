import { Worker } from '../types';
export declare function registerWorker(id: string, hostname: string, pid: number): Promise<Worker>;
export declare function heartbeat(id: string): Promise<void>;
export declare function setWorkerStatus(id: string, status: Worker['status'], currentTaskId?: string | null): Promise<void>;
export declare function incrementWorkerStats(id: string, success: boolean): Promise<void>;
export declare function markWorkerOffline(id: string): Promise<void>;
export declare function listWorkers(): Promise<Worker[]>;
//# sourceMappingURL=workerRepository.d.ts.map