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
/** El azul del fondo, para el hueco del aro: no blanco ni negro. */
const BACKGROUND_DEEP: IRgba = { r: 37, g: 99, b: 235, a: 255 };

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

/**
 * El dibujo del icono.
 *
 * Una llave blanca sobre azul era bonito a 1024 px y **ilegible a 16 px**, que
 * es el tamano que se ve en la barra del navegador, en la barra de tareas y en
 * el dock. A ese tamano solo se distingue una mancha con dos puntitos.
 *
 * Lo que se dibuja ahora son tres cosas y solo tres, y todas se leen a 16 px:
 *
 * 1. Un aro grueso a la **izquierda**: la cabeza de la llave. Es la forma que
 *    la gente asocia con "clave" de todo el mundo, sin depender de ningun
 *    logo.
 * 2. Una barra horizontal que sale a la derecha: el vastago.
 * 3. **Un diente** en el extremo. Un solo diente grande vale mas que tres
 *    pequenos: a 16 px solo se ve uno y se lee; con tres se convierte en un
 *    borde irregular que parece ruido.
 *
 * El aro y el diente van separados por el hueco del vastago, que es lo que hace
 * que la silueta siga siendo reconocible aunque se pixele mucho.
 */
function drawIcon(): Uint8Array {
  const canvas = createCanvas(SIZE);

  // ---------------------------------------------------------- fondo ---
  // Degradado diagonal en vez de vertical: con el vertical, la parte de abajo
  // del aro se pierde en el azul oscuro en las pantallas OLED.
  const margin = 64;
  const radius = 216;

  for (let y = 0; y < SIZE; y += 1) {
    for (let x = 0; x < SIZE; x += 1) {
      const ratio = (x + y) / (SIZE * 2);

      const color: IRgba = {
        r: Math.round(BACKGROUND_TOP.r + (BACKGROUND_BOTTOM.r - BACKGROUND_TOP.r) * ratio),
        g: Math.round(BACKGROUND_TOP.g + (BACKGROUND_BOTTOM.g - BACKGROUND_TOP.g) * ratio),
        b: Math.round(BACKGROUND_TOP.b + (BACKGROUND_BOTTOM.b - BACKGROUND_TOP.b) * ratio),
        a: 255,
      };

      const dx = Math.max(margin + radius - x, x - (SIZE - margin - radius - 1), 0);
      const dy = Math.max(margin + radius - y, y - (SIZE - margin - radius - 1), 0);
      const distance = Math.hypot(dx, dy);

      if (distance <= radius) setPixel(canvas, x, y, color, 1);
      else if (distance <= radius + 1) setPixel(canvas, x, y, color, radius + 1 - distance);
    }
  }

  // ----------------------------------------------------------- llave ---
  // La cabeza se situa en el tercio izquierdo y algo mas arriba: con el centro
  // optico, el espacio que queda a la derecha para el vastago es el justo, sin
  // tener que achicar la llave hasta hacerla fina.
  const cx = 384;
  const cy = 470;

  const outer = 190;
  const inner = 100;

  // Aro. Grueso a proposito: `outer - inner` son 88 px sobre 1024, que a 16 px
  // son algo mas de uno. Un aro mas fino desaparece del todo.
  ring(canvas, cx, cy, outer, inner, FOREGROUND);

  // El hueco del aro lleva el azul del fondo, no blanco: si no, la cabeza se
  // lee como un disco y se pierde la silueta de llave.
  disc(canvas, cx, cy, inner - 10, BACKGROUND_DEEP);

  // Vstago: sale de la cabeza y llega casi al borde derecho.
  const shaftStart = cx + inner - 44;
  const shaftEnd = SIZE - margin - 116;
  roundedRect(canvas, shaftStart, cy - 50, shaftEnd - shaftStart, 100, 26, FOREGROUND);

  // Un unico diente grande hacia abajo, a dos tercios del vastago. Es lo que
  // convierte una barra en una llave a primera vista.
  const toothX = shaftStart + (shaftEnd - shaftStart) * 0.52;
  roundedRect(canvas, toothX, cy + 34, 74, 190, 26, FOREGROUND);

  return canvas;
}

/**
 * El icono reducido, para el favicon.
 *
 * La primera version dibujaba un aro con un diente pegado debajo y salia un
 * amasijo sin forma: a 32 px el aro se cerraba y el diente se fundia con el.
 * No era un problema de tamano sino de **dibujo**: dos formas que se tocan y
 * compiten por el mismo espacio.
 *
 * Aqui se dibuja **la misma llave** que en el icono grande, y solo se le
 * engordan las partes. Es lo unico que hace falta: la silueta ya funciona a
 * 1024 px y a 16 px lo unico que hay que lograr es que las tres piezas —aro,
 * vastago, diente— sigan siendo tres piezas separadas.
 *
 * Dos cambios concretos para el tamano pequeno:
 *
 * - El hueco del aro es proporcionalmente mas pequeno. A 16 px un hueco de
 *   tamano normal se lo come el redondeo y el aro se convierte en un disco.
 * - La llave se dibuja un poco mas grande dentro del lienzo, porque en un
 *   favicon no hay margen que desperdiciar: cada pixel cuenta.
 */
function drawFavicon(_size: number): Uint8Array {
  const canvas = createCanvas(SIZE);

  // ---------------------------------------------------------- fondo ---
  // Sin esquinas redondeadas: en la barra del navegador un rectángulo de 32 px
  // es indistinguible de uno redondeado, y las esquinas redondeadas dejarian
  // cuatro pixeles del fondo del navegador asomando por las esquinas.
  for (let y = 0; y < SIZE; y += 1) {
    for (let x = 0; x < SIZE; x += 1) {
      const ratio = (x + y) / (SIZE * 2);

      setPixel(canvas, x, y, {
        r: Math.round(BACKGROUND_TOP.r + (BACKGROUND_BOTTOM.r - BACKGROUND_TOP.r) * ratio),
        g: Math.round(BACKGROUND_TOP.g + (BACKGROUND_BOTTOM.g - BACKGROUND_TOP.g) * ratio),
        b: Math.round(BACKGROUND_TOP.b + (BACKGROUND_BOTTOM.b - BACKGROUND_TOP.b) * ratio),
        a: 255,
      }, 1);
    }
  }

  // ----------------------------------------------------------- llave ---
  // Las proporciones son las del icono grande pero **algo mas engordadas**, y
  // la llave se centra mejor: el aro con `outer` de 222 se comia el tercio
  // izquierdo entero y el vastago salia del hueco del aro en vez de del borde,
  // que es como se leia todo junto.
  const cx = 340;
  const cy = 468;

  // Aro: 190 de radio, 84 de hueco. El grosor (106 px) es un 35% mayor que en el
  // icono grande y es lo que hace que a 16 px siga viéndose el hueco.
  const outer = 190;
  const inner = 84;

  // El vastago arranca **en el borde exterior** del aro, nunca dentro del hueco:
  // si arranca dentro, el blanco del aro y el blanco del vastago se unen y la
  // cabeza deja de leerse como un aro.
  const shaftStart = cx + outer - 62;
  const shaftEnd = SIZE - 96;
  const shaftHeight = 96;

  // El diente se coloca mas a la derecha del que en el icono grande, casi en el
  // extremo. Un diente en el centro se lee como una cruz y no como una llave.
  const toothX = shaftStart + (shaftEnd - shaftStart) * 0.62;
  roundedRect(canvas, shaftStart, cy - shaftHeight / 2, shaftEnd - shaftStart, shaftHeight, 24, FOREGROUND);
  roundedRect(canvas, toothX, cy + shaftHeight / 2 - 10, 88, 190, 24, FOREGROUND);

  ring(canvas, cx, cy, outer, inner, FOREGROUND);

  // El hueco lleva el azul del fondo: con blanco dentro, el aro se lee como un
  // disco con un agujero y se pierde la forma de llave.
  disc(canvas, cx, cy, inner, BACKGROUND_DEEP);

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

function encodePng(canvas: Uint8Array, size = SIZE): Uint8Array {
  const header = new Uint8Array(13);
  const headerView = new DataView(header.buffer);

  headerView.setUint32(0, size);
  headerView.setUint32(4, size);
  header[8] = 8; // bits por canal
  header[9] = 6; // RGBA
  header[10] = 0;
  header[11] = 0;
  header[12] = 0;

  // Cada scanline lleva delante su byte de filtro (0 = ninguno).
  const raw = new Uint8Array(size * (size * 4 + 1));

  for (let y = 0; y < size; y += 1) {
    const target = y * (size * 4 + 1);
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

// El favicon va en `public/` porque es lo que Vite copia a `build/` y es de
// donde lo lee el `index.html`. Ahi no hay que hacer nada mas.
const publicDir = join(import.meta.dir, '..', '..', 'apps', 'desktop', 'public');
mkdirSync(publicDir, { recursive: true });
writeFileSync(join(publicDir, 'favicon.png'), encodePng(drawFavicon(32)));

console.log(`Icono base generado: ${target} (${SIZE}x${SIZE})`);
console.log(`Favicon generado: ${join(publicDir, 'favicon.png')} (32x32)`);
console.log('Siguiente paso:  cd apps/desktop && bunx tauri icon ../../build/icons/icon-source.png');