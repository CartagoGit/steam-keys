import type { KeyPlatform } from '../enums/key-platform.enum';
import type { ParsedKeyKind } from '../enums/parsed-key-kind.enum';
import type { ParsedIssueReason } from '../enums/parsed-issue-reason.enum';

/** Una clave localizada dentro de una linea, con su posicion y su contexto. */
export interface IParsedKeyToken {
  value: string;
  kind: ParsedKeyKind;
  /** Indice inicial de la clave en la linea original. */
  start: number;
  /** Indice final (exclusivo) de la clave en la linea original. */
  end: number;
  /** URL original, cuando la clave viene dentro de un enlace de Humble. */
  sourceUrl: string | null;
}

/** Una entrada ya normalizada, lista para insertar en la base de datos. */
export interface IParsedEntry {
  title: string;
  keyValue: string;
  platform: KeyPlatform;
  /** Estado deducido: `gifted` si la linea llevaba el guion inicial. */
  status: import('../enums/key-status.enum').KeyStatus;
  keyKind: ParsedKeyKind;
  /** `true` cuando el TXT marcaba la linea con el guion inicial. */
  gifted: boolean;
  giftedTo: string | null;
  parentTitle: string | null;
  note: string | null;
  tags: readonly string[];
  addedOn: string | null;
  /** Numero de linea en el TXT de origen (1-indexado), para depurar. */
  sourceLine: number;
}

/** Una linea que el parser no ha podido entender del todo. */
export interface IParsedIssue {
  sourceLine: number;
  /** Linea original. Puede contener la clave: enmascararla antes de mostrarla. */
  rawLine: string;
  reason: ParsedIssueReason;
  detail: string;
}

/** Resultado completo de parsear el TXT. */
export interface IParseResult {
  entries: readonly IParsedEntry[];
  issues: readonly IParsedIssue[];
  stats: IParseStats;
}

/** Metricas del parseo, seguras de mostrar (no contienen ninguna clave). */
export interface IParseStats {
  totalLines: number;
  parsedLines: number;
  skippedLines: number;
  gifted: number;
  available: number;
  byPlatform: Readonly<Record<string, number>>;
  duplicates: number;
}

/** Opciones del parser. */
export interface IParseOptions {
  /** Ignora claves ya presentes en la base de datos (comparacion normalizada). */
  existingKeys?: readonly string[];
  /** Deduplica claves repetidas dentro del propio TXT. Por defecto `true`. */
  dedupe?: boolean;
}