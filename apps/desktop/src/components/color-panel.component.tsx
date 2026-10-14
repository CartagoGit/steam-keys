import { useEffect, useMemo, useRef, useState } from 'react';

import { useT } from '@/context/locale.context';
import {
  casillaHsv,
  esColor,
  hexToRgb,
  hsvToCss,
  hsvToRgb,
  normalizaHex,
  puntoTono,
  rgbToHex,
  rgbToHsv,
  tonoDesdePunto,
  type IHsv,
} from '@/helpers/color.helper';

import { Popover } from './popover.component';

export interface IColorPanelProps {
  /** Lo que lleva el boton que abre el panel. */
  trigger: React.ComponentProps<'button'>;
  /** El color actual, o `''` si no hay. */
  value: string;
  /** Cambia el color. `''` es «sin color». */
  onChange: (color: string) => void;
}

/** Lado del disco del boton. */
const BOTON = 16;

/** Lado del cuadrado de color. */
const CUADRADO = 216;

/** Alto de la barra de tono. */
const BARRA = 12;

/**
 * Cuanto se espera antes de escribir el color.
 *
 * Un arrastre por el cuadrado son cientos de `mousemove`. Con cada uno
 * escribiendo, cada pixel era una peticion **y** una recarga de la lista de
 * etiquetas: el color tardaba un rato en verse y ademas se notaba cada
 * parpadeo. Con la espera, mover se ve al instante porque pinta en memoria, y
 * a la base solo va un color por cada vez que el raton para.
 *
 * No es un retardo a la espera de empezar —un debounce— sino uno que se
 * reinicia en cada movimiento: lo que se guarda es **el color por el que se ha
 * quedado el raton**, no el primero que se movio.
 */
const ESPERA_MS = 220;

/** El color con el que arranca el panel cuando la etiqueta no tiene ninguno. */
const SIN_COLOR: IHsv = { h: 0, s: 0, v: 0 };

/** Una posicion dentro de una superficie, de 0 a 1 en cada eje. */
interface IPunto {
  x: number;
  y: number;
}

interface IUsoPunto {
  nodo: React.RefObject<HTMLDivElement | null>;
  onPointerDown: (e: React.PointerEvent<HTMLDivElement>) => void;
  onPointerMove: (e: React.PointerEvent<HTMLDivElement>) => void;
}

/**
 * Arrastre de un punto sobre una superficie, para el cuadrado y para la barra.
 *
 * Los dos hacen lo mismo —convertir la posicion del puntero en coordenadas de
 * 0 a 1 y avisar— y solo se diferencian en como se mide. Sin esto, el manejador
 * del cuadrado esta copiado en el de la barra y un dia se arregla uno y se
 * olvida el otro.
 *
 * **No hay `requestAnimationFrame` por medio**, y es a proposito. Encolar el
 * aviso en el siguiente fotograma parece la forma fina de no pintar mas de lo
 * que se ve, pero `requestAnimationFrame` **se suspende** cuando la pagina no
 * esta pintando —una pestana de fondo, un navegador sin compositor, la ventana
 * minimizada— y entonces el panel se queda muerto: el raton por encima y el
 * color no se mueve. Un control que deja de responder segun donde mires es peor
 * que uno que repinte de mas, y lo que de verdad cuesta —la escritura en la base
 * de datos— ya lo frena la espera de `ESPERA_MS`.
 *
 * Lo que llega de `pointermove` son unos pocos numeros y el trabajo es una
 * division y una conversion mas. Se pinta lo que llega.
 *
 * `leer` y `aviso` se guardan en `ref` a proposito. Vienen de la renderizacion
 * del que llama y cambiar en cada repintorno haria que el manejador se
 * encadenara al anterior.
 */
function usePunto(
  leer: (e: React.PointerEvent<HTMLDivElement>, caja: DOMRect) => IPunto,
  aviso: (punto: IPunto) => void,
): IUsoPunto {
  const nodo = useRef<HTMLDivElement | null>(null);

  const leerActual = useRef(leer);
  const avisoActual = useRef(aviso);

  leerActual.current = leer;
  avisoActual.current = aviso;

  const situar = (e: React.PointerEvent<HTMLDivElement>): void => {
    avisoActual.current(leerActual.current(e, e.currentTarget.getBoundingClientRect()));
  };

  return {
    nodo,
    onPointerDown: (e) => {
      // Sin esto el raton sale de la superficie a mitad de arrastre y el color
      // se queda congelado en el ultimo punto, con el dedo mas alla del borde.
      e.currentTarget.setPointerCapture(e.pointerId);
      situar(e);
    },
    onPointerMove: (e) => {
      // `buttons` distingue el arrastre del simple pasar por encima: sin esto,
      // cruzar el cuadrado con el boton izquierdo pulsado cambiaria el color.
      if ((e.buttons & 1) === 0) return;

      situar(e);
    },
  };
}

/**
 * El panel de color.
 *
 * ## Por que este y no el del navegador
 *
 * `<input type="color">` trae el panel nativo, que es justo el que se pide:
 * cuadrado de saturacion, barra de tono y los campos sincronizados. Pero no se
 * puede tematizar —sale con los colores del sistema operativo— y, sobre todo,
 * no tiene forma de ofrecer **«sin color»**. Ese quitado de color es una accion
 * de verdad: la etiqueta deja de ser una caja tintada y sale como texto. Y es
 * la unica manera de deshacer la eleccion.
 *
 * Lo otro —meter el nativo dentro y poner «Sin color» al lado— tampoco vale:
 * el nativo vive fuera de la pagina, es una ventana del sistema, y al abrirlo
 * tapa justo el boton que hay que pulsar para quitar el color. Por eso lo de
 * construirlo aqui no es hacer algo peor: es la unica forma de que las tres
 * cosas —panel de verdad, estilo del tema y quitar el color— esten a la vez.
 *
 * ## Se mueve solo, sin esperar a nadie
 *
 * Cada movimiento del puntero cambia el color **al instante** y en memoria: lo
 * que se ve sale de `vivo`, que es estado local. A la base de datos va despues,
 * cuando el raton lleva un momento quieto. Antes cada pixel de arrastre era una
 * escritura y una recarga de la lista, y por eso tardaba en verse.
 *
 * `vivo` —y no `value`— es lo que pintan el disco del boton, el punto y los
 * campos. Leyendo del color guardado, el panel no se moveria hasta que pasara
 * la espera, que es justo cuando se nota que va lento.
 *
 * ## El blanco y el negro tambien se pueden elegir
 *
 * Los tres ejes van de 0 a 1, sin reservar el negro para «sin color».
 * Reservarlo haria que una etiqueta negra no se pudiera tener, y el negro es un
 * color mas.
 */
export function ColorPanel({ trigger, value, onChange }: IColorPanelProps) {
  const { t } = useT();

  const boton = useRef<HTMLButtonElement>(null);
  const espera = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [abierto, setAbierto] = useState(false);

  /*
   * El color que se ve mientras el panel esta abierto.
   *
   * `null` es «no se ha tocado»: entonces manda `value`. Cualquier otra cosa es
   * el color por el que se esta, ya escrito —`''` incluido, que es como se
   * guarda «sin color»—. Llevarlo como cadena y no como coordenadas es lo que
   * permite que quitar el color se vea en el acto: con un `IHsv` no habria
   * ningun valor que dijera «ninguno».
   *
   * Los dos se limpian al abrir. Sin eso, cerrar el panel sin tocar nada
   * dejaba el color a medias en pantalla hasta que entrara otro.
   */
  const [vivo, setVivo] = useState<string | null>(null);

  /*
   * Lo tecleado en el hexadecimal, por separado de `vivo`.
   *
   * Van en dos estados porque se estan escribiendo los dos a la vez: al teclear
   * `#A1` el campo tiene que poder mostrar `#A1`, que todavia no es un color,
   * mientras el punto del cuadrado ya se ha movido. Si el texto saliera de
   * `vivo`, cada tecleo se repondria solo y no se podria escribir nada.
   */
  const [texto, setTexto] = useState<string | null>(null);

  /*
   * Nada de escribir con el panel ya cerrado.
   *
   * La espera sobrevive a cerrarlo, y lo que pasaria sin esto es abrir el
   * panel, mover el color y cerrarlo antes de tiempo: el color se guardaria
   * despues, con el dialogo ya fuera de pantalla.
   */
  useEffect(
    () => () => {
      if (espera.current !== null) clearTimeout(espera.current);
    },
    [],
  );

  /** Agenda la escritura del color que se ha quedado puesto. */
  const programar = (color: string): void => {
    if (espera.current !== null) clearTimeout(espera.current);

    espera.current = setTimeout(() => {
      espera.current = null;
      onChange(color);
    }, ESPERA_MS);
  };

  /** Adopta un color nuevo: se ve ya y se escribe cuando el raton pare. */
  const adoptar = (color: string): void => {
    setVivo(color);
    setTexto(color === '' ? '' : color.slice(1));
    programar(color);
  };

  const enVivo = vivo ?? value;

  /*
   * Los tres ejes del panel salen del color que se ve, no del guardado.
   *
   * Sin color no hay nada que colocar en el cuadrado, y el negro es lo unico
   * que no dice nada: es el origen de los tres ejes y no sugiere ningun color.
   */
  const hsv = useMemo(
    () => (enVivo === '' ? SIN_COLOR : rgbToHsv(hexToRgb(enVivo))),
    [enVivo],
  );

  const rgb = hsvToRgb(hsv);

  const enCuadrado = usePunto(
    (e, caja) => ({
      x: (e.clientX - caja.left) / caja.width,
      y: (e.clientY - caja.top) / caja.height,
    }),
    ({ x, y }) => adoptar(rgbToHex(hsvToRgb(casillaHsv(hsv.h, x, y)))),
  );

  const enBarra = usePunto(
    (e, caja) => ({ x: (e.clientX - caja.left) / caja.width, y: 0 }),
    ({ x }) => adoptar(rgbToHex(hsvToRgb({ ...hsv, h: tonoDesdePunto(x) }))),
  );

  /**
   * Teclear un hexadecimal mueve el punto, y al reves.
   *
   * Acepta tres o seis digitos porque es lo que se escribe: `#ABC` es un
   * atajo legitimo y obligar a los seis solo haria que el punto se quedara
   * quieto hasta el ultimo. Lo que no es un color se ignora en vez de
   * conectarse: un `''` a medio teclear es el estado normal del campo.
   */
  const escribirHex = (escrito: string): void => {
    const limpio = escrito.replace('#', '');

    setTexto(limpio);

    if (!esColor(`#${limpio}`)) return;

    const color = normalizaHex(`#${limpio}`);

    setVivo(color);
    programar(color);
  };

  const cerrar = (): void => {
    setAbierto(false);
    setVivo(null);
    setTexto(null);
  };

  return (
    <>
      <button
        ref={boton}
        type="button"
        aria-expanded={abierto}
        onClick={() => setAbierto((v) => !v)}
        {...trigger}
        className={[trigger.className ?? '', 'shrink-0 rounded-full'].join(' ')}
        style={{ width: BOTON, height: BOTON }}
      >
        {/*
          Sin color el disco **no se inventa uno**: sale un circulo de
          contorno. Poner el color del tema —«el color por defecto», que ya no
          existe— seria mentir sobre lo que hay, y un boton gris sin mas no
          dice si la etiqueta no tiene color o si el boton esta apagado.
        */}
        <span
          aria-hidden="true"
          className={
            enVivo === ''
              ? 'block rounded-full border border-dashed border-line-strong'
              : 'block rounded-full ring-1 ring-borde'
          }
          style={{
            width: BOTON,
            height: BOTON,
            backgroundColor: enVivo === '' ? 'transparent' : enVivo,
          }}
        />
      </button>

      <Popover
        abierto={abierto}
        ancla={boton}
        onCerrar={cerrar}
        lado="derecha"
        esLista={false}
        ancho={CUADRADO + 8}
        aria-label={t('tags.color.label')}
      >
        {/*
          El ancho lo manda el cuadrado, no el contenido.

          Con una columna de `w-fit` el ancho lo decide la fila mas ancha —la
          del hexadecimal y el `rgb`— y como el panel tiene un ancho fijo se
          salen por la derecha: el `rgb` quedaba cortado contra el borde y su
          ultimo numero se perdia. Fijar la columna al cuadrado hace que sea el
          hexadecimal el que cede, que es el que puede.
        */}
        <div className="flex flex-col" style={{ width: CUADRADO }}>
          {/* ----------------------------------------- cuadrado --- */}
          <div
            ref={enCuadrado.nodo}
            role="application"
            aria-label={t('tags.color.square')}
            onPointerDown={enCuadrado.onPointerDown}
            onPointerMove={enCuadrado.onPointerMove}
            className="relative touch-none rounded-md"
            style={{
              width: CUADRADO,
              height: CUADRADO,
              backgroundColor: hsvToCss({ h: hsv.h, s: 1, v: 1 }),
              /*
                El blanco de arriba y el negro de abajo: la capa de saturacion
                va de blanco a transparente y la de valor, encima, de
                transparente a negro. Sin esto el cuadrado seria un tono plano y
                no habria donde elegir.
              */
              backgroundImage:
                'linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, transparent)',
            }}
          >
            {/*
              El punto va al centro de la casilla y no en su esquina: el raton
              esta sobre la esquina y el punto se va medio ancho y medio alto
              hacia dentro. Con `translate(-50%)` en los dos ejes sale centrado,
              que es lo que hace el panel nativo.
            */}
            <span
              aria-hidden="true"
              className="pointer-events-none absolute h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white"
              style={{
                left: `${hsv.s * 100}%`,
                top: `${(1 - hsv.v) * 100}%`,
                boxShadow: '0 0 0 1px #0006',
                backgroundColor: enVivo,
              }}
            />
          </div>

          {/* ----------------------------------------------- tono --- */}
          <div
            ref={enBarra.nodo}
            role="application"
            aria-label={t('tags.color.hue')}
            onPointerDown={enBarra.onPointerDown}
            onPointerMove={enBarra.onPointerMove}
            className="relative mt-3 touch-none rounded-full"
            style={{
              width: CUADRADO,
              height: BARRA,
              /*
                Los seis tramos del circulo de tono, a mano. Sin ponerlos sale
                un degradado de rojo a rojo por el defecto de `red`, que no
                deja ver el paso por el magenta ni por el amarillo.
              */
              backgroundImage:
                'linear-gradient(to right, #f00, #ff0, #0f0, #0ff, #00f, #f0f, #f00)',
            }}
          >
            <span
              aria-hidden="true"
              className="pointer-events-none absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white"
              style={{
                left: `${puntoTono(hsv.h) * 100}%`,
                boxShadow: '0 0 0 1px #0006',
                backgroundColor: hsvToCss({ h: hsv.h, s: 1, v: 1 }),
              }}
            />
          </div>

          {/* ------------------------------------------ hex y rgb --- */}
          <div className="mt-3 flex items-center gap-2">
            {/*
              La muestra del color que se esta escribiendo. Va antes de los
              campos porque es la unica parte del panel que se parece a lo que
              va a salir al final, y mirarla mientras se teclea es justo para
              lo que sirve.
            */}
            <span
              aria-hidden="true"
              className="h-6 w-6 shrink-0 rounded-md ring-1 ring-line-strong"
              style={{ backgroundColor: enVivo === '' ? 'transparent' : enVivo }}
            />

            <label className="flex min-w-0 flex-1 items-center gap-1 rounded-md bg-hover px-1.5 py-1 ring-1 ring-line">
              <span className="shrink-0 text-[10px] font-medium text-t4">#</span>
              <input
                /*
                 * El texto sale siempre en mayusculas, incluso el que ya venia
                 * escrito en minusculas: el campo tiene una sola forma o se ve
                 * como si estuviera a medio teclear.
                 */
                value={texto ?? (enVivo === '' ? '' : normalizaHex(enVivo).slice(1))}
                onChange={(e) => escribirHex(e.target.value)}
                maxLength={6}
                spellCheck={false}
                aria-label={t('tags.color.hex')}
                className="min-w-0 flex-1 bg-transparent text-[11px] uppercase text-t1 outline-none"
              />
            </label>

            {/*
              El `rgb` sale, no se teclea: son tres numeros que dependen de un
              canal de 255 cada uno, y escribirlos a mano para verlos acaba
              cambiando el color. Va a la derecha del hexadecimal porque es la
              misma informacion en otro formato, no una opcion mas.
            */}
            <span
              aria-label={t('tags.color.rgb')}
              className="w-[5.25rem] shrink-0 rounded-md bg-hover px-1.5 py-1 text-[11px] tabular-nums text-t1 ring-1 ring-line"
            >
              {rgb.r}, {rgb.g}, {rgb.b}
            </span>
          </div>

          {/* ------------------------------------------- sin color --- */}
          {/*
            Quitar el color va **dentro** del panel y no con una aspa pegada al
            disco. Con la aspa, «quitar el color» y «quitar la etiqueta» se
            parecian mucho: los dos son una cruz en circulo y los dos
            desaparecen. Uno deja de pintar la etiqueta y el otro se la quita de
            la clave, que es bastante mas serio.
          */}
          <button
            type="button"
            aria-pressed={enVivo === ''}
            onClick={() => {
              setVivo('');
              setTexto('');
              programar('');
            }}
            className={[
              'mt-3 flex w-full items-center gap-2 rounded-md px-1.5 py-1 text-left text-[11px]',
              /*
                Se marca la fila activa. Sin esto, quitar el color y volver a
                ponerlo es indistinguishable de no haber hecho nada: el
                cuadrado y el disco se ven igual de vacios y no hay forma de
                saber si la etiqueta esta sin pintar o si el panel no ha
                guardado el cambio.
              */
              enVivo === '' ? 'bg-hover text-t1' : 'text-t3 hover:bg-hover hover:text-t1',
            ].join(' ')}
          >
            <span
              aria-hidden="true"
              className={[
                'block h-4 w-4 shrink-0 rounded-full border border-dashed border-line-strong',
                enVivo === '' ? 'ring-1 ring-line-strong' : '',
              ].join(' ')}
            />
            {t('tags.color.none')}
          </button>
        </div>
      </Popover>
    </>
  );
}