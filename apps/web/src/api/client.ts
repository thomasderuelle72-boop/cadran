const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3001/api";

/*
 * Le jeton de session n'est pas accessible d'ici, et c'est voulu : il vit
 * dans un cookie `httpOnly` que le navigateur attache seul. Ce fichier ne
 * sait donc pas lire la session — il sait seulement demander qu'elle soit
 * envoyée (`credentials: "include"`).
 *
 * Reste le jeton anti-CSRF, qu'on recopie en en-tête sur chaque requête
 * modifiante. Un site tiers peut faire émettre la requête par le navigateur
 * de la victime, mais il ne peut ni lire cette valeur ni poser un en-tête
 * personnalisé sans un préalable que CORS lui refuse.
 *
 * **Il ne vient plus d'un cookie.** L'API le pose bien dans un cookie
 * lisible, mais ce cookie appartient au domaine de l'API — et l'interface est
 * servie depuis un autre. `document.cookie` d'un domaine ne montre rien de
 * l'autre : le frontend n'y lisait donc rien, n'envoyait aucun en-tête, et
 * toute requête modifiante suivant une connexion partait en 403. En
 * développement, interface et API partageant `localhost`, le défaut restait
 * invisible — c'est ce qui l'a laissé passer.
 *
 * Le jeton arrive désormais dans le corps des réponses qui ouvrent une
 * session, et `GET /auth/csrf` le redonne au rechargement d'une page.
 */
const ENTETE_CSRF = "x-jeton-csrf";

/** Clé de session du navigateur : propre à l'origine, et effacée à la
 *  fermeture de l'onglet. Le jeton n'a pas à vivre plus longtemps. */
const CLE_CSRF = "cadran_csrf";

/** Marque qu'une session a été ouverte depuis ce navigateur. Simple indice,
 *  pour ne pas interroger l'API au nom d'un visiteur anonyme — jamais une
 *  preuve : seul le serveur tranche. */
const CLE_SESSION = "cadran_session_ouverte";

let jetonCsrf: string | null = null;

/** Le stockage peut lever : navigation privée, stockage désactivé. Aucune de
 *  ces situations ne doit empêcher l'application de fonctionner. */
function lireStockage(cle: string, source: Storage): string | null {
  try {
    return source.getItem(cle);
  } catch {
    return null;
  }
}

function ecrireStockage(cle: string, valeur: string | null, source: Storage): void {
  try {
    if (valeur === null) source.removeItem(cle);
    else source.setItem(cle, valeur);
  } catch {
    // Sans stockage, le jeton vit en mémoire : il faudra le redemander au
    // rechargement, ce qui coûte un appel et rien d'autre.
  }
}

/** Mémorise le jeton rendu par une réponse d'ouverture de session. */
export function memoriserCsrf(jeton: string | undefined | null): void {
  if (!jeton) return;
  jetonCsrf = jeton;
  ecrireStockage(CLE_CSRF, jeton, sessionStorage);
}

export function oublierSession(): void {
  jetonCsrf = null;
  ecrireStockage(CLE_CSRF, null, sessionStorage);
  ecrireStockage(CLE_SESSION, null, localStorage);
}

export function marquerSessionOuverte(): void {
  ecrireStockage(CLE_SESSION, "1", localStorage);
}

/**
 * Une session est-elle vraisemblablement ouverte ?
 *
 * On ne peut pas le savoir de façon certaine ici : le cookie de session est
 * invisible au JavaScript, et celui de l'API n'est de toute façon pas lisible
 * depuis ce domaine. On s'appuie donc sur une marque posée à la connexion et
 * retirée à la déconnexion. Elle peut mentir — un cookie expiré la laisse en
 * place — et c'est sans gravité : la réponse de `/auth/me` tranche.
 */
export function sessionProbable(): boolean {
  return lireStockage(CLE_SESSION, localStorage) !== null;
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

/**
 * Le jeton anti-CSRF du moment, obtenu si on ne l'a pas.
 *
 * Trois sources, dans l'ordre : la mémoire, le stockage de session — qui
 * survit au rechargement de la page, pas à la fermeture de l'onglet — puis
 * l'API. Sans ce dernier recours, recharger la page suffisait à ne plus rien
 * pouvoir modifier jusqu'à la reconnexion.
 */
export async function obtenirCsrf(): Promise<string | null> {
  if (jetonCsrf) return jetonCsrf;

  const range = lireStockage(CLE_CSRF, sessionStorage);
  if (range) {
    jetonCsrf = range;
    return range;
  }

  try {
    const reponse = await fetch(`${API_URL}/auth/csrf`, { credentials: "include" });
    if (!reponse.ok) return null;
    const corps = (await reponse.json()) as { jetonCsrf?: string };
    memoriserCsrf(corps.jetonCsrf);
    return jetonCsrf;
  } catch {
    /* Réseau indisponible : la requête qui suit échouera de toute façon, et
     * son message sera plus parlant que celui qu'on produirait ici. */
    return null;
  }
}

/** Le `Content-Type` est volontairement absent : voir uploadFile. */
function enteteCsrf(jeton: string | null): Headers {
  const entetes = new Headers();
  if (jeton) entetes.set(ENTETE_CSRF, jeton);
  return entetes;
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
  const headers = new Headers(options.headers);
  headers.set("Content-Type", "application/json");

  if (!METHODES_SANS_EFFET.has(methode)) {
    const jeton = await obtenirCsrf();
    if (jeton) headers.set(ENTETE_CSRF, jeton);
  }

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
  put: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "PUT", body: body ? JSON.stringify(body) : undefined }),
  patch: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "PATCH", body: body ? JSON.stringify(body) : undefined }),
  delete: <T>(path: string) => request<T>(path, { method: "DELETE" }),
  /*
   * Une suppression avec corps : réservée aux destructions qui exigent une
   * confirmation saisie. Mettre le nom à confirmer dans l'adresse l'écrirait
   * dans les journaux d'accès du serveur et dans l'historique du navigateur,
   * là où il n'a rien à faire.
   */
  deleteAvecCorps: <T>(path: string, body: unknown) =>
    request<T>(path, { method: "DELETE", body: JSON.stringify(body) }),
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
    headers: enteteCsrf(await obtenirCsrf()),
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

/**
 * Adresse locale d'une image servie par l'API.
 *
 * Un `<img src>` pointant directement sur l'API n'emporterait les cookies
 * qu'avec `crossorigin="use-credentials"`, dont le contrat CORS est plus
 * strict que celui de nos autres appels. On récupère donc les octets par la
 * même voie que le reste et on les expose au document par une URL d'objet,
 * que l'appelant révoque quand il n'en a plus besoin.
 */
export async function urlImage(path: string): Promise<string> {
  const response = await fetch(`${API_URL}${path}`, { credentials: "include" });
  if (!response.ok) throw new ApiError(response.status, await messageErreur(response));
  return URL.createObjectURL(await response.blob());
}

/**
 * Le message à afficher quand la session n'est pas reconnue juste après une
 * connexion acceptée : le cookie n'est pas reparti avec la requête suivante.
 *
 * On ne peut pas lire ce cookie — il est `httpOnly`, et posé sur le domaine
 * de l'API. On ne peut que lui demander de servir, ce que fait `login` dans
 * AuthContext en relisant `/auth/me`. C'est le cas de Safari et de la
 * navigation privée, qui écartent les cookies dits tiers — et les nôtres en
 * sont, l'interface et l'API étant sur deux domaines.
 */
export const MESSAGE_COOKIE_REFUSE =
  "Votre navigateur a refusé le cookie de session. Safari et les navigateurs "
  + "en navigation privée bloquent les cookies dits tiers ; Cadran servant "
  + "son interface et son API depuis deux domaines, le nôtre en est un. "
  + "Autorisez les cookies pour ce site, ou utilisez Chrome ou Firefox.";
