/**
 * The two files the comic is downloaded as, written by hand (no dependency):
 * a PDF with one JPEG per page, and a ZIP with the PNG pages (stored, not
 * compressed: PNG already is).
 */

const ascii = (s: string) => Uint8Array.from(s, (c) => c.charCodeAt(0) & 0xff);

function concat(parts: Uint8Array[]) {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const part of parts) {
    out.set(part, at);
    at += part.length;
  }
  return out;
}

export interface PdfPage {
  jpeg: Uint8Array;
  /** Pixel size of the JPEG. */
  width: number;
  height: number;
}

/** A PDF text string in UTF-16BE (accents survive), as hex. */
const pdfText = (s: string) => `<FEFF${Array.from({ length: s.length }, (_, i) => s.charCodeAt(i).toString(16).padStart(4, "0")).join("")}>`.toUpperCase();

/** A PDF whose pages are the given JPEG images, each filling an A4-wide page. */
export function buildPdf(pages: PdfPage[], info: { title: string }) {
  const parts: Uint8Array[] = [];
  const offsets: number[] = [];
  let length = 0;
  const push = (part: Uint8Array | string) => {
    const bytes = typeof part === "string" ? ascii(part) : part;
    parts.push(bytes);
    length += bytes.length;
  };
  const object = (id: number, body: string, stream?: Uint8Array) => {
    offsets[id] = length;
    push(`${id} 0 obj\n${body}\n`);
    if (stream) {
      push("stream\n");
      push(stream);
      push("\nendstream\n");
    }
    push("endobj\n");
  };

  // The second line marks the file as binary for tools that guess.
  push("%PDF-1.4\n");
  push(Uint8Array.of(0x25, 0xe2, 0xe3, 0xcf, 0xd3, 0x0a));
  const pageId = (i: number) => 4 + i * 3;
  object(1, "<< /Type /Catalog /Pages 2 0 R >>");
  object(2, `<< /Type /Pages /Count ${pages.length} /Kids [${pages.map((_, i) => `${pageId(i)} 0 R`).join(" ")}] >>`);
  object(3, `<< /Title ${pdfText(info.title)} /Creator (Role Quest - Chronicles Studio) >>`);
  pages.forEach((page, i) => {
    const id = pageId(i);
    const width = 595.28;
    const height = Math.round(((width * page.height) / page.width) * 100) / 100;
    const draw = ascii(`q ${width} 0 0 ${height} 0 0 cm /Im0 Do Q`);
    object(id, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${width} ${height}] /Resources << /XObject << /Im0 ${id + 2} 0 R >> >> /Contents ${id + 1} 0 R >>`);
    object(id + 1, `<< /Length ${draw.length} >>`, draw);
    object(id + 2, `<< /Type /XObject /Subtype /Image /Width ${page.width} /Height ${page.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${page.jpeg.length} >>`, page.jpeg);
  });

  const count = 4 + pages.length * 3;
  const xref = length;
  push(`xref\n0 ${count}\n0000000000 65535 f \n`);
  for (let id = 1; id < count; id++) push(`${String(offsets[id]).padStart(10, "0")} 00000 n \n`);
  push(`trailer\n<< /Size ${count} /Root 1 0 R /Info 3 0 R >>\nstartxref\n${xref}\n%%EOF\n`);
  return concat(parts);
}

const CRC_TABLE = Uint32Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

export function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/** A ZIP archive with the files stored as they are. File names in UTF-8. */
export function buildZip(files: { name: string; data: Uint8Array }[], date = new Date()) {
  const time = (date.getHours() << 11) | (date.getMinutes() << 5) | (date.getSeconds() >> 1);
  const day = ((Math.max(1980, date.getFullYear()) - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate();
  const local: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;
  for (const file of files) {
    const name = new TextEncoder().encode(file.name);
    const crc = crc32(file.data);
    // What the local header and the central directory entry share.
    const shared = new DataView(new ArrayBuffer(26));
    shared.setUint16(0, 20, true); // version needed
    shared.setUint16(2, 0x0800, true); // UTF-8 names
    shared.setUint16(4, 0, true); // stored
    shared.setUint16(6, time, true);
    shared.setUint16(8, day, true);
    shared.setUint32(10, crc, true);
    shared.setUint32(14, file.data.length, true);
    shared.setUint32(18, file.data.length, true);
    shared.setUint16(22, name.length, true);
    shared.setUint16(24, 0, true); // no extra field
    const sharedBytes = new Uint8Array(shared.buffer);

    const head = concat([Uint8Array.of(0x50, 0x4b, 0x03, 0x04), sharedBytes, name]);
    local.push(head, file.data);

    const tail = new DataView(new ArrayBuffer(14));
    tail.setUint32(10, offset, true); // comment, disk and attributes stay 0
    central.push(Uint8Array.of(0x50, 0x4b, 0x01, 0x02, 20, 0), sharedBytes, new Uint8Array(tail.buffer), name);
    offset += head.length + file.data.length;
  }
  const directory = concat(central);
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true);
  end.setUint16(8, files.length, true);
  end.setUint16(10, files.length, true);
  end.setUint32(12, directory.length, true);
  end.setUint32(16, offset, true);
  return concat([...local, directory, new Uint8Array(end.buffer)]);
}
