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
bun run dev          # abre la UI en el navegador (datos en memoria)
bun test             # 46 tests
bun run typecheck    # TypeScript en modo estricto
```

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
| `bun run dev` | Front en el navegador, datos en memoria |
| `bun run dev:tauri` | App de escritorio nativa |
| `bun run build` | Compila el front a `build/` |
| `bun run build:windows` | `.exe` + instalador en `dist/` |
| `bun run build:windows:docker` | Lo mismo, pero desde Linux |
| `bun test` | Tests (parser, export, round-trip) |
| `bun run typecheck` | TypeScript estricto |
| `bun run import` | Importa el TXT (simula por defecto) |
| `bun run import -- --force` | Importa de verdad |
| `bun run export` | Exporta la BD a `build/steam-keys-export.txt` |
| `bun run db:path` | Dónde está la base de datos y cuántas claves tiene |
| `bun run db:reset -- --force` | Borra la base de datos |
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

## Arquitectura

```
steam-keys/
├── apps/desktop/                  App de escritorio
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
Tauri se usa SQLite; en el navegador, un repositorio en memoria sobre
`localStorage`. Eso permite trabajar en la interfaz sin compilar Rust.

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