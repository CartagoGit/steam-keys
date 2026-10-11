import { useState, type ReactNode } from 'react';
import { Icon, type IconName } from './icon.component';

export interface IBadgeProps {
  label: string;
  tone?: string;
  icon?: IconName;
  title?: string;
  size?: 'sm' | 'md';
}

/** Pastilla compacta para estados y plataformas. */
export function Badge({ label, tone = '', icon, title, size = 'sm' }: IBadgeProps) {
  return (
    <span
      title={title}
      className={[
        'inline-flex items-center gap-1 rounded-full ring-1 font-medium whitespace-nowrap',
        size === 'sm' ? 'px-2 py-0.5 text-[11px]' : 'px-2.5 py-1 text-xs',
        tone,
      ].join(' ')}
    >
      {icon ? <Icon name={icon} size={size === 'sm' ? 11 : 13} /> : null}
      {label}
    </span>
  );
}

export interface IButtonProps {
  children: ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'ghost' | 'danger' | 'subtle';
  size?: 'sm' | 'md';
  icon?: IconName;
  iconRight?: IconName;
  disabled?: boolean;
  title?: string;
  type?: 'button' | 'submit';
  full?: boolean;
}

const VARIANTS: Record<string, string> = {
  primary:
    'bg-accent text-on-accent hover:brightness-110 active:brightness-95 shadow-sm',
  ghost: 'text-t2 hover:bg-hover hover:text-t1 active:bg-hover-2',
  subtle: 'bg-hover text-t1 ring-1 ring-line hover:bg-hover-2',
  danger: 'bg-danger text-on-accent hover:brightness-110 active:brightness-95',
};

export function Button({
  children,
  onClick,
  variant = 'subtle',
  size = 'md',
  icon,
  iconRight,
  disabled,
  title,
  type = 'button',
  full,
}: IButtonProps) {
  return (
    <button
      type={type}
      title={title}
      disabled={disabled}
      onClick={onClick}
      className={[
        'inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors',
        'disabled:cursor-not-allowed disabled:opacity-40',
        size === 'sm' ? 'px-2.5 py-1.5 text-xs' : 'px-3.5 py-2 text-sm',
        full ? 'w-full' : '',
        VARIANTS[variant] ?? VARIANTS.subtle,
      ].join(' ')}
    >
      {icon ? <Icon name={icon} size={size === 'sm' ? 13 : 15} /> : null}
      {children}
      {iconRight ? <Icon name={iconRight} size={size === 'sm' ? 13 : 15} /> : null}
    </button>
  );
}

export interface IFieldProps {
  label: string;
  children: ReactNode;
  /**
   * Texto de ayuda.
   *
   * Acepta un nodo y no solo una cadena porque algunos avisos necesitan un
   * enlace de verdad dentro: «Pedir la clave en steamcommunity.com/dev/apikey»
   * escrito como texto obliga a copiarlo y pegarlo a mano en el navegador, que
   * es justo el rodeo que hace que alguien no llegue a pedirla.
   */
  hint?: ReactNode;
  required?: boolean;
}

export function Field({ label, children, hint, required }: IFieldProps) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-medium tracking-wide text-t3 uppercase">
        {label}
        {required ? <span className="ml-1 text-danger">*</span> : null}
      </span>
      {children}
      {hint ? <span className="text-xs text-t4">{hint}</span> : null}
    </label>
  );
}

export interface IExternalLinkProps {
  /** Se abre en el navegador del sistema, no dentro de la ventana de la app. */
  url: string;
  children: ReactNode;
  /** Si se escribe la URL en vez de un texto corto. */
  showUrl?: boolean;
}

/**
 * Enlace que abre en el navegador del sistema.
 *
 * Se pone `target="_blank"` y ademas se intercepta el clic para llamar a
 * `window.open`. Lo segundo no sobra: en una ventana de escritorio el motor
 * no siempre recoge el `_blank`, y sin el `preventDefault` lo que ocurre en
 * el peor caso es peor que no abrirse nada — la propia ventana de la app navega
 * a la web externa y la aplicacion se queda en blanco, con el trabajo sin
 * guardar a la vista.
 *
 * Sigue siendo un `<a href>` de verdad y no un `button`: se ve la URL al
 * pasar el raton, se puede copiar el enlace con el boton derecho y se puede
 * abrir en otra pestana con el boton central. Todo eso se pierde con un
 * `button` que solo llama a `window.open`.
 */
export function ExternalLink({ url, children, showUrl = false }: IExternalLinkProps) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer noopener"
      onClick={(event) => {
        event.preventDefault();
        window.open(url, '_blank', 'noopener,noreferrer');
      }}
      title={url}
      className="inline-flex items-center gap-1 text-info underline decoration-info/40 underline-offset-2 transition hover:decoration-info"
    >
      {showUrl ? url.replace(/^https?:\/\//, '') : children}
      <Icon name="external" size={11} className="shrink-0" />
    </a>
  );
}

export const INPUT_CLASS =
  'w-full rounded-lg bg-surface-2 px-3 py-2 text-sm text-t1 ring-1 ring-line ' +
  'placeholder:text-t5 transition focus:bg-surface-3 focus:ring-2 focus:ring-accent focus:outline-none';

export const SELECT_CLASS = `${INPUT_CLASS} appearance-none cursor-pointer`;

export interface IPasswordInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  /** Texto del boton cuando la clave esta tapada. */
  labelVisible?: string;
  /** Texto del boton cuando la clave esta a la vista. */
  labelHidden?: string;
}

/**
 * Campo de clave con el boton de mostrar y ocultar.
 *
 * El boton va **dentro** del input y no al lado porque si va fuera, el texto se
 * acorta y la clave se ve cortada justo por el medio, que es justo el sitio
 * donde no quieres que alguien mire. Ademas al ser un boton dentro del campo
 * hay que impedir que el clic se convierta en "el campo pierde el foco", que
 * es lo que hace un label por defecto.
 */
export function PasswordInput({
  value,
  onChange,
  placeholder,
  labelVisible = 'Ver la clave',
  labelHidden = 'Ocultar la clave',
}: IPasswordInputProps) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="relative">
      <input
        type={visible ? 'text' : 'password'}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        autoComplete="off"
        spellCheck={false}
        className={`${INPUT_CLASS} pr-10 font-mono`}
      />

      <button
        type="button"
        // Sin este `preventDefault`, el clic saca el foco del campo y la
        // capitalizacion automatica del navegador puede volver a tapar lo
        // justo que se estaba escribiendo.
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => setVisible((actual) => !actual)}
        title={visible ? labelHidden : labelVisible}
        aria-label={visible ? labelHidden : labelVisible}
        className="absolute inset-y-0 right-0 flex w-10 items-center justify-center rounded-r-lg text-t4 transition hover:text-t1 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-accent"
      >
        <Icon name={visible ? 'eye-off' : 'eye'} size={15} />
      </button>
    </div>
  );
}