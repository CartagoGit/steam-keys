/**
 * Genera el icono base de la aplicacion.
 *
 * Se dibuja por codigo y se escribe a mano un PNG (IHDR + IDAT + IEND) para no
 * depender de una libreria de imagenes ni de un binario externo. El resultado
 * se pasa despues a `tauri icon`, que genera el resto de tamanos.
 *
 *   bun run tools/scripts/generate-icons.script.ts
 *   cd apps/desktop && bunx tauri icon ../../build/icon-source.png
 */
import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const SIZE = 1024;

/** Color con canal alfa, 0-255. */
interface IRgba {
  r: number;
  g: number;
  b: number;
  a: number;
}

const BACKGROUND_TOP: IRgba = { r: 59, g: 130, b: 246, a: 255 };
const BACKGROUND_BOTTOM: IRgba = { r: 29, g: 78, b: 216, a: 255 };
const FOREGROUND: IRgba = { r: 255, g: 255, b: 255, a: 255 };

function createCanvas(size: number): Uint8Array {
  return new Uint8Array(size * size * 4);
}

function setPixel(canvas: Uint8Array, x: number, y: number, color: IRgba, alpha = 1): void {
  if (x < 0 || y < 0 || x >= SIZE || y >= SIZE) return;

  const offset = (y * SIZE + x) * 4;
  const source = color.a / 255 * alpha;

  if (source <= 0) return;

  const dstA = canvas[offset + 3] ?? 0;
  const outA = source + dstA * (1 - source);

  if (outA === 0) {
    canvas[offset] = 0;
    canvas[offset + 1] = 0;
    canvas[offset + 2] = 0;
    canvas[offset + 3] = 0;
    return;
  }

  for (let channel = 0; channel < 3; channel += 1) {
    const src = [color.r, color.g, color.b][channel] ?? 0;
    const dst = canvas[offset + channel] ?? 0;
    canvas[offset + channel] = Math.round((src * source + dst * dstA * (1 - source)) / outA);
  }

  canvas[offset + 3] = Math.round(outA * 255);
}

/** Rectangulo redondeado, con bordes suavizados por antialiasing. */
function roundedRect(
  canvas: Uint8Array,
  x0: number,
  y0: number,
  width: number,
  height: number,
  radius: number,
  color: IRgba,
): void {
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const px = x0 + x;
      const py = y0 + y;

      const dx = Math.max(x0 + radius - px, px - (x0 + width - radius - 1), 0);
      const dy = Math.max(y0 + radius - py, py - (y0 + height - radius - 1), 0);
      const distance = Math.hypot(dx, dy);

      if (distance <= radius) {
        setPixel(canvas, px, py, color, 1);
      } else if (distance <= radius + 1) {
        setPixel(canvas, px, py, color, radius + 1 - distance);
      }
    }
  }
}

/** Anillo: la parte redonda de la llave. */
function ring(
  canvas: Uint8Array,
  cx: number,
  cy: number,
  outer: number,
  inner: number,
  color: IRgba,
): void {
  for (let y = Math.floor(cy - outer - 1); y <= cy + outer + 1; y += 1) {
    for (let x = Math.floor(cx - outer - 1); x <= cx + outer + 1; x += 1) {
      const distance = Math.hypot(x - cx, y - cy);

      if (distance <= outer && distance >= inner - 1) {
        const alpha = Math.min(distance - (inner - 1), outer - distance + 1, 1);
        setPixel(canvas, Math.round(x), Math.round(y), color, Math.max(alpha, 0));
      }
    }
  }
}

/** Circulo relleno. */
function disc(canvas: Uint8Array, cx: number, cy: number, radius: number, color: IRgba): void {
  for (let y = Math.floor(cy - radius - 1); y <= cy + radius + 1; y += 1) {
    for (let x = Math.floor(cx - radius - 1); x <= cx + radius + 1; x += 1) {
      const distance = Math.hypot(x - cx, y - cy);
      if (distance <= radius) {
        setPixel(canvas, Math.round(x), Math.round(y), color, 1);
      }
    }
  }
}

function drawIcon(): Uint8Array {
  const canvas = createCanvas(SIZE);

  // Fondo redondeado con degradado vertical.
  const margin = 72;
  const size = SIZE - margin * 2;

  for (let y = 0; y < SIZE; y += 1) {
    const ratio = y / SIZE;
    const color: IRgba = {
      r: Math.round(BACKGROUND_TOP.r + (BACKGROUND_BOTTOM.r - BACKGROUND_TOP.r) * ratio),
      g: Math.round(BACKGROUND_TOP.g + (BACKGROUND_BOTTOM.g - BACKGROUND_TOP.g) * ratio),
      b: Math.round(BACKGROUND_TOP.b + (BACKGROUND_BOTTOM.b - BACKGROUND_TOP.b) * ratio),
      a: 255,
    };

    for (let x = 0; x < SIZE; x += 1) {
      const dx = Math.max(margin + 210 - x, x - (margin + size - 211), 0);
      const dy = Math.max(margin + 210 - y, y - (margin + size - 211), 0);
      const distance = Math.hypot(dx, dy);

      if (distance <= 210) setPixel(canvas, x, y, color, 1);
      else if (distance <= 211) setPixel(canvas, x, y, color, 211 - distance);
    }
  }

  // Llave: aro + vstago + dientes.
  const cx = 400;
  const cy = 400;
  const outer = 168;
  const inner = 96;

  ring(canvas, cx, cy, outer, inner, FOREGROUND);
  disc(canvas, cx, cy, inner - 26, { r: 59, g: 130, b: 246, a: 255 });

  roundedRect(canvas, cx + inner - 34, cy - 46, 268, 92, 22, FOREGROUND);
  roundedRect(canvas, cx + outer + 150, cy - 46, 62, 172, 20, FOREGROUND);
  roundedRect(canvas, cx + outer + 86, cy - 46, 62, 132, 20, FOREGROUND);

  return canvas;
}

// ---------------------------------------------------------------------------
// Escritura del PNG
// ---------------------------------------------------------------------------

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);

  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }

  return table;
})();

function crc32(buffer: Uint8Array): number {
  let crc = 0xffffffff;

  for (const byte of buffer) {
    crc = (CRC_TABLE[(crc ^ byte) & 0xff] ?? 0) ^ (crc >>> 8);
  }

  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Uint8Array): Uint8Array {
  const typeBytes = new TextEncoder().encode(type);
  const body = new Uint8Array(typeBytes.length + data.length);

  body.set(typeBytes, 0);
  body.set(data, typeBytes.length);

  const out = new Uint8Array(body.length + 8);
  const view = new DataView(out.buffer);

  view.setUint32(0, data.length);
  out.set(body, 4);
  view.setUint32(body.length + 4, crc32(body));

  return out;
}

function encodePng(canvas: Uint8Array): Uint8Array {
  const header = new Uint8Array(13);
  const headerView = new DataView(header.buffer);

  headerView.setUint32(0, SIZE);
  headerView.setUint32(4, SIZE);
  header[8] = 8; // bits por canal
  header[9] = 6; // RGBA
  header[10] = 0;
  header[11] = 0;
  header[12] = 0;

  // Cada scanline lleva delante su byte de filtro (0 = ninguno).
  const raw = new Uint8Array(SIZE * (SIZE * 4 + 1));

  for (let y = 0; y < SIZE; y += 1) {
    const target = y * (SIZE * 4 + 1);
    raw[target] = 0;
    raw.set(canvas.subarray(y * SIZE * 4, (y + 1) * SIZE * 4), target + 1);
  }

  const signature = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = chunk('IHDR', header);
  const idat = chunk('IDAT', new Uint8Array(deflateSync(raw, { level: 9 })));
  const iend = chunk('IEND', new Uint8Array(0));

  const png = new Uint8Array(signature.length + ihdr.length + idat.length + iend.length);
  png.set(signature, 0);
  png.set(ihdr, signature.length);
  png.set(idat, signature.length + ihdr.length);
  png.set(iend, signature.length + ihdr.length + idat.length);

  return png;
}

// ---------------------------------------------------------------------------

const outputDir = join(import.meta.dir, '..', '..', 'build', 'icons');
mkdirSync(outputDir, { recursive: true });

const target = join(outputDir, 'icon-source.png');
writeFileSync(target, encodePng(drawIcon()));

console.log(`Icono base generado: ${target} (${SIZE}x${SIZE})`);
console.log('Siguiente paso:  cd apps/desktop && bunx tauri icon ../../build/icons/icon-source.png');