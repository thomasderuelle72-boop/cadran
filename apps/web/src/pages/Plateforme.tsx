import { Fragment, useState } from "react";
import { useNavigate } from "react-router";
import { ApiError } from "../api/client";
import {
  useChangerFormulePlateforme,
  useDossierTest,
  useImporterReferentiel,
  useReferentielsSectoriels,
  useSupprimerReferentiel,
  useDroitPlateforme,
  useMotDePasseProvisoire,
  useOrganisationsPlateforme,
  useOuvrirAccesSupport,
  useSantePlateforme,
  useSupprimerOrganisation,
  useUtilisateursPlateforme,
} from "../api/hooks";
import type { OrganisationPlateforme, StatutAbonnement } from "../api/types";
import type { PlanId } from "../lib/abonnement";
import { useAuth } from "../context/AuthContext";
import { EntetePage, SqueletteTableau } from "../components/etats";

/**
 * Console d'exploitation.
 *
 * Elle montre des volumes, jamais des chiffres de clients : combien d'entités,
 * combien d'écritures, quand on s'est connecté pour la dernière fois. De quoi
 * facturer, dimensionner et diagnostiquer. Pour voir le contenu d'un dossier
 * il faut ouvrir un accès support, qui bascule la session et s'inscrit dans la
 * piste d'audit du client — c'est-à-dire sous ses yeux.
 */

/*
 * « Interne » figure ici et nulle part ailleurs : c'est la console
 * d'administration qui l'accorde, jamais la page d'abonnement ni un paiement.
 */
const PLANS: PlanId[] = ["essai", "solo", "cabinet", "groupe", "interne"];
const STATUTS: StatutAbonnement[] = [
  "essai",
  "actif",
  "impaye",
  "resilie",
  "incomplet",
];

const COULEUR_STATUT: Record<StatutAbonnement, string> = {
  actif: "text-success bg-success/10",
  essai: "text-ink-3 bg-ink/5",
  impaye: "text-critical bg-critical/10",
  resilie: "text-ink-3 bg-ink/5",
  incomplet: "text-warning bg-warning/10",
};

function date(valeur: string | null): string {
  return valeur ? new Date(valeur).toLocaleDateString("fr-FR") : "—";
}

function nombre(valeur: number): string {
  return valeur.toLocaleString("fr-FR");
}

export function PlateformePage() {
  const { user, refresh } = useAuth();
  const navigate = useNavigate();
  /*
   * `bascule` coupe les requêtes de la console dès le clic sur « Entrer »,
   * sans attendre que l'identité soit rechargée.
   *
   * Le cookie de session change avant que `user` ne le sache : entre les
   * deux, les deux requêtes de cette page repartaient avec une session
   * d'accès support, que le garde refuse — deux 403 dans la console du
   * navigateur à chaque prise en charge, et deux lignes sans objet dans une
   * piste d'audit qu'on consulte justement pour y voir clair.
   */
  const [bascule, setBascule] = useState(false);
  const autorise =
    user?.administrateurPlateforme === true && user.support === false;
  const interroge = autorise && !bascule;

  const { data: sante } = useSantePlateforme(interroge);
  const { data: organisations, isLoading } =
    useOrganisationsPlateforme(interroge);
  const [ouverte, setOuverte] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  const acces = useOuvrirAccesSupport();

  if (!autorise) {
    return (
      <div className="card max-w-xl">
        <h2 className="font-display text-lg font-semibold mb-1">
          Console indisponible
        </h2>
        <p className="text-sm text-ink-3">
          {user?.support
            ? "Quittez l'accès support en cours pour revenir à la console."
            : "Cette page est réservée à l'administration de la plateforme."}
        </p>
      </div>
    );
  }

  async function entrer(organisation: OrganisationPlateforme) {
    setErreur(null);
    setBascule(true);
    try {
      await acces.mutateAsync(organisation.id);
      /* La session vient de changer d'organisation : recharger l'identité
       * avant de naviguer, sinon le premier écran s'affiche encore au nom de
       * l'ancienne — exactement la confusion que l'accès support doit éviter. */
      await refresh();
      navigate("/tableau-de-bord");
    } catch (err) {
      // L'accès a échoué : la session n'a pas changé, la console reprend.
      setBascule(false);
      setErreur(err instanceof ApiError ? err.message : "Accès impossible.");
    }
  }

  return (
    <div className="space-y-6">
      <EntetePage
        titre="Plateforme"
        sousTitre="Organisations clientes, formules et dépannage"
      />

      {sante && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Tuile libelle="Organisations" valeur={nombre(sante.organisations)} />
          <Tuile libelle="Comptes" valeur={nombre(sante.utilisateurs)} />
          <Tuile
            libelle="Actifs sur 7 jours"
            valeur={nombre(sante.utilisateursActifs7j)}
            detail="comptes connectés"
          />
          <Tuile
            libelle="Écritures refusées"
            valeur={nombre(sante.ecritsEnEchec7j)}
            detail="7 jours · code ≥ 400"
            alerte={sante.ecritsEnEchec7j > 0}
          />
        </div>
      )}

      {erreur && <p className="text-critical text-sm">{erreur}</p>}

      <div className="card">
        <h2 className="font-display text-lg font-semibold mb-1">
          Organisations
        </h2>
        <p className="text-sm text-ink-3 mb-4">
          Les volumes suffisent à facturer et à diagnostiquer. Le contenu des
          dossiers n&apos;est pas lisible d&apos;ici : il faut ouvrir un accès
          support, que le client voit dans sa propre piste d&apos;audit.
        </p>

        {isLoading && <SqueletteTableau lignes={5} colonnes={6} />}

        {organisations && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[860px]">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-ink-3 border-b border-rule/10">
                  <th className="py-2 pr-4">Organisation</th>
                  <th className="py-2 pr-4">Formule</th>
                  <th className="py-2 pr-4 text-right">Comptes</th>
                  <th className="py-2 pr-4 text-right">Entités</th>
                  <th className="py-2 pr-4 text-right">Périodes</th>
                  <th className="py-2 pr-6 text-right">Écritures</th>
                  <th className="py-2 pr-4">Dernière venue</th>
                  <th className="py-2"></th>
                </tr>
              </thead>
              <tbody>
                {organisations.map((org) => (
                  <Fragment key={org.id}>
                    <tr className="border-b border-rule/5">
                      <td className="py-2.5 pr-4">
                        <div className="font-medium">{org.nom}</div>
                        <div className="text-xs text-ink-3">
                          créée le {date(org.creeeLe)}
                        </div>
                      </td>
                      <td className="py-2.5 pr-4">
                        <span
                          className={`inline-block rounded px-1.5 py-0.5 text-xs font-medium ${COULEUR_STATUT[org.statut]}`}
                        >
                          {org.plan} · {org.statut}
                        </span>
                        {org.resiliationDemandee && (
                          <div className="text-xs text-warning mt-0.5">
                            résiliation demandée
                          </div>
                        )}
                      </td>
                      <td className="py-2.5 pr-4 text-right font-mono tabular-nums">
                        {nombre(org.utilisateurs)}
                      </td>
                      <td className="py-2.5 pr-4 text-right font-mono tabular-nums">
                        {nombre(org.entites)}
                      </td>
                      <td className="py-2.5 pr-4 text-right font-mono tabular-nums">
                        {nombre(org.periodes)}
                      </td>
                      <td className="py-2.5 pr-6 text-right font-mono tabular-nums">
                        {nombre(org.ecritures)}
                      </td>
                      <td className="py-2.5 pr-4 text-ink-3 whitespace-nowrap">
                        {date(org.derniereActivite)}
                      </td>
                      <td className="py-2.5 text-right whitespace-nowrap">
                        <button
                          type="button"
                          className="btn-secondary text-xs px-2.5 py-1"
                          onClick={() =>
                            setOuverte(ouverte === org.id ? null : org.id)
                          }
                        >
                          {ouverte === org.id ? "Fermer" : "Gérer"}
                        </button>
                      </td>
                    </tr>
                    {ouverte === org.id && (
                      <tr>
                        <td colSpan={8} className="pb-4">
                          <Detail
                            organisation={org}
                            onEntrer={() => entrer(org)}
                            entreeEnCours={acces.isPending}
                          />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <ReferentielSectoriel />
    </div>
  );
}

/**
 * Le référentiel sectoriel : ce qui est chargé, et de quoi le charger.
 *
 * Commun à toutes les organisations — c'est une donnée publique, pas une
 * donnée client — d'où sa place au niveau de la console et non dans le
 * panneau d'une organisation.
 *
 * L'avertissement en tête n'est pas une formule : les fascicules de la Banque
 * de France portent une mention interdisant leur reproduction sans
 * autorisation expresse. Charger le référentiel avant de l'avoir obtenue
 * engage l'éditeur, et c'est ici que la décision se prend.
 */
function ReferentielSectoriel() {
  const { data: charges, isLoading } = useReferentielsSectoriels(true);
  const importer = useImporterReferentiel();
  const supprimer = useSupprimerReferentiel();

  return (
    <div className="card space-y-3">
      <div>
        <h2 className="font-display text-lg font-semibold">Référentiel sectoriel</h2>
        <p className="text-sm text-ink-3 mt-1 max-w-prose">
          Les quartiles par secteur auxquels chaque dossier est comparé dans son diagnostic. Aucun
          n&apos;est livré avec Cadran.
        </p>
      </div>

      <p className="rounded-md bg-warning-soft px-3 py-2 text-sm text-ink-2 max-w-prose">
        Les fascicules de la Banque de France interdisent leur reproduction sans son autorisation
        expresse. Ne chargez ses quartiles qu&apos;après l&apos;avoir obtenue par écrit.
      </p>

      {isLoading ? null : !charges || charges.length === 0 ? (
        <p className="text-sm text-ink-3">Aucun référentiel chargé : la comparaison sectorielle reste masquée.</p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wide text-ink-3 border-b border-rule/10">
              <th className="py-2 pr-4 font-medium">Source</th>
              <th className="py-2 pr-4 font-medium">Données</th>
              <th className="py-2 pr-4 font-medium">Mise à jour</th>
              <th className="py-2 pr-4 font-medium text-right">Secteurs</th>
              <th className="py-2 pr-4 font-medium text-right">Valeurs</th>
              <th className="py-2 font-medium">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {charges.map((r) => (
              <tr key={`${r.source}-${r.millesime}`} className="border-b border-rule/5 last:border-0">
                <td className="py-2 pr-4">{r.source === "BANQUE_DE_FRANCE" ? "Banque de France" : r.source}</td>
                <td className="py-2 pr-4 tabular-nums">{r.millesime}</td>
                <td className="py-2 pr-4">{new Date(r.miseAJour).toLocaleDateString("fr-FR", { timeZone: "UTC" })}</td>
                <td className="py-2 pr-4 text-right tabular-nums">{r.secteurs}</td>
                <td className="py-2 pr-4 text-right tabular-nums">{r.lignes}</td>
                <td className="py-2 text-right">
                  <button
                    type="button"
                    className="btn-secondary text-xs px-2 py-1"
                    disabled={supprimer.isPending}
                    onClick={() => supprimer.mutate({ source: r.source, millesime: r.millesime })}
                  >
                    Retirer
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <div>
        <label htmlFor="fichier-referentiel" className="label">
          Charger un référentiel (JSON)
        </label>
        <input
          id="fichier-referentiel"
          type="file"
          accept="application/json,.json"
          className="block mt-1 text-sm"
          disabled={importer.isPending}
          onChange={(e) => {
            const fichier = e.target.files?.[0];
            if (fichier) importer.mutate(fichier);
            e.target.value = "";
          }}
        />
        <p className="text-xs text-ink-3 mt-1">
          Remplace d&apos;un bloc le référentiel de même source et de même millésime. Le format est
          décrit dans <code>apps/api/src/benchmark/import-reference.ts</code>.
        </p>
        {importer.isSuccess && (
          <p role="status" className="text-xs text-success mt-1">
            Référentiel chargé : {importer.data.secteurs} secteurs ({importer.data.lignes} valeurs), données{" "}
            {importer.data.millesime}.
          </p>
        )}
        {importer.isError && (
          <p role="alert" className="text-xs text-critical mt-1">
            {importer.error instanceof Error ? importer.error.message : "Import refusé."}
          </p>
        )}
      </div>
    </div>
  );
}

function Tuile({
  libelle,
  valeur,
  detail,
  alerte,
}: {
  libelle: string;
  valeur: string;
  detail?: string;
  alerte?: boolean;
}) {
  return (
    <div className="panneau">
      <div className="oeil">{libelle}</div>
      <div
        className={`font-display text-2xl font-semibold mt-1 tabular-nums ${alerte ? "text-critical" : ""}`}
      >
        {valeur}
      </div>
      {detail && <div className="text-xs text-ink-3 mt-0.5">{detail}</div>}
    </div>
  );
}

function Detail({
  organisation,
  onEntrer,
  entreeEnCours,
}: {
  organisation: OrganisationPlateforme;
  onEntrer: () => void;
  entreeEnCours: boolean;
}) {
  const { data: utilisateurs } = useUtilisateursPlateforme(organisation.id);
  const changerFormule = useChangerFormulePlateforme();
  const motDePasse = useMotDePasseProvisoire();
  const droit = useDroitPlateforme();
  const supprimer = useSupprimerOrganisation();
  const dossier = useDossierTest();

  const [plan, setPlan] = useState<PlanId>(organisation.plan);
  const [statut, setStatut] = useState<StatutAbonnement>(organisation.statut);
  const [confirmation, setConfirmation] = useState("");
  const [provisoire, setProvisoire] = useState<{
    email: string;
    motDePasse: string;
  } | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  async function tenter(action: () => Promise<unknown>) {
    setErreur(null);
    try {
      await action();
    } catch (err) {
      setErreur(
        err instanceof ApiError ? err.message : "Opération impossible.",
      );
    }
  }

  return (
    <div className="panneau-discret space-y-5">
      <div className="grid gap-5 lg:grid-cols-2">
        <section className="space-y-3">
          <h3 className="text-sm font-medium">Formule</h3>
          <div className="flex flex-wrap gap-2 items-end">
            <div>
              <label className="label" htmlFor={`plan-${organisation.id}`}>
                Plan
              </label>
              <select
                id={`plan-${organisation.id}`}
                className="input w-40"
                value={plan}
                onChange={(e) => setPlan(e.target.value as PlanId)}
              >
                {PLANS.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label" htmlFor={`statut-${organisation.id}`}>
                Statut
              </label>
              <select
                id={`statut-${organisation.id}`}
                className="input w-40"
                value={statut}
                onChange={(e) => setStatut(e.target.value as StatutAbonnement)}
              >
                {STATUTS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="button"
              className="btn-secondary text-sm"
              disabled={
                changerFormule.isPending ||
                (plan === organisation.plan && statut === organisation.statut)
              }
              onClick={() =>
                tenter(() =>
                  changerFormule.mutateAsync({
                    organizationId: organisation.id,
                    plan,
                    statut,
                  }),
                )
              }
            >
              {changerFormule.isPending ? "Application…" : "Appliquer"}
            </button>
          </div>
          <p className="text-xs text-ink-3">
            Appliqué en base seulement. Un abonnement Stripe existant continue
            de son côté : deux sources de vérité qui s&apos;écrivent
            mutuellement finissent toujours par diverger.
          </p>
        </section>

        <section className="space-y-3">
          <h3 className="text-sm font-medium">Accès support</h3>
          <p className="text-xs text-ink-3">
            Bascule votre session sur {organisation.nom} pour une heure. Chaque
            requête, lecture comprise, est inscrite dans la piste d&apos;audit
            de ce client, qui la voit depuis son écran Paramètres.
          </p>
          <button
            type="button"
            className="btn-primary text-sm"
            disabled={entreeEnCours}
            onClick={onEntrer}
          >
            {entreeEnCours ? "Ouverture…" : `Entrer dans ${organisation.nom}`}
          </button>
        </section>

        <section className="space-y-3">
          <h3 className="text-sm font-medium">Dossier de test</h3>
          <p className="text-xs text-ink-3">
            Une entreprise fictive de quatre exercices,{" "}
            <strong>volontairement en difficulté</strong> — deux années de
            pertes, délai client qui dérive, apport du dirigeant pour tenir. Un
            dossier en bonne santé ne teste rien : les alertes restent muettes
            et le conseiller n &apos;a rien à dire. Le créer remplace celui qui
            existe déjà.
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="btn-secondary text-sm"
              disabled={dossier.isPending}
              onClick={() =>
                dossier.mutate({
                  organizationId: organisation.id,
                  action: "creer",
                })
              }
            >
              {dossier.isPending ? "En cours…" : "Créer le dossier de test"}
            </button>
            <button
              type="button"
              className="btn-secondary text-sm"
              disabled={dossier.isPending}
              onClick={() =>
                dossier.mutate({
                  organizationId: organisation.id,
                  action: "supprimer",
                })
              }
            >
              Le retirer
            </button>
          </div>
          {dossier.isSuccess && (
            <p className="text-xs text-ink-3">
              {dossier.data.cree
                ? `« ${dossier.data.nom} » est en place${dossier.data.supprime ? " (l'ancien a été remplacé)" : ""}.`
                : dossier.data.supprime
                  ? `« ${dossier.data.nom} » a été retiré.`
                  : "Aucun dossier de test à retirer."}
            </p>
          )}
          {dossier.isError && (
            <p className="text-xs text-critical">
              {dossier.error instanceof Error
                ? dossier.error.message
                : "Échec."}
            </p>
          )}
        </section>
      </div>

      <section className="space-y-2">
        <h3 className="text-sm font-medium">Comptes</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[600px]">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-ink-3 border-b border-rule/10">
                <th className="py-1.5">Nom</th>
                <th className="py-1.5">E-mail</th>
                <th className="py-1.5">Rôle</th>
                <th className="py-1.5">Dernière connexion</th>
                <th className="py-1.5"></th>
              </tr>
            </thead>
            <tbody>
              {utilisateurs?.map((u) => (
                <tr key={u.id} className="border-b border-rule/5 last:border-0">
                  <td className="py-1.5">
                    {u.name}
                    {u.administrateurPlateforme && (
                      <span className="ml-1.5 text-[0.65rem] uppercase tracking-wide text-primary">
                        plateforme
                      </span>
                    )}
                  </td>
                  <td className="py-1.5 text-ink-3">{u.email}</td>
                  <td className="py-1.5 text-ink-3">{u.role}</td>
                  <td className="py-1.5 text-ink-3">
                    {date(u.derniereConnexion)}
                  </td>
                  <td className="py-1.5 text-right whitespace-nowrap">
                    <button
                      type="button"
                      className="btn-secondary text-xs px-2 py-1"
                      disabled={motDePasse.isPending}
                      onClick={() =>
                        tenter(async () =>
                          setProvisoire(await motDePasse.mutateAsync(u.id)),
                        )
                      }
                    >
                      Mot de passe
                    </button>
                    <button
                      type="button"
                      className="btn-secondary text-xs px-2 py-1 ml-1.5"
                      disabled={droit.isPending}
                      onClick={() =>
                        tenter(() =>
                          droit.mutateAsync({
                            userId: u.id,
                            accorde: !u.administrateurPlateforme,
                          }),
                        )
                      }
                    >
                      {u.administrateurPlateforme
                        ? "Retirer plateforme"
                        : "Donner plateforme"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {provisoire && (
          <div className="panneau border-warning/40">
            <p className="text-sm">
              Mot de passe provisoire pour <strong>{provisoire.email}</strong> :
            </p>
            <p className="font-mono text-base mt-1 select-all">
              {provisoire.motDePasse}
            </p>
            <p className="text-xs text-ink-3 mt-1.5">
              Affiché une seule fois — il n&apos;est stocké qu&apos;en
              condensat. Les sessions ouvertes de ce compte viennent d&apos;être
              closes.
            </p>
            <button
              type="button"
              className="btn-secondary text-xs px-2 py-1 mt-2"
              onClick={() => setProvisoire(null)}
            >
              J&apos;ai noté
            </button>
          </div>
        )}
      </section>

      <section className="space-y-2 border-t border-rule/10 pt-4">
        <h3 className="text-sm font-medium text-critical">
          Supprimer l&apos;organisation
        </h3>
        <p className="text-xs text-ink-3">
          Efface les comptes, les entités, les périodes et le grand livre. Sans
          retour : c&apos;est ce qu&apos;exige une demande d&apos;effacement,
          qu&apos;une colonne « supprimé » ne satisferait pas. Saisissez le nom
          exact pour confirmer.
        </p>
        <div className="flex flex-wrap gap-2 items-center">
          <input
            className="input w-64"
            placeholder={organisation.nom}
            aria-label="Nom de l'organisation à supprimer"
            value={confirmation}
            onChange={(e) => setConfirmation(e.target.value)}
          />
          <button
            type="button"
            className="btn-secondary text-sm border-critical/40 text-critical"
            disabled={confirmation !== organisation.nom || supprimer.isPending}
            onClick={() =>
              tenter(() =>
                supprimer.mutateAsync({
                  organizationId: organisation.id,
                  nom: confirmation,
                }),
              )
            }
          >
            {supprimer.isPending ? "Suppression…" : "Supprimer définitivement"}
          </button>
        </div>
      </section>

      {erreur && <p className="text-critical text-sm">{erreur}</p>}
    </div>
  );
}
