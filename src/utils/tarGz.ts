import { gzipSync } from "node:zlib";

export function makeTarGz(files: Array<{ name: string; data: Buffer }>): Buffer {
  const records: Buffer[] = [];
  for (const file of files) {
    const header = Buffer.alloc(512, 0);
    writeTarString(header, 0, 100, file.name);
    writeTarOctal(header, 100, 8, 0o644);
    writeTarOctal(header, 108, 8, 0);
    writeTarOctal(header, 116, 8, 0);
    writeTarOctal(header, 124, 12, file.data.length);
    writeTarOctal(header, 136, 12, Math.floor(Date.now() / 1000));
    header.fill(0x20, 148, 156);
    header[156] = "0".charCodeAt(0);
    writeTarString(header, 257, 6, "ustar");
    writeTarString(header, 263, 2, "00");
    writeTarString(header, 265, 32, "mod-dwarf-mcp");
    writeTarString(header, 297, 32, "mod-dwarf-mcp");
    const checksum = header.reduce((sum, byte) => sum + byte, 0);
    writeTarOctal(header, 148, 8, checksum);
    records.push(header, file.data, Buffer.alloc((512 - (file.data.length % 512)) % 512, 0));
  }
  records.push(Buffer.alloc(1024, 0));
  return gzipSync(Buffer.concat(records));
}

function writeTarString(buffer: Buffer, offset: number, length: number, value: string): void {
  Buffer.from(value).copy(buffer, offset, 0, Math.min(length, Buffer.byteLength(value)));
}

function writeTarOctal(buffer: Buffer, offset: number, length: number, value: number): void {
  const text = value.toString(8).padStart(length - 1, "0");
  buffer.write(text.slice(0, length - 1), offset, length - 1, "ascii");
  buffer[offset + length - 1] = 0;
}
