import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import * as bcrypt from "bcryptjs";
import { Role } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { EmailService } from "../email/email.service";
import { gabarit } from "../email/gabarit";
import { RegisterDto } from "./dto/register.dto";
import { LoginDto } from "./dto/login.dto";
import { emettreJeton, empreinteDe, verifierJeton } from "./reinitialisation";

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private email: EmailService,
    private config: ConfigService
  ) {}

  private issueToken(user: { id: string; organizationId: string; role: Role; email: string }) {
    const accessToken = this.jwt.sign({
      sub: user.id,
      organizationId: user.organizationId,
      role: user.role,
      email: user.email,
    });
    return accessToken;
  }

  async register(dto: RegisterDto) {
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existing) {
      throw new ConflictException("Un compte existe déjà avec cet e-mail.");
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);

    const organization = await this.prisma.organization.create({
      data: { name: dto.organizationName },
    });

    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        name: dto.name,
        passwordHash,
        role: Role.ADMIN,
        organizationId: organization.id,
      },
    });

    return {
      accessToken: this.issueToken(user),
      user: this.toPublicUser(user, organization.name),
    };
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email }, include: { organization: true } });
    if (!user) throw new UnauthorizedException("Identifiants invalides.");

    const passwordMatches = await bcrypt.compare(dto.password, user.passwordHash);
    if (!passwordMatches) throw new UnauthorizedException("Identifiants invalides.");

    return {
      accessToken: this.issueToken(user),
      user: this.toPublicUser(user, user.organization.name),
    };
  }

  private toPublicUser(
    user: { id: string; email: string; name: string; role: Role; organizationId: string },
    organizationName: string
  ) {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      organizationId: user.organizationId,
      organizationName,
    };
  }

  /**
   * Demande de réinitialisation.
   *
   * Répond toujours de la même façon, que l'adresse existe ou non. Dire
   * « aucun compte avec cette adresse » transformerait ce point d'entrée en
   * annuaire : on saurait, une adresse à la fois, qui est client. Le silence
   * est la seule réponse correcte, et il est ici volontaire, pas accidentel.
   */
  async demanderReinitialisation(email: string): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) {
      // Le temps de réponse doit rester comparable, sinon la différence de
      // durée rétablit l'énumération qu'on vient d'empêcher.
      await bcrypt.hash("temps-constant", 10);
      this.logger.log(`Réinitialisation demandée pour une adresse inconnue.`);
      return;
    }

    // Les jetons antérieurs encore ouverts sont clos : plusieurs liens
    // valables en parallèle multiplient les occasions d'en voir un intercepté.
    await this.prisma.passwordResetToken.updateMany({
      where: { userId: user.id, utiliseLe: null },
      data: { utiliseLe: new Date() },
    });

    const { jetonClair, empreinte, expireLe } = emettreJeton();
    await this.prisma.passwordResetToken.create({
      data: { userId: user.id, empreinte, expireLe },
    });

    const base = this.config.get<string>("APP_URL") ?? "http://localhost:5173";
    const lien = `${base}/mot-de-passe/nouveau?jeton=${jetonClair}`;

    await this.email.envoyer({
      destinataire: user.email,
      sujet: "Réinitialiser votre mot de passe Cadran",
      ...gabarit("Réinitialiser votre mot de passe", {
        paragraphes: [
          `Bonjour ${user.name},`,
          "Vous avez demandé à réinitialiser votre mot de passe. Le lien ci-dessous est valable une heure, et ne sert qu'une fois.",
          "Si vous n'êtes pas à l'origine de cette demande, ignorez ce message : votre mot de passe actuel reste valable.",
        ],
        action: { lien, libelle: "Choisir un nouveau mot de passe" },
        rappelLien: true,
      }),
    });
  }

  /**
   * Change le mot de passe contre un jeton valide.
   *
   * Le motif exact d'un refus reste dans les journaux : répondre « ce jeton a
   * expiré » plutôt que « ce jeton est invalide » confirmerait à un inconnu
   * qu'il a existé, et à quel moment.
   */
  async reinitialiser(jetonClair: string, nouveauMotDePasse: string): Promise<void> {
    const enBase = await this.prisma.passwordResetToken.findFirst({
      where: { empreinte: empreinteDe(jetonClair) },
      include: { user: true },
    });

    const verdict = verifierJeton(jetonClair, enBase);
    if (!verdict.valide) {
      this.logger.warn(`Jeton de réinitialisation refusé : ${verdict.motif}.`);
      throw new BadRequestException(
        "Ce lien n'est plus valable. Demandez-en un nouveau depuis la page de connexion."
      );
    }
    if (!enBase) throw new BadRequestException("Ce lien n'est plus valable.");

    const passwordHash = await bcrypt.hash(nouveauMotDePasse, 10);

    // Les deux écritures dans la même transaction : un mot de passe changé
    // sans que le jeton soit clos laisserait le lien réutilisable.
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: enBase.userId },
        data: { passwordHash },
      }),
      this.prisma.passwordResetToken.update({
        where: { id: enBase.id },
        data: { utiliseLe: new Date() },
      }),
    ]);

    await this.email.envoyer({
      destinataire: enBase.user.email,
      sujet: "Votre mot de passe Cadran a été modifié",
      ...gabarit("Votre mot de passe a été modifié", {
        paragraphes: [
          `Bonjour ${enBase.user.name},`,
          "Votre mot de passe vient d'être modifié.",
          "Si vous n'êtes pas à l'origine de ce changement, votre compte est compromis : demandez immédiatement une nouvelle réinitialisation depuis la page de connexion.",
        ],
      }),
    });
  }
}
