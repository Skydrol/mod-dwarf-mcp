import { readFile } from "node:fs/promises";
import type { ApiCallRecord } from "../types/importBundle.js";
import type { HttpConfig } from "./httpClient.js";

export interface WriteHttpResponse {
  ok: boolean;
  status: number;
  body: Buffer;
  text: string;
}

export class WriteHttpClient {
  private readonly baseUrl: string;
  public readonly calls: ApiCallRecord[] = [];

  constructor(private readonly config: HttpConfig) {
    this.baseUrl = `http://${config.host}:${config.port}`;
  }

  async getBytes(path: string, purpose: string): Promise<WriteHttpResponse> {
    this.assertPath(path);
    const response = await this.request(path, { method: "GET" }, purpose);
    return response;
  }

  async postMultipartFile(
    path: string,
    fieldName: string,
    filePath: string,
    purpose: string
  ): Promise<WriteHttpResponse> {
    this.assertPath(path);
    const bytes = await readFile(filePath);
    const form = new FormData();
    form.set(fieldName, new Blob([bytes]), filePath.split("/").pop() ?? "pedalboard.zip");
    return this.request(path, { method: "POST", body: form }, purpose);
  }

  async postRawFile(path: string, filePath: string, purpose: string): Promise<WriteHttpResponse> {
    this.assertPath(path);
    const bytes = await readFile(filePath);
    return this.request(
      path,
      {
        method: "POST",
        body: bytes,
        headers: { "Content-Type": "application/octet-stream" }
      },
      purpose
    );
  }

  recordSkipped(method: "GET" | "POST", path: string, purpose: string, error: string): void {
    this.calls.push({ method, path, purpose, status: "skipped", error });
  }

  private async request(
    path: string,
    init: RequestInit,
    purpose: string
  ): Promise<WriteHttpResponse> {
    const method = (init.method ?? "GET") as "GET" | "POST";
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.config.timeoutMs);

    try {
      const response = await fetch(`${this.baseUrl}${path}`, {
        ...init,
        signal: controller.signal
      });
      const arrayBuffer = await response.arrayBuffer();
      const body = Buffer.from(arrayBuffer);
      const text = body.toString("utf8");
      this.calls.push({
        method,
        path,
        purpose,
        status: response.ok ? "success" : "failed",
        httpStatus: response.status,
        error: response.ok ? undefined : text.slice(0, 500)
      });
      return { ok: response.ok, status: response.status, body, text };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.calls.push({ method, path, purpose, status: "failed", error: message });
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }

  private assertPath(path: string): void {
    if (!path.startsWith("/")) throw new Error(`HTTP path must start with '/': ${path}`);
  }
}
