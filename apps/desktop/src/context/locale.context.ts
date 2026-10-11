import { createContext, useContext } from 'react';
import { DEFAULT_LOCALE, type AppLocale, type TranslationArgs } from '@/contracts';
import { translate } from '@/helpers/i18n.helper';

/**
 * El traductor, disponible en todo el arbol.
 *
 * Vive en un contexto y no se pasa como prop a cada componente porque en
 * cuanto hay tres o cuatro niveles de profundidad, ir pasando el idioma por
 * todas partes es ruido. Y es facil olvidarse en uno: ese trozo se queda en
 * espanol dentro de la version inglesa y no se nota hasta que se abre esa
 * pantalla.
 *
 *     const { t } = useT();
 *     <button>{t('action.save')}</button>
 */
export interface ITranslator {
  /** Traduce `clave`, con sus argumentos en orden. */
  t: (clave: string, args?: TranslationArgs) => string;
  /** El idioma que hay en pantalla ahora mismo. */
  locale: AppLocale;
  /** Cambia el idioma. */
  setLocale: (locale: AppLocale) => void;
}

/**
 * El contexto.
 *
 * El valor por defecto traduce en espanol, que es el idioma de origen, para
 * que un componente usado fuera del arbol de la app no se rompa nunca.
 */
export const LocaleContext = createContext<ITranslator>({
  t: (clave, args) => translate(DEFAULT_LOCALE, clave, args),
  locale: DEFAULT_LOCALE,
  setLocale: () => undefined,
});

/** Acceso al traductor desde cualquier componente. */
export function useT(): ITranslator {
  return useContext(LocaleContext);
}

/** Acceso solo al idioma actual, para lo que solo necesita saber cual es. */
export function useLocale(): AppLocale {
  return useContext(LocaleContext).locale;
}