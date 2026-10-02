import { PageLegale, Section } from "../components/PageLegale";
import { EDITEUR, HEBERGEURS, mention } from "../lib/editeur";

/**
 * Mentions légales — article 6 III de la LCEN.
 *
 * Leur absence sur un site professionnel est pénalement sanctionnée. Les
 * valeurs viennent toutes de lib/editeur.ts ; celles qui manquent
 * s'affichent comme manquantes plutôt que d'être inventées.
 */
export function MentionsLegales() {
  return (
    <PageLegale
      titre="Mentions légales"
      chapeau="Qui édite ce site, qui l'héberge, et comment nous joindre."
      sommaire={[
        "Éditeur du site",
        "Directeur de la publication",
        "Hébergement",
        "Propriété intellectuelle",
        "Données personnelles",
        "Signaler un contenu",
      ]}
    >
      <Section numero={1} titre="Éditeur du site">
        <dl className="grid grid-cols-1 sm:grid-cols-[13rem_1fr] gap-x-6 gap-y-2">
          {[
            ["Dénomination sociale", mention(EDITEUR.denomination)],
            ["Forme juridique", mention(EDITEUR.formeJuridique)],
            [
              "Capital social",
              EDITEUR.capitalSocial === null ? mention(null) : `${EDITEUR.capitalSocial} €`,
            ],
            ["Siège social", mention(EDITEUR.siege)],
            ["Numéro SIREN", mention(EDITEUR.siren)],
            [
              "Immatriculation",
              EDITEUR.siren === null
                ? mention(null)
                : `RCS de ${mention(EDITEUR.villeRcs)} sous le numéro ${EDITEUR.siren}`,
            ],
            ["TVA intracommunautaire", mention(EDITEUR.tvaIntracommunautaire)],
            ["Adresse électronique", EDITEUR.courriel],
            ["Téléphone", mention(EDITEUR.telephone)],
          ].map(([cle, valeur]) => (
            <div key={cle} className="contents">
              <dt className="text-ink/50 text-sm">{cle}</dt>
              <dd className="text-ink mb-1 sm:mb-0">{valeur}</dd>
            </div>
          ))}
        </dl>
      </Section>

      <Section numero={2} titre="Directeur de la publication">
        <p>
          Le directeur de la publication est {mention(EDITEUR.directeurPublication)}, en qualité de
          représentant légal de la société éditrice.
        </p>
      </Section>

      <Section numero={3} titre="Hébergement">
        <p>
          Le site et le service sont hébergés par les prestataires suivants. Ils interviennent
          également comme sous-traitants au sens du règlement général sur la protection des
          données ; le détail de leur rôle figure dans la{" "}
          <a href="/confidentialite" className="text-primary hover:underline">
            politique de confidentialité
          </a>
          .
        </p>
        <ul className="space-y-3 mt-2">
          {HEBERGEURS.map((h) => (
            <li key={h.nom} className="card">
              <p className="label">{h.role}</p>
              <p className="font-medium mt-1">{h.nom}</p>
              <p className="text-sm text-ink/60">{h.adresse}</p>
              <p className="text-sm text-ink/60">{h.pays}</p>
            </li>
          ))}
        </ul>
      </Section>

      <Section numero={4} titre="Propriété intellectuelle">
        <p>
          L&apos;ensemble des éléments composant ce site — structure, textes, interface, marques
          et logiciel — est protégé par le droit de la propriété intellectuelle et demeure la
          propriété de l&apos;éditeur. Toute reproduction ou représentation, totale ou partielle,
          sans autorisation écrite préalable, est interdite.
        </p>
        <p>
          Les données comptables que vous importez vous appartiennent et restent les vôtres.
          L&apos;éditeur n&apos;acquiert sur elles aucun droit autre que celui, strictement
          nécessaire, de les traiter pour vous fournir le service.
        </p>
      </Section>

      <Section numero={5} titre="Données personnelles">
        <p>
          Le traitement des données personnelles, les finalités poursuivies, les durées de
          conservation, les sous-traitants et l&apos;exercice de vos droits sont décrits dans la{" "}
          <a href="/confidentialite" className="text-primary hover:underline">
            politique de confidentialité
          </a>
          , qui fait partie intégrante des présentes mentions.
        </p>
      </Section>

      <Section numero={6} titre="Signaler un contenu">
        <p>
          Tout signalement relatif au site peut être adressé à{" "}
          <a href={`mailto:${EDITEUR.courriel}`} className="text-primary hover:underline">
            {EDITEUR.courriel}
          </a>
          . Nous accusons réception de chaque signalement et y répondons dans un délai
          raisonnable.
        </p>
      </Section>
    </PageLegale>
  );
}
