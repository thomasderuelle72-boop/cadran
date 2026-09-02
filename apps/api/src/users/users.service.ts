import { ConflictException, Injectable } from "@nestjs/common";
import * as bcrypt from "bcryptjs";
import { PrismaService } from "../prisma/prisma.service";
import { CreateUserDto } from "./dto/create-user.dto";

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  list(organizationId: string) {
    return this.prisma.user.findMany({
      where: { organizationId },
      select: { id: true, name: true, email: true, role: true, createdAt: true },
      orderBy: { createdAt: "asc" },
    });
  }

  async create(organizationId: string, dto: CreateUserDto) {
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existing) throw new ConflictException("Un compte existe déjà avec cet e-mail.");

    const passwordHash = await bcrypt.hash(dto.password, 10);
    const user = await this.prisma.user.create({
      data: { organizationId, name: dto.name, email: dto.email, passwordHash, role: dto.role },
      select: { id: true, name: true, email: true, role: true, createdAt: true },
    });
    return user;
  }
}
