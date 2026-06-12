import type { CommandRunner } from "../clients/sshClient.js";
import type { BankList } from "../types/bank.js";
import { parseBanks } from "./parsers.js";
import { readFile } from "./sshUtils.js";

const USER_BANKS = "/root/data/banks.json";
const FACTORY_BANKS = "/usr/share/mod/banks.json";

export class BankService {
  constructor(private readonly ssh: CommandRunner) {}

  async listBanks(source: "user" | "factory" | "all" = "all"): Promise<BankList> {
    const [userText, factoryText] = await Promise.all([
      source === "factory" ? Promise.resolve(null) : readFile(this.ssh, USER_BANKS),
      source === "user" ? Promise.resolve(null) : readFile(this.ssh, FACTORY_BANKS)
    ]);

    return {
      user: userText ? parseBanks(userText) : [],
      factory: factoryText ? parseBanks(factoryText) : []
    };
  }
}
