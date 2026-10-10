/**
 * Copia al portapapeles con degradacion elegante.
 *
 * `navigator.clipboard` necesita contexto seguro y no existe en Tauri v1;
 * por eso hay una via de reserva con `document.execCommand`, que sigue
 * funcionando en WebView2.
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Sigue al metodo alternativo.
  }

  try {
    const area = document.createElement('textarea');
    area.value = text;
    area.setAttribute('readonly', '');
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body.appendChild(area);
    area.select();

    const done = document.execCommand('copy');
    document.body.removeChild(area);

    return done;
  } catch {
    return false;
  }
}