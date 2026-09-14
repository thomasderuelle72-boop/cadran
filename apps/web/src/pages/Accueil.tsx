import { useState } from "react";
import { Link } from "react-router-dom";
import { FORMULES, economieAnnuelle, prixAnnualise } from "../lib/formules";
import { BasculeTheme } from "../components/BasculeTheme";

/**
 * Page d'accueil publique.
 *
 * Elle vit dans l'application React plutôt que dans un site statique séparé,
 * ce qui est un compromis assumé : une page vitrine n'a pas besoin de React
 * et le charge quand même. Le jour où le référencement compte, elle se
 * réécrit en Astro sans rien changer d'autre — le contenu est ici, pas
 * disséminé.
 *
 * Le fil de la page suit celui du produit : constater, comprendre, agir.
 * C'est l'argument de vente, et c'est aussi la navigation de l'outil ; les
 * faire coïncider évite au visiteur d'apprendre deux fois la même chose.
 */

function Marque() {
  return (
    <div className="flex items-center gap-2.5">
      <span
        className="w-7 h-7 rounded-full flex-none"
        style={{
          background:
            "conic-gradient(from -90deg, rgb(var(--accent)) 0 25%, rgb(var(--surface-2)) 25% 100%)",
        }}
        aria-hidden="true"
      />
      <span className="font-display font-semibold text-lg leading-none">Cadran</span>
    </div>
  );
}

/** Une étape du raisonnement, illustrée par une phrase que l'outil produit. */
function Etape({
  numero,
  titre,
  texte,
  exemple,
}: {
  numero: string;
  titre: string;
  texte: string;
  exemple: string;
}) {
  return (
    <div className="flex gap-5">
      {/*
        La numérotation est ici légitime : les quatre marches sont un ordre
        réel, chacune supposant la précédente. On ne conseille pas avant
        d'avoir compris, ni ne comprend avant d'avoir constaté.
      */}
      <div className="flex-none w-9 h-9 rounded-full bg-primary-soft text-primary font-mono text-sm font-semibold flex items-center justify-center">
        {numero}
      </div>
      <div className="min-w-0">
        <h3 className="font-display text-lg font-semibold mb-1">{titre}</h3>
        <p className="text-ink/60 text-sm max-w-prose">{texte}</p>
        <p className="mt-2.5 text-sm font-mono text-ink/80 border-l-2 border-accent/50 pl-3 py-0.5">
          {exemple}
        </p>
      </div>
    </div>
  );
}

function Coche() {
  return (
    <svg
      className="w-4 h-4 flex-none mt-0.5 text-success"
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M3.5 8.5l3 3 6-7"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function Accueil() {
  const [annuel, setAnnuel] = useState(false);

  return (
    <div className="min-h-screen bg-paper text-ink">
      <header className="sticky top-0 z-20 border-b border-rule/10 bg-paper/85 backdrop-blur">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          <Marque />
          <nav className="flex items-center gap-2 sm:gap-4 text-sm">
            <a href="#tarifs" className="hidden sm:inline text-ink/60 hover:text-ink transition">
              Tarifs
            </a>
            <Link to="/login" className="text-ink/60 hover:text-ink transition px-2">
              Se connecter
            </Link>
            <Link to="/register" className="btn-primary whitespace-nowrap">
              Essayer 14 jours
            </Link>
          </nav>
        </div>
      </header>

      <main>
        {/* ---------------------------------------------------------------
            Accroche. Elle nomme le manque plutôt que la fonctionnalité :
            tout le monde a déjà un tableau de bord, personne n'a la suite.
        --------------------------------------------------------------- */}
        <section className="mx-auto max-w-6xl px-4 sm:px-6 pt-16 pb-14 sm:pt-24 sm:pb-20">
          <p className="oeil mb-4">Pilotage et conseil financier</p>
          <h1 className="font-display text-4xl sm:text-5xl lg:text-6xl font-semibold leading-[1.05] max-w-4xl text-balance">
            Votre comptable vous dit où vous en êtes.
            <span className="block text-primary mt-2">
              Cadran vous dit si c&apos;est normal, et quoi faire.
            </span>
          </h1>
          <p className="mt-6 text-lg text-ink/60 max-w-2xl">
            Importez votre fichier des écritures comptables. En quelques secondes, dix-neuf ratios,
            vos soldes de gestion, votre tableau de flux, vos encours client et un diagnostic de
            fragilité — chacun remontant jusqu&apos;à l&apos;écriture qui l&apos;explique.
          </p>

          <div className="mt-9 flex flex-wrap items-center gap-3">
            <Link to="/register" className="btn-primary text-base px-6 py-3">
              Commencer l&apos;essai gratuit
            </Link>
            <a href="#tarifs" className="btn-secondary text-base px-6 py-3">
              Voir les tarifs
            </a>
          </div>
          <p className="mt-4 text-sm text-ink/45">
            14 jours, sans carte bancaire. Aucune installation.
          </p>

          <div className="mt-14 grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              ["19", "ratios calculés", "à chaque import, avec leur formule"],
              ["18", "colonnes FEC", "le format normé, sans correspondance à établir"],
              ["2", "scores de fragilité", "Altman Z' et Conan & Holder, auditables"],
              ["0", "saisie manuelle", "un fichier suffit pour un exercice entier"],
            ].map(([chiffre, quoi, precision]) => (
              <div key={quoi} className="panneau-discret">
                <div className="font-mono text-3xl font-semibold text-primary">{chiffre}</div>
                <div className="font-medium text-sm mt-1">{quoi}</div>
                <div className="text-xs text-ink/50 mt-0.5">{precision}</div>
              </div>
            ))}
          </div>
        </section>

        {/* ---------------------------------------------------------------
            Les quatre marches du conseil.
        --------------------------------------------------------------- */}
        <section className="border-y border-rule/10 bg-surface">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 py-16 sm:py-20">
            <h2 className="font-display text-3xl font-semibold text-balance">
              Un outil de reporting s&apos;arrête à la première marche
            </h2>
            <p className="mt-3 text-ink/60 max-w-2xl">
              Un chiffre sans contexte n&apos;est pas une information. Cadran descend les quatre
              marches, et chacune mène à la suivante d&apos;un clic.
            </p>

            <div className="mt-12 grid md:grid-cols-2 gap-10 md:gap-x-12 md:gap-y-12">
              <Etape
                numero="1"
                titre="Constater"
                texte="Les agrégats, les ratios et leur évolution, recalculés à chaque import. Rien à saisir."
                exemple="Marge d'EBITDA : 18,1 %"
              />
              <Etape
                numero="2"
                titre="Comprendre"
                texte="Chaque poste se déplie en comptes, et chaque compte en écritures du grand livre. Le chiffre se vérifie sans quitter l'écran."
                exemple="dont 411000 Clients : 333 864 € sur 182 écritures"
              />
              <Etape
                numero="3"
                titre="Anticiper"
                texte="Seuil de rentabilité, besoin en fonds de roulement normatif, projection de trésorerie et scores de fragilité — avec leurs formules et leurs limites affichées."
                exemple="Point mort atteint le 14 septembre"
              />
              <Etape
                numero="4"
                titre="Agir"
                texte="Chaque recommandation devient un objet suivi : constat, action, impact chiffré, échéance. L'indicateur est relu tout seul à la période suivante."
                exemple="DSO 83 → 65 jours · 84 000 € · échéance 31/12"
              />
            </div>
          </div>
        </section>

        {/* ---------------------------------------------------------------
            Tarifs.
        --------------------------------------------------------------- */}
        <section id="tarifs" className="mx-auto max-w-6xl px-4 sm:px-6 py-16 sm:py-24">
          <div className="text-center max-w-2xl mx-auto">
            <h2 className="font-display text-3xl sm:text-4xl font-semibold text-balance">
              Un tarif par taille de périmètre
            </h2>
            <p className="mt-3 text-ink/60">
              Toutes les formules donnent accès à l&apos;analyse complète. Ce qui change, c&apos;est
              le nombre d&apos;entités et d&apos;intervenants.
            </p>
          </div>

          <div className="mt-8 flex justify-center">
            <div
              className="inline-flex gap-1 p-1 rounded-xl bg-ink/[0.05]"
              role="radiogroup"
              aria-label="Périodicité de facturation"
            >
              {[
                { id: false, label: "Mensuel" },
                { id: true, label: "Annuel −20 %" },
              ].map((option) => (
                <button
                  key={String(option.id)}
                  type="button"
                  role="radio"
                  aria-checked={annuel === option.id}
                  onClick={() => setAnnuel(option.id)}
                  className={`rounded-lg px-4 py-1.5 text-sm font-medium transition ${
                    annuel === option.id
                      ? "bg-surface text-ink shadow-sm"
                      : "text-ink/55 hover:text-ink/80"
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-10 grid sm:grid-cols-2 lg:grid-cols-4 gap-4 items-start">
            {FORMULES.map((formule) => {
              const prix =
                formule.prixMensuel === null
                  ? null
                  : annuel
                    ? prixAnnualise(formule.prixMensuel)
                    : formule.prixMensuel;

              return (
                <div
                  key={formule.id}
                  className={
                    formule.recommandee
                      ? "card border-primary/40 ring-1 ring-primary/20 relative"
                      : "card"
                  }
                >
                  {formule.recommandee && (
                    <span className="absolute -top-2.5 left-5 bg-primary text-paper text-[0.65rem] font-semibold uppercase tracking-wider px-2 py-0.5 rounded">
                      Le plus choisi
                    </span>
                  )}

                  <h3 className="font-display text-xl font-semibold">{formule.label}</h3>
                  <p className="text-xs text-ink/50 mt-0.5 min-h-[2.5rem]">{formule.pourQui}</p>

                  <div className="mt-4 mb-1 flex items-baseline gap-1.5">
                    {prix === null ? (
                      <span className="font-mono text-3xl font-semibold">Gratuit</span>
                    ) : (
                      <>
                        <span className="font-mono text-3xl font-semibold">{prix} €</span>
                        <span className="text-sm text-ink/50">/ mois</span>
                      </>
                    )}
                  </div>
                  <p className="text-xs text-ink/45 min-h-[2.5rem]">
                    {prix === null
                      ? "14 jours, sans carte"
                      : annuel
                        ? `Facturé à l'année · ${economieAnnuelle(formule.prixMensuel!)} € économisés`
                        : "Hors taxes · sans engagement"}
                  </p>

                  <Link
                    to="/register"
                    className={`block text-center mt-4 ${
                      formule.recommandee ? "btn-primary" : "btn-secondary"
                    }`}
                  >
                    {formule.prixMensuel === null ? "Commencer" : "Choisir"}
                  </Link>

                  <ul className="mt-5 space-y-2 text-sm">
                    {formule.arguments.map((argument) => (
                      <li key={argument} className="flex gap-2 text-ink/70">
                        <Coche />
                        <span>{argument}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>

          <p className="mt-8 text-center text-sm text-ink/50 max-w-2xl mx-auto">
            Tous les prix sont hors taxes. Les clients professionnels de l&apos;Union européenne
            disposant d&apos;un numéro de TVA intracommunautaire relèvent de l&apos;autoliquidation.
            Résiliation en ligne à tout moment, sans justification.
          </p>
        </section>

        {/* ---------------------------------------------------------------
            Ce que l'outil ne fait pas. Le dire vaut mieux que de le
            laisser découvrir : un client qui s'abonne sur un malentendu
            résilie, et raconte pourquoi.
        --------------------------------------------------------------- */}
        <section className="border-t border-rule/10 bg-surface">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 py-14">
            <h2 className="font-display text-2xl font-semibold">Ce que Cadran ne fait pas</h2>
            <div className="mt-5 grid sm:grid-cols-3 gap-5 text-sm text-ink/60">
              <p>
                <strong className="text-ink/80 block mb-1">Ce n&apos;est pas un logiciel de comptabilité.</strong>
                Cadran lit vos écritures, il ne les produit pas. Votre expert-comptable garde sa place.
              </p>
              <p>
                <strong className="text-ink/80 block mb-1">Les seuils ne sont pas sectoriels.</strong>
                Ils sont communs à tous les métiers pour l&apos;instant. Une marge de 58 % ne se juge
                pas pareil en industrie et en logiciel : nous y travaillons.
              </p>
              <p>
                <strong className="text-ink/80 block mb-1">La projection n&apos;est pas une prévision.</strong>
                Elle part du rythme de la dernière période, sans modéliser les délais
                d&apos;encaissement ni la TVA. C&apos;est un point de départ à ajuster.
              </p>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 sm:px-6 py-16 sm:py-20 text-center">
          <h2 className="font-display text-3xl font-semibold text-balance">
            Un fichier, et vous saurez
          </h2>
          <p className="mt-3 text-ink/60 max-w-xl mx-auto">
            Votre logiciel comptable exporte déjà le FEC. Quatorze jours suffisent pour voir ce
            qu&apos;il contient.
          </p>
          <Link to="/register" className="btn-primary text-base px-6 py-3 inline-block mt-7">
            Commencer l&apos;essai gratuit
          </Link>
        </section>
      </main>

      <footer className="border-t border-rule/10">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 py-10 flex flex-wrap items-start justify-between gap-6">
          <div>
            <Marque />
            <p className="text-xs text-ink/45 mt-2 max-w-xs">
              Plateforme de pilotage et de conseil financier pour l&apos;entreprise.
            </p>
          </div>
          <div className="flex flex-col gap-2 text-sm">
            <Link to="/login" className="text-ink/60 hover:text-ink transition">
              Se connecter
            </Link>
            <a href="#tarifs" className="text-ink/60 hover:text-ink transition">
              Tarifs
            </a>
          </div>
          <div className="w-44">
            <BasculeTheme />
          </div>
        </div>
      </footer>
    </div>
  );
}
