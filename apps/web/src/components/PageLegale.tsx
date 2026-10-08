import type { ReactNode } from "react";
import { Link } from "react-router";
import { BasculeTheme } from "./BasculeTheme";
import { DERNIERE_MISE_A_JOUR, champsManquants, identiteComplete } from "../lib/editeur";

/**
 * Cadre commun aux trois pages légales.
 *
 * Elles se lisent, elles ne se parcourent pas : colonne étroite, titres
 * numérotés pour qu'on puisse se référer à un article, et une table des
 * matières parce qu'on arrive souvent sur ces pages en cherchant un point
 * précis (« comment je résilie »).
 */

export function Section({ numero, titre, children }: { numero: number; titre: string; children: ReactNode }) {
  const ancre = `article-${numero}`;
  return (
    <section id={ancre} className="scroll-mt-24">
      <h2 className="font-display text-xl font-semibold mt-10 mb-3">
        <span className="text-ink-3 font-mono text-base mr-2">{numero}.</span>
        {titre}
      </h2>
      <div className="space-y-3 text-[15px] leading-relaxed text-ink-2">{children}</div>
    </section>
  );
}

export function Definition({ terme, children }: { terme: string; children: ReactNode }) {
  return (
    <p>
      <span className="font-medium text-ink">{terme}</span> — {children}
    </p>
  );
}

export function PageLegale({
  titre,
  chapeau,
  sommaire,
  children,
}: {
  titre: string;
  chapeau: string;
  sommaire: string[];
  children: ReactNode;
}) {
  const incomplete = !identiteComplete();

  return (
    <div className="min-h-screen bg-paper">
      <header className="border-b border-rule/10 sticky top-0 bg-paper/90 backdrop-blur z-10">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 py-4 flex items-center justify-between gap-4">
          <Link to="/" className="flex items-center gap-2">
            <span
              className="w-6 h-6 rounded-full flex-none"
              style={{
                background:
                  "conic-gradient(from -90deg, rgb(var(--accent)) 0 25%, rgb(var(--surface-2)) 25% 100%)",
              }}
            />
            <span className="font-display font-semibold text-lg">Cadran</span>
          </Link>
          <Link to="/" className="text-sm text-ink-3 hover:text-ink transition">
            Retour au site
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 sm:px-6 py-10 sm:py-14">
        <h1 className="font-display text-3xl sm:text-4xl font-semibold text-balance">{titre}</h1>
        <p className="mt-3 text-ink-3">{chapeau}</p>
        <p className="mt-2 text-xs text-ink-3">
          Dernière mise à jour : {DERNIERE_MISE_A_JOUR}
        </p>

        {/*
         * L'avertissement n'est pas décoratif : tant que la société n'est pas
         * immatriculée, ces pages ne peuvent pas être complètes, et un
         * visiteur a le droit de le savoir plutôt que de lire des mentions
         * trouées sans explication.
         */}
        {incomplete && (
          <div className="mt-6 card border-warning/40 bg-warning-soft">
            <p className="text-sm font-medium text-ink">Document en cours de constitution</p>
            <p className="text-sm text-ink-2 mt-1">
              La société éditrice n&apos;est pas encore immatriculée. Les mentions suivantes
              restent à compléter : {champsManquants().join(", ")}. Le service n&apos;est pas
              commercialisé en l&apos;état.
            </p>
          </div>
        )}

        {sommaire.length > 0 && (
          <nav aria-label="Sommaire" className="mt-8 card">
            <p className="label mb-2">Sommaire</p>
            <ol className="space-y-1 text-sm">
              {sommaire.map((entree, index) => (
                <li key={entree}>
                  <a
                    href={`#article-${index + 1}`}
                    className="text-ink-2 hover:text-primary transition"
                  >
                    <span className="font-mono text-ink-3 mr-2">{index + 1}.</span>
                    {entree}
                  </a>
                </li>
              ))}
            </ol>
          </nav>
        )}

        <div className="mt-2">{children}</div>
      </main>

      <footer className="border-t border-rule/10">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 py-8 flex flex-wrap gap-6 justify-between items-start text-sm">
          <nav className="flex flex-col gap-2">
            <Link to="/mentions-legales" className="text-ink-3 hover:text-ink transition">
              Mentions légales
            </Link>
            <Link to="/confidentialite" className="text-ink-3 hover:text-ink transition">
              Politique de confidentialité
            </Link>
            <Link to="/cgv" className="text-ink-3 hover:text-ink transition">
              Conditions générales de vente
            </Link>
          </nav>
          <div className="w-fit">
            <BasculeTheme />
          </div>
        </div>
      </footer>
    </div>
  );
}
