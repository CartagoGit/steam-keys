#!/bin/sh
# ==============================================================================
#  Empaquetado del instalador de Windows.
#
#    Se invoca al ARRANCAR el contenedor, no durante el build, por una razon:
#    `makensis` es un ejecutable de Windows de 32 bits y corre bajo wine, y el
#    perfil seccomp de Docker bloquea `socketcall` (la syscall i386
#    multiplexada) sin el cual el PE no arranca. Durante el build no se puede
#    cambiar ese perfil, asi que aqui tampoco habria彩n forma de empaquetar.
#
#  Por eso el `docker-compose.windows.yml` lo lanza con
#  `--security-opt seccomp=unconfined`.
# ==============================================================================
set -eu

release="/workspace/apps/desktop/src-tauri/target/${TAURI_TARGET}/release"
nsis="${release}/nsis/x64"
idiomas="/opt/nsis/Contrib/Language files"

cd /workspace

# Las variables de cross-compilacion (SDK de Windows, enlazador, flags).
cargo xwin env --target "${TAURI_TARGET}" > /tmp/xwin-env.sh
. /tmp/xwin-env.sh

# Que Tauri escriba el script. Se espera que se quede corto al invocar a
# makensis; si algun dia lo consigue, los pasos de abajo son un no-op.
tauri build --target "${TAURI_TARGET}" --bundles nsis --ci \
  || echo "AVISO: Tauri no supo empaquetar; se hace a mano."

# Tauri deja rutas absolutas de Unix en el script y `makensis`, que corre bajo
# wine, las busca en la unidad de Windows actual, donde no hay nada. El fallo
# sale como `could not find` de ficheros que estan ahi mismo, que es lo mas
# confuso que puede pasar. Se traducen a `Z:\...`, que si funciona; el porque de
# que las alternativas no valen esta en el propio `.awk`.
awk -f /workspace/tools/scripts/nsis-rutas-windows.awk \
  "${nsis}/installer.nsi" > "${nsis}/installer.nsi.nuevo" \
  && mv "${nsis}/installer.nsi.nuevo" "${nsis}/installer.nsi"

# El fichero de idioma tampoco esta: Tauri lo copia del directorio de
# instalacion de NSIS, y no puede deducir cual es porque `makensis` aqui es un
# script nuestro y no el binario de NSIS.
cp "${idiomas}"/*.nsh "${nsis}/"

# Y ya esta todo lo que Tauri necesitaba. Esta llamada es exactamente la que
# hace Tauri, con los mismos argumentos.
#
# `-V4` en vez de `-V1`: con `-V1` un fallo de `makensis` se pierde entre el
# ruido de la compilacion, y aqui lo que hay que ver es justo por que falla.
#
# El script de NSIS declara su salida como `nsis-output.exe`, no como el nombre
# final: es Tauri quien despues lo renombra a `Steam Keys_1.0.0_x64-setup.exe`
# al moverlo a `bundle/nsis/`. Como aqui el paso manual de Tauri puede haber
# fallado, se buscan los dos nombres.
cd "${nsis}"
makensis -INPUTCHARSET UTF8 -OUTPUTCHARSET UTF8 -V4 installer.nsi

cp "${release}/steam-keys.exe" /out/

# El script de NSIS declara su salida como `nsis-output.exe`, no como el nombre
# final: es Tauri quien despues lo renombra a `<Producto>_<version>_x64-setup.exe`
# al moverlo a `bundle/nsis/`. Como aqui el paso de Tauri puede haber fallado
# (y asi lo hace: no ve las rutas de Windows), se busca el nombre que haya
# dejado y se renombra aqui al que veria el usuario.
for instalador in \
  "${release}"/bundle/nsis/*.exe \
  "${nsis}"/nsis-output.exe
do
  [ -f "${instalador}" ] || continue

  case "${instalador}" in
    */nsis-output.exe) destino="/out/Steam Keys_${TAURI_VERSION}_x64-setup.exe" ;;
    *)                 destino="/out/$(basename "${instalador}")" ;;
  esac

  cp "${instalador}" "${destino}"
done

# Lo que el contenedor escribe lo escribe como root, y en el host no hay quien
# pueda borrarlo despues: el siguiente `bun run build:front` falla con EACCES al
# vaciar `build/`, y `bun run clean` tambien. No es cosmetico — es un build que
# se queda trabado hasta que se entra como root— asi que al final se devuelve la
# propiedad al usuario del host. Los dos numeros llegan por `HOST_UID`/`HOST_GID`.
chown -R "${HOST_UID:-0}:${HOST_GID:-0}" /out /workspace/build 2>/dev/null || true

echo "=== dist/ ==="
ls -la /out/