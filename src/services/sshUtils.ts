import type { CommandRunner } from "../clients/sshClient.js";

export function shellQuote(value: string): string {
  return `'${value.replace(/'/g, `'"'"'`)}'`;
}

export async function readFile(ssh: CommandRunner, path: string): Promise<string | null> {
  const result = await ssh.exec(`cat ${shellQuote(path)}`);
  return result.code === 0 ? result.stdout : null;
}

export async function testFile(ssh: CommandRunner, path: string): Promise<boolean> {
  const result = await ssh.exec(`test -f ${shellQuote(path)}`);
  return result.code === 0;
}

export async function listDirectories(
  ssh: CommandRunner,
  path: string,
  name: string
): Promise<string[]> {
  const result = await ssh.exec(
    `find ${shellQuote(path)} -maxdepth 1 -type d -name ${shellQuote(name)} -print`
  );
  if (result.code !== 0) return [];
  return result.stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}
