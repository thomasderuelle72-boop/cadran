import type { RatioUnit } from "../api/types";

export function formatRatioValue(value: number | null, unit: RatioUnit): string {
  if (value === null || Number.isNaN(value)) return "n/d";
  switch (unit) {
    case "pourcentage":
      return `${(value * 100).toFixed(1)} %`;
    case "jours":
      return `${value.toFixed(0)} j`;
    case "annees":
      return `${value.toFixed(1)} ans`;
    case "devise":
      return formatCurrency(value);
    default:
      return value.toFixed(2);
  }
}

export function formatCurrency(value: number): string {
  return value.toLocaleString("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
}

export function formatDate(value: string): string {
  return new Date(value).toLocaleDateString("fr-FR");
}
