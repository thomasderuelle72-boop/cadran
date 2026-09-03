// Doit être chargé avant tout le reste : plusieurs modules (AuthModule en
// tête) lisent process.env.JWT_SECRET dès l'évaluation de leur décorateur
// @Module, donc avant que ConfigModule.forRoot() n'ait eu la main.
import "dotenv/config";
import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { ValidationPipe } from "@nestjs/common";
import { AppModule } from "./app.module";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors();
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true })
  );
  app.setGlobalPrefix("api");
  const port = process.env.PORT ? Number(process.env.PORT) : 3001;
  await app.listen(port);
  console.log(`Cadran API listening on http://localhost:${port}/api`);
}
bootstrap();
