import type { ITag } from '@/contracts';
import { useT } from '@/context/locale.context';
import { pluralKey } from '@/helpers/i18n.helper';

import { Button, Field } from './ui.component';

export interface IKeysSettingsProps {
  /** El catalogo de etiquetas, con su recuento de usos. */
  catalogo: readonly ITag[];
  /** Abre el gestor de etiquetas. */
  onManageTags: () => void;
}

/**
 * Ajustes que son de las claves y no de la ventana.
 *
 * Tema e idioma son de como se ve la app; la cuenta es de la conexion con
 * Steam. Las claves son lo que queda: como se llaman sus etiquetas y que
 * significa cada una.
 *
 * El catalogo se enseña resumido y se edita en el gestor. Caben todas las
 * etiquetas en una pestana de ajustes —una coleccion tiene seis, y una persona
 * llega a treinta— pero una lista de treinta filas con tres botones cada una
 * hace que el resto de los ajustes se salga de la vista.
 */
export function KeysSettings({ catalogo, onManageTags }: IKeysSettingsProps) {
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
            el resumen util. El resto no cabe, y no tiene por que caber: para
            eso esta el gestor.
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

          <div>
            <Button icon="tag" onClick={onManageTags} title={t('settings.keys.tags.manage')}>
              {t('settings.keys.tags.manage')}
            </Button>
          </div>
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