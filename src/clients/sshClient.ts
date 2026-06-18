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
  "lv2info ",
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

  // Write file via exec+stdin. Works on devices without SFTP subsystem.
  // The shell command runs through /bin/sh -c so that > redirection is handled.
  async sshWriteFile(remotePath: string, content: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const client = new Client();
      const timeout = setTimeout(() => {
        client.end();
        reject(new Error(`SSH timeout writing: ${remotePath}`));
      }, this.config.timeoutMs);

      client
        .on("ready", () => {
          const escaped = remotePath.replace(/'/g, "'\\''");
          // Use explicit shell so > redirection works; drain stdout+stderr so close fires.
          client.exec(`/bin/sh -c 'cat > '"'"'${escaped}'"'"''`, (err, stream) => {
            if (err) {
              clearTimeout(timeout);
              client.end();
              reject(err);
              return;
            }
            let exitCode: number | null = null;
            stream
              .on("exit", (code: number | null) => {
                exitCode = code;
              })
              .on("close", () => {
                clearTimeout(timeout);
                client.end();
                if (exitCode === 0 || exitCode === null) {
                  resolve();
                } else {
                  reject(new Error(`cat exited with code ${exitCode} writing ${remotePath}`));
                }
              })
              .on("data", () => { /* drain stdout */ });
            stream.stderr.on("data", () => { /* drain stderr */ });
            stream.write(Buffer.from(content, "utf8"));
            stream.end();
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
