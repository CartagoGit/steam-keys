# Convierte a rutas de Windows las rutas absolutas de Unix que Tauri deja en el
# `installer.nsi`, para que `makensis` las encuentre al correr bajo wine.
#
#POR QUE HAY QUE HACER ESTO
#
# Tauri genera el script dando por hecho que corre en Windows, donde nunca se ve
# una ruta de Unix. Las suyas empiezan por `/workspace/...` o `/root/...`, y
# `makensis` las resuelve contra la unidad de Windows actual: o sea, contra
# `C:`, donde no hay nada. El error que sale es un `could not find` de ficheros
# que estan ahi mismo, que es de lo mas confuso que puede pasar.
#
# Tres cosas que se han probado y NO funcionan, para no repetirlas:
#
#   - `Z:/ruta/con/barras`: `Z:` es la raiz en wine, pero con barras normales no
#     vale. Hay que ser `Z:\ruta\con\barras`.
#   - Rutas relativas con `..`, como `../../steam-keys.exe`: fallan, con barras
#     y sin ellas. Sin `..` (`utils.nsh`) si funcionan.
#   - Enlazar el proyecto dentro del prefix de wine (`drive_c/workspace`): wine
#     no resuelve el enlace y sigue sin encontrar nada.
#
# QUE NO SE TOCA NADA MAS
#
# En un script de NSIS las barras son el separador de argumentos de comando, no
# una ruta: `/SILENT`, `/UPDATE`, `/oname=...`, `DeleteRegKey /ifempty`,
# `SetCompressor /SOLID`, `IntOp $4 / 96`. Por eso el patron exige que la cadena
# empiece por `/workspace/` o `/root/`: son las dos unicas rutas absolutas que
# mete Tauri, y ningun flag empieza por un nombre de directorio. Los `;` de
# comentario y las URLs tampoco se tocan, aunque contengan barras.
#
# Uso: awk -f tools/scripts/nsis-rutas-windows.awk installer.nsi

{
  while (match($0, /"\/(workspace|root)\/[^"]*"/)) {
    antes = substr($0, 1, RSTART - 1)
    dentro = substr($0, RSTART + 1)
    fin = index(dentro, "\"")

    # `Z:` es la raiz del sistema de ficheros segun wine, y las barras se
    # cambian por las de Windows. Se hace con `split` y no con `gsub` porque en
    # el texto de reemplazo de `gsub` la barra invertida necesita su propio
    # escapado, y asi es imposible de leer.
    cuerpo = "Z:" substr(dentro, 1, fin - 1)
    n = split(cuerpo, trozos, "/")
    cuerpo = trozos[1]
    for (i = 2; i <= n; i++) {
      cuerpo = cuerpo "\\" trozos[i]
    }

    $0 = antes "\"" cuerpo "\"" substr(dentro, fin + 1)
  }

  print
}