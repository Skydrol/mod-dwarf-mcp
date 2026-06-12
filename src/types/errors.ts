export class ModDwarfError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly cause?: unknown
  ) {
    super(message);
    this.name = "ModDwarfError";
  }
}

export class ReadOnlyViolationError extends ModDwarfError {
  constructor(command: string) {
    super(`Refusing non-read-only SSH command: ${command}`, "READ_ONLY_VIOLATION");
  }
}
