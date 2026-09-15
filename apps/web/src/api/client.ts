const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3001/api";

/*
 * Le jeton de session n'est plus accessible d'ici, et c'est voulu : il vit
 * dans un cookie `httpOnly` que le navigateur attache seul. Ce fichier ne
 * sait donc plus lire la session — il sait seulement demander qu'elle soit
 * envoyée (`credentials: "include"`).
 *
 * Ne subsiste que le jeton anti-CSRF, volontairement lisible. L'API le pose
 * dans un cookie ordinaire à l'ouverture de session ; on le recopie dans un
 * en-tête sur chaque requête modifiante. Un site tiers peut faire émettre la
 * requête par le navigateur de la victime, mais la politique de même origine
 * l'empêche de lire le cookie : il ne peut pas fabriquer l'en-tête.
 */
const COOKIE_CSRF = "cadran_csrf";
const ENTETE_CSRF = "x-jeton-csrf";

/**
 * Extrait la valeur d'un cookie d'une chaîne au format `document.cookie`.
 *
 * Séparée de la lecture du document pour être vérifiable sans navigateur :
 * c'est cette fonction qui décide si une session semble ouverte et si les
 * cookies ont été refusés, deux jugements qu'on ne veut pas croire sur parole.
 *
 * Le préfixe `; ` est ce qui empêche un cookie dont le nom *se termine* par
 * le nôtre (`faux_cadran_csrf`) d'être pris pour lui.
 */
export function valeurCookie(chaine: string, nom: string): string | null {
  const trouve = `; ${chaine}`.split(`; ${nom}=`);
  return trouve.length === 2 ? (trouve.pop()?.split(";").shift() ?? null) : null;
}

function lireCookie(nom: string): string | null {
  return valeurCookie(document.cookie, nom);
}

/**
 * Une session est-elle vraisemblablement ouverte ?
 *
 * On ne peut plus le savoir avec certitude côté navigateur, puisque le cookie
 * de session est invisible — seul le serveur tranche. Mais le cookie
 * anti-CSRF est posé et retiré en même temps que lui : sa présence est un
 * indice fiable, et il ne prouve rien à lui seul, donc s'en servir ici
 * n'affaiblit rien. Sans cet indice, chaque visiteur anonyme de la page
 * d'accueil déclencherait un appel authentifié voué au 401.
 */
export function sessionProbable(): boolean {
  return lireCookie(COOKIE_CSRF) !== null;
}

/**
 * Les cookies tiers ont-ils été refusés par le navigateur ?
 *
 * À n'appeler qu'après une connexion réussie. L'API pose deux cookies, dont
 * un lisible ; si celui-là n'est pas là alors que la requête a abouti, le
 * navigateur les a écartés tous les deux. C'est le cas de Safari, qui bloque
 * les cookies tiers par défaut — et le frontend et l'API étant hébergés sur
 * deux domaines distincts, les nôtres en sont.
 *
 * Sans ce contrôle, l'utilisateur voit l'écran de connexion réapparaître sans
 * message : impossible pour lui de deviner que la cause est le navigateur, et
 * non son mot de passe. Le remède est de servir l'API depuis un
 * sous-domaine du site (api.cadran.fr), ce qui rend le cookie premier.
 */
export function cookiesRefuses(): boolean {
  return !sessionProbable();
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message);
  }
}

/** Ces méthodes ne modifient rien : l'en-tête anti-CSRF n'y a pas d'objet. */
const METHODES_SANS_EFFET = new Set(["GET", "HEAD", "OPTIONS"]);

function entetesAvecCsrf(base: Headers, methode: string): Headers {
  if (!METHODES_SANS_EFFET.has(methode)) {
    const jeton = lireCookie(COOKIE_CSRF);
    if (jeton) base.set(ENTETE_CSRF, jeton);
  }
  return base;
}

async function messageErreur(response: Response): Promise<string> {
  let message = response.statusText;
  try {
    const corps = await response.json();
    message = corps.message ?? message;
  } catch {
    // réponse sans corps JSON exploitable
  }
  return Array.isArray(message) ? message.join(", ") : message;
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const methode = options.method ?? "GET";
  const headers = entetesAvecCsrf(new Headers(options.headers), methode);
  headers.set("Content-Type", "application/json");

  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers,
    // Sans ceci, le navigateur n'envoie aucun cookie vers une autre origine.
    credentials: "include",
  });

  if (!response.ok) throw new ApiError(response.status, await messageErreur(response));

  /*
   * Un corps vide n'est pas réservé au 204. Nest renvoie 200 sans corps pour
   * un contrôleur qui ne retourne rien — c'est le cas de toutes les
   * suppressions. Appeler response.json() dessus lève une erreur de syntaxe,
   * la mutation est rejetée, son onSuccess n'invalide rien : la ligne
   * supprimée en base restait affichée à l'écran.
   */
  const corps = await response.text();
  if (!corps) return undefined as T;
  return JSON.parse(corps) as T;
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "POST", body: body ? JSON.stringify(body) : undefined }),
  patch: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "PATCH", body: body ? JSON.stringify(body) : undefined }),
  delete: <T>(path: string) => request<T>(path, { method: "DELETE" }),
};

/**
 * Envoi d'un fichier en multipart. Le Content-Type est délibérément laissé au
 * navigateur : il doit y joindre la frontière (« boundary ») du corps, ce
 * qu'il ne fait que si l'en-tête n'est pas déjà positionné.
 */
export async function uploadFile<T>(path: string, file: File, field = "file"): Promise<T> {
  const body = new FormData();
  body.append(field, file);

  const response = await fetch(`${API_URL}${path}`, {
    method: "POST",
    headers: entetesAvecCsrf(new Headers(), "POST"),
    body,
    credentials: "include",
  });

  if (!response.ok) throw new ApiError(response.status, await messageErreur(response));
  return response.json() as Promise<T>;
}

export async function downloadFile(path: string, filename: string) {
  const response = await fetch(`${API_URL}${path}`, { credentials: "include" });
  if (!response.ok) throw new ApiError(response.status, "Impossible de télécharger le fichier.");
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
