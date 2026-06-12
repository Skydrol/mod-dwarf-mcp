import { Client } from "ssh2";
import { ReadOnlyViolationError } from "../types/errors.js";

export interface SshConfig {
  host: string;
  username: string;
  password: string;
  timeoutMs: number;
}

export interface CommandResult {
  stdout: string;
  stderr: string;
  code: number | null;
}

export interface CommandRunner {
  exec(command: string): Promise<CommandResult>;
}

const allowedPrefixes = [
  "cat ",
  "sed -n ",
  "find ",
  "ls ",
  "wc ",
  "uname",
  "lv2ls",
  "readlink ",
  "test ",
  "printf ",
  "grep "
];

const forbiddenPatterns = [
  /(^|\s)(rm|mv|cp|touch|mkdir|chmod|chown|ln|tee|modprobe|reboot|shutdown|systemctl|service|apt|apk|opkg|yum|dnf|npm|pnpm|yarn)(\s|$)/,
  />|>>|<\(|\$\(|`|;|&&|\|\|/,
  /sed\s+-i/
];

export function assertReadOnlyCommand(command: string): void {
  const trimmed = command.trim();
  if (forbiddenPatterns.some((pattern) => pattern.test(trimmed))) {
    throw new ReadOnlyViolationError(command);
  }
  if (!allowedPrefixes.some((prefix) => trimmed === prefix.trim() || trimmed.startsWith(prefix))) {
    throw new ReadOnlyViolationError(command);
  }
}

export class SshClient implements CommandRunner {
  constructor(private readonly config: SshConfig) {}

  async exec(command: string): Promise<CommandResult> {
    assertReadOnlyCommand(command);

    return new Promise((resolve, reject) => {
      const client = new Client();
      const timeout = setTimeout(() => {
        client.end();
        reject(new Error(`SSH command timed out after ${this.config.timeoutMs}ms: ${command}`));
      }, this.config.timeoutMs);

      client
        .on("ready", () => {
          client.exec(command, (err, stream) => {
            if (err) {
              clearTimeout(timeout);
              client.end();
              reject(err);
              return;
            }

            let stdout = "";
            let stderr = "";
            let exitCode: number | null = null;

            stream
              .on("close", (code: number | null) => {
                exitCode = code;
                clearTimeout(timeout);
                client.end();
                resolve({ stdout, stderr, code: exitCode });
              })
              .on("data", (data: Buffer) => {
                stdout += data.toString("utf8");
              });

            stream.stderr.on("data", (data: Buffer) => {
              stderr += data.toString("utf8");
            });
          });
        })
        .on("error", (err) => {
          clearTimeout(timeout);
          reject(err);
        })
        .connect({
          host: this.config.host,
          username: this.config.username,
          password: this.config.password,
          readyTimeout: this.config.timeoutMs
        });
    });
  }
}
