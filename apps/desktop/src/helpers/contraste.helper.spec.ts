import { describe, expect, test } from 'bun:test';

import { join } from 'node:path';

/**
 * Guardas del contraste en la hoja de estilos.
 *
 * La app no tiene ESLint —los equivalentes son estos tests—, asi que la hoja
 * de estilos no la mira nadie hasta que algo se ve raro. Y en CSS casi todo
 * lo que se ve raro es un color: un `#fff` al 5 % que alguien puso creyendo
 * que era «gris claro», o una propiedad pegada del andamiaje que se ha
 * quedado para siempre.
 *
 * Estas reglas miran lo que se puede mirar leyendo: que las variables esten
 * declaradas, que el mapa `@theme` las recoja, y que no se colen propiedades
 * que atenuan un control entero. Los ratios concretos estan medidos a mano en
 * el navegador y estan en los comentarios de la propia hoja.
 */

const RAIZ = join(new URL('.', import.meta.url).pathname, '..');

/** Los nueve temas, con los dos que se reparten `system`. */
const TEMAS = [
  'dark',
  'light',
  'midnight',
  'paper',
  'forest',
  'berry',
  'nord',
  'contrast',
  'system',
];

/**
 * Los colores que todo control necesita para existir como control.
 *
 * Van con el nombre corto que declaran los temas —`--s1`, `--onAccent`— y no
 * con el largo del mapa `@theme`: en `[data-theme]` no existen los `--color-*`.
 */
const OBLIGATORIAS = [
  '--s0',
  '--s1',
  '--s2',
  '--s3',
  '--line',
  '--borde',
  '--accent',
  '--onAccent',
  '--t1',
  '--t2',
  '--t3',
  '--t4',
  '--t5',
];

describe('la hoja de estilos', () => {
  test('declara las variables que el resto de la app da por hechas', async () => {
    const css = await Bun.file(join(RAIZ, 'styles/index.css')).text();

    const faltan = OBLIGATORIAS.filter((variable) => !css.includes(`${variable}:`));

    expect(faltan).toEqual([]);
  });

  test('cada tema declara sus variables', async () => {
    const css = await Bun.file(join(RAIZ, 'styles/index.css')).text();

    const sinTema = TEMAS.filter((tema) => !css.includes(`:root[data-theme='${tema}']`));

    expect(sinTema).toEqual([]);
  });

  /**
   * `@theme` es donde Tailwind lee los nombres.
   *
   * Una variable declarada en `[data-theme]` pero no recogida en `@theme`
   * existe para CSS y no para `bg-`/`text-`/`border-`: la clase no sale, y
   * quien la escribio no se entera hasta que el boton aparece sin fondo. El
   * fallo es silencioso de verdad.
   */
  test('las variables de color estan tambien en el mapa @theme', async () => {
    const css = await Bun.file(join(RAIZ, 'styles/index.css')).text();

    const bloque = css.slice(css.indexOf('@theme'), css.indexOf('}', css.indexOf('@theme')));

    const sinMapa = ['--color-borde', '--color-line', '--color-accent', '--color-t1'].filter(
      (nombre) => !bloque.includes(nombre),
    );

    expect(sinMapa).toEqual([]);
  });

  /**
   * Nada atenua un control entero.
   *
   * Se llego a dejar `opacity: 0.45` en el bloque de `input, select, textarea,
   * button`: venia pegada del andamiaje, donde era de `.row-dragging`, una
   * clase que no existe en la aplicacion. El efecto fue que **todos** los
   * botones, campos y desplegables se veian al 45 % —apagados, sin
   * contraste— y como venia en CSS nadie lo vio hasta que se dijo.
   *
   * Un `opacity` global sobre controles es ademas una trampa por si mismo:
   * `opacity` compone con los colores, asi que un texto que estaba en 7:1
   * pasa a estar en 3:1 sin que se toque ni el color ni el tema. Por eso la
   * regla es «cero opacidades en el bloque de controles», y no «menos de
   * 0.8».
   */
  test('los controles de formulario no se atenuan', async () => {
    const css = await Bun.file(join(RAIZ, 'styles/index.css')).text();

    const inicio = css.indexOf('input,\nselect,\ntextarea,\nbutton');
    const bloque = css.slice(inicio, css.indexOf('}', inicio));

    expect(bloque).toContain('font: inherit');
    expect(bloque).not.toContain('opacity');
  });

  /**
   * Los bordes de los controles van a `--borde`, no a `--line`.
   *
   * `--line` es para separar: la cabecera del cuerpo, el filo de una tabla. Da
   * alrededor de 1,3:1 contra su propia superficie, que es lo justo para una
   * separacion y nada mas. Para el contorno que dice «esto se pulsa» la WCAG
   * 1.4.11 pide 3:1, y con `--line` un boton se leia por su letra y no por su
   * caja.
   *
   * Se comprueba que cada `--borde` este pegado a su `--line`, no que haya
   * tantos como temas: que sobren dos `--borde` y falten dos `--line` deja el
   * recuento igual.
   */
  test('--borde va pegado a su --line, para que no se confuse uno con otro', async () => {
    const css = await Bun.file(join(RAIZ, 'styles/index.css')).text();
    const lineas = css.split('\n');

    const huerfanos = lineas
      .map((linea, indice) => ({ linea, indice }))
      .filter(({ linea }) => linea.includes('--borde: #'))
      .filter(
        ({ indice }) =>
          !lineas
            .slice(Math.max(0, indice - 40), indice)
            .some((anterior) => anterior.includes('--line: #')),
      );

    expect(huerfanos.map(({ linea }) => linea.trim())).toEqual([]);
  });

  /**
   * Lo que se pulsa enseña la manita.
   *
   * En Linux el navegador pone la **flecha** sobre un `<button>` y nadie la
   * cambia: habia 34 elementos —todos los botones de la barra, los chips de los
   * filtros, los iconos de editar y eliminar— que parecian texto hasta que se
   * pasaba el raton por encima. En Windows y Mac ya sale la manita, asi que el
   * fallo solo se ve en el escritorio de al lado.
   *
   * Se hace en la hoja y no con `cursor-pointer` en cada componente porque son
   * treinta y cuatro y mañana treinta y cinco: un boton nuevo nace con la
   * manita sin que nadie se acuerde.
   *
   * Y tiene que estar **dentro de `@layer base`**. Fuera, en CSS lo que no
   * esta en ninguna capa gana a lo que esta, y esta regla se comeria el
   * `cursor-not-allowed` de los apagados: botones que prometen pulsar algo y
   * no lo hacen.
   */
  test('lo que se pulsa lleva la manita, y lo apagado el no', async () => {
    const css = await Bun.file(join(RAIZ, 'styles/index.css')).text();

    /**
     * Se busca `@layer base {` con la llave, no la palabra suelta.
     *
     * El comentario de la regla habla de `@layer base` y al buscarlo asi el
     * corte sale por ahi y se lleva el bloque entero. Es el fallo clasico de
     * leer un fuente buscando un texto: hay que anclar donde se puede anclar.
     */
    const inicio = css.indexOf('@layer base {');
    expect(inicio).toBeGreaterThan(-1);

    const capa = css.slice(inicio, css.indexOf('\n}', inicio));

    // Los dos cursores estan ahi dentro.
    expect(capa).toContain('cursor: pointer');
    expect(capa).toContain('cursor: not-allowed');

    /**
     * Y los apagados se miran con `:disabled` y no con una utilidad.
     *
     * Con `disabled:` de Tailwind se genera un `&:disabled` que solo gana si
     * la regla de los pulsables esta en una capa —si no, se come la manita—.
     */
    expect(capa).toContain('button:disabled');
    expect(capa).toContain(':not(:disabled)');
  });

  /**
   * Quien pida menos movimiento no ve animaciones.
   *
   * Con parkinson o con migrañas una transicion de escala en cada dialogo no es
   * un detalle: es sintoma. Y esto no es configuracion: es la peticion del
   * sistema, y por tanto la respuesta minima.
   *
   * Se recorre la hoja buscando `.animate-*` en vez de comprobar una lista
   * fija, porque una lista fija es justo lo que paso: se anadio
   * `animate-popover-in` y `animate-popover-out` mas tarde, y la media
   * consulta se escribio contra seis clases que ya estaban ahi. Con la lista, abrir
   * un desplegable con prefers-reduced-motion se sentia igual que antes.
   */
  test('las animaciones respetan prefers-reduced-motion', async () => {
    const css = await Bun.file(join(RAIZ, 'styles/index.css')).text();

    const inicio = css.indexOf('@media (prefers-reduced-motion: reduce)');
    expect(inicio).toBeGreaterThan(-1);

    const bloque = css.slice(inicio, css.indexOf('\n}', inicio));

    /**
     * Las clases de animacion que existen, en orden de aparicion y sin
     * repetir. Se corta en `animation:` porque ahi empieza la regla de verdad.
     */
    const definidas = [
      ...new Set(
        [...css.matchAll(/^\.animate-[\w-]+(?=\s*\{)/gm)].map((cuadro) => cuadro[0]),
      ),
    ];

    expect(definidas.length).toBeGreaterThan(0);

    const sinCubrir = definidas.filter((clase) => !bloque.includes(clase));

    expect(sinCubrir).toEqual([]);
  });
});