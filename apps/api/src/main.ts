// Doit être chargé avant tout le reste : plusieurs modules (AuthModule en
// tête) lisent process.env.JWT_SECRET dès l'évaluation de leur décorateur
// @Module, donc avant que ConfigModule.forRoot() n'ait eu la main.
import "dotenv/config";
import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { ValidationPipe } from "@nestjs/common";
import { AppModule } from "./app.module";

async function bootstrap() {
  // rawBody conserve le corps brut des requêtes en plus du corps analysé.
  // Le webhook Stripe en a besoin : sa signature porte sur les octets
  // reçus, et un JSON re-sérialisé ne la vérifie plus.
  const app = await NestFactory.create(AppModule, { rawBody: true });
  /*
   * CORS restreint aux origines déclarées.
   *
   * `enableCors()` sans argument autorise n'importe quel site à appeler
   * l'API depuis le navigateur d'un utilisateur connecté. En développement
   * c'est commode ; en production, sur une application qui détient la
   * comptabilité d'entreprises, c'est une porte ouverte.
   *
   * Sans CORS_ORIGINS, on retombe sur le frontend local : une instance mal
   * configurée refuse les appels plutôt que de les accepter tous.
   */
  const origines = (process.env.CORS_ORIGINS ?? "http://localhost:5173")
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean);
  app.enableCors({ origin: origines, credentials: true });
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true })
  );
  app.setGlobalPrefix("api");
  const port = process.env.PORT ? Number(process.env.PORT) : 3001;
  await app.listen(port);
  console.log(`Cadran API listening on http://localhost:${port}/api`);
}
bootstrap();
