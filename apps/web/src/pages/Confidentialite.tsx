import { PageLegale, Section } from "../components/PageLegale";
import { EDITEUR, HEBERGEURS, mention } from "../lib/editeur";

/**
 * Politique de confidentialité — articles 13 et 14 du RGPD.
 *
 * Écrite d'après ce que le logiciel fait réellement (le schéma Prisma), et
 * non d'après un modèle générique : une politique qui décrit un traitement
 * différent de celui qui a lieu n'est pas une politique, c'est une
 * déclaration inexacte.
 *
 * Le point structurant est la distinction des deux rôles. Pour le compte de
 * l'utilisateur, Cadran est responsable de traitement. Pour les écritures
 * comptables importées — qui nomment les clients et fournisseurs de
 * l'entreprise, parfois des personnes physiques — Cadran n'est que
 * sous-traitant : c'est l'entreprise cliente qui décide, et elle en répond.
 */
export function Confidentialite() {
  return (
    <PageLegale
      titre="Politique de confidentialité"
      chapeau="Quelles données nous traitons, pourquoi, combien de temps, et ce que vous pouvez exiger."
      sommaire={[
        "Deux rôles distincts",
        "Données que nous traitons",
        "Finalités et bases légales",
        "Durées de conservation",
        "Destinataires et sous-traitants",
        "Transferts hors de l'Union européenne",
        "Sécurité",
        "Vos droits",
        "Témoins de connexion",
        "Modifications",
      ]}
    >
      <Section numero={1} titre="Deux rôles distincts">
        <p>
          Cette distinction commande tout le reste, et elle n&apos;est pas une subtilité
          juridique : elle détermine qui décide quoi de vos données.
        </p>
        <div className="card">
          <p className="label">Responsable de traitement</p>
          <p className="text-sm mt-1">
            Pour les données de votre <strong>compte</strong> — votre nom, votre adresse
            électronique, votre organisation, votre abonnement — c&apos;est nous qui décidons des
            finalités et des moyens. Nous en répondons directement devant vous.
          </p>
        </div>
        <div className="card">
          <p className="label">Sous-traitant</p>
          <p className="text-sm mt-1">
            Pour les <strong>écritures comptables</strong> que vous importez, c&apos;est vous qui
            décidez. Un fichier des écritures comptables nomme vos clients et vos fournisseurs ;
            lorsque ce sont des personnes physiques — un entrepreneur individuel, un particulier —
            ce sont des données personnelles dont <strong>vous</strong> êtes responsable. Nous ne
            les traitons que sur votre instruction, pour vous rendre le service, et jamais pour
            notre compte.
          </p>
        </div>
        <p className="text-sm text-ink-3">
          Un contrat de sous-traitance au sens de l&apos;article 28 du RGPD est conclu avec chaque
          client professionnel. Il est annexé aux conditions générales.
        </p>
      </Section>

      <Section numero={2} titre="Données que nous traitons">
        <p className="font-medium text-ink">Compte et organisation</p>
        <p>
          Nom, adresse électronique, rôle au sein de l&apos;organisation, nom de
          l&apos;organisation, empreinte du mot de passe (jamais le mot de passe lui-même, qui
          n&apos;est ni stocké ni récupérable), date de création.
        </p>

        <p className="font-medium text-ink mt-4">Données d&apos;entreprise</p>
        <p>
          Dénomination des entités suivies, code d&apos;activité, devise, et les agrégats
          financiers calculés à partir de vos imports.
        </p>

        <p className="font-medium text-ink mt-4">Écritures comptables</p>
        <p>
          Le contenu des fichiers que vous importez : journal, date, numéro de pièce, compte
          général et compte auxiliaire, libellé, débit, crédit, lettrage.{" "}
          <strong>
            Le libellé du compte auxiliaire désigne un client ou un fournisseur et peut donc
            identifier une personne physique.
          </strong>
        </p>

        <p className="font-medium text-ink mt-4">Journal d&apos;activité</p>
        <p>
          Pour chaque action modifiant les données : son auteur, sa date et sa nature. Ce journal
          est immuable — il ne peut être ni modifié ni effacé — car sa raison d&apos;être est de
          pouvoir établir après coup ce qui s&apos;est passé.
        </p>

        <p className="font-medium text-ink mt-4">Abonnement</p>
        <p>
          Formule souscrite, statut, identifiants techniques de facturation. Nous ne recevons ni
          ne conservons aucune donnée de carte bancaire : les paiements sont traités par notre
          prestataire, chez qui les coordonnées bancaires restent.
        </p>
      </Section>

      <Section numero={3} titre="Finalités et bases légales">
        <ul className="space-y-2">
          <li>
            <strong>Fourniture du service</strong> (import, calculs, diagnostic, rapports) —
            exécution du contrat.
          </li>
          <li>
            <strong>Gestion du compte et authentification</strong> — exécution du contrat.
          </li>
          <li>
            <strong>Facturation et recouvrement</strong> — exécution du contrat et obligation
            légale comptable.
          </li>
          <li>
            <strong>Sécurité du service</strong> (limitation du nombre de tentatives de connexion,
            journal d&apos;activité) — intérêt légitime à protéger les données de nos clients.
          </li>
          <li>
            <strong>Courriels liés au compte</strong> (réinitialisation de mot de passe, alertes
            que vous avez configurées) — exécution du contrat.
          </li>
        </ul>
        <p className="text-sm text-ink-3 mt-3">
          Nous ne pratiquons ni prospection commerciale par voie électronique sans votre accord,
          ni profilage, ni décision automatisée produisant des effets juridiques à votre égard.
          Les analyses produites par le service sont des indicateurs destinés à éclairer vos
          décisions, qui restent les vôtres.
        </p>
      </Section>

      <Section numero={4} titre="Durées de conservation">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-rule/20 text-left">
                <th className="py-2 pr-4 font-medium">Donnée</th>
                <th className="py-2 font-medium">Durée</th>
              </tr>
            </thead>
            <tbody className="text-ink-2">
              {[
                ["Compte et organisation", "Durée du contrat, puis 3 mois"],
                ["Écritures comptables importées", "Durée du contrat, puis 3 mois"],
                ["Journal d'activité", "5 ans — il sert de preuve"],
                ["Jeton de réinitialisation", "1 heure, et un seul usage"],
                ["Pièces de facturation", "10 ans — obligation comptable"],
              ].map(([donnee, duree]) => (
                <tr key={donnee} className="border-b border-rule/10">
                  <td className="py-2 pr-4">{donnee}</td>
                  <td className="py-2">{duree}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p>
          Le délai de trois mois après la fin du contrat existe pour vous permettre de revenir ou
          de récupérer vos données. Passé ce délai, elles sont supprimées. Vous pouvez demander
          leur suppression immédiate à tout moment.
        </p>
      </Section>

      <Section numero={5} titre="Destinataires et sous-traitants">
        <p>
          Vos données ne sont ni vendues, ni louées, ni communiquées à des tiers à des fins
          commerciales. Elles ne sont accessibles qu&apos;aux personnes de votre organisation que
          vous y avez autorisées, et aux prestataires strictement nécessaires au fonctionnement du
          service :
        </p>
        <ul className="space-y-3 mt-2">
          {HEBERGEURS.map((h) => (
            <li key={h.nom} className="card">
              <p className="font-medium">{h.nom}</p>
              <p className="text-sm text-ink-3">
                {h.role} — {h.pays}
              </p>
            </li>
          ))}
        </ul>
        <div className="card border-rule/30 mt-4">
          <p className="font-medium text-sm">Le conseiller, quand il est activé</p>
          <p className="text-sm text-ink-2 mt-1">
            Lorsque vous posez une question au conseiller, votre question et les résultats des
            calculs nécessaires pour y répondre — qui peuvent comporter des noms de clients ou de
            fournisseurs — sont transmis au modèle d&apos;analyse de langage, selon la configuration
            du service : soit par <strong>OpenRouter, Inc.</strong>, qui achemine la requête vers un
            hébergeur du modèle (par exemple Amazon Web Services ou Google Cloud pour les modèles
            Claude), soit directement à <strong>Anthropic PBC</strong>. L&apos;écran du conseiller
            indique le modèle et le prestataire utilisés.
          </p>
          <ul className="list-disc pl-5 space-y-1 text-sm text-ink-2 mt-2">
            <li>
              Rien n&apos;est transmis tant que vous ne posez pas de question : aucune analyse
              automatique n&apos;est envoyée en arrière-plan.
            </li>
            <li>
              Vos données ne servent pas à entraîner de modèle et ne sont pas conservées par
              l&apos;hébergeur. Par OpenRouter, chaque requête l&apos;exige (« zéro conservation »,
              « aucune collecte ») et n&apos;est acheminée que vers un hébergeur qui s&apos;y engage ;
              à défaut, elle n&apos;est pas envoyée. En direct, c&apos;est une obligation
              contractuelle d&apos;Anthropic.
            </li>
            <li>
              Nous ne conservons ni vos questions ni les réponses : seul un compteur mensuel,
              destiné au suivi de votre formule, est enregistré.
            </li>
            <li>
              Les traitements ont lieu aux États-Unis, encadrés par les clauses contractuelles
              types de la Commission européenne.
            </li>
          </ul>
        </div>

        <p className="text-sm text-ink-3 mt-3">
          Cette liste est tenue à jour. Tout nouveau sous-traitant y est ajouté avant sa mise en
          service, et les clients professionnels en sont informés conformément au contrat de
          sous-traitance.
        </p>
      </Section>

      <Section numero={6} titre="Transferts hors de l'Union européenne">
        <p>
          Nos hébergeurs sont des sociétés de droit américain. Les serveurs qui exécutent
          l&apos;application et stockent la base de données sont situés aux Pays-Bas, donc dans
          l&apos;Union européenne ; une intervention d&apos;administration depuis les États-Unis
          reste toutefois possible et constitue un transfert.
        </p>
        <p>
          Ces transferts sont encadrés par les clauses contractuelles types de la Commission
          européenne et, le cas échéant, par la certification des prestataires au cadre de
          protection des données UE–États-Unis.
        </p>
      </Section>

      <Section numero={7} titre="Sécurité">
        <p>Les mesures en place, concrètement :</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>Chiffrement de toutes les communications (HTTPS).</li>
          <li>
            Mots de passe stockés sous forme d&apos;empreinte bcrypt, jamais en clair : nous ne
            pouvons pas les lire, et nous ne pouvons donc pas vous les redonner.
          </li>
          <li>
            Session portée par un témoin de connexion inaccessible au JavaScript de la page, avec
            une protection contre la falsification de requête inter-sites.
          </li>
          <li>Cloisonnement strict des données par organisation.</li>
          <li>Limitation du nombre de tentatives de connexion.</li>
          <li>Journal d&apos;activité immuable.</li>
        </ul>
        <p>
          En cas de violation de données susceptible d&apos;engendrer un risque pour vos droits,
          nous en informons la CNIL dans les 72 heures et vous en informons sans délai
          lorsque le risque est élevé.
        </p>
      </Section>

      <Section numero={8} titre="Vos droits">
        <p>
          Vous disposez des droits d&apos;accès, de rectification, d&apos;effacement, de
          limitation, d&apos;opposition, et de portabilité de vos données. Pour les données dont
          nous ne sommes que sous-traitants — vos écritures comptables — adressez votre demande à
          l&apos;entreprise cliente, qui en est responsable ; nous l&apos;assistons pour y
          répondre.
        </p>
        <p>
          Écrivez à{" "}
          <a href={`mailto:${EDITEUR.courriel}`} className="text-primary hover:underline">
            {EDITEUR.courriel}
          </a>
          . Nous répondons dans un délai d&apos;un mois, prolongeable de deux mois si la demande
          est complexe, auquel cas nous vous en informons.
        </p>
        <p>
          Si notre réponse ne vous satisfait pas, vous pouvez introduire une réclamation auprès de
          la Commission nationale de l&apos;informatique et des libertés —{" "}
          <a
            href="https://www.cnil.fr/fr/plaintes"
            className="text-primary hover:underline"
            target="_blank"
            rel="noreferrer"
          >
            cnil.fr
          </a>{" "}
          — 3 place de Fontenoy, TSA 80715, 75334 Paris Cedex 07.
        </p>
      </Section>

      <Section numero={9} titre="Témoins de connexion">
        <p>
          Nous n&apos;utilisons <strong>aucun</strong> témoin publicitaire ni de mesure
          d&apos;audience. Aucun bandeau de consentement ne vous est donc demandé, et ce
          n&apos;est pas un oubli : la réglementation en dispense les témoins strictement
          nécessaires au service que vous avez demandé.
        </p>
        <p>Les seuls déposés sont :</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>
            <span className="font-mono text-sm">cadran_session</span> — vous maintient connecté.
            Expire après 7 jours.
          </li>
          <li>
            <span className="font-mono text-sm">cadran_csrf</span> — empêche un site tiers
            d&apos;agir en votre nom. Même durée.
          </li>
        </ul>
        <p>
          Votre choix de thème est conservé dans le stockage local de votre navigateur et ne nous
          est jamais transmis.
        </p>
      </Section>

      <Section numero={10} titre="Modifications">
        <p>
          Toute modification substantielle de la présente politique vous est notifiée par courriel
          au moins trente jours avant son entrée en vigueur. La date de dernière mise à jour
          figure en tête de page. L&apos;éditeur est {mention(EDITEUR.denomination)}.
        </p>
      </Section>
    </PageLegale>
  );
}
