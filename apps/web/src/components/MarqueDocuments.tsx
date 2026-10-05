import { useEffect, useRef, useState } from "react";
import { ApiError, urlImage } from "../api/client";
import {
  useEnregistrerMarque,
  useMarque,
  useRetirerMarque,
  useTeleverserMarque,
} from "../api/hooks";
import type { EmplacementMarque, ImageMarque, Marque } from "../api/types";
import { SqueletteCarte } from "./etats";

/**
 * Réglage de l'identité appliquée aux documents produits.
 *
 * L'écran est construit autour d'un aperçu plutôt que d'un formulaire seul :
 * ce qu'un cabinet veut vérifier avant d'envoyer un rapport à son client,
 * c'est l'en-tête tel qu'il sortira, pas la liste des champs qu'il a remplis.
 * L'aperçu reprend donc les proportions réelles du PDF — logo contenu dans
 * une boîte, filet à la couleur d'accent, mentions en pied.
 */

const COULEUR_PAR_DEFAUT = "#1F4F43";

/** Même garde que côté serveur : la couleur finit écrite dans un PDF. */
const HEXA = /^#[0-9a-fA-F]{6}$/;

const EMPLACEMENTS: Record<
  EmplacementMarque,
  { titre: string; aide: string; boite: { largeur: number; hauteur: number } }
> = {
  logo: {
    titre: "Logo",
    aide: "Placé en tête de chaque document. PNG ou JPEG, 2 Mo au plus.",
    boite: { largeur: 150, hauteur: 46 },
  },
  signature: {
    titre: "Signature",
    aide: "Posée au-dessus du nom du signataire, en fin de rapport.",
    boite: { largeur: 140, hauteur: 48 },
  },
};

/** Taille d'affichage conservant les proportions, jamais agrandie. */
function ajuster(image: ImageMarque, boite: { largeur: number; hauteur: number }) {
  const facteur = Math.min(boite.largeur / image.largeur, boite.hauteur / image.hauteur, 1);
  return { largeur: image.largeur * facteur, hauteur: image.hauteur * facteur };
}

/**
 * Charge une image servie par l'API et révoque son URL d'objet au démontage.
 *
 * Sans la révocation, chaque téléversement laisserait derrière lui un blob
 * que le navigateur garde jusqu'à la fermeture de l'onglet.
 */
function useImageMarque(emplacement: EmplacementMarque, presente: boolean, version: number) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!presente) {
      setUrl(null);
      return;
    }
    let abandonne = false;
    let aRevoquer: string | null = null;

    urlImage(`/marque/${emplacement}`)
      .then((valeur) => {
        if (abandonne) {
          URL.revokeObjectURL(valeur);
          return;
        }
        aRevoquer = valeur;
        setUrl(valeur);
      })
      .catch(() => setUrl(null));

    return () => {
      abandonne = true;
      if (aRevoquer) URL.revokeObjectURL(aRevoquer);
    };
  }, [emplacement, presente, version]);

  return url;
}

function Televersement({
  emplacement,
  image,
  version,
  modifiable,
  surChangement,
}: {
  emplacement: EmplacementMarque;
  image: ImageMarque | null;
  version: number;
  modifiable: boolean;
  surChangement: () => void;
}) {
  const champ = useRef<HTMLInputElement>(null);
  const televerser = useTeleverserMarque();
  const retirer = useRetirerMarque();
  const [erreur, setErreur] = useState<string | null>(null);
  const url = useImageMarque(emplacement, image !== null, version);
  const { titre, aide, boite } = EMPLACEMENTS[emplacement];
  const taille = image ? ajuster(image, boite) : null;

  async function choisir(fichier: File | undefined) {
    if (!fichier) return;
    setErreur(null);
    try {
      await televerser.mutateAsync({ emplacement, fichier });
      surChangement();
    } catch (err) {
      setErreur(err instanceof ApiError ? err.message : "Envoi impossible.");
    } finally {
      // Sans cela, rechoisir le même fichier après un refus ne déclenche
      // aucun événement : la valeur du champ n'a pas changé.
      if (champ.current) champ.current.value = "";
    }
  }

  return (
    <div className="panneau-discret">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-sm font-medium">{titre}</h3>
        {image && <span className="text-xs text-ink/40 font-mono">{image.largeur} × {image.hauteur} px</span>}
      </div>
      <p className="text-xs text-ink/50 mt-1 mb-3">{aide}</p>

      <div
        className="flex items-center justify-center bg-paper rounded border border-rule/20 mb-3"
        style={{ height: boite.hauteur + 24 }}
      >
        {url && taille ? (
          <img src={url} alt={titre} style={{ width: taille.largeur, height: taille.hauteur }} />
        ) : (
          <span className="text-xs text-ink/35">{image ? "Chargement…" : "Aucune image"}</span>
        )}
      </div>

      {erreur && <p className="text-critical text-xs mb-2">{erreur}</p>}

      {modifiable && (
        <div className="flex gap-2">
          <input
            ref={champ}
            id={`marque-${emplacement}`}
            type="file"
            accept="image/png,image/jpeg"
            className="hidden"
            onChange={(e) => choisir(e.target.files?.[0])}
          />
          <button
            type="button"
            className="btn-secondary text-xs px-3 py-1.5"
            disabled={televerser.isPending}
            onClick={() => champ.current?.click()}
          >
            {televerser.isPending ? "Envoi…" : image ? "Remplacer" : "Choisir un fichier"}
          </button>
          {image && (
            <button
              type="button"
              className="btn-secondary text-xs px-3 py-1.5"
              disabled={retirer.isPending}
              onClick={() => retirer.mutate(emplacement, { onSuccess: surChangement })}
            >
              Retirer
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/** En-tête du document tel qu'il sera composé, aux proportions près. */
function Apercu({
  marque,
  nomOrganisation,
  logo,
}: {
  marque: Champs;
  nomOrganisation: string;
  logo: string | null;
}) {
  const accent = HEXA.test(marque.couleurAccent) ? marque.couleurAccent : COULEUR_PAR_DEFAUT;
  return (
    <div className="bg-paper rounded border border-rule/20 p-5">
      {logo && <img src={logo} alt="" className="max-h-9 mb-3" />}
      <p className="text-base font-display font-semibold leading-tight">
        {marque.nomAffiche.trim() || nomOrganisation}
      </p>
      <p className="text-sm font-medium mt-0.5" style={{ color: accent }}>
        Rapport financier
      </p>
      <p className="text-xs text-ink/55 mt-1.5">Entité cliente · Exercice 2025</p>
      <p className="text-[11px] text-ink/40">
        Période du 01/01/2025 au 31/12/2025 · Calculé le{" "}
        {new Date().toLocaleDateString("fr-FR")}
      </p>
      <div className="h-px my-3" style={{ backgroundColor: accent }} />
      <p className="text-[11px] text-ink/35">Synthèse · Rentabilité · Liquidité · Solvabilité…</p>
      {marque.signataireNom.trim() && (
        <p className="text-[11px] text-ink/55 mt-3 pt-2 border-t border-rule/20">
          {marque.signataireNom}
          {marque.signataireFonction.trim() && (
            <span className="text-ink/40"> · {marque.signataireFonction}</span>
          )}
        </p>
      )}
      {marque.mentionsPied.trim() && (
        <p className="text-[10px] text-ink/35 mt-3 leading-snug">{marque.mentionsPied}</p>
      )}
    </div>
  );
}

interface Champs {
  nomAffiche: string;
  couleurAccent: string;
  mentionsPied: string;
  signataireNom: string;
  signataireFonction: string;
}

function champsDepuis(marque: Marque): Champs {
  return {
    nomAffiche: marque.nomAffiche ?? "",
    couleurAccent: marque.couleurAccent ?? COULEUR_PAR_DEFAUT,
    mentionsPied: marque.mentionsPied ?? "",
    signataireNom: marque.signataireNom ?? "",
    signataireFonction: marque.signataireFonction ?? "",
  };
}

export function MarqueDocuments({
  nomOrganisation,
  estAdmin,
}: {
  nomOrganisation: string;
  estAdmin: boolean;
}) {
  const { data: marque, isLoading, error } = useMarque();
  const enregistrer = useEnregistrerMarque();
  const [champs, setChamps] = useState<Champs | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [enregistre, setEnregistre] = useState(false);

  /* L'état du formulaire naît de la réponse du serveur et n'est pas
   * réinitialisé ensuite : écraser la saisie en cours à chaque invalidation
   * de requête ferait disparaître sous les doigts ce qu'on est en train
   * d'écrire. La clé de version suffit à repartir d'un état propre. */
  useEffect(() => {
    if (marque && champs === null) setChamps(champsDepuis(marque));
  }, [marque, champs]);

  /* Un compteur, et non les dimensions de l'image : remplacer un logo par un
   * autre de même taille doit recharger l'aperçu, et c'est précisément le cas
   * le plus courant quand on corrige une couleur ou un détail. */
  const [version, setVersion] = useState(0);
  const logo = useImageMarque("logo", Boolean(marque?.logo), version);

  if (isLoading || !marque || !champs) {
    return error ? (
      <div className="card">
        <h2 className="font-display text-lg font-semibold mb-1">Marque des documents</h2>
        <p className="text-sm text-critical">Réglages indisponibles.</p>
      </div>
    ) : (
      <SqueletteCarte hauteur="16rem" />
    );
  }

  const couleurValide = HEXA.test(champs.couleurAccent);
  const modifiable = estAdmin && marque.autorisee;

  async function soumettre(e: React.FormEvent) {
    e.preventDefault();
    if (!champs) return;
    setErreur(null);
    setEnregistre(false);
    try {
      await enregistrer.mutateAsync({
        nomAffiche: champs.nomAffiche,
        couleurAccent: champs.couleurAccent,
        mentionsPied: champs.mentionsPied,
        signataireNom: champs.signataireNom,
        signataireFonction: champs.signataireFonction,
      });
      setEnregistre(true);
    } catch (err) {
      setErreur(err instanceof ApiError ? err.message : "Enregistrement impossible.");
    }
  }

  return (
    <div className="card">
      <h2 className="font-display text-lg font-semibold mb-1">Marque des documents</h2>
      <p className="text-sm text-ink/50 mb-4">
        Les exports PDF et Excel portent cette identité : le cabinet remet à son client un document
        à son nom, pas à celui de son outil.
      </p>

      {!marque.autorisee && (
        <p className="text-sm text-warning mb-4 panneau-discret">
          La personnalisation des documents commence à la formule Cabinet. Les réglages ci-dessous
          restent consultables, mais les documents sortent à l&apos;identité de Cadran.
        </p>
      )}

      <div className="grid gap-5 lg:grid-cols-2">
        <form onSubmit={soumettre} className="space-y-3">
          <div>
            <label className="label" htmlFor="marque-nom">
              Nom affiché
            </label>
            <input
              id="marque-nom"
              className="input"
              placeholder={nomOrganisation}
              maxLength={120}
              disabled={!modifiable}
              value={champs.nomAffiche}
              onChange={(e) => setChamps({ ...champs, nomAffiche: e.target.value })}
            />
          </div>

          <div>
            <label className="label" htmlFor="marque-couleur">
              Couleur d&apos;accent
            </label>
            <div className="flex gap-2">
              <input
                id="marque-couleur"
                type="color"
                className="h-9 w-12 rounded border border-rule/30 bg-surface disabled:opacity-50"
                disabled={!modifiable}
                value={couleurValide ? champs.couleurAccent : COULEUR_PAR_DEFAUT}
                onChange={(e) => setChamps({ ...champs, couleurAccent: e.target.value })}
              />
              <input
                className="input font-mono"
                aria-label="Code hexadécimal de la couleur d'accent"
                maxLength={7}
                disabled={!modifiable}
                value={champs.couleurAccent}
                onChange={(e) => setChamps({ ...champs, couleurAccent: e.target.value })}
              />
            </div>
            {!couleurValide && (
              <p className="text-xs text-critical mt-1">
                Six chiffres hexadécimaux précédés d&apos;un dièse, par exemple #1F4F43.
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label" htmlFor="marque-signataire">
                Signataire
              </label>
              <input
                id="marque-signataire"
                className="input"
                placeholder="Claire Martin"
                maxLength={120}
                disabled={!modifiable}
                value={champs.signataireNom}
                onChange={(e) => setChamps({ ...champs, signataireNom: e.target.value })}
              />
            </div>
            <div>
              <label className="label" htmlFor="marque-fonction">
                Fonction
              </label>
              <input
                id="marque-fonction"
                className="input"
                placeholder="Expert-comptable"
                maxLength={120}
                disabled={!modifiable}
                value={champs.signataireFonction}
                onChange={(e) => setChamps({ ...champs, signataireFonction: e.target.value })}
              />
            </div>
          </div>

          <div>
            <label className="label" htmlFor="marque-mentions">
              Mentions de pied de page
            </label>
            <textarea
              id="marque-mentions"
              className="input"
              rows={2}
              maxLength={300}
              placeholder="Adresse, numéro d'inscription à l'Ordre, mentions obligatoires…"
              disabled={!modifiable}
              value={champs.mentionsPied}
              onChange={(e) => setChamps({ ...champs, mentionsPied: e.target.value })}
            />
            <p className="text-xs text-ink/40 mt-1">
              Reprises telles quelles sur chaque page, à côté de la numérotation.
            </p>
          </div>

          {erreur && <p className="text-critical text-sm">{erreur}</p>}
          {enregistre && <p className="text-success text-sm">Marque enregistrée.</p>}

          {modifiable && (
            <button
              type="submit"
              className="btn-primary"
              disabled={enregistrer.isPending || !couleurValide}
            >
              {enregistrer.isPending ? "Enregistrement…" : "Enregistrer"}
            </button>
          )}
          {estAdmin === false && (
            <p className="text-xs text-ink/40">
              Seul un administrateur peut modifier la marque de l&apos;organisation.
            </p>
          )}
        </form>

        <div className="space-y-3">
          <p className="oeil">
            Aperçu de l&apos;en-tête{" "}
            <span className="normal-case text-ink/35">
              {marque.autorisee
                ? "— entité et chiffres d'exemple"
                : "— non appliqué avec la formule actuelle"}
            </span>
          </p>
          <Apercu marque={champs} nomOrganisation={nomOrganisation} logo={logo} />
          <div className="grid sm:grid-cols-2 gap-3">
            <Televersement
              emplacement="logo"
              image={marque.logo}
              version={version}
              modifiable={modifiable}
              surChangement={() => setVersion((valeur) => valeur + 1)}
            />
            <Televersement
              emplacement="signature"
              image={marque.signature}
              version={version}
              modifiable={modifiable}
              surChangement={() => setVersion((valeur) => valeur + 1)}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
