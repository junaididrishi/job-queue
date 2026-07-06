import { Task } from '../../types';

export async function handleDataExport(task: Task): Promise<Record<string, unknown>> {
  const { entity, format, query } = task.payload as {
    entity: string;
    format: 'csv' | 'json' | 'xlsx';
    query?: Record<string, unknown>;
  };
  if (!entity || !format) throw new Error('Missing required fields: entity, format');

  await sleep(800 + Math.random() * 1200);

  return {
    export_id: `exp_${Date.now()}`,
    entity,
    format,
    download_url: `https://exports.example.com/${entity}_${Date.now()}.${format}`,
    record_count: Math.floor(Math.random() * 50_000) + 1_000,
    file_size_bytes: Math.floor(Math.random() * 10_000_000) + 100_000,
    query: query ?? {},
    exported_at: new Date().toISOString(),
  };
}

function sleep(ms: number) { return new Promise((r) => setTimeout(r, ms)); }
