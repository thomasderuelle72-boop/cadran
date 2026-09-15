import { Body, Controller, Get, HttpCode, Post, Res, UseGuards } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { Response } from "express";
import { AuthService } from "./auth.service";
import { RegisterDto } from "./dto/register.dto";
import { LoginDto } from "./dto/login.dto";
import { DemandeReinitialisationDto, ReinitialisationDto } from "./dto/reinitialisation.dto";
import { Throttle } from "@nestjs/throttler";
import { JwtAuthGuard } from "../common/jwt-auth.guard";
import { CurrentUser, AuthUser } from "../common/current-user.decorator";
import { PrismaService } from "../prisma/prisma.service";
import {
  COOKIE_CSRF,
  COOKIE_SESSION,
  emettreCsrf,
  optionsCsrf,
  optionsSession,
} from "./session";

@Controller("auth")
export class AuthController {
  constructor(
    private authService: AuthService,
    private prisma: PrismaService,
    private config: ConfigService
  ) {}

  /** `secure` et `SameSite=None` hors développement : voir session.ts. */
  private get production(): boolean {
    return this.config.get<string>("NODE_ENV") === "production";
  }

  /**
   * Installe la session dans deux cookies et retire le jeton du corps.
   *
   * Le retirer est le but de l'opération : un jeton renvoyé dans le corps
   * finit dans une variable JavaScript, puis dans le stockage du navigateur,
   * et l'on n'a rien gagné. Le client apprend qui il est par l'utilisateur
   * renvoyé, et la session voyage désormais hors de sa portée.
   */
  private ouvrirSession(
    reponse: Response,
    resultat: { accessToken: string; user: unknown }
  ): { user: unknown } {
    reponse.cookie(COOKIE_SESSION, resultat.accessToken, optionsSession(this.production));
    reponse.cookie(COOKIE_CSRF, emettreCsrf(), optionsCsrf(this.production));
    return { user: resultat.user };
  }

  @Post("register")
  async register(@Body() dto: RegisterDto, @Res({ passthrough: true }) reponse: Response) {
    return this.ouvrirSession(reponse, await this.authService.register(dto));
  }

  /**
   * Cinq essais par minute et par adresse IP.
   *
   * Sans cela, on peut éprouver des mots de passe en boucle : l'application
   * détient le grand livre complet d'entreprises, et un compte forcé ouvre
   * toute leur comptabilité.
   */
  @Post("login")
  @HttpCode(200)
  @Throttle({ court: { limit: 5, ttl: 60_000 }, long: { limit: 30, ttl: 3_600_000 } })
  async login(@Body() dto: LoginDto, @Res({ passthrough: true }) reponse: Response) {
    return this.ouvrirSession(reponse, await this.authService.login(dto));
  }

  /**
   * Ferme la session côté serveur.
   *
   * Avec un jeton en localStorage, se déconnecter se réduisait à l'effacer —
   * une opération purement locale. Un cookie `httpOnly`, le JavaScript ne
   * peut pas l'effacer : il faut que le serveur demande sa suppression.
   *
   * Le jeton reste valable jusqu'à son échéance : le révoquer vraiment
   * supposerait une liste de révocation, que rien ne justifie ici. Le cookie
   * disparaît du navigateur, ce qui est l'effet attendu d'une déconnexion.
   */
  @Post("logout")
  @HttpCode(204)
  logout(@Res({ passthrough: true }) reponse: Response) {
    const { maxAge: _ignore, ...session } = optionsSession(this.production);
    const { maxAge: _autre, ...csrf } = optionsCsrf(this.production);
    reponse.clearCookie(COOKIE_SESSION, session);
    reponse.clearCookie(COOKIE_CSRF, csrf);
  }

  /**
   * Demande d'un lien de réinitialisation.
   *
   * 204 quoi qu'il arrive, adresse connue ou non : une réponse différenciée
   * ferait de ce point d'entrée un annuaire de clients.
   *
   * Limité plus sévèrement que le reste : c'est un point d'entrée qui envoie
   * des courriels à des adresses arbitraires, donc un relais de spam si on le
   * laisse ouvert.
   */
  @Post("mot-de-passe/oubli")
  @HttpCode(204)
  @Throttle({ court: { limit: 3, ttl: 60_000 }, long: { limit: 10, ttl: 3_600_000 } })
  async oubli(@Body() dto: DemandeReinitialisationDto) {
    await this.authService.demanderReinitialisation(dto.email);
  }

  @Post("mot-de-passe/nouveau")
  @HttpCode(204)
  @Throttle({ court: { limit: 5, ttl: 60_000 }, long: { limit: 20, ttl: 3_600_000 } })
  async nouveauMotDePasse(@Body() dto: ReinitialisationDto) {
    await this.authService.reinitialiser(dto.jeton, dto.motDePasse);
  }

  @Get("me")
  @UseGuards(JwtAuthGuard)
  async me(@CurrentUser() user: AuthUser) {
    const record = await this.prisma.user.findUniqueOrThrow({
      where: { id: user.userId },
      include: { organization: true },
    });
    return {
      id: record.id,
      email: record.email,
      name: record.name,
      role: record.role,
      organizationId: record.organizationId,
      organizationName: record.organization.name,
    };
  }
}
