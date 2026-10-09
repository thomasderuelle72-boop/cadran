/**
 * Une mini-courbe dans une ligne de tableau : la tendance d'un coup d'œil, à
 * côté des chiffres exacts (Tufte, « sparklines »). Sans axe ni graduation :
 * les valeurs sont juste à gauche. Le dernier point est marqué.
 */
export function MiniCourbe({
  valeurs,
  largeur = 72,
  hauteur = 22,
}: {
  valeurs: Array<number | null>;
  largeur?: number;
  hauteur?: number;
}) {
  const presentes = valeurs.filter((v): v is number => v !== null);
  if (presentes.length < 2) return null;
  const min = Math.min(...presentes);
  const max = Math.max(...presentes);
  const etendue = max - min || 1;
  const marge = 3;
  const x = (i: number) => marge + (i / (valeurs.length - 1)) * (largeur - 2 * marge);
  const y = (v: number) => hauteur - marge - ((v - min) / etendue) * (hauteur - 2 * marge);

  const points = valeurs
    .map((v, i) => (v === null ? null : `${x(i).toFixed(1)},${y(v).toFixed(1)}`))
    .filter(Boolean)
    .join(" ");
  const dernier = valeurs.length - 1;
  const fin = valeurs[dernier];

  return (
    <svg width={largeur} height={hauteur} viewBox={`0 0 ${largeur} ${hauteur}`} aria-hidden="true" className="inline-block align-middle">
      <polyline points={points} fill="none" stroke="currentColor" strokeWidth={1.5} className="text-ink-3" strokeLinejoin="round" />
      {fin !== null && <circle cx={x(dernier)} cy={y(fin)} r={2.6} className="fill-serie-1" />}
    </svg>
  );
}
