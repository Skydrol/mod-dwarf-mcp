import "dotenv/config";
import { z } from "zod";

export const envSchema = z.object({
  MOD_DWARF_HOST: z.string().min(1).default("moddwarf.local"),
  MOD_DWARF_PORT: z.coerce.number().int().positive().default(80),
  MOD_DWARF_SSH_USER: z.string().min(1).default("root"),
  MOD_DWARF_SSH_PASSWORD: z.string().min(1),
  MOD_DWARF_SSH_TIMEOUT_MS: z.coerce.number().int().positive().default(10000),
  MOD_DWARF_HTTP_TIMEOUT_MS: z.coerce.number().int().positive().default(10000),
  MOD_DWARF_ENABLE_WRITE_TOOLS: z
    .enum(["true", "false"])
    .default("false")
    .transform((value) => value === "true")
});

export type EnvConfig = z.infer<typeof envSchema>;

export function loadEnv(env: NodeJS.ProcessEnv = process.env): EnvConfig {
  return envSchema.parse(env);
}
