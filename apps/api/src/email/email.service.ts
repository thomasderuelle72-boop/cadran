import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createTransport, type Transporter } from "nodemailer";

export interface Courriel {
  destinataire: string;
  sujet: string;
  /** Version texte. Elle sert de repli, et elle est la seule en journal. */
  texte: string;
  html?: string;
}

/**
 * Envoi de courriels.
 *
 * Comme pour Stripe, l'absence de configuration ne fait pas échouer le
 * démarrage : le service bascule en mode journal et écrit le message dans les
 * logs au lieu de l'expédier. C'est ce qui permet de développer et de tester
 * la réinitialisation de mot de passe sans serveur SMTP — on lit le lien dans
 * la console.
 *
 * Le mode journal est signalé à chaque envoi, et non seulement au démarrage :
 * une instance mal configurée mise en production doit être bruyante, sinon
 * personne ne remarque que les courriels ne partent pas avant qu'un client ne
 * le signale.
 */
@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly transport: Transporter | null;
  private readonly expediteur: string;

  constructor(private config: ConfigService) {
    this.expediteur = this.config.get<string>("SMTP_FROM") ?? "Cadran <ne-pas-repondre@cadran.fr>";
    const hote = this.config.get<string>("SMTP_HOST");

    if (!hote) {
      this.logger.warn(
        "SMTP_HOST absente : les courriels seront écrits dans les journaux au lieu d'être envoyés."
      );
      this.transport = null;
      return;
    }

    this.transport = createTransport({
      host: hote,
      port: Number(this.config.get<string>("SMTP_PORT") ?? 587),
      // Le port 465 impose TLS dès la connexion ; les autres passent par
      // STARTTLS. Se tromper donne une erreur de protocole peu parlante.
      secure: Number(this.config.get<string>("SMTP_PORT") ?? 587) === 465,
      auth: this.config.get<string>("SMTP_USER")
        ? {
            user: this.config.get<string>("SMTP_USER"),
            pass: this.config.get<string>("SMTP_PASSWORD"),
          }
        : undefined,
    });
  }

  get configure(): boolean {
    return this.transport !== null;
  }

  /**
   * Envoie un courriel, ou le journalise faute de configuration.
   *
   * Ne lève jamais : un envoi raté ne doit pas faire échouer l'action qui
   * l'a déclenché. Un utilisateur qui demande un lien de réinitialisation et
   * reçoit une erreur 500 conclut que son compte est cassé, alors que seul le
   * serveur de courrier l'est.
   */
  async envoyer(courriel: Courriel): Promise<{ envoye: boolean }> {
    if (!this.transport) {
      this.logger.warn(
        `[courriel non envoyé — SMTP non configuré] À : ${courriel.destinataire}\n` +
          `Sujet : ${courriel.sujet}\n${courriel.texte}`
      );
      return { envoye: false };
    }

    try {
      await this.transport.sendMail({
        from: this.expediteur,
        to: courriel.destinataire,
        subject: courriel.sujet,
        text: courriel.texte,
        html: courriel.html,
      });
      return { envoye: true };
    } catch (erreur) {
      const message = erreur instanceof Error ? erreur.message : String(erreur);
      this.logger.error(`Envoi à ${courriel.destinataire} en échec : ${message}`);
      return { envoye: false };
    }
  }
}
