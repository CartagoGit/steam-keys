# Steam Keys

Gestor local de claves de Steam (y de otras tiendas) para Windows.
Escritorio con **Tauri 2 + React 19 + TypeScript + Bun** y base de datos
**SQLite propia**.

Todo vive en tu ordenador. No hay cuentas, ni nube, ni telemetría.

---

## La regla de oro: las claves no salen del equipo

Este repositorio **jamás** contiene claves reales.

| Qué | Dónde | ¿Versionado? |
|---|---|---|
| TXT original con las claves | `original/steam-keys.txt` | **No** (`.gitignore`) |
| Base de datos SQLite | `%APPDATA%\com.cartagostudios.steamkeys\steam-keys.db` | **No** (fuera del repo) |
| Exportaciones y listados | `build/steam-keys-export.txt` | **No** (`.gitignore`) |
| Listados enmascarados, sin claves | `build/steam-keys-masked.txt` | **No** (`.gitignore`) |

Hay tres defensas, porque perder una clave regalable duele:

1. **`.gitignore`** ignora `original/`, `*.txt`, `*.db` y `*.sqlite*`.
2. **`.dockerignore`** impide que el contexto de build de Docker arrastre
   `original/` a la imagen.
3. **Los scripts de diagnóstico se auto-auditan.** Antes de imprimir nada,
   `mask` y `verify-parser` comprueban que ninguna clave del archivo aparece
   literalmente en su salida, y abortan si se cuela alguna.

Además, en la interfaz **las claves se muestran enmascaradas por defecto**
(`MQ7R•••••••••PN84`): hace falta pulsar el icono del ojo para verlas.

---

## Puesta en marcha

Requisitos: [Bun](https://bun.sh) y (para compilar el `.exe`) Rust.

```bash
bun install          # instala todo el workspace
bun run dev          # abre la UI en el navegador, con la BD real
bun test             # 71 tests
bun run typecheck    # TypeScript en modo estricto
```

> `bun run dev` abre la interfaz **con tus claves de verdad**: un puente de
> desarrollo ejecuta el SQL contra el mismo fichero SQLite que usa la app de
> escritorio. Ver [El puente de desarrollo](#el-puente-de-desarrollo).

### La app de escritorio

```bash
bun run dev:tauri            # abre la ventana nativa
bun run build:windows        # genera el .exe y el instalador en dist/
```

### Compilar para Windows desde Linux (Docker)

```bash
bun run build:windows:docker
```

Usa `cargo-xwin` para compilar el binario Rust contra el SDK de Windows desde
un contenedor Linux. Solo genera el instalador **NSIS**; el **MSI** requiere
Windows o `wine`.

---

## Traer las claves del TXT

### Opción A · desde la app (recomendada)

`Importar` → eliges `original/steam-keys.txt` → la app te enseña cuántas ha
detectado y te pide confirmación → se guardan en tu base de datos.

### Opción B · desde la terminal

```bash
bun run import          # simulación: no escribe nada
bun run import -- --force
```

### Opción C · desde cero

`Añadir` y rellenar el formulario a mano.

---

## Comandos

Todos están en el `package.json` de la raíz.

| Comando | Qué hace |
|---|---|
| `bun run dev` | Front en el navegador, contra la BD real |
| `bun run dev:tauri` | App de escritorio nativa |
| `bun run build` | Compila el front a `build/` |
| `bun run build:windows` | `.exe` + instalador en `dist/` |
| `bun run build:windows:docker` | Lo mismo, pero desde Linux |
| `bun test` | Tests (parser, export, round-trip, puente) |
| `bun run typecheck` | TypeScript estricto |
| `bun run import` | Importa el TXT (simula por defecto) |
| `bun run import -- --force` | Importa de verdad |
| `bun run export` | Exporta la BD a `build/steam-keys-export.txt` |
| `bun run db:path` | Dónde está la base de datos y cuántas claves tiene |
| `bun run db:reset -- --force` | Borra la base de datos |
| `bun run backup:list` | Copias de seguridad guardadas |
| `bun run backup:now -- motivo` | Crea una copia de seguridad |
| `bun run backup:prune -- 5` | Deja solo las 5 más recientes |
| `bun run backup:restore -- nombre` | Prepara una copia para restaurar |
| `bun run mask` | Copia del TXT **sin claves**, segura para compartir |
| `bun run audit` | Busca claves reales en el índice **y en el historial** de git |
| `bun run inspect:format` | Mapa del formato del TXT original |
| `bun run clean` | Vacía `build/` y `dist/` |

> `audit` es la red de seguridad: léelo antes de cada `git push`. Si alguna vez
> salta, dice qué fichero y qué commit, y los pasos exactos para limpiarlo
> (`git filter-repo`). Ojo: `filter-repo` revierte los cambios sin commitear.

---

## El formato del TXT original

El archivo lleva años escrito a mano y mezcla seis convenciones. El parser
(`parse-legacy-txt.helper.ts`) las cubre todas:

```
Celeste - MQ7RT-29XKL-ZPN84              Nombre - clave
Portal 2<TAB>Steam Key: MQ7RT-...        Nombre TAB "Steam Key:" clave
Rocket League _ MQ7RT-...                Nombre _ clave
MQ7RT-29XKL-ZPN84 - Two Worlds 2         La clave delante del nombre
INK _ https://humblebundle.com/?key=...  URL de Humble Bundle
EARTH DEFENSE FORCE 4.1 { ... }          Bloque { } con DLC sueltos
- Return of Monkey Island - MQ7RT-... - Alberto   Regalada, con destinatario
# 22-01-25                              Cabecera de fecha
ACTIVAR YO >>>>                         Las siguientes son para activar yo
```

Convenciones:

- Un **`-` al principio de la línea** significa *ya regalada*.
- **`ACTIVAR YO`** cambia el estado de las líneas siguientes a *canjeada*.
- Un **`{` … `}`** agrupa claves sueltas bajo el nombre de la cabecera.

Lo que el parser **no** puede inventar:

- **La fecha de caducidad.** Ni Steam ni ninguna otra tienda la publican por
  API. Una clave sin fecha conocida queda como *Disponible* o *Por revisar*:
  solo se puede saber canjeándola, y canjearla la quema.
- **La plataforma de las claves que no son de Steam.** Si la forma de la clave
  no encaja en ningún patrón conocido, se marca *Sin determinar* y se revisa a
  mano en la UI. Preferimos decir «no lo sé» a inventar.

---

## Persistencia

La colección vive en **SQLite**, en el directorio de configuración de Windows
(`%APPDATA%\com.cartagostudios.steamkeys\steam-keys.db`), fuera del repositorio.
Se crea sola la primera vez y sobrevive a cerrar la app.

### Copias de seguridad

El botón **Datos** de la barra abre el panel de almacenamiento: dónde está el
fichero, cuántas claves hay, si la base está sana y qué copias existen.

- Se guarda una copia **automáticamente** antes de cada importación y de cada
  restauración.
- Se conservan las **10 más recientes** en la carpeta `backups` contigua al
  fichero, con el nombre `steam-keys-<fecha>-<motivo>.db`.
- Restaurar **nunca borra**: solo añade las claves que falten y, si eliges la
  opción de sobrescribir, devuelve a su estado anterior las que ya tenías.
- Antes de restaurar se hace otra copia, así que un restore equivocado también
  se deshace.

> Restaurar **no** sustituye el fichero `.db` por debajo: la app mantiene la
> conexión abierta y SQLite se quedaría con una referencia obsoleta. La copia se
> deposita como `restore-candidate.db`, se abre con su propia conexión y las
> filas se fusionan una a una.

### Salud de la base

El panel ejecuta `PRAGMA integrity_check` al abrirse y avisa si SQLite detecta
corrupción, para que puedas restaurar antes de perder claves.

### En el navegador

`bun run dev` abre la interfaz sin Tauri, pero **con tus claves de verdad**: un
middleware de Vite ejecuta el SQL contra el mismo fichero SQLite de la app de
escritorio. Lo que añadas, edites o borres ahí se guarda en tu base de datos.

#### El puente de desarrollo

El problema que resuelve: dentro de Tauri la app abre SQLite con el plugin
nativo, pero en el navegador ese plugin no existe, así que la app caía en un
repositorio en memoria y se veía una colección vacía en lugar de tus claves.

En vez de reimplementar el repositorio, el puente **ejecuta SQL de verdad** y el
navegador solo le manda sentencias. El único código que escribe en la base de
datos sigue siendo `SqliteGameKeyRepository`, idéntico en los dos entornos.

```
navegador ──HTTP+token──▶ middleware de Vite ──ejecFileSync──▶ dev-bridge.serve.ts ──▶ SQLite
```

Salvaguardas, en este orden:

1. **Solo en desarrollo.** El middleware lleva `apply: 'serve'`: no existe en
   `vite build` ni en el `.exe`. Además, un segundo plugin sustituye el cliente
   del puente por un módulo que falla al usarlo, así que el bundle de producción
   no contiene ni el endpoint ni el token. Se puede comprobar:

   ```bash
   bun run build && grep -r '__dev-bridge__\|dev-token' build/   # sin resultados
   ```

2. **Token por proceso.** Se genera al arrancar el servidor y se inyecta solo en
   el bundle del navegador. Una petición sin ese header devuelve `403`. Al ser
   un header personalizado, el navegador obliga a un preflight CORS, de modo que
   una página web cualquiera no puede llamar a `127.0.0.1` aunque la víctima la
   tenga abierta.

3. **Solo en loopback.** Vite escucha en `127.0.0.1`, nunca en `0.0.0.0`.

4. **Sin volcado masivo.** Solo hay `exec` y `select`. No existe forma de pedir
   "dame la tabla entera" con las claves en claro.

> Aun así, cualquier SQL que llegue al puente se ejecuta contra tu base de
> datos. Es una herramienta de desarrollo, no una API: no lo expongas ni lo
> apuntes a un servidor compartido.

El botón **Datos** muestra en qué modo se está trabajando (Tauri, puente o
memoria), para que no te confundas si algo de lo que ves cambia al abrir la
interfaz desde otro sitio.

---

## Arquitectura

```
steam-keys/
├── apps/desktop/                  App de escritorio
│   ├── dev-bridge.contract.ts     Contrato puente ↔ cliente (sin Node)
│   ├── dev-bridge.vite-plugin.ts  Middleware y stub de producción
│   ├── src/
│   │   ├── contracts/             Capa inferior, sin dependencias de React
│   │   │   ├── constants/         Constantes y metadatos de UI
│   │   │   ├── enums/             Enums (siempre tipo ENUM)
│   │   │   └── interfaces/        Interfaces y types (siempre I / T)
│   │   ├── helpers/               Funciones puras (parseo, enmascarado, filtros)
│   │   ├── repositories/          Acceso a datos
│   │   ├── services/              Orquestación y plataforma
│   │   ├── components/            React
│   │   └── styles/                Tailwind
│   └── src-tauri/                 Shell Rust (ventana, diálogos, SQLite)
│
├── tools/
│   ├── scripts/                   Scripts de uso genérico (Bun)
│   │   ├── dev-bridge.serve.ts    Ejecuta el SQL del puente
│   │   └── support/               Ayudas compartidas por los scripts
│   └── docker/                    Build de Windows desde Linux
│
├── build/                         Salida del front (no se versiona)
├── dist/                          .exe e instaladores (no se versiona)
└── original/                      El TXT con las claves (no se versiona)
```

Reglas que se respetan en todo el proyecto:

- Los ficheros se llaman `{nombre}.{tipo}.ts`: `game-key.interface.ts`,
  `key-status.enum.ts`, `db.service.ts`, `parse-legacy-txt.helper.ts`.
- Interfaces y types empiezan por `I` / `T` y viven en `contracts/interfaces/`.
- Constantes, interfaces y enums viven en `contracts/`, y se importan siempre
  desde el barril `@/contracts`.
- **Ninguna ruta absoluta**: todo es relativo al proyecto.
- La lógica pura vive en `helpers/` y se testea sin montar nada.

### Por qué dos repositorios

La UI no sabe si hay SQLite detrás: habla con `IGameKeyRepository`. Dentro de
Tauri se usa el cliente nativo; en el navegador, el del puente de desarrollo; y
solo si no hay ninguno de los dos, uno en memoria sobre `localStorage`. Los tres
terminan en `SqliteGameKeyRepository` menos el último, así que el código que
escribe en la base de datos es el mismo.

---

## Base de datos

SQLite, creada desde TypeScript (`db-schema.constants.ts`), no desde Rust: así
el esquema tiene una única fuente de verdad y los adaptadores nunca se
desincronizan.

```sql
CREATE TABLE game_keys (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  title        TEXT    NOT NULL,
  key_value    TEXT    NOT NULL UNIQUE,   -- una clave, una fila
  platform     TEXT    NOT NULL,
  status       TEXT    NOT NULL,
  source       TEXT    NOT NULL,
  gifted_to    TEXT,
  parent_title TEXT,                      -- para DLC
  note         TEXT,
  tags         TEXT,
  added_on     TEXT,
  last_used_at TEXT,
  created_at   TEXT,
  updated_at   TEXT
);
```

La entidad es la **clave**, no el juego: un mismo juego puede repetirse con
varias claves, y eso ocurre en el TXT original.

---

## Privacidad

- Ninguna clave sale del ordenador. No hay analítica ni peticiones de red.
- Los permisos de Tauri son mínimos: SQL y diálogos nativos. No se usa el
  plugin `fs`, así que la app **no puede leer nada que no elijas tú** en un
  diálogo del sistema.
- La base de datos vive en el directorio de configuración de Windows, fuera del
  repositorio.