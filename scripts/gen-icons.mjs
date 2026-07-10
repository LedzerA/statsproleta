// Gera public/icon-192.png e public/icon-512.png (bola estilizada verde/creme)
// sem dependências externas: desenha por pixel e codifica PNG na mão.
import { deflateSync } from "node:zlib";
import { writeFileSync } from "node:fs";

const GREEN = [8, 53, 31], CREAM = [242, 235, 214];

function makeIcon(size) {
  const px = new Uint8Array(size * size * 4);
  const c = size / 2;
  const rOuterRing = size * 0.293, ringW = size * 0.05, rCenter = size * 0.11;
  const rx = size * 0.1875; // cantos arredondados
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      // máscara de canto arredondado
      const dx = Math.max(rx - x, x - (size - 1 - rx), 0);
      const dy = Math.max(rx - y, y - (size - 1 - rx), 0);
      if (Math.hypot(dx, dy) > rx) { px[i + 3] = 0; continue; }
      const d = Math.hypot(x - c, y - c);
      const onRing = Math.abs(d - rOuterRing) <= ringW / 2;
      const inCenter = d <= rCenter;
      const [r, g, b] = onRing || inCenter ? CREAM : GREEN;
      px[i] = r; px[i + 1] = g; px[i + 2] = b; px[i + 3] = 255;
    }
  }
  return encodePNG(size, size, px);
}

function crc32(buf) {
  let c, table = crc32.table;
  if (!table) {
    table = crc32.table = new Int32Array(256);
    for (let n = 0; n < 256; n++) {
      c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      table[n] = c;
    }
  }
  c = -1;
  for (let i = 0; i < buf.length; i++) c = (c >>> 8) ^ table[(c ^ buf[i]) & 0xff];
  return (c ^ -1) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function encodePNG(w, h, rgba) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 6; // 8-bit RGBA
  const raw = Buffer.alloc(h * (1 + w * 4));
  for (let y = 0; y < h; y++) {
    raw[y * (1 + w * 4)] = 0; // filtro none
    Buffer.from(rgba.buffer, y * w * 4, w * 4).copy(raw, y * (1 + w * 4) + 1);
  }
  return Buffer.concat([
    sig,
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

for (const size of [192, 512]) {
  writeFileSync(new URL(`../public/icon-${size}.png`, import.meta.url), makeIcon(size));
  console.log(`icon-${size}.png ok`);
}
