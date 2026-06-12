export interface HttpConfig {
  host: string;
  port: number;
  timeoutMs: number;
}

export class HttpClient {
  private readonly baseUrl: string;

  constructor(private readonly config: HttpConfig) {
    this.baseUrl = `http://${config.host}:${config.port}`;
  }

  async getJson<T>(path: string): Promise<T> {
    if (!path.startsWith("/")) {
      throw new Error(`HTTP path must start with '/': ${path}`);
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.config.timeoutMs);

    try {
      const response = await fetch(`${this.baseUrl}${path}`, {
        method: "GET",
        signal: controller.signal
      });
      if (!response.ok) {
        throw new Error(`HTTP GET ${path} failed with ${response.status}`);
      }
      return (await response.json()) as T;
    } finally {
      clearTimeout(timeout);
    }
  }
}
