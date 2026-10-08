import { PageLegale, Section } from "../components/PageLegale";
import { EDITEUR, mention } from "../lib/editeur";
import { FORMULES, REMISE_ANNUELLE, prixAnnualise } from "../lib/formules";

/**
 * Conditions générales de vente.
 *
 * Deux partis pris.
 *
 * Les tarifs sont lus depuis lib/formules.ts, la même source que la page
 * d'accueil. Un prix contractuel qui diverge du prix affiché est un litige
 * qu'on perd ; recopier les montants ici serait exactement le moyen de le
 * créer.
 *
 * Les droits du consommateur et ceux du professionnel sont séparés
 * explicitement. Cadran s'adresse aux deux, et la plupart des protections du
 * code de la consommation ne valent que pour le premier : les mélanger
 * produit un texte soit faux, soit inutilement contraignant.
 */
export function CGV() {
  return (
    <PageLegale
      titre="Conditions générales de vente"
      chapeau="Le contrat qui vous lie à Cadran : ce que nous fournissons, à quel prix, et comment partir."
      sommaire={[
        "Objet et acceptation",
        "Le service",
        "Compte et accès",
        "Essai gratuit",
        "Formules et tarifs",
        "Facturation et paiement",
        "Durée et reconduction",
        "Résiliation",
        "Droit de rétractation du consommateur",
        "Disponibilité et maintenance",
        "Responsabilité",
        "Vos données",
        "Évolution des conditions",
        "Droit applicable et litiges",
      ]}
    >
      <Section numero={1} titre="Objet et acceptation">
        <p>
          Les présentes conditions régissent la fourniture du service Cadran par{" "}
          {mention(EDITEUR.denomination)} (« l&apos;éditeur ») à toute personne qui y souscrit («
          le client »). Elles sont acceptées à la création du compte et prévalent sur tout autre
          document.
        </p>
        <p className="text-sm text-ink-3">
          Certaines stipulations ne s&apos;appliquent qu&apos;au client{" "}
          <strong>consommateur</strong> — personne physique agissant à des fins étrangères à son
          activité professionnelle. Elles sont signalées comme telles. Les autres valent pour
          tous.
        </p>
      </Section>

      <Section numero={2} titre="Le service">
        <p>
          Cadran importe les fichiers des écritures comptables du client, en tire des indicateurs
          financiers — soldes intermédiaires de gestion, capacité d&apos;autofinancement, flux de
          trésorerie, balance âgée, scores de fragilité, seuil de rentabilité — et en propose une
          lecture ainsi qu&apos;un plan d&apos;action.
        </p>
        <div className="card border-warning/40 bg-warning-soft">
          <p className="font-medium text-sm">Ce que le service n&apos;est pas</p>
          <p className="text-sm text-ink-2 mt-1">
            Cadran n&apos;est ni un logiciel de comptabilité, ni un outil de déclaration fiscale,
            ni un conseil juridique, fiscal ou en investissement. Les analyses sont des
            indicateurs destinés à éclairer les décisions du client, qui les prend sous sa seule
            responsabilité. Elles ne remplacent ni un expert-comptable, ni un commissaire aux
            comptes.
          </p>
        </div>
      </Section>

      <Section numero={3} titre="Compte et accès">
        <p>
          Le client fournit des informations exactes et maintient la confidentialité de ses
          identifiants. Toute action effectuée depuis son compte est réputée accomplie par lui. Il
          informe sans délai l&apos;éditeur de tout usage non autorisé dont il aurait
          connaissance.
        </p>
        <p>
          Le nombre d&apos;utilisateurs et d&apos;entités suivies dépend de la formule souscrite.
          Le dépassement de ces limites est bloqué par le service.
        </p>
      </Section>

      <Section numero={4} titre="Essai gratuit">
        <p>
          L&apos;essai dure quatorze jours et ne requiert aucun moyen de paiement.{" "}
          <strong>Il ne se transforme pas en abonnement payant à son terme</strong> : au terme des
          quatorze jours, l&apos;accès est suspendu jusqu&apos;à souscription expresse. Les
          données importées restent conservées trois mois.
        </p>
      </Section>

      <Section numero={5} titre="Formules et tarifs">
        <p>
          Les prix sont exprimés en euros et <strong>hors taxes</strong>. La taxe sur la valeur
          ajoutée applicable est ajoutée lors de la facturation, selon la réglementation en
          vigueur et le statut du client.
        </p>
        <div className="overflow-x-auto mt-3">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-rule/20 text-left">
                <th className="py-2 pr-4 font-medium">Formule</th>
                <th className="py-2 pr-4 font-medium tabular-nums">Mensuel</th>
                <th className="py-2 font-medium tabular-nums">Annuel (par mois)</th>
              </tr>
            </thead>
            <tbody className="text-ink-2">
              {FORMULES.map((formule) => (
                <tr key={formule.id} className="border-b border-rule/10">
                  <td className="py-2 pr-4">{formule.label}</td>
                  <td className="py-2 pr-4 tabular-nums">
                    {formule.prixMensuel === null ? "Gratuit" : `${formule.prixMensuel} € HT`}
                  </td>
                  <td className="py-2 tabular-nums">
                    {formule.prixMensuel === null
                      ? "—"
                      : `${prixAnnualise(formule.prixMensuel)} € HT`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-sm text-ink-3 mt-2">
          L&apos;engagement annuel ouvre droit à une remise de {Math.round(REMISE_ANNUELLE * 100)} %
          et se règle en une fois à la souscription.
        </p>
        <p>
          Tout changement tarifaire est notifié au client au moins trente jours avant son entrée
          en vigueur et ne s&apos;applique qu&apos;à compter de la période suivante. Le client qui
          le refuse peut résilier sans frais avant cette date.
        </p>
      </Section>

      <Section numero={6} titre="Facturation et paiement">
        <p>
          L&apos;abonnement est payable d&apos;avance, par carte bancaire, par l&apos;intermédiaire
          d&apos;un prestataire de paiement agréé. L&apos;éditeur ne conserve aucune coordonnée
          bancaire. Une facture est émise à chaque échéance et reste accessible depuis le compte.
        </p>
        <p>
          En cas de défaut de paiement, plusieurs tentatives de prélèvement sont effectuées et le
          client en est averti. <strong>L&apos;accès est maintenu pendant cette période</strong> :
          il n&apos;est suspendu qu&apos;au terme des relances, et les données restent conservées
          conformément à la politique de confidentialité.
        </p>
        <p className="text-sm text-ink-3">
          Entre professionnels, tout retard de paiement entraîne de plein droit des pénalités au
          taux d&apos;intérêt légal majoré, ainsi que l&apos;indemnité forfaitaire pour frais de
          recouvrement de 40 € prévue par le code de commerce.
        </p>
      </Section>

      <Section numero={7} titre="Durée et reconduction">
        <p>
          L&apos;abonnement est conclu pour la durée choisie — mensuelle ou annuelle — et se
          reconduit tacitement pour une durée identique, sauf résiliation.
        </p>
        <p className="text-sm text-ink-3">
          <strong>Client consommateur :</strong> conformément au code de la consommation,
          l&apos;éditeur informe le client de la possibilité de ne pas reconduire le contrat, par
          écrit, au plus tôt trois mois et au plus tard un mois avant le terme de la période de
          reconduction. À défaut, le client peut résilier à tout moment et sans frais à compter de
          la date de reconduction.
        </p>
      </Section>

      <Section numero={8} titre="Résiliation">
        <div className="card">
          <p className="font-medium text-sm">Résilier en ligne, en trois clics</p>
          <p className="text-sm text-ink-2 mt-1">
            La résiliation s&apos;effectue depuis votre espace, rubrique{" "}
            <strong>Abonnement</strong>, par le bouton <strong>« Résilier mon abonnement »</strong>.
            Aucune lettre, aucun appel, aucune justification ne sont exigés. La fonctionnalité est
            accessible en permanence, conformément à l&apos;article L. 215-1-1 du code de la
            consommation.
          </p>
        </div>
        <p>
          La résiliation prend effet au terme de la période en cours ; le service reste accessible
          jusque-là. Les sommes déjà versées au titre de la période entamée ne sont pas
          remboursées, sauf exercice du droit de rétractation.
        </p>
        <p>
          L&apos;éditeur peut suspendre ou résilier le compte en cas de manquement grave — usage
          frauduleux, atteinte à la sécurité du service, défaut de paiement persistant — après
          mise en demeure restée sans effet pendant quinze jours, sauf urgence.
        </p>
      </Section>

      <Section numero={9} titre="Droit de rétractation du consommateur">
        <p className="text-sm text-ink-3">Cet article ne concerne que le client consommateur.</p>
        <p>
          Le client consommateur dispose d&apos;un délai de <strong>quatorze jours</strong> à
          compter de la souscription pour se rétracter, sans avoir à se justifier ni à supporter
          de pénalité.
        </p>
        <p>
          Le service étant fourni immédiatement, le client est invité, lors de la souscription, à
          demander expressément que son exécution commence avant la fin de ce délai et à
          reconnaître qu&apos;il perdra alors son droit de rétractation une fois le service
          pleinement exécuté. S&apos;il se rétracte en cours d&apos;exécution, il règle le montant
          correspondant à ce qui a été fourni jusqu&apos;à sa décision.
        </p>
        <p>
          La rétractation s&apos;exerce par toute déclaration dénuée d&apos;ambiguïté adressée à{" "}
          <a href={`mailto:${EDITEUR.courriel}`} className="text-primary hover:underline">
            {EDITEUR.courriel}
          </a>
          . Le remboursement intervient dans les quatorze jours suivant la réception de la
          demande.
        </p>
      </Section>

      <Section numero={10} titre="Disponibilité et maintenance">
        <p>
          L&apos;éditeur met en œuvre les moyens raisonnables pour assurer l&apos;accessibilité du
          service, sans garantie de disponibilité ininterrompue. Les interventions de maintenance
          programmée sont annoncées à l&apos;avance et conduites, autant que possible, en dehors
          des heures ouvrées.
        </p>
        <p className="text-sm text-ink-3">
          Aucun engagement chiffré de niveau de service n&apos;est souscrit à ce jour. Un tel
          engagement, s&apos;il venait à être proposé, ferait l&apos;objet d&apos;un document
          distinct.
        </p>
      </Section>

      <Section numero={11} titre="Responsabilité">
        <p>
          L&apos;éditeur est tenu d&apos;une obligation de moyens. Il répond des dommages directs
          causés par un manquement qui lui est imputable, dans la limite des sommes versées par le
          client au cours des douze mois précédant le fait générateur.
        </p>
        <p>
          <strong>
            Les décisions prises au vu des analyses relèvent du seul client.
          </strong>{" "}
          L&apos;éditeur ne répond ni de l&apos;exactitude des données importées, dont le client a
          la maîtrise, ni des conséquences d&apos;une décision de gestion.
        </p>
        <p className="text-sm text-ink-3">
          Ces limitations ne s&apos;appliquent ni en cas de faute lourde ou dolosive, ni en cas de
          dommage corporel, ni lorsque la loi les écarte — notamment à l&apos;égard du
          consommateur, dont les droits légaux demeurent entiers.
        </p>
      </Section>

      <Section numero={12} titre="Vos données">
        <p>
          Les données importées restent la propriété du client. L&apos;éditeur n&apos;acquiert
          aucun droit d&apos;exploitation sur elles et ne les utilise ni à des fins commerciales,
          ni pour entraîner un quelconque modèle.
        </p>
        <p>
          Le client peut exporter ses données à tout moment depuis son espace. Les modalités de
          traitement figurent dans la{" "}
          <a href="/confidentialite" className="text-primary hover:underline">
            politique de confidentialité
          </a>
          , et le contrat de sous-traitance prévu à l&apos;article 28 du RGPD y est annexé.
        </p>
      </Section>

      <Section numero={13} titre="Évolution des conditions">
        <p>
          Les présentes conditions peuvent être modifiées. Toute modification substantielle est
          notifiée au moins trente jours avant son entrée en vigueur. Le client qui la refuse peut
          résilier sans frais avant cette date ; à défaut, la poursuite de l&apos;utilisation vaut
          acceptation.
        </p>
      </Section>

      <Section numero={14} titre="Droit applicable et litiges">
        <p>
          Les présentes conditions sont régies par le droit français. Toute réclamation doit
          d&apos;abord être adressée à{" "}
          <a href={`mailto:${EDITEUR.courriel}`} className="text-primary hover:underline">
            {EDITEUR.courriel}
          </a>
          , l&apos;éditeur s&apos;engageant à y répondre sous quinze jours.
        </p>
        <p className="text-sm text-ink-3">
          <strong>Client consommateur :</strong> à défaut de résolution amiable, le client peut
          recourir gratuitement à un médiateur de la consommation —{" "}
          {mention(null)} — ou à la plateforme européenne de règlement en ligne des litiges. Les
          tribunaux compétents sont ceux désignés par le code de procédure civile.
        </p>
        <p className="text-sm text-ink-3">
          <strong>Client professionnel :</strong> à défaut de résolution amiable, compétence
          exclusive est attribuée aux tribunaux du ressort du siège de l&apos;éditeur.
        </p>
      </Section>
    </PageLegale>
  );
}
