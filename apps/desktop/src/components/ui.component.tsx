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

/**
 * El tipo sale de la prop, no de `Record<string, string>`.
 *
 * Con `Record<string, ...>` el mapa acepta cualquier clave: escribir `variant="primry"`
 * compila sin decir nada y el boton sale con el estilo por defecto, porque el
 * `?? VARIANTS.subtle` de mas abajo se traga el error. Con `Record<TablaDeVariantes, string>`
 * la prop y la tabla no pueden separarse, y la comprobacion de que estan
 * completas la hace el compilador en vez de la vista.
 */
type TVariant = NonNullable<IButtonProps['variant']>;

const VARIANTS: Record<TVariant, string> = {
  /**
   * `primary` y `danger` llevan borde transparente. No es decoracion: sin
   * borde estos dos miden 40px y `ghost`/`subtle` 42, y en una misma barra dos
   * botones de la misma accion con 2px de diferencia parecen un descuido —y lo
   * es—. Con el borde transparente el alto es el mismo en las cuatro
   * variantes y el relleno de color no se ve afectado.
   */
  primary:
    'border border-transparent bg-accent text-on-accent hover:brightness-110 active:brightness-95 shadow-sm',
  /**
   * Antes era solo texto con fondo al pasar por encima, que es indistinguible
   * de una etiqueta. Con `ghost` los botones del header parecian texto plano:
   * el texto se leia bien, 7:1, pero no habia ni superficie ni borde que
   * dijera «esto se pulsa». Ahora tiene las dos, con el borde en 3:1.
   */
  ghost: 'border border-borde bg-surface-2 text-t1 hover:bg-surface-3 hover:text-t1 active:bg-surface-3',
  subtle: 'border border-borde bg-surface-2 text-t1 hover:bg-surface-3 active:bg-surface-3',
  danger: 'border border-transparent bg-danger text-on-accent hover:brightness-110 active:brightness-95',
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
        VARIANTS[variant],
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
  /**
   * Texto del tooltip, cuando lo que se ve no lo explica.
   *
   * En el pie los enlaces son **solo el icono de la marca**: el nombre de la
   * web ya esta ahi, pero un icono sin nombre es un icono sin nombre, y el
   * nombre es lo unico que dice adonde va. Va tambien como `aria-label`, que es
   * lo que lee el lector de pantalla.
   */
  title?: string;
  /**
   * Clases extra, para cuando quien lo usa necesita otra cosa ademas del
   * enlace. Va como prop y no como `className` aplicado por fuera porque el
   * componente escribe su propia lista en el `<a>` y un envoltorio con clases
   *eria una caja mas —y un `inline-flex` mas— en medio de la fila del pie.
   */
  className?: string;
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
export function ExternalLink({
  url,
  children,
  showUrl = false,
  title,
  className = '',
}: IExternalLinkProps) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer noopener"
      onClick={(event) => {
        event.preventDefault();
        window.open(url, '_blank', 'noopener,noreferrer');
      }}
      // El tooltip enseña **la URL**, que es lo que se lleva a otra parte, y no
      // el nombre del enlace. Con los dos, el nombre va como texto accesible.
      title={title ?? url}
      // El `aria-label` solo cuando hay un `title`. Con los dos a la vez, el
      // lector de pantalla anuncia el texto del `title` y el del enlace queda
      // fuera: «Codigo en GitHub: CartagoGit» en vez de «CartagoGit», que es lo
      // que se ve.
      aria-label={title}
      className={[
        'inline-flex items-center gap-1 text-info underline',
        'decoration-info/40 underline-offset-2 transition hover:decoration-info',
        className,
      ].join(' ')}
    >
      {showUrl ? url.replace(/^https?:\/\//, '') : children}

      {/*
        La flecha de «salir hacia fuera» solo cuando el enlace **no** trae ya
        una marca: con el icono de GitHub al lado, la flecha es una segunda
        señal diciendo lo mismo y lo unico que añade es ruido. Y se quita por
        `showUrl`, que es el caso en el que el texto es la propia URL y la
        flecha si dice algo.
      */}
      {showUrl ? <Icon name="external" size={11} className="shrink-0" /> : null}
    </a>
  );
}

/**
 * El borde va en `--borde` y no en `--line`.
 *
 * `--line` da 1,3:1 contra la propia superficie, que para separar bloques
 * vale, pero para el contorno de un campo deja el rectangulo deshilachado: se
 * ve el texto y no se ve donde acaba el campo. `--borde` llega a 3:1 en los
 * nueve temas, que es lo que pide la WCAG 1.4.11 para el contorno de un
 * control.
 *
 * Se separa del ancho a proposito. `INPUT_CLASS` lleva `w-full`, asi que un
 * selector que quiere **su propia** medida —«Ordenar por», que va con los
 * botones de la cabecera— no lo puede usar directamente: con las dos clases en
 * el `className` manda la que Tailwind pone despues en su CSS, no la que va la
 * ultima en la cadena, y el ancho acaba siendo el que no se queria. Quien lo
 * quiera ancho compone `CAMPO_CLASS`; quien lo quiera completo, `INPUT_CLASS`.
 */
export const CAMPO_CLASS =
  'rounded-lg border border-borde bg-surface-2 px-3 py-2 text-sm text-t1 ' +
  'placeholder:text-t4 transition focus:bg-surface-3 focus:border-accent focus:outline-none';

export const INPUT_CLASS = `${CAMPO_CLASS} w-full`;

export interface IPasswordInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  /**
   * Texto del boton cuando la clave esta tapada. Es obligatorio, y no lleva
   * valor por defecto a proposito: es el texto del boton, se ve en pantalla, y
   * un valor por defecto en castellano sale siempre en castellano en los cinco
   * idiomas. Quien lo usa tiene que traerlo ya traducido.
   */
  labelVisible: string;
  /** Texto del boton cuando la clave esta a la vista. */
  labelHidden: string;
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
  labelVisible,
  labelHidden,
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
export interface IIconButtonProps {
  icon: IconName;
  /** Texto del tooltip y, a la vez, el nombre accesible del boton. */
  title: string;
  onClick?: () => void;
  /**
   * Colores, como clases completas.
   *
   * Van completas y no como un nombre de color porque los tonos son semanticos
   * y cada tema declara los suyos en `styles/index.css`. Si aqui se tradujera
   * un `'danger'`, este boton tendria su propia tabla, distinta de la del
   * texto y la de la pastilla, y volveria a haber tres fuentes de verdad.
   */
  tone?: string;
  size?: 'sm' | 'md';
  /**
   * Apagado.
   *
   * Faltaba, y no por capricho: los botones de icono de los dialogos se
   * apagaban mientras se guardaba algo —el de renombrar, mientras se espera al
   * `await`— y como no tenian la prop se hacia con `opacity` en el tono, o no se
   * hacia. Con la prop, el estado apagado se pinta igual que en `Button`, que es
   * donde ya se sabe como se ve.
   */
  disabled?: boolean;
}

/**
 * Boton de **solo icono**: la cruz de cerrar, la lupa, el cubo de papelera.
 *
 * Estaba escrito a mano en catorce sitios de ocho ficheros, y con la mitad del
 * relleno en `p-1.5` y la otra en `p-2` para lo que es el mismo boton. En
 * `key-row` conviven los dos: dos botones de icono en la misma fila con dos
 * medidas distintas, que se nota como que uno esta desligado.
 *
 * El `title` es tambien el `aria-label`: un boton que solo tiene icono no tiene
 * nombre, y el de cerrar de uno de los dialogos se quedaba sin el —solo con
 * el tooltip, que el lector de pantalla no lee—.
 */
export function IconButton({
  icon,
  title,
  onClick,
  tone = 'text-t4 hover:text-t1',
  size = 'md',
  disabled = false,
}: IIconButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-label={title}
      disabled={disabled}
      className={[
        'rounded-lg transition hover:bg-hover',
        // El mismo `cursor` y el mismo `opacity` que `Button`. Antes solo el
        // boton de texto se enteraba de que estaba apagado, y el de icono se
        // quedaba con el mismo aspecto de siempre, sin hover pero sin rastro
        // de por que.
        'disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent',
        size === 'sm' ? 'p-1' : 'p-1.5',
        'shrink-0',
        tone,
      ].join(' ')}
    >
      <Icon name={icon} size={size === 'sm' ? 14 : 16} />
    </button>
  );
}

export interface IToggleProps {
  /** Si esta puesto. */
  marcada: boolean;
  /** Recibe el valor nuevo, para poder cambiarlo. */
  alCambiar: (marcada: boolean) => void;
  /** Icono a la izquierda. Cambia con el estado, que es lo que lo hace legible. */
  icono: IconName;
  /** Texto de la fila. */
  children: ReactNode;
}

/**
 * Una fila con casilla, al pie de un desplegable.
 *
 * Es el patron de dos sitios y estaba escrito dos veces: la del candado del
 * filtro de etiquetas y la del orden inverso. Se uniaron porque son lo mismo —
 * «una de las dos lecturas, y aqui se elige»— y porque las dos estan en el pie
 * de un `Popover`, debajo de una nota y encima de nada.
 *
 * **Casilla de Checkbox y no `switch`**, por lo mismo que el candado no es un
 * interruptor: son dos estados que no se quedan puestos al cerrar el menu, se
 * eligen y se aplican. Un interruptor promete un ajuste permanente.
 *
 * El tamano va en el `style` y no en la clase. `text-[10px]` no llega a un
 * boton porque la regla de `font: inherit` de la hoja esta **fuera** de
 * `@layer` —fuera, gana a cualquier utilidad— y como `font` es el atajo
 * completo, pisa tambien el tamano. Se veia a 16 px junto a una nota a 10, y la
 * fila parecia un titular.
 */
export function Toggle({ marcada, alCambiar, icono, children }: IToggleProps) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={marcada}
      onClick={() => alCambiar(!marcada)}
      style={{ fontSize: TAMANO_TOGGLE }}
      className={[
        'flex w-full items-center gap-2 px-3 py-2',
        'text-left leading-relaxed transition-colors',
        marcada ? 'text-t1' : 'text-t3 hover:text-t2',
      ].join(' ')}
    >
      <Icon name={icono} size={13} className="shrink-0" />
      <span>{children}</span>
    </button>
  );
}

/**
 * Tamano del texto de una fila con casilla.
 *
 * En el `style` de `Toggle` y no aqui como constante exportada: es lo unico que
 * necesita el valor y sacarlo lo que haria que se pueda cambiar sin que se
 * entere nadie. La nota de al lado, que va en un `<p>`, si usa una clase.
 */
const TAMANO_TOGGLE = '10px';
