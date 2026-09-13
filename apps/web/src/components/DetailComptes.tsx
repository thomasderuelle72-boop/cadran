import { useMemo, useState } from "react";
import { useEcritures, useImportReference, useLineItems } from "../api/hooks";
import { EtatErreur, EtatVide, Ligne, SqueletteTableau, Zone } from "./etats";
import { formatCurrency, formatDate } from "../lib/format";
import type { LineItem, LinePoste } from "../api/types";

/**
 * Détail par compte, avec descente jusqu'à l'écriture.
 *
 * Jusqu'ici l'application s'arrêtait à l'agrégat : on lisait « charges de
 * personnel : 412 000 € » sans pouvoir vérifier d'où venait le chiffre. Un
 * outil de conseil ne peut pas demander cette confiance-là — la première
 * question d'un dirigeant devant un montant qui le surprend est « c'est
 * quoi, dedans ? », et la réponse doit tenir en deux clics.
 *
 * Trois échelons, dépliés à la demande :
 *   poste (l'agrégat qui alimente les ratios)
 *     → compte (la ligne de balance importée)
 *       → écritures (les pièces du grand livre, si un FEC a été importé)
 *
 * Rien n'est chargé tant que rien n'est déplié : les écritures d'un compte de
 * banque se comptent en milliers de lignes.
 */

function montant(item: LineItem): number {
  return Number(item.amount);
}

/** Normalise pour une recherche insensible à la casse et aux accents. */
function sansAccent(texte: string): string {
  return texte
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

/**
 * Niveau 3 : les écritures du compte.
 *
 * Le total est affiché à côté du nombre de lignes visibles, parce que la
 * requête est bornée : masquer l'écart laisserait croire qu'on voit tout.
 */
function Ecritures({ entityId, compte }: { entityId: string; compte: string }) {
  // Un préfixe d'un seul caractère ramènerait une classe entière du plan
  // comptable : l'API le refuse, et la requête ne part pas. Sans ce garde,
  // le panneau s'ouvrirait vide sans rien dire.
  const interrogeable = compte.trim().length >= 2;
  const { data, isLoading, error, refetch } = useEcritures(entityId, compte, interrogeable);

  if (!interrogeable) {
    return (
      <p className="text-xs text-ink/50 py-2">
        Ce compte est identifié par un seul caractère : trop large pour retrouver ses écritures.
      </p>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-1.5 py-2">
        {Array.from({ length: 4 }, (_, i) => (
          <Ligne key={i} hauteur="0.8rem" largeur={i % 2 ? "70%" : "90%"} />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="py-2">
        <EtatErreur erreur={error} onReessayer={() => void refetch()} quoi="les écritures" />
      </div>
    );
  }

  if (!data) return null;

  if (data.total === 0) {
    return (
      <p className="text-xs text-ink/50 py-2">
        Aucune écriture pour ce compte. Le solde vient d&apos;une balance saisie ou importée en
        CSV : seul un import FEC apporte le détail des pièces.
      </p>
    );
  }

  return (
    <div className="py-2">
      <div className="flex items-baseline justify-between gap-3 mb-2 text-xs text-ink/50">
        <span>
          {data.affichees < data.total
            ? `${data.affichees} écritures les plus récentes sur ${data.total}`
            : `${data.total} écriture${data.total > 1 ? "s" : ""}`}
        </span>
        <span className="font-mono">
          Débit {formatCurrency(data.debitTotal, data.currency)} · Crédit{" "}
          {formatCurrency(data.creditTotal, data.currency)} · Solde{" "}
          {formatCurrency(data.solde, data.currency)}
        </span>
      </div>

      {/*
        Hauteur bornée : un compte de clients porte ici 182 écritures, et les
        dérouler d'un coup repousse tout le reste de la page hors de l'écran.
        Le cadre défile, l'en-tête reste, et le total au-dessus dit combien il
        y en a.
      */}
      <div className="overflow-auto max-h-80 rounded-lg border border-rule/[0.07]">
        <table className="w-full text-xs min-w-[620px]">
          <thead className="sticky top-0 bg-surface-2">
            <tr className="text-left text-ink/40 border-b border-rule/10">
              <th className="py-1.5 font-medium">Date</th>
              <th className="py-1.5 font-medium">Journal</th>
              <th className="py-1.5 font-medium">Pièce</th>
              <th className="py-1.5 font-medium">Libellé</th>
              <th className="py-1.5 font-medium text-right">Débit</th>
              <th className="py-1.5 font-medium text-right">Crédit</th>
            </tr>
          </thead>
          <tbody>
            {data.ecritures.map((e) => (
              <tr key={e.id} className="border-b border-rule/5 last:border-0">
                <td className="py-1.5 whitespace-nowrap font-mono text-ink/70">
                  {formatDate(e.entryDate)}
                </td>
                <td className="py-1.5 font-mono text-ink/50">{e.journalCode}</td>
                <td className="py-1.5 font-mono text-ink/50">{e.pieceRef ?? "—"}</td>
                <td className="py-1.5">
                  {e.label}
                  {e.auxAccountLabel && (
                    <span className="block text-ink/40">{e.auxAccountLabel}</span>
                  )}
                </td>
                <td className="py-1.5 text-right font-mono">
                  {e.debit === 0 ? <span className="text-ink/25">—</span> : formatCurrency(e.debit, data.currency)}
                </td>
                <td className="py-1.5 text-right font-mono">
                  {e.credit === 0 ? <span className="text-ink/25">—</span> : formatCurrency(e.credit, data.currency)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/** Niveau 2 : un compte de la balance, dépliable vers ses écritures. */
function LigneCompte({
  item,
  totalPoste,
  currency,
  entityId,
}: {
  item: LineItem;
  totalPoste: number;
  currency: string;
  entityId: string;
}) {
  const [ouvert, setOuvert] = useState(false);
  // Une part n'a de sens que si le poste a une masse : sur un poste dont les
  // lignes se compensent, « 340 % du poste » n'informe personne.
  const part = totalPoste !== 0 ? montant(item) / totalPoste : null;

  return (
    <>
      <tr className="border-b border-rule/5">
        <td className="py-1.5 pl-3 sm:pl-6">
          <button
            type="button"
            onClick={() => setOuvert((o) => !o)}
            aria-expanded={ouvert}
            className="text-left hover:text-primary transition"
          >
            <span className="font-mono text-ink/50 mr-2">{item.accountCode}</span>
            {item.label}
            <span className="ml-2 text-xs text-ink/35">{ouvert ? "▾" : "▸"}</span>
          </button>
        </td>
        <td className="py-1.5 text-right font-mono">{formatCurrency(montant(item), currency)}</td>
        <td className="py-1.5 text-right font-mono text-ink/45">
          {part === null ? "—" : `${(part * 100).toFixed(1)} %`}
        </td>
      </tr>
      {ouvert && (
        <tr>
          <td colSpan={3} className="bg-ink/[0.02] px-3 sm:px-6">
            <Ecritures entityId={entityId} compte={item.accountCode} />
          </td>
        </tr>
      )}
    </>
  );
}

/** Niveau 1 : le poste, tel qu'il alimente les ratios et les SIG. */
function GroupePoste({
  libelle,
  items,
  currency,
  entityId,
  forceOuvert,
}: {
  libelle: string;
  items: LineItem[];
  currency: string;
  entityId: string;
  forceOuvert: boolean;
}) {
  const [ouvert, setOuvert] = useState(false);
  const total = items.reduce((s, i) => s + montant(i), 0);
  // Une recherche active déplie tout : sinon l'utilisateur verrait des postes
  // filtrés sans voir les comptes qui ont provoqué la correspondance.
  const deplie = ouvert || forceOuvert;

  return (
    <>
      <tr className="border-b border-rule/10 bg-surface-2/60">
        <td className="py-2">
          <button
            type="button"
            onClick={() => setOuvert((o) => !o)}
            aria-expanded={deplie}
            className="text-left font-semibold hover:text-primary transition"
          >
            {libelle}
            <span className="ml-2 text-xs font-normal text-ink/40">
              {items.length} compte{items.length > 1 ? "s" : ""} {deplie ? "▾" : "▸"}
            </span>
          </button>
        </td>
        <td className="py-2 text-right font-mono font-semibold">{formatCurrency(total, currency)}</td>
        {/* Vide : la colonne mesure la part d'un compte dans son poste, et un
            poste vaut toujours 100 % de lui-même. */}
        <td className="py-2" />
      </tr>
      {deplie &&
        items.map((item) => (
          <LigneCompte
            key={item.id}
            item={item}
            totalPoste={total}
            currency={currency}
            entityId={entityId}
          />
        ))}
    </>
  );
}

export function DetailComptes({
  periodId,
  entityId,
  currency,
}: {
  periodId: string | null;
  entityId: string;
  currency: string;
}) {
  const { data: items, isLoading, error, refetch } = useLineItems(periodId);
  const { data: reference } = useImportReference();
  const [recherche, setRecherche] = useState("");

  // Les libellés et l'ordre des postes viennent de l'API : les redéfinir ici
  // créerait une seconde vérité qui divergerait au premier poste ajouté.
  const libelles = useMemo(() => {
    const table = new Map<string, string>();
    reference?.postes.forEach((p) => table.set(p.poste, p.label));
    return table;
  }, [reference]);

  const groupes = useMemo(() => {
    if (!items) return [];
    const terme = sansAccent(recherche.trim());
    const retenus = terme
      ? items.filter(
          (i) => sansAccent(i.label).includes(terme) || i.accountCode.startsWith(terme)
        )
      : items;

    const parPoste = new Map<LinePoste, LineItem[]>();
    for (const item of retenus) {
      const liste = parPoste.get(item.poste);
      if (liste) liste.push(item);
      else parPoste.set(item.poste, [item]);
    }

    const ordre = reference?.postes.map((p) => p.poste) ?? [...parPoste.keys()];
    return ordre
      .filter((poste) => parPoste.has(poste))
      .map((poste) => ({
        poste,
        libelle: libelles.get(poste) ?? poste,
        // Le compte le plus lourd d'abord : c'est celui qui explique le poste.
        items: [...(parPoste.get(poste) ?? [])].sort(
          (a, b) => Math.abs(montant(b)) - Math.abs(montant(a))
        ),
      }));
  }, [items, recherche, reference, libelles]);

  if (!periodId) return null;

  return (
    <div className="card">
      <div className="flex items-start justify-between gap-4 flex-wrap mb-1">
        <h2 className="font-display text-lg font-semibold">Détail par compte</h2>
        <input
          className="input w-full sm:w-64"
          type="search"
          value={recherche}
          placeholder="Chercher un compte"
          aria-label="Chercher un compte"
          onChange={(e) => setRecherche(e.target.value)}
        />
      </div>
      <p className="text-sm text-ink/50 mb-4">
        Chaque poste se déplie en comptes, et chaque compte en écritures : de quoi vérifier un
        chiffre sans quitter l&apos;analyse.
      </p>

      <Zone
        chargement={isLoading}
        erreur={error}
        onReessayer={() => void refetch()}
        quoi="le détail des comptes"
        squelette={<SqueletteTableau lignes={8} colonnes={3} />}
      >
        {groupes.length === 0 ? (
          recherche ? (
            <EtatVide titre="Aucun compte trouvé">
              Aucun compte ne correspond à « {recherche} » sur cette période.
            </EtatVide>
          ) : (
            <EtatVide titre="Aucune ligne" action={{ to: "/import", label: "Importer des données" }}>
              Cette période n&apos;a aucune ligne de balance.
            </EtatVide>
          )
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[480px]">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-ink/40 border-b border-rule/10">
                  <th className="py-2">Poste et comptes</th>
                  <th className="py-2 text-right">Montant</th>
                  <th className="py-2 text-right">Part du poste</th>
                </tr>
              </thead>
              <tbody>
                {groupes.map((groupe) => (
                  <GroupePoste
                    key={groupe.poste}
                    libelle={groupe.libelle}
                    items={groupe.items}
                    currency={currency}
                    entityId={entityId}
                    forceOuvert={recherche.trim().length > 0}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Zone>
    </div>
  );
}
