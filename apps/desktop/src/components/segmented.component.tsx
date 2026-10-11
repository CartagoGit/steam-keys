import type { IconName } from './icon.component';

/** Una opcion de un grupo de opciones excluyentes. */
export interface ISegmentOption<T> {
  value: T;
  /** Clave de traduccion del texto. */
  label: string;
  icon?: IconName;
}

export interface ISegmentedProps<T extends string> {
  options: readonly ISegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
  /**
   * Por que no se puede cambiar ahora mismo. Si viene, el grupo entero se
   * apaga y el tooltip lo explica.
   */
  disabled?: boolean;
  /** Texto del tooltip cuando esta apagado. */
  disabledTitle?: string;
  /** Colores del grupo: cambia segun para que sirve cada filtro. */
  tone?: 'neutral' | 'emerald' | 'amber' | 'violet';
  /** Nombre accesible del grupo. */
  label: string;
}

/** Los colores de cada tono: el anillo y el fondo del boton activo. */
type TTono = NonNullable<ISegmentedProps<string>["tone"]>;

const TONES: Record<TTono, { anillo: string; fondo: string; texto: string }> = {
  neutral: {
    anillo: 'ring-info/60 bg-info/15 text-info',
    fondo: 'ring-line-strong',
    texto: 'text-t2',
  },
  emerald: {
    anillo: 'ring-ok/60 bg-ok/15 text-ok',
    fondo: 'ring-line-strong',
    texto: 'text-t2',
  },
  amber: {
    anillo: 'ring-warn/60 bg-warn/15 text-warn',
    fondo: 'ring-line-strong',
    texto: 'text-t2',
  },
  violet: {
    anillo: 'ring-info/60 bg-info/15 text-info',
    fondo: 'ring-line-strong',
    texto: 'text-t2',
  },
};

/**
 * Grupo de opciones excluyentes, en plan selector de canal de television.
 *
 * Antes eran dos interruptores sueltos con un texto largo cada uno
 * ("Solo disponibles" y "Solo DLC"), que ocupaban media fila y no dejaban
 * claro que eran dos opciones de un mismo grupo. Con esto se ve de un vistazo
 * que son tres valores de la misma cosa, y solo uno puede estar activo.
 *
 * Cuando `disabled` llega, el grupo entero se apaga: no tiene sentido dejar
 * activo un filtro que ya no hace nada.
 */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  disabled = false,
  disabledTitle,
  tone = 'neutral',
  label,
}: ISegmentedProps<T>) {
  const colores = TONES[tone] ?? TONES['neutral']!;

  return (
    <div
      role="radiogroup"
      aria-label={label}
      title={disabled ? disabledTitle : undefined}
      className="flex shrink-0 items-center gap-1.5"
    >
      <span className="text-[10px] font-medium tracking-wide text-t4 uppercase">
        {label}
      </span>

      <div
        className={[
          'flex items-center gap-0.5 rounded-lg p-0.5 ring-1 transition',
          disabled ? 'opacity-40' : '',
        ].join(' ')}
      >
        {options.map((option) => {
          const activo = option.value === value;

          return (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={activo}
              disabled={disabled}
              onClick={() => onChange(option.value)}
              title={activo ? undefined : option.label}
              className={[
                'inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium whitespace-nowrap transition',
                'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
                'disabled:cursor-not-allowed',
                activo
                  ? [colores.anillo, 'ring-1'].join(' ')
                  : [colores.fondo, colores.texto, 'ring-1 hover:bg-hover-2'].join(' '),
              ].join(' ')}
            >
              {option.icon ? <IconGlyph name={option.icon} /> : null}
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** El icono del boton, del mismo tamano que el texto. */
function IconGlyph({ name }: { name: IconName }) {
  return <span className="text-[13px] leading-none">{GLIFOS[name] ?? '·'}</span>;
}

/**
 * Glifos en texto plano.
 *
 * Se usan en vez de iconos SVG porque en un boton de 28 px de alto un SVG pesa
 * mas que el texto y lo descuadra; ademas el color lo hereda del boton sin
 * tener que pasarle clases.
 *
 * El tipo sale de `IconName`, no de `Record<string, string>`: con el tipo
 * abierto, anadir un icono nuevo a la enumeracion no obliga a decidir aqui si
 * lleva glifo o no, y el `?? '·'` de `IconGlyph` se traga el olvido sin avisar.
 * `Partial` mantiene esa red de seguridad sin fingir que todos los iconos
 * tienen glifo: hoy `check-circle` comparte glifo con `check`, y el resto
 * (flechas, lapiz...) no se usan en este boton y se dibujarian como punto.
 */
const GLIFOS: Partial<Readonly<Record<IconName, string>>> = {
  check: '✓',
  'check-circle': '✓',
  gamepad: '\u{1F3AE}',
  package: '\u{1F4E6}',
  filter: '\u{1F50D}',
  layers: '\u{1F5C2}',
};