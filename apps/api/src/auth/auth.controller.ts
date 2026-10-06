import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Req,
  Res,
  UseGuards,
} from "@nestjs/common";
import type { Request, Response } from "express";
import { AuthService } from "./auth.service";
import { RegisterDto } from "./dto/register.dto";
import { LoginDto } from "./dto/login.dto";
import { DemandeReinitialisationDto, ReinitialisationDto } from "./dto/reinitialisation.dto";
import { Throttle } from "@nestjs/throttler";
import { JwtAuthGuard } from "../common/jwt-auth.guard";
import { CurrentUser, AuthUser } from "../common/current-user.decorator";
import { PrismaService } from "../prisma/prisma.service";
import { estProduction } from "../config/environnement";
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
    private prisma: PrismaService
  ) {}

  /** `secure` et `SameSite=None` hors développement : voir session.ts. */
  private get production(): boolean {
    return estProduction();
  }

  /**
   * Installe la session dans deux cookies, et rend le jeton anti-CSRF dans le
   * corps.
   *
   * Le jeton **de session** reste hors du corps : c'est tout l'objet du
   * cookie `httpOnly`, et le rendre reviendrait à le laisser atterrir dans le
   * stockage du navigateur, à portée de n'importe quel script de la page.
   *
   * Le jeton **anti-CSRF**, lui, doit être lisible par le client — c'est sa
   * définition même : il prouve que la requête vient d'un code capable de
   * lire une valeur qu'un site tiers ne peut pas lire. Il transitait jusqu'ici
   * par un cookie non `httpOnly`, ce qui ne marche que si l'interface et
   * l'API partagent un domaine. Elles n'en partagent pas : le frontend est
   * sur Vercel, l'API sur Railway, et `document.cookie` de l'un ne voit rien
   * de l'autre. Le frontend ne pouvait donc produire aucun en-tête, et toute
   * requête modifiante suivant une connexion était refusée.
   *
   * Le cookie reste posé : c'est lui que le garde compare à l'en-tête. Ce qui
   * change est seulement la façon dont le client apprend la valeur. La
   * protection est intacte — un site tiers ne peut ni lire cette réponse
   * (CORS la réserve à nos origines) ni poser un en-tête personnalisé sans
   * préalable accepté.
   */
  private ouvrirSession(
    reponse: Response,
    resultat: { accessToken: string; user: unknown }
  ): { user: unknown; jetonCsrf: string } {
    const jetonCsrf = emettreCsrf();
    reponse.cookie(COOKIE_SESSION, resultat.accessToken, optionsSession(this.production));
    reponse.cookie(COOKIE_CSRF, jetonCsrf, optionsCsrf(this.production));
    return { user: resultat.user, jetonCsrf };
  }

  /**
   * Donne au client un jeton anti-CSRF utilisable.
   *
   * Nécessaire au rechargement d'une page : le jeton vit en mémoire côté
   * client, et un nouvel onglet n'en a pas. Sans ce point d'entrée, il
   * faudrait se reconnecter pour pouvoir modifier quoi que ce soit.
   *
   * Rend la valeur du cookie existant plutôt que d'en forger une à chaque
   * appel : deux onglets de la même session partagent le cookie, et en battre
   * un neuf invaliderait le jeton que l'autre détient.
   *
   * Non authentifié, parce que la connexion elle-même en a besoin. Cela ne
   * l'affaiblit pas : un attaquant peut obtenir *un* jeton pour son propre
   * navigateur, jamais celui de sa victime, et c'est à celui de la victime
   * que le garde compare.
   */
  @Get("csrf")
  csrf(@Req() requete: Request, @Res({ passthrough: true }) reponse: Response) {
    const cookies = (requete.cookies ?? {}) as Record<string, string | undefined>;
    const existant = cookies[COOKIE_CSRF];
    if (existant) return { jetonCsrf: existant };

    const jetonCsrf = emettreCsrf();
    reponse.cookie(COOKIE_CSRF, jetonCsrf, optionsCsrf(this.production));
    return { jetonCsrf };
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
   * Quitte un accès support et revient sur sa propre organisation.
   *
   * Vit ici et non dans le contrôleur de plateforme, dont le garde refuse
   * justement les sessions support : s'en remettre à l'expiration du jeton
   * pour en sortir laisserait l'administrateur une heure dans le dossier d'un
   * client qu'il a fini de dépanner.
   *
   * Aucun mot de passe n'est redemandé : la session support prouve déjà qui
   * appelle, et la session rendue est celle du même compte, moins les droits.
   */
  @Post("support/quitter")
  @HttpCode(200)
  @UseGuards(JwtAuthGuard)
  async quitterSupport(
    @CurrentUser() user: AuthUser,
    @Res({ passthrough: true }) reponse: Response
  ) {
    if (!user.support) {
      throw new BadRequestException("Cette session n'est pas un accès support.");
    }
    return this.ouvrirSession(reponse, await this.authService.sessionOrdinaire(user.userId));
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

  /**
   * Qui suis-je, et sur quoi porte ma session ?
   *
   * L'organisation renvoyée est celle de la session, pas celle du compte :
   * en accès support ce sont deux choses différentes, et afficher le nom du
   * cabinet au-dessus des chiffres d'un client serait exactement le genre de
   * confusion qui fait écrire une recommandation dans le mauvais dossier.
   */
  @Get("me")
  @UseGuards(JwtAuthGuard)
  async me(@CurrentUser() user: AuthUser) {
    const record = await this.prisma.user.findUniqueOrThrow({
      where: { id: user.userId },
      select: { id: true, email: true, name: true },
    });
    const organisation = await this.prisma.organization.findUniqueOrThrow({
      where: { id: user.organizationId },
      select: { name: true },
    });
    return {
      id: record.id,
      email: record.email,
      name: record.name,
      role: user.role,
      organizationId: user.organizationId,
      organizationName: organisation.name,
      administrateurPlateforme: user.administrateurPlateforme,
      support: user.support,
    };
  }
}
