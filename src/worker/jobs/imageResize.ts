import { Task } from '../../types';

export async function handleImageResize(task: Task): Promise<Record<string, unknown>> {
  const { source_url, width, height, format } = task.payload as {
    source_url: string;
    width: number;
    height: number;
    format?: string;
  };
  if (!source_url || !width || !height) throw new Error('Missing required fields: source_url, width, height');

  // Simulate CPU-bound image processing
  await sleep(500 + Math.random() * 1000);

  if (Math.random() < 0.05) throw new Error('Image codec error: unsupported format');

  const outputFormat = format || 'webp';
  return {
    output_url: `https://cdn.example.com/resized/${Date.now()}_${width}x${height}.${outputFormat}`,
    original_url: source_url,
    dimensions: { width, height },
    format: outputFormat,
    size_bytes: Math.floor(Math.random() * 500_000) + 50_000,
    processed_at: new Date().toISOString(),
  };
}

function sleep(ms: number) { return new Promise((r) => setTimeout(r, ms)); }
