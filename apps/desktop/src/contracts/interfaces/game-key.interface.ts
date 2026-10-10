import type { KeyPlatform } from '../enums/key-platform.enum';
import type { KeySource } from '../enums/key-source.enum';
import type { KeyStatus } from '../enums/key-status.enum';

/**
 * Una fila de la tabla `game_keys`.
 *
 * Un mismo juego puede repetirse con varias keys distintas, asi que la entidad
 * es la *key*, no el juego. El titulo hace de identidad legible.
 */
export interface IGameKey {
  readonly id: number;
  /** Nombre del juego. Limpio: sin guiones, sin `Steam Key:`, sin tabs. */
  title: string;
  /** Texto exacto de la clave, tal cual se guarda y se puede canjear. */
  keyValue: string;
  platform: KeyPlatform;
  status: KeyStatus;
  source: KeySource;
  /** A quien se la regalaste, si consta. */
  giftedTo: string | null;
  /** Juego padre cuando la entrada es un DLC o contenido adicional. */
  parentTitle: string | null;
  /** Texto libre: promo de origen, fecha, instrucciones... */
  note: string | null;
  /** Etiquetas para filtrar (humble, dlc, promo...). */
  tags: readonly string[];
  /** Fecha de la cabecera `# dd-mm-aa` del TXT, en ISO. */
  addedOn: string | null;
  /** Ultima vez que se abrio/canjeo la key, en ISO. */
  lastUsedAt: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

/** Campos que el usuario puede editar desde la UI. */
export interface IGameKeyDraft {
  title: string;
  keyValue: string;
  platform: KeyPlatform;
  status: KeyStatus;
  giftedTo: string | null;
  parentTitle: string | null;
  note: string | null;
  tags: readonly string[];
  addedOn: string | null;
}

/** Una key creada desde cero: lo unico que se rellena a mano. */
export interface IGameKeyInput {
  title: string;
  keyValue: string;
  platform?: KeyPlatform;
  status?: KeyStatus;
  giftedTo?: string | null;
  parentTitle?: string | null;
  note?: string | null;
  tags?: readonly string[];
  addedOn?: string | null;
}