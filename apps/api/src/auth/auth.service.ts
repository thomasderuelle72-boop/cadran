import { ConflictException, Injectable, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import * as bcrypt from "bcryptjs";
import { Role } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { RegisterDto } from "./dto/register.dto";
import { LoginDto } from "./dto/login.dto";

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService
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
}
