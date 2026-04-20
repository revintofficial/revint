// Module type shims.
//
// bullmq@5.73 ships no .d.ts in its npm tarball even though package.json
// points at one - a known upstream packaging bug. We declare the API
// surface we actually use; widen this file if you start using more of
// the bullmq API.
//
// jspdf resolves to its .min.js under `moduleResolution: "bundler"` which
// has no types; we treat it as an opaque default export.

declare module "bullmq" {
  export interface Job<T = unknown> {
    id?: string;
    name: string;
    data: T;
  }

  export interface QueueOptions {
    connection: unknown;
    defaultJobOptions?: Record<string, unknown>;
  }

  export interface JobsOptions {
    removeOnComplete?: number | boolean;
    removeOnFail?: number | boolean;
    attempts?: number;
    backoff?: { type: string; delay: number } | number;
    delay?: number;
    priority?: number;
  }

  export class Queue<T = unknown> {
    constructor(name: string, opts?: QueueOptions);
    add(name: string, data: T, opts?: JobsOptions): Promise<Job<T>>;
    close(): Promise<void>;
  }

  export interface WorkerOptions {
    connection: unknown;
    concurrency?: number;
    limiter?: { max: number; duration: number };
  }

  export class Worker<T = unknown, R = unknown> {
    constructor(
      name: string,
      processor: (job: Job<T>) => Promise<R>,
      opts?: WorkerOptions,
    );
    close(): Promise<void>;
    on(event: "completed", cb: (job: Job<T>) => void): this;
    on(event: "failed", cb: (job: Job<T> | undefined, err: Error) => void): this;
    on(event: string, cb: (...args: unknown[]) => void): this;
  }
}

declare module "jspdf" {
  // jsPDF surface is wide. Type the instance as any-indexed rather than
  // reimplementing 80+ method signatures; watchlist-export is the sole
  // consumer and it uses the library imperatively.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const jsPDF: new (...args: any[]) => any;
  export default jsPDF;
}
