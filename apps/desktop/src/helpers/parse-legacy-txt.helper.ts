import {
  ALPHANUMERIC_KEY_PATTERN,
  BATTLENET_KEY_PATTERN,
  BLOCK_CLOSE_PATTERN,
  BLOCK_OPEN_PATTERN,
  DECORATIVE_PATTERN,
  GIFT_MARKER_PATTERN,
  HUMBLE_URL_KEY_PATTERN,
  INSTRUCTION_PATTERN,
  PLATFORM_HINT_PATTERN,
  RECIPIENT_MAX_WORDS,
  RECIPIENT_PATTERN,
  REDEEM_MARKER_PATTERN,
  SECTION_MARKER_PATTERN,
  STEAM_KEY_PATTERN,
} from '@/contracts/constants/legacy-format.constants';
import { KeyPlatform } from '@/contracts/enums/key-platform.enum';
import { KeyStatus } from '@/contracts/enums/key-status.enum';
import { ParsedIssueReason } from '@/contracts/enums/parsed-issue-reason.enum';
import { ParsedKeyKind } from '@/contracts/enums/parsed-key-kind.enum';
import type {
  IParseOptions,
  IParseResult,
  IParseStats,
  IParsedEntry,
  IParsedIssue,
  IParsedKeyToken,
} from '@/contracts/interfaces/parsed-entry.interface';
import {
  inferPlatformFromKeyShape,
  platformFromHint,
} from './detect-platform.helper';
import { parseLegacyDate } from './format-date.helper';
import {
  keyFingerprint,
  normalizeKey,
  normalizeTitle,
  stripSeparators,
} from './normalize-text.helper';

const URL_PATTERN = /https?:\/\/\S+/gi;

/** Contexto acumulado mientras se recorre el TXT linea a linea. */
interface IParserState {
  /** Fecha de la cabecera `# dd-mm-aa` vigente. */
  dateContext: string | null;
  /** Texto de la nota vigente ("ACTIVAR YO", "4 Sesion de regalos"...). */
  noteContext: string | null;
  /** Las siguientes claves son para activarlas yo, no para regalar. */
  redeemMode: boolean;
  /** Plataforma forzada por una linea de contexto del TXT. */
  platformHint: KeyPlatform | null;
  /** Primera linea sin clave vista desde el ultimo separador: el nombre. */
  orphanTitle: string | null;
  /** Ultima linea sin clave vista: la fuente o la nota. */
  orphanNote: string | null;
  /** Estamos dentro de un bloque `{ ... }` de DLC. */
  inBlock: boolean;
  /** Juego padre del bloque `{ ... }`. */
  blockParent: string | null;
}

function createState(): IParserState {
  return {
    dateContext: null,
    noteContext: null,
    redeemMode: false,
    platformHint: null,
    orphanTitle: null,
    orphanNote: null,
    inBlock: false,
    blockParent: null,
  };
}

/** Busca una URL de Humble Bundle y extrae la clave que lleva dentro. */
function findHumbleUrlToken(line: string): IParsedKeyToken | null {
  URL_PATTERN.lastIndex = 0;

  const urlMatch = URL_PATTERN.exec(line);
  if (!urlMatch) return null;

  const url = urlMatch[0];
  const keyMatch = url.match(HUMBLE_URL_KEY_PATTERN);
  if (!keyMatch || !keyMatch[1]) return null;

  const keyValue = keyMatch[1];

  // El token abarca la URL entera, no solo la clave: asi el nombre del juego
  // queda en `before` y la URL no se cuela en el titulo.
  return {
    value: keyValue,
    kind: ParsedKeyKind.HumbleUrl,
    start: urlMatch.index,
    end: urlMatch.index + url.length,
    sourceUrl: url,
  };
}

/** Busca la clave de una linea por forma, de mas a menos especifica. */
export function extractKeyToken(line: string): IParsedKeyToken | null {
  const humble = findHumbleUrlToken(line);
  if (humble) return humble;

  const steam = STEAM_KEY_PATTERN.exec(line);
  if (steam) {
    return {
      value: steam[0],
      kind: ParsedKeyKind.Steam,
      start: steam.index,
      end: steam.index + steam[0].length,
      sourceUrl: null,
    };
  }

  const battlenet = BATTLENET_KEY_PATTERN.exec(line);
  if (battlenet) {
    return {
      value: battlenet[0],
      kind: ParsedKeyKind.Alphanumeric,
      start: battlenet.index,
      end: battlenet.index + battlenet[0].length,
      sourceUrl: null,
    };
  }

  const alphanumeric = ALPHANUMERIC_KEY_PATTERN.exec(line);
  if (alphanumeric) {
    return {
      value: alphanumeric[0],
      kind: ParsedKeyKind.Alphanumeric,
      start: alphanumeric.index,
      end: alphanumeric.index + alphanumeric[0].length,
      sourceUrl: null,
    };
  }

  return null;
}

/** Un tramo de texto corto y sin cifras parece un nombre de persona. */
function looksLikeRecipient(value: string): boolean {
  const text = value.trim();
  if (!RECIPIENT_PATTERN.test(text)) return false;
  if (/\d/.test(text)) return false;

  return text.split(/\s+/).length <= RECIPIENT_MAX_WORDS;
}

/**
 * Convierte el TXT plano en entradas estructuradas.
 *
 * El archivo esta escrito a mano durante anos y mezcla seis convenciones:
 * `Nombre - KEY`, `Nombre TAB Steam Key: KEY`, `Nombre _ KEY`, la clave
 * delante del nombre, URLs de Humble Bundle, bloques `{ }` con DLC sueltos,
 * claves de Battle.net y notas al final ("- Alberto"). Todo eso se resuelve
 * aqui y lo que no se entiende se devuelve como incidencia para revisarlo a
 * mano en la app.
 */
export function parseLegacyTxt(raw: string, options: IParseOptions = {}): IParseResult {
  const { dedupe = true } = options;

  const lines = raw.split(/\r?\n/);
  const state = createState();
  const entries: IParsedEntry[] = [];
  const issues: IParsedIssue[] = [];
  const seen = new Set<string>(options.existingKeys?.map(keyFingerprint) ?? []);

  let parsedLines = 0;
  let skippedLines = 0;
  let duplicates = 0;

  const addIssue = (
    sourceLine: number,
    rawLine: string,
    reason: ParsedIssueReason,
    detail: string,
  ): void => {
    issues.push({ sourceLine, rawLine, reason, detail });
  };

  for (let index = 0; index < lines.length; index += 1) {
    const sourceLine = index + 1;
    const rawLine = lines[index] ?? '';
    const line = rawLine.trim();

    // ---------------------------------------------------------- vacias ---
    if (line.length === 0) {
      skippedLines += 1;
      continue;
    }

    // ------------------------------------------- bloques de DLC { ... } ---
    if (BLOCK_OPEN_PATTERN.test(line)) {
      state.inBlock = true;
      state.blockParent = state.orphanTitle;
      skippedLines += 1;
      continue;
    }

    if (BLOCK_CLOSE_PATTERN.test(line)) {
      state.inBlock = false;
      state.blockParent = null;
      state.orphanTitle = null;
      state.orphanNote = null;
      skippedLines += 1;
      continue;
    }

    // --------------------------------------------- cabeceras de fecha ---
    if (line.startsWith('#')) {
      const date = parseLegacyDate(line);
      if (date) {
        state.dateContext = date;
        state.orphanTitle = null;
        state.orphanNote = null;
      }
      skippedLines += 1;
      continue;
    }

    // -------------------------------------- separadores y decoracion ---
    if (DECORATIVE_PATTERN.test(line) && !line.includes('...')) {
      skippedLines += 1;
      continue;
    }

    // --------------------------------------- "4 Sesion de regalos ..." ---
    if (SECTION_MARKER_PATTERN.test(line)) {
      state.noteContext = line.replace(/^[.\s]+|[.\s]+$/g, '');
      state.redeemMode = false;
      state.orphanTitle = null;
      state.orphanNote = null;
      skippedLines += 1;
      continue;
    }

    // ----------------------------------------------- "ACTIVAR YO >>>>" ---
    if (REDEEM_MARKER_PATTERN.test(line)) {
      state.noteContext = line.replace(/[\s\-<>]+$/, '').trim();
      state.redeemMode = true;
      state.orphanTitle = null;
      state.orphanNote = null;
      skippedLines += 1;
      continue;
    }

    // ----------------------------- pistas de plataforma ("... BATTLE.NET") ---
    // Solo si la linea NO trae clave: si la trae, es una entrada normal cuyo
    // nombre puede coincidir con el nombre de una tienda ("Blade & Soul ...").
    if (
      !extractKeyToken(line) &&
      PLATFORM_HINT_PATTERN.test(line) &&
      !INSTRUCTION_PATTERN.test(line)
    ) {
      const hinted = platformFromHint(line);
      if (hinted) {
        state.platformHint = hinted;
        state.noteContext = line;
        state.orphanTitle = null;
        state.orphanNote = null;
        skippedLines += 1;
        continue;
      }
    }

    // --------------------------------- lineas de instrucciones (sin clave) ---
    if (INSTRUCTION_PATTERN.test(line) && !extractKeyToken(line)) {
      addIssue(
        sourceLine,
        line,
        ParsedIssueReason.Instrucciones,
        'Linea de instrucciones sin clave associated.',
      );
      skippedLines += 1;
      continue;
    }

    // ---------------------------------------------------------- clave ---
    const token = extractKeyToken(line);

    if (!token) {
      // Linea sin clave: candidata a nombre o a nota del siguiente bloque.
      if (state.orphanTitle === null) {
        state.orphanTitle = normalizeTitle(line);
      } else {
        state.orphanNote = normalizeTitle(line);
      }
      skippedLines += 1;
      continue;
    }

    // ------------------------------------------- basura pegada a la clave ---
    let keyValue = normalizeKey(token.value);
    const before = line.slice(0, token.start);
    let after = line.slice(token.end);

    // Casos como `SYNTHETIC-KEY-3-VFHW`: el sufijo no forma parte de la clave.
    const junkSuffix = /^[-_](\S{2,8})$/.exec(after);
    if (junkSuffix && token.kind !== ParsedKeyKind.Steam) {
      addIssue(
        sourceLine,
        line,
        ParsedIssueReason.ClaveSospechosa,
        `Sufijo "${junkSuffix[0]}" eliminado de la clave.`,
      );
      after = '';
    }

    // Deduplicar contra el TXT y contra lo que ya hay en la base de datos.
    const fingerprint = keyFingerprint(keyValue);
    if (dedupe && seen.has(fingerprint)) {
      duplicates += 1;
      addIssue(
        sourceLine,
        line,
        ParsedIssueReason.ClaveRepetidaEnLinea,
        'Clave duplicada: ya aparece en el archivo o en la base de datos.',
      );
      skippedLines += 1;
      continue;
    }
    seen.add(fingerprint);

    // ------------------------------------------------------- nombre ---
    // El guion de "regalada" solo cuenta si abre la linea. Un ` - ` detras de
    // la clave es un separador de titulo cualquiera, no una marca de regalo.
    const gifted = GIFT_MARKER_PATTERN.test(before);
    const beforeClean = stripSeparators(before);
    const afterClean = stripSeparators(after);

    let title: string;
    let giftedTo: string | null = null;

    if (beforeClean.length === 0) {
      // La clave va delante del nombre: `KEY - Two Worlds 2`.
      title = afterClean;
    } else if (gifted && afterClean.length > 0 && looksLikeRecipient(afterClean)) {
      // Linea de regalo con destinatario: `- Monkeys Island - KEY - Alberto`.
      title = beforeClean;
      giftedTo = afterClean;
    } else if (afterClean.length > 0 && beforeClean.length > 0) {
      title = `${beforeClean} ${afterClean}`;
    } else {
      title = beforeClean;
    }

    title = normalizeTitle(title);

    // Los titulos sueltos de un bloque `{ ... }` sustituyen al nombre en linea.
    const pendingTitle = state.orphanTitle;
    if (pendingTitle) {
      title = pendingTitle;
    }

    if (title.length === 0) {
      title = state.blockParent ?? 'Sin nombre';
      addIssue(
        sourceLine,
        line,
        ParsedIssueReason.SinNombre,
        'No se pudo deducir el nombre del juego.',
      );
    }

    // ---------------------------------------------------- plataforma ---
    const platform =
      state.platformHint ?? inferPlatformFromKeyShape(keyValue);

    if (platform === KeyPlatform.Unknown) {
      addIssue(
        sourceLine,
        line,
        ParsedIssueReason.ClaveSospechosa,
        'Formato de clave no reconocido: revisa la plataforma a mano.',
      );
    }

    // ------------------------------------------------------- estado ---
    const status = gifted
      ? KeyStatus.Gifted
      : state.redeemMode
        ? KeyStatus.Redeemed
        : KeyStatus.Available;

    // --------------------------------------------------------- tags ---
    const tags: string[] = [];
    if (state.blockParent || state.orphanNote) tags.push('dlc');
    if (token.kind === ParsedKeyKind.HumbleUrl) tags.push('humble');
    if (state.noteContext) tags.push('contexto');

    const note = state.orphanNote ?? state.noteContext;

    entries.push({
      title,
      keyValue,
      platform,
      status,
      keyKind: token.kind,
      gifted,
      giftedTo,
      parentTitle: state.blockParent ?? null,
      note,
      tags,
      addedOn: state.dateContext,
      sourceLine,
    });

    parsedLines += 1;

    // Limpia el contexto de lineas sueltas: ya se han consumido.
    state.orphanTitle = null;
    state.orphanNote = null;
  }

  const byPlatform: Record<string, number> = {};
  for (const entry of entries) {
    byPlatform[entry.platform] = (byPlatform[entry.platform] ?? 0) + 1;
  }

  const stats: IParseStats = {
    totalLines: lines.length,
    parsedLines,
    skippedLines,
    gifted: entries.filter((entry) => entry.gifted).length,
    available: entries.filter((entry) => entry.status === KeyStatus.Available).length,
    byPlatform,
    duplicates,
  };

  return { entries, issues, stats };
}