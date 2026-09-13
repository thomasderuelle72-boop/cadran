import { useState } from "react";
import { RATIO_CATALOG } from "../lib/ratioCatalog";
import type { ActionPlan, Entity } from "../api/types";

/**
 * Formulaire d'une action, en création comme en modification.
 *
 * Il n'existait qu'en création : une action mal saisie — un impact à côté,
 * une échéance au mauvais mois, un constat à reformuler avant de le montrer
 * au dirigeant — ne pouvait que se supprimer et se ressaisir, ce qui fait
 * perdre l'auteur et la date d'origine. Le même formulaire sert maintenant
 * aux deux, ce qui garantit aussi que les deux voies valident pareil.
 */

export interface ValeursAction {
  constat: string;
  action: string;
  entityId: string;
  ratioId: string;
  valeurInitiale: string;
  valeurCible: string;
  impactEstime: string;
  responsable: string;
  /** Format jj/mm/aaaa du champ date natif, donc « aaaa-mm-jj ». */
  echeance: string;
}

export const VALEURS_VIDES: ValeursAction = {
  constat: "",
  action: "",
  entityId: "",
  ratioId: "",
  valeurInitiale: "",
  valeurCible: "",
  impactEstime: "",
  responsable: "",
  echeance: "",
};

/** Remplit le formulaire depuis une action existante. */
export function valeursDe(action: ActionPlan): ValeursAction {
  return {
    constat: action.constat,
    action: action.action,
    entityId: action.entityId ?? "",
    ratioId: action.ratioId ?? "",
    valeurInitiale: action.valeurInitiale === null ? "" : String(action.valeurInitiale),
    valeurCible: action.valeurCible === null ? "" : String(action.valeurCible),
    impactEstime: action.impactEstime === null ? "" : String(action.impactEstime),
    responsable: action.responsable ?? "",
    // Le champ date natif n'accepte que « aaaa-mm-jj » ; un ISO complet le
    // laisse vide sans le moindre message.
    echeance: action.echeance ? action.echeance.slice(0, 10) : "",
  };
}

export function FormulaireAction({
  titre,
  libelleBouton,
  valeursInitiales,
  entities,
  enCours,
  erreur,
  modeEdition = false,
  nomEntite,
  onValider,
  onAnnuler,
}: {
  titre: string;
  libelleBouton: string;
  valeursInitiales: ValeursAction;
  entities: Entity[] | undefined;
  enCours: boolean;
  erreur: string | null;
  /** En modification, l'entité est figée : elle détermine l'historique lu. */
  modeEdition?: boolean;
  nomEntite?: string | null;
  onValider: (valeurs: ValeursAction) => void;
  onAnnuler: () => void;
}) {
  const [form, setForm] = useState<ValeursAction>(valeursInitiales);
  // Les identifiants sont préfixés : deux formulaires peuvent coexister à
  // l'écran, et un `htmlFor` ambigu associe le libellé au mauvais champ.
  const p = modeEdition ? "edit" : "neuf";

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onValider(form);
      }}
      className="card space-y-4"
    >
      <h2 className="font-display text-lg font-semibold">{titre}</h2>

      <div>
        <label className="label" htmlFor={`${p}-constat`}>
          Constat — ce qu&apos;on a observé
        </label>
        <input
          id={`${p}-constat`}
          className="input"
          placeholder="Le DSO est à 83 jours, contre 45 dans le secteur"
          value={form.constat}
          onChange={(e) => setForm({ ...form, constat: e.target.value })}
          required
          minLength={3}
        />
      </div>

      <div>
        <label className="label" htmlFor={`${p}-action`}>
          Action — ce qu&apos;on fait
        </label>
        <input
          id={`${p}-action`}
          className="input"
          placeholder="Relancer à J+30 et passer les trois plus gros clients en prélèvement"
          value={form.action}
          onChange={(e) => setForm({ ...form, action: e.target.value })}
          required
          minLength={3}
        />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        <div>
          <label className="label" htmlFor={`${p}-entite`}>
            Entité
          </label>
          {modeEdition ? (
            <div className="text-sm py-2 text-ink/60">
              {nomEntite ?? "— Aucune —"}
              <span className="block text-xs text-ink/40">non modifiable</span>
            </div>
          ) : (
            <select
              id={`${p}-entite`}
              className="input"
              value={form.entityId}
              onChange={(e) => setForm({ ...form, entityId: e.target.value })}
            >
              <option value="">— Aucune —</option>
              {entities?.map((entity) => (
                <option key={entity.id} value={entity.id}>
                  {entity.name}
                </option>
              ))}
            </select>
          )}
        </div>
        <div>
          <label className="label" htmlFor={`${p}-indicateur`}>
            Indicateur suivi
          </label>
          <select
            id={`${p}-indicateur`}
            className="input"
            value={form.ratioId}
            onChange={(e) => setForm({ ...form, ratioId: e.target.value })}
          >
            <option value="">— Aucun —</option>
            {RATIO_CATALOG.map((ratio) => (
              <option key={ratio.id} value={ratio.id}>
                {ratio.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor={`${p}-impact`}>
            Impact estimé
          </label>
          <input
            id={`${p}-impact`}
            type="number"
            step="any"
            className="input"
            placeholder="84000"
            value={form.impactEstime}
            onChange={(e) => setForm({ ...form, impactEstime: e.target.value })}
          />
        </div>
        <div>
          <label className="label" htmlFor={`${p}-initiale`}>
            Valeur initiale
          </label>
          <input
            id={`${p}-initiale`}
            type="number"
            step="any"
            className="input"
            placeholder="83"
            value={form.valeurInitiale}
            onChange={(e) => setForm({ ...form, valeurInitiale: e.target.value })}
          />
        </div>
        <div>
          <label className="label" htmlFor={`${p}-cible`}>
            Valeur cible
          </label>
          <input
            id={`${p}-cible`}
            type="number"
            step="any"
            className="input"
            placeholder="65"
            value={form.valeurCible}
            onChange={(e) => setForm({ ...form, valeurCible: e.target.value })}
          />
        </div>
        <div>
          <label className="label" htmlFor={`${p}-echeance`}>
            Échéance
          </label>
          <input
            id={`${p}-echeance`}
            type="date"
            className="input"
            value={form.echeance}
            onChange={(e) => setForm({ ...form, echeance: e.target.value })}
          />
        </div>
        <div>
          <label className="label" htmlFor={`${p}-responsable`}>
            Responsable
          </label>
          <input
            id={`${p}-responsable`}
            className="input"
            value={form.responsable}
            onChange={(e) => setForm({ ...form, responsable: e.target.value })}
          />
        </div>
      </div>

      <p className="text-xs text-ink/40">
        L&apos;indicateur suivi est relu automatiquement sur la dernière période de
        l&apos;entité : c&apos;est ce qui permet de dire au point suivant si la cible a été
        atteinte. Il demande donc de préciser une entité. Vider un champ facultatif le retire.
      </p>

      {erreur && <p className="text-critical text-sm">{erreur}</p>}

      <div className="flex gap-3">
        <button type="submit" className="btn-primary" disabled={enCours}>
          {enCours ? "Enregistrement…" : libelleBouton}
        </button>
        <button type="button" className="btn-secondary" onClick={onAnnuler}>
          Annuler
        </button>
      </div>
    </form>
  );
}
