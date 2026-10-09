import type { RatioUnit } from "../api/types";

export function formatRatioValue(value: number | null, unit: RatioUnit, currency = "EUR"): string {
  if (value === null || Number.isNaN(value)) return "n/d";
  switch (unit) {
    // Virgule décimale, comme on écrit les nombres en français : « 18,1 % »,
    // et non « 18.1 % ».
    case "pourcentage":
      return `${decimal(value * 100, 1)} %`;
    case "jours":
      return `${decimal(value, 0)} j`;
    case "annees":
      // « 0,6 an », « 2,6 ans » : le pluriel commence à deux.
      return `${decimal(value, 1)} ${Math.abs(value) >= 2 ? "ans" : "an"}`;
    case "indice":
      return decimal(value, 0);
    case "devise":
      return formatCurrency(value, currency);
    default:
      return decimal(value, 2);
  }
}

function decimal(value: number, chiffres: number): string {
  return value.toLocaleString("fr-FR", { minimumFractionDigits: chiffres, maximumFractionDigits: chiffres });
}

export function formatCurrency(value: number, currency = "EUR"): string {
  return value.toLocaleString("fr-FR", { style: "currency", currency, maximumFractionDigits: 0 });
}

export function formatDate(value: string): string {
  return new Date(value).toLocaleDateString("fr-FR");
}
