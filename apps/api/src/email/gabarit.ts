/**
 * Gabarit des courriels transactionnels.
 *
 * Deux raisons d'avoir une version HTML et pas seulement du texte.
 *
 * La première est un défaut observé : en texte seul, le codage
 * quoted-printable insère un saut de ligne souple (« = » en fin de ligne) au
 * milieu de l'URL de réinitialisation. Un décodeur conforme le recolle, mais
 * de nombreux clients détectent les liens sur un texte mal recollé et coupent
 * l'adresse à cet endroit. Un `<a href>` ne se coupe pas.
 *
 * La seconde est prosaïque : un destinataire attend un bouton.
 *
 * Le texte reste présent dans chaque message — il sert de repli, et une
 * version texte absente est un signal de pourriel pour les filtres.
 */

/** Styles en ligne : les clients de messagerie ignorent les feuilles liées,
 *  et la plupart suppriment même une balise <style> dans l'en-tête. */
const FOND = "#f2f3ec";
const ENCRE = "#1c1f1a";
const ACCENT = "#9c5f26";
const PRIMAIRE = "#1f4f43";

/**
 * Échappe ce qui part dans du HTML.
 *
 * Le nom du destinataire vient d'un formulaire d'inscription : il n'est pas
 * sous notre contrôle, et il n'a rien à faire tel quel dans un document.
 * Les guillemets sont échappés aussi, parce que la même fonction sert pour
 * une valeur d'attribut (`href`).
 */
export function echapper(valeur: string): string {
  return valeur
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export interface Bloc {
  /** Paragraphes, dans l'ordre. Échappés à l'insertion. */
  paragraphes: string[];
  /** Bouton d'action, facultatif : tous les courriels n'en ont pas. */
  action?: { lien: string; libelle: string };
  /** Reprise de l'URL en clair sous le bouton, quand il y en a un : un
   *  client qui n'affiche pas le HTML doit pouvoir copier l'adresse. */
  rappelLien?: boolean;
}

export function gabarit(titre: string, bloc: Bloc): { texte: string; html: string } {
  const paragraphes = bloc.paragraphes
    .map(
      (p) =>
        `<p style="margin:0 0 16px;font-size:15px;line-height:1.55;color:${ENCRE}">${echapper(p)}</p>`,
    )
    .join("");

  const bouton = bloc.action
    ? `<p style="margin:0 0 16px">` +
      `<a href="${echapper(bloc.action.lien)}" ` +
      `style="display:inline-block;padding:11px 20px;border-radius:6px;` +
      `background:${PRIMAIRE};color:#ffffff;text-decoration:none;font-size:15px;font-weight:600">` +
      `${echapper(bloc.action.libelle)}</a></p>`
    : "";

  const rappel =
    bloc.action && bloc.rappelLien
      ? `<p style="margin:0 0 16px;font-size:13px;line-height:1.5;color:#5b6157;word-break:break-all">` +
        `Si le bouton ne fonctionne pas, copiez cette adresse :<br />` +
        `${echapper(bloc.action.lien)}</p>`
      : "";

  const html =
    `<!doctype html><html lang="fr"><body style="margin:0;padding:24px;background:${FOND};` +
    `font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif">` +
    `<table role="presentation" cellpadding="0" cellspacing="0" border="0" ` +
    `style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:10px;` +
    `border:1px solid #dfe2d7"><tr><td style="padding:28px">` +
    `<p style="margin:0 0 20px;font-size:17px;font-weight:700;color:${ACCENT}">Cadran</p>` +
    `<h1 style="margin:0 0 16px;font-size:19px;line-height:1.3;color:${ENCRE}">${echapper(titre)}</h1>` +
    paragraphes +
    bouton +
    rappel +
    `<p style="margin:24px 0 0;padding-top:16px;border-top:1px solid #dfe2d7;` +
    `font-size:12px;line-height:1.5;color:#5b6157">` +
    `Message automatique — merci de ne pas y répondre.</p>` +
    `</td></tr></table></body></html>`;

  /* Le texte reprend le même contenu, l'adresse en clair : c'est la version
   * que lisent les clients en mode texte, et celle qui apparaît dans les
   * journaux quand SMTP n'est pas configuré. */
  const texte =
    bloc.paragraphes.join("\n\n") +
    (bloc.action ? `\n\n${bloc.action.lien}\n` : "\n") +
    `\nMessage automatique — merci de ne pas y répondre.\n`;

  return { texte, html };
}
