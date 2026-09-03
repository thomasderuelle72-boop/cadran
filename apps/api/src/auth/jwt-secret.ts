const MINIMUM_LENGTH = 32;

/**
 * Refuse de démarrer plutôt que de retomber sur un secret par défaut : un
 * JWT signé avec une valeur publique connue permettrait de forger un token
 * ADMIN pour n'importe quelle organisation. Appelée au chargement du module
 * (donc avant que l'API n'accepte la moindre requête).
 */
export function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.trim().length < MINIMUM_LENGTH) {
    throw new Error(
      `JWT_SECRET manquant ou trop court (minimum ${MINIMUM_LENGTH} caractères). ` +
        "Générez-en un avec `openssl rand -base64 48` et renseignez-le dans apps/api/.env avant de démarrer l'API."
    );
  }
  return secret;
}
