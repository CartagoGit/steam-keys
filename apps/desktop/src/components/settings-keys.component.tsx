import type { ITag } from '@/contracts';
import { useT } from '@/context/locale.context';
import { pluralKey } from '@/helpers/i18n.helper';

import { Button, Field } from './ui.component';

export interface IKeysSettingsProps {
  /** El catalogo de etiquetas, con su recuento de usos. */
  catalogo: readonly ITag[];
  /** Exporta la coleccion al TXT de siempre. */
  onExport: () => void;
  /** Abre el selector de ficheros para importar un TXT. */
  onImport: () => void;
  /** Abre la pantalla de datos: donde vive el fichero y el tamano. */
  onOpenStorage: () => void;
  /** `true` mientras hay algo en marcha: «Importar» no se puede repetir. */
  busy: boolean;
}

/**
 * Ajustes que son de las claves y no de la ventana.
 *
 * Tema e idioma son de como se ve la app; la cuenta es de la conexion con
 * Steam. Las claves son lo que queda: como se llaman sus etiquetas, que
 * significa cada una, y que se puede hacer con el fichero entero.
 *
 * El catalogo se enseña resumido y se edita en el gestor. Caben todas las
 * etiquetas en una pestana de ajustes —una coleccion tiene seis, y una persona
 * llega a treinta— pero una lista de treinta filas con tres botones cada una
 * hace que el resto de los ajustes se salga de la vista.
 */
export function KeysSettings({
  catalogo,
  onExport,
  onImport,
  onOpenStorage,
  busy,
}: IKeysSettingsProps) {
  const { t } = useT();

  const enUso = catalogo.filter((tag) => tag.usos > 0).length;
  const sinUsar = catalogo.length - enUso;

  return (
    <div className="flex flex-col gap-5">
      {/*
        El recuento va en dos cifras y no en una: «6 etiquetas» no dice si son
        seis que usa media coleccion o seis que solo ha escrito una vez, y esa
        es justo la diferencia entre un vocabulario vivo y uno abandonado.
      */}
      <Field label={t('settings.keys.tags')} hint={t('settings.keys.tags.hint')}>
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-4 text-xs">
            <span className="text-t2">
              <strong className="text-sm text-t1 tabular-nums">{catalogo.length}</strong>{' '}
              {t('settings.keys.tags.total')}
            </span>

            {catalogo.length > 0 ? (
              <span className="text-t4">
                {t(pluralKey(enUso, 'settings.keys.tags.inUseOne', 'settings.keys.tags.inUseMany'), [
                  enUso,
                ])}
                {sinUsar > 0 ? ` · ${t('settings.keys.tags.idle', [sinUsar])}` : ''}
              </span>
            ) : null}
          </div>

          {/*
            Las mas usadas salen como Pastillas y no como una lista: son las
            que alguien querria marcar ahora mismo, y verlas de un vistazo es
            el resumen util. El resto no cabe, y no tiene por que caber.

            Esto es un **resumen**, no el sitio para managearlas. Renombrar o
            borrar una etiqueta se lleva por delante las claves que la llevan,
            y eso necesita ver cuantas son —que es lo que hace el gestor—, no
            un boton suelto debajo de una lista de seis nombres.

            Tampoco hay un boton que abra el gestor desde aqui. Antes lo habia, y
            salia **debajo** de estas pastillas: un boton de texto con la misma
            anchura visual que ellas pero con otro aspecto, que se leia como
            una etiqueta mas y no como una accion. Quien llegue por el editor de
            una clave tiene el engranaje al lado de «Anadir etiqueta», que es
            donde se managean de verdad.
          */}
          {enUso > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {catalogo
                .filter((tag) => tag.usos > 0)
                .slice(0, TOP)
                .map((tag) => (
                  <span
                    key={tag.nombre}
                    className="inline-flex items-center gap-1.5 rounded-full bg-hover px-2.5 py-1 text-[11px] text-t2 ring-1 ring-line"
                  >
                    {tag.nombre}
                    <span className="tabular-nums text-t4">{tag.usos}</span>
                  </span>
                ))}

              {enUso > TOP ? (
                <span className="inline-flex items-center rounded-full px-2 py-1 text-[11px] text-t4">
                  {t('settings.keys.tags.more', [enUso - TOP])}
                </span>
              ) : null}
            </div>
          ) : null}
        </div>
      </Field>

      {/*
        El fichero entero: exportar, importar y donde vive.

        Estas tres estaban en la barra de arriba, junto al buscador y a los
        filtros, y ahi estorbaban: son tres botones de texto mas —con su icono,
        su relleno y su borde— para algo que se hace una vez cada varios meses
        y que no cambia con lo que se esta mirando. Con veinte plataformas y
        cinco estados, la barra era mas de semantica que de trabajo.

        En la pestana de claves su sitio es obvio —es donde esta el fichero— y
        la barra se queda con lo que se usa todos los dias: buscar, ordenar,
        filtrar y anadir.

        «Datos» se queda con su boton y no se abre en linea porque abre la
        pantalla de la base de datos, que es otra cosa.
      */}
      <Field label={t('settings.keys.file')} hint={t('settings.keys.file.hint')}>
        <div className="flex flex-wrap gap-2">
          <Button icon="download" onClick={onExport} title={t('toolbar.export')}>
            {t('toolbar.export')}
          </Button>

          <Button
            icon="upload"
            onClick={onImport}
            disabled={busy}
            title={t('toolbar.import')}
          >
            {t('toolbar.import')}
          </Button>

          <Button icon="package" onClick={onOpenStorage} title={t('toolbar.data')}>
            {t('toolbar.data')}
          </Button>
        </div>
      </Field>
    </div>
  );
}

/**
 * Cuantas etiquetas se enseñan en el resumen.
 *
 * Es un tope, no un filtro: se cortan por orden de usos, asi que lo que se
 * deja fuera es siempre lo menos usado. Diez son las que caben sin empujar el
 * boton de abajo.
 */
const TOP = 10;