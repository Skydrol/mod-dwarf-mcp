import { describe, expect, it } from "vitest";
import { assertReadOnlyCommand } from "../src/clients/sshClient.js";
import { ReadOnlyViolationError } from "../src/types/errors.js";

describe("SSH read-only guard", () => {
  it("allows read-only commands", () => {
    expect(() => assertReadOnlyCommand("cat '/etc/os-release'")).not.toThrow();
    expect(() =>
      assertReadOnlyCommand("find '/root/.pedalboards' -maxdepth 1 -type d -print")
    ).not.toThrow();
    expect(() => assertReadOnlyCommand("lv2ls -n")).not.toThrow();
  });

  it("rejects mutation commands", () => {
    expect(() => assertReadOnlyCommand("rm -rf /root/.pedalboards")).toThrow(
      ReadOnlyViolationError
    );
    expect(() => assertReadOnlyCommand("echo test > /root/data/banks.json")).toThrow(
      ReadOnlyViolationError
    );
    expect(() => assertReadOnlyCommand("modprobe rtl8192cu")).toThrow(ReadOnlyViolationError);
    expect(() => assertReadOnlyCommand("reboot")).toThrow(ReadOnlyViolationError);
  });
});
