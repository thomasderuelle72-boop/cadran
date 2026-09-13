const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3001/api";
const TOKEN_KEY = "cadran.accessToken";

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string | null) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message);
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers = new Headers(options.headers);
  headers.set("Content-Type", "application/json");
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const response = await fetch(`${API_URL}${path}`, { ...options, headers });

  if (!response.ok) {
    let message = response.statusText;
    try {
      const body = await response.json();
      message = body.message ?? message;
    } catch {
      // réponse sans corps JSON exploitable
    }
    throw new ApiError(response.status, Array.isArray(message) ? message.join(", ") : message);
  }

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
  const token = getToken();
  const headers = new Headers();
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const body = new FormData();
  body.append(field, file);

  const response = await fetch(`${API_URL}${path}`, { method: "POST", headers, body });

  if (!response.ok) {
    let message = response.statusText;
    try {
      const corps = await response.json();
      message = corps.message ?? message;
    } catch {
      // réponse sans corps JSON exploitable
    }
    throw new ApiError(response.status, Array.isArray(message) ? message.join(", ") : message);
  }

  return response.json() as Promise<T>;
}

export async function downloadFile(path: string, filename: string) {
  const token = getToken();
  const headers = new Headers();
  if (token) headers.set("Authorization", `Bearer ${token}`);
  const response = await fetch(`${API_URL}${path}`, { headers });
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
