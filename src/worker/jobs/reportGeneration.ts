import { Task } from '../../types';

export async function handleReportGeneration(task: Task): Promise<Record<string, unknown>> {
  const { report_type, start_date, end_date, filters } = task.payload as {
    report_type: string;
    start_date: string;
    end_date: string;
    filters?: Record<string, unknown>;
  };
  if (!report_type || !start_date || !end_date) {
    throw new Error('Missing required fields: report_type, start_date, end_date');
  }

  // Simulate heavy report aggregation
  await sleep(1000 + Math.random() * 2000);

  return {
    report_id: `rpt_${Date.now()}`,
    report_type,
    period: { start_date, end_date },
    filters: filters ?? {},
    download_url: `https://reports.example.com/${report_type}_${Date.now()}.pdf`,
    row_count: Math.floor(Math.random() * 10_000) + 100,
    generated_at: new Date().toISOString(),
    expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
  };
}

function sleep(ms: number) { return new Promise((r) => setTimeout(r, ms)); }
