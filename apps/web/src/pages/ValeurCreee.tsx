import { useEffect, useState } from "react";
import { RotateCcw } from "lucide-react";
import { useEntities, useUpdateAction, useValeurCreee } from "../api/hooks";
import type { ActionStatus, LigneValeur } from "../api/types";
import { useAuth } from "../context/AuthContext";
import { EntetePage, EtatVide, SqueletteTableau, Zone } from "../components/etats";
import { formatCurrency, formatRatioValue } from "../lib/format";

/**
 * Ce que les actions menées ont rapporté aux clients.
 *
 * Le pendant de « Missions à proposer » : là, ce qu'on peut faire gagner ;
 * ici, ce qu'on a fait gagner. C'est l'argument d'un cabinet pour ses
 * honoraires de conseil, et il doit pouvoir le présenter tel qu'il le
 * défend : choisir la période et les actions comptées, corriger un gain
 * quand il en sait plus que les chiffres. Chaque choix est enregistré sur
 * l'action, et le rapport client le reprend.
 */

const PERIODES: Array<{ id: string; libelle: string; mois: number | null }> = [
  { id: "3", libelle: "3 mois", mois: 3 },
  { id: "6", libelle: "6 mois", mois: 6 },
  { id: "12", libelle: "12 mois", mois: 12 },
  { id: "tout", libelle: "Depuis le début", mois: null },
];

const STATUTS: Array<{ id: ActionStatus; libelle: string }> = [
  { id: "FAITE", libelle: "Faites" },
  { id: "EN_COURS", libelle: "En cours" },
  { id: "A_FAIRE", libelle: "À faire" },
];

function ilYa(mois: number | null): string | undefined {
  if (mois === null) return undefined;
  const date = new Date();
  date.setMonth(date.getMonth() - mois);
  return date.toISOString().slice(0, 10);
}

export function ValeurCreeePage() {
  const { user } = useAuth();
  const { data: entites } = useEntities();
  const [periode, setPeriode] = useState("12");
  const [statuts, setStatuts] = useState<ActionStatus[]>(["FAITE", "EN_COURS"]);
  const [dossier, setDossier] = useState("");
  const { data, isLoading, error, refetch } = useValeurCreee({
    depuis: ilYa(PERIODES.find((p) => p.id === periode)?.mois ?? null),
    statuts,
    entityId: dossier || undefined,
  });
  // Corriger un gain, c'est modifier l'action : mêmes droits que le plan d'action.
  const modifiable = user?.role === "ADMIN" || user?.role === "DAF" || user?.role === "CONTROLEUR";

  const basculer = (s: ActionStatus) =>
    setStatuts((liste) => (liste.includes(s) ? liste.filter((x) => x !== s) : [...liste, s]));

  return (
    <div className="space-y-6">
      <EntetePage
        titre="Valeur créée"
        sousTitre="Ce que les actions menées ont rapporté aux clients, mesuré sur leurs derniers chiffres."
      />

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex gap-0.5 p-0.5 rounded-lg bg-ink/[0.06]" role="radiogroup" aria-label="Période">
          {PERIODES.map((p) => (
            <button
              key={p.id}
              type="button"
              role="radio"
              aria-checked={periode === p.id}
              onClick={() => setPeriode(p.id)}
              className={`rounded-md px-2.5 py-1 text-sm font-medium transition ${
                periode === p.id ? "bg-surface text-ink shadow-sm" : "text-ink-3 hover:text-ink"
              }`}
            >
              {p.libelle}
            </button>
          ))}
        </div>
        <fieldset className="flex flex-wrap items-center gap-3 text-sm">
          <legend className="sr-only">Actions prises en compte</legend>
          {STATUTS.map((s) => (
            <label key={s.id} className="inline-flex items-center gap-1.5 text-ink-2">
              <input type="checkbox" checked={statuts.includes(s.id)} onChange={() => basculer(s.id)} />
              {s.libelle}
            </label>
          ))}
        </fieldset>
        <select
          className="input w-auto py-1.5"
          aria-label="Dossier"
          value={dossier}
          onChange={(e) => setDossier(e.target.value)}
        >
          <option value="">Tous les dossiers</option>
          {entites?.map((e) => (
            <option key={e.id} value={e.id}>
              {e.name}
            </option>
          ))}
        </select>
      </div>

      {statuts.length === 0 ? (
        <EtatVide titre="Aucune action retenue">Cochez au moins un statut d&apos;action à prendre en compte.</EtatVide>
      ) : (
        <Zone
          chargement={isLoading}
          erreur={error}
          onReessayer={() => void refetch()}
          quoi="la valeur créée"
          squelette={<SqueletteTableau lignes={5} colonnes={5} />}
        >
          {data && data.lignes.length === 0 ? (
            <EtatVide titre="Aucune action sur cette période" action={{ to: "/opportunites", label: "Voir les missions à proposer" }}>
              La valeur créée se mesure sur les actions du plan d&apos;action. Ajoutez-y les missions proposées à vos
              clients : leur effet apparaîtra ici dès la période suivante importée.
            </EtatVide>
          ) : (
            data && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {/* Un montant nul ne s'affiche pas : « 0 € de résultat » prend la
                      place d'une information sans en donner une. */}
                  {Math.round(data.totaux.tresorerie) !== 0 && (
                    <Tuile valeur={formatCurrency(Math.round(data.totaux.tresorerie))} libelle="de trésorerie libérée" />
                  )}
                  {Math.round(data.totaux.resultat) !== 0 && (
                    <Tuile valeur={formatCurrency(Math.round(data.totaux.resultat))} libelle="de résultat en plus, par an" />
                  )}
                  <Tuile
                    valeur={String(data.totaux.actionsComptees)}
                    libelle={`action${data.totaux.actionsComptees > 1 ? "s" : ""} comptée${data.totaux.actionsComptees > 1 ? "s" : ""}, sur ${data.totaux.dossiers} dossier${data.totaux.dossiers > 1 ? "s" : ""}${
                      Math.round(data.totaux.autres) !== 0 ? ` · ${formatCurrency(Math.round(data.totaux.autres))} de gains saisis` : ""
                    }`}
                  />
                </div>

                <div className="card p-0 overflow-x-auto">
                  <table className="w-full text-sm min-w-[860px]">
                    <thead>
                      <tr className="text-left text-xs uppercase tracking-wide text-ink-3 border-b border-rule/10 bg-surface-2">
                        <th className="px-4 py-2.5 font-semibold">Compter</th>
                        <th className="px-3 py-2.5 font-semibold">Action</th>
                        <th className="px-3 py-2.5 font-semibold">Indicateur</th>
                        <th className="px-3 py-2.5 font-semibold text-right">Gain calculé</th>
                        <th className="px-4 py-2.5 font-semibold text-right">Gain retenu</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.lignes.map((ligne) => (
                        <Ligne key={ligne.actionId} ligne={ligne} modifiable={modifiable} />
                      ))}
                    </tbody>
                  </table>
                </div>

                <p className="text-xs text-ink-3 max-w-prose">
                  Chaque gain est calculé sur la dernière période importée du dossier : jours de délai gagnés × ventes
                  ou achats par jour, points de marge × chiffre d&apos;affaires annuel, écart de trésorerie. Un gain
                  négatif signale une dégradation. Les corrections et exclusions sont enregistrées sur l&apos;action
                  et reprises dans le rapport client.
                </p>
              </div>
            )
          )}
        </Zone>
      )}
    </div>
  );
}

function Tuile({ valeur, libelle }: { valeur: string; libelle: string }) {
  return (
    <div className="card apparition">
      <div className="text-[1.6rem] font-bold leading-tight tracking-tight">{valeur}</div>
      <div className="text-sm text-ink-3 mt-1">{libelle}</div>
    </div>
  );
}

function Ligne({ ligne, modifiable }: { ligne: LigneValeur; modifiable: boolean }) {
  const modifier = useUpdateAction();
  const [saisie, setSaisie] = useState(ligne.gainRetenu === null ? "" : String(Math.round(ligne.gainRetenu)));
  useEffect(() => {
    setSaisie(ligne.gainRetenu === null ? "" : String(Math.round(ligne.gainRetenu)));
  }, [ligne.gainRetenu]);
  /* La case suit le clic tout de suite, sans attendre le serveur : une case
   * qui ne bouge pas fait recliquer. En cas d'échec, elle revient à l'état
   * enregistré. */
  const [exclue, setExclue] = useState(ligne.exclue);
  useEffect(() => setExclue(ligne.exclue), [ligne.exclue]);

  function enregistrer() {
    const propre = saisie.replace(/\s/g, "").replace(",", ".");
    if (propre === "") return;
    const montant = Number(propre);
    if (!Number.isFinite(montant) || Math.round(montant) === Math.round(ligne.gainRetenu ?? Number.NaN)) return;
    modifier.mutate({ id: ligne.actionId, gainRetenu: montant });
  }

  const unite = ligne.unite ?? "ratio";
  return (
    <tr className={`border-b border-rule/5 last:border-0 align-top ${exclue ? "opacity-50" : ""}`}>
      <td className="px-4 py-3">
        <input
          type="checkbox"
          aria-label={`Compter « ${ligne.action} » dans la valeur créée`}
          checked={!exclue}
          disabled={!modifiable}
          onChange={(e) => {
            const nouvelle = !e.target.checked;
            setExclue(nouvelle);
            modifier.mutate(
              { id: ligne.actionId, exclureDeLaValeur: nouvelle },
              { onError: () => setExclue(ligne.exclue) },
            );
          }}
        />
      </td>
      <td className="px-3 py-3 max-w-[22rem]">
        <div className="text-xs font-semibold text-ink-3">{ligne.dossier ?? "Organisation"}</div>
        <div className="font-medium">{ligne.action}</div>
        <div className="text-xs text-ink-3 mt-0.5">{ligne.explication}</div>
      </td>
      <td className="px-3 py-3 whitespace-nowrap">
        {ligne.ratioLibelle ? (
          <>
            <div className="text-ink-2">{ligne.ratioLibelle}</div>
            <div className="tabular-nums">
              {formatRatioValue(ligne.valeurInitiale, unite, ligne.devise)} →{" "}
              <span className="font-semibold">{formatRatioValue(ligne.valeurActuelle, unite, ligne.devise)}</span>
            </div>
            {ligne.periodeLue && <div className="text-xs text-ink-3">lu sur {ligne.periodeLue}</div>}
          </>
        ) : (
          <span className="text-ink-3">—</span>
        )}
      </td>
      <td className="px-3 py-3 text-right tabular-nums whitespace-nowrap text-ink-2">
        {ligne.gainCalcule === null ? "—" : formatCurrency(Math.round(ligne.gainCalcule), ligne.devise)}
      </td>
      <td className="px-4 py-3 text-right whitespace-nowrap">
        <div className="inline-flex items-center gap-1.5">
          <input
            type="text"
            inputMode="decimal"
            aria-label="Gain retenu, en euros"
            className={`input w-32 py-1 text-right tabular-nums ${ligne.gainCorrige ? "font-semibold" : ""}`}
            value={saisie}
            placeholder="à saisir"
            disabled={!modifiable}
            onChange={(e) => setSaisie(e.target.value)}
            onBlur={enregistrer}
            onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
          />
          <span className="text-ink-3">€</span>
          {ligne.gainCorrige && modifiable && (
            <button
              type="button"
              title="Revenir au gain calculé"
              aria-label="Revenir au gain calculé"
              className="p-1 rounded-md text-ink-3 hover:text-ink hover:bg-ink/5"
              onClick={() => modifier.mutate({ id: ligne.actionId, gainRetenu: null })}
            >
              <RotateCcw size={14} aria-hidden="true" />
            </button>
          )}
        </div>
        {ligne.gainCorrige && <div className="text-xs text-ink-3 mt-1">corrigé à la main</div>}
      </td>
    </tr>
  );
}
