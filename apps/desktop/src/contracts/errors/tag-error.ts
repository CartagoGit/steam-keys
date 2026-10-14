/**
 * La etiqueta ya existe en el catalogo.
 *
 * Sin esto, escribir «Zapatazo» con una etiqueta «zapatazo» no decia nada: el
 * `INSERT OR IGNORE` no insertaba, no pasaba nada y el campo se vaciaba como si
 * hubiera funcionado. Quien lo escribe no puede ver la diferencia entre «la he
 * creado» y «no he creado nada», asi que hay que decirlo.
 *
 * Se lanza en vez de devolverse como `null` porque es un **error con nombre**:
 * un `null` significaria lo mismo que un nombre vacio, y quien llama necesita
 * poder distinguir «no valia» de «ya estaba».
 *
 * ## Por que vive aqui y no en el servicio que lo lanza
 *
 * Por quien lo atrapa. Lo crea `tag.service` —capa de servicios— pero lo
 * necesita distinguir `use-tags.helper`, que es un hook de `helpers/` y solo
 * puede mirar `contracts`. Si el error viviera junto a quien lo lanza, el hook
 * tendria que importar de `services` para nombrarlo, y esa es justo la
 * dependencia que las capas no permiten.
 *
 * El mensaje va en castellano y sin traducir a proposito, como el de
 * `DuplicateKeyError`: el aviso que ve quien lo usa lo compone el hook, que si
 * tiene el idioma a mano. Este texto es para el registro y para cuando algo se
 * avisa sin pasar por ahi.
 */
export class DuplicateTagError extends Error {
  /**
   * La etiqueta que ya estaba, **con la caja con la que ya se conoce**.
   *
   * No la que se ha intentado crear: si hay una «Zapatazo» y alguien escribe
   * «zapatazo», el aviso tiene que decir «Zapatazo», que es lo que hay en
   * pantalla. Salir con el texto nuevo haria pensar que hay dos.
   */
  constructor(readonly existente: string) {
    super(`Ya existe una etiqueta llamada «${existente}».`);
    this.name = 'DuplicateTagError';
  }
}