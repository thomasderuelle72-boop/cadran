import { Global, Module } from "@nestjs/common";
import { EmailService } from "./email.service";

// Global : presque tous les modules finiront par envoyer quelque chose, et
// répéter l'import partout n'apporterait rien.
@Global()
@Module({
  providers: [EmailService],
  exports: [EmailService],
})
export class EmailModule {}
