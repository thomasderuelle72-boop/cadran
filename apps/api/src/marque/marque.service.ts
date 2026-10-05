import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { BillingService } from "../billing/billing.service";
import { PLANS } from "../billing/plans";
import { MOTIFS, validerImage, type ImageValide } from "./image";

export type Emplacement = "logo" | "signature";

/**
 * Identité de marque d'une organisation, et son application aux documents.
 *
 * Deux décisions structurent ce service.
 *
 * **La marque est une fonctionnalité de formule.** La page de tarifs promet
 * « exports à votre marque » à partir de Cabinet ; le vérifier ici plutôt
 * qu'à l'écran évite qu'un appel direct à l'API contourne la promesse — et
 * qu'on vende deux fois la même chose.
 *
 * **Les images ne sont servies qu'à l'organisation qui les a déposées.**
 * L'état lu par l'écran de réglage ne porte que les dimensions et le format ;
 * les octets passent par une route distincte, dont l'adresse ne contient
 * aucun identifiant — c'est la session qui désigne l'organisation. Un
 * administrateur doit pouvoir vérifier quel logo part sur ses documents, et
 * un descriptif « PNG 96 × 32 » ne le lui dit pas.
 */

/** Une couleur d'accent est écrite dans un PDF : on n'y met que ce qu'on a
 *  validé. */
const HEXA = /^#[0-9a-fA-F]{6}$/;

export interface MarqueLisible {
  nomAffiche: string | null;
  mentionsPied: string | null;
  couleurAccent: string | null;
  signataireNom: string | null;
  signataireFonction: string | null;
  logo: { format: string; largeur: number; hauteur: number } | null;
  signature: { format: string; largeur: number; hauteur: number } | null;
  /** Faux quand la formule n'inclut pas la personnalisation. */
  autorisee: boolean;
}

@Injectable()
export class MarqueService {
  constructor(
    private prisma: PrismaService,
    private billing: BillingService
  ) {}

  async autorisee(organizationId: string): Promise<boolean> {
    const abonnement = await this.billing.pourOrganisation(organizationId);
    return PLANS[abonnement.plan].quotas.marqueDocuments;
  }

  private async exigerAutorisation(organizationId: string): Promise<void> {
    if (await this.autorisee(organizationId)) return;
    const abonnement = await this.billing.pourOrganisation(organizationId);
    throw new ForbiddenException(
      `La personnalisation des documents n'est pas incluse dans la formule ` +
        `« ${PLANS[abonnement.plan].label} ». Elle commence à la formule Cabinet.`
    );
  }

  /** Ce que l'écran de réglage affiche. Jamais les octets. */
  async lire(organizationId: string): Promise<MarqueLisible> {
    const marque = await this.prisma.marque.findUnique({
      where: { organizationId },
      select: {
        nomAffiche: true,
        mentionsPied: true,
        couleurAccent: true,
        signataireNom: true,
        signataireFonction: true,
        logoFormat: true,
        logoLargeur: true,
        logoHauteur: true,
        signatureFormat: true,
        signatureLargeur: true,
        signatureHauteur: true,
      },
    });

    const autorisee = await this.autorisee(organizationId);
    if (!marque) {
      return {
        nomAffiche: null,
        mentionsPied: null,
        couleurAccent: null,
        signataireNom: null,
        signataireFonction: null,
        logo: null,
        signature: null,
        autorisee,
      };
    }

    return {
      nomAffiche: marque.nomAffiche,
      mentionsPied: marque.mentionsPied,
      couleurAccent: marque.couleurAccent,
      signataireNom: marque.signataireNom,
      signataireFonction: marque.signataireFonction,
      logo:
        marque.logoFormat && marque.logoLargeur && marque.logoHauteur
          ? { format: marque.logoFormat, largeur: marque.logoLargeur, hauteur: marque.logoHauteur }
          : null,
      signature:
        marque.signatureFormat && marque.signatureLargeur && marque.signatureHauteur
          ? {
              format: marque.signatureFormat,
              largeur: marque.signatureLargeur,
              hauteur: marque.signatureHauteur,
            }
          : null,
      autorisee,
    };
  }

  /**
   * Les octets d'une image, pour l'aperçu de l'écran de réglage.
   *
   * Servis même quand la formule n'inclut plus la personnalisation : le
   * fichier appartient au cabinet, et le lui cacher ne protège rien. L'écran
   * dit par ailleurs qu'il ne sera pas appliqué.
   */
  async image(
    organizationId: string,
    emplacement: Emplacement
  ): Promise<{ octets: Buffer; format: string }> {
    const marque = await this.prisma.marque.findUnique({ where: { organizationId } });
    const octets = emplacement === "logo" ? marque?.logo : marque?.signature;
    const format = emplacement === "logo" ? marque?.logoFormat : marque?.signatureFormat;
    if (!octets || !format) throw new NotFoundException("Aucune image enregistrée.");
    return { octets: Buffer.from(octets), format };
  }

  /** Ce que le générateur de documents consomme : octets compris. */
  async pourDocument(organizationId: string) {
    if (!(await this.autorisee(organizationId))) return null;
    return this.prisma.marque.findUnique({ where: { organizationId } });
  }

  async enregistrer(
    organizationId: string,
    champs: {
      nomAffiche?: string | null;
      mentionsPied?: string | null;
      couleurAccent?: string | null;
      signataireNom?: string | null;
      signataireFonction?: string | null;
    }
  ): Promise<MarqueLisible> {
    await this.exigerAutorisation(organizationId);

    if (champs.couleurAccent && !HEXA.test(champs.couleurAccent)) {
      throw new BadRequestException(
        "La couleur doit être un code hexadécimal à six chiffres, par exemple #1F4F43."
      );
    }

    /* Les chaînes vides valent effacement : le formulaire renvoie un champ
     * vidé comme "", et le conserver tel quel imprimerait une ligne blanche
     * en tête de document. */
    const propre = Object.fromEntries(
      Object.entries(champs).map(([cle, valeur]) => [
        cle,
        typeof valeur === "string" && valeur.trim() === "" ? null : valeur,
      ])
    );

    await this.prisma.marque.upsert({
      where: { organizationId },
      create: { organizationId, ...propre },
      update: propre,
    });
    return this.lire(organizationId);
  }

  async televerser(
    organizationId: string,
    emplacement: Emplacement,
    octets: Buffer
  ): Promise<MarqueLisible> {
    await this.exigerAutorisation(organizationId);

    const verdict = validerImage(octets);
    if (!verdict.valide) throw new BadRequestException(MOTIFS[verdict.motif]);

    await this.prisma.marque.upsert({
      where: { organizationId },
      create: { organizationId, ...colonnes(emplacement, octets, verdict.image) },
      update: colonnes(emplacement, octets, verdict.image),
    });
    return this.lire(organizationId);
  }

  async retirer(organizationId: string, emplacement: Emplacement): Promise<MarqueLisible> {
    await this.exigerAutorisation(organizationId);
    const existe = await this.prisma.marque.findUnique({ where: { organizationId } });
    if (!existe) throw new NotFoundException("Aucune marque enregistrée.");

    await this.prisma.marque.update({
      where: { organizationId },
      data: colonnes(emplacement, null, null),
    });
    return this.lire(organizationId);
  }
}

/** Les quatre colonnes d'une image vont et viennent ensemble : les séparer
 *  laisserait un format sans octets, ou des dimensions périmées. */
function colonnes(emplacement: Emplacement, octets: Buffer | null, image: ImageValide | null) {
  if (emplacement === "logo") {
    return {
      logo: octets,
      logoFormat: image?.format ?? null,
      logoLargeur: image?.largeur ?? null,
      logoHauteur: image?.hauteur ?? null,
    };
  }
  return {
    signature: octets,
    signatureFormat: image?.format ?? null,
    signatureLargeur: image?.largeur ?? null,
    signatureHauteur: image?.hauteur ?? null,
  };
}
