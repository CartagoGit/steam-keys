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
    'bg-blue-600 text-white hover:bg-blue-500 active:bg-blue-700 shadow-sm shadow-blue-950/50',
  ghost: 'text-slate-300 hover:bg-white/5 hover:text-white active:bg-white/10',
  subtle: 'bg-white/5 text-slate-200 ring-1 ring-white/10 hover:bg-white/10',
  danger: 'bg-rose-600/90 text-white hover:bg-rose-500 active:bg-rose-600',
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
  hint?: string;
  required?: boolean;
}

export function Field({ label, children, hint, required }: IFieldProps) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-medium tracking-wide text-slate-400 uppercase">
        {label}
        {required ? <span className="ml-1 text-rose-400">*</span> : null}
      </span>
      {children}
      {hint ? <span className="text-xs text-slate-500">{hint}</span> : null}
    </label>
  );
}

export const INPUT_CLASS =
  'w-full rounded-lg bg-surface-2 px-3 py-2 text-sm text-slate-100 ring-1 ring-white/10 ' +
  'placeholder:text-slate-600 transition focus:bg-surface-3 focus:ring-2 focus:ring-blue-500/60 focus:outline-none';

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
        className="absolute inset-y-0 right-0 flex w-10 items-center justify-center rounded-r-lg text-slate-500 transition hover:text-slate-200 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-blue-400"
      >
        <Icon name={visible ? 'eye-off' : 'eye'} size={15} />
      </button>
    </div>
  );
}