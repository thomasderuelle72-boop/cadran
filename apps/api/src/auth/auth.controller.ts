import { Body, Controller, Get, HttpCode, Post, UseGuards } from "@nestjs/common";
import { AuthService } from "./auth.service";
import { RegisterDto } from "./dto/register.dto";
import { LoginDto } from "./dto/login.dto";
import { DemandeReinitialisationDto, ReinitialisationDto } from "./dto/reinitialisation.dto";
import { Throttle } from "@nestjs/throttler";
import { JwtAuthGuard } from "../common/jwt-auth.guard";
import { CurrentUser, AuthUser } from "../common/current-user.decorator";
import { PrismaService } from "../prisma/prisma.service";

@Controller("auth")
export class AuthController {
  constructor(
    private authService: AuthService,
    private prisma: PrismaService
  ) {}

  @Post("register")
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
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
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
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
