/**
 * Format a CHF amount from Rappen (bigint or number) to display string.
 * Currency prefix per Swiss convention: CHF left of the amount.
 * Example: 123450n → "CHF 1'234.50"
 *
 * `currency` is optional and defaults to "CHF" for backward compatibility.
 * When a currency is passed (e.g. "EUR", "USD"), the prefix changes but the
 * Swiss apostrophe thousands separator and 2-decimal format remain.
 */
export function formatCHF(rappen: bigint | number, currency?: string): string {
  const rappenNum = typeof rappen === "bigint" ? Number(rappen) : rappen;
  const franken = rappenNum / 100;
  const formatted = franken.toFixed(2);
  // Swiss thousand separator (apostrophe)
  const parts = formatted.split(".");
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, "'");
  const prefix = currency && currency.length > 0 ? currency : "CHF";
  return `${prefix} ${parts[0]}.${parts[1]}`;
}

/**
 * formatAmount — formatiert einen Rappen-Wert mit Schweizer Apostroph-
 * Tausendertrennzeichen und 2 Dezimalstellen, OHNE Währungspräfix.
 * Wird für Tabellenzellen verwendet, in denen die Währung nur in der
 * Spaltenüberschrift steht (z.B. "Betrag (CHF)"), nicht in jeder Zelle.
 *
 * Beispiel: 123450n → "1'234.50"
 */
export function formatAmount(rappen: bigint | number): string {
  const rappenNum = typeof rappen === "bigint" ? Number(rappen) : rappen;
  const franken = rappenNum / 100;
  const formatted = franken.toFixed(2);
  const parts = formatted.split(".");
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, "'");
  return `${parts[0]}.${parts[1]}`;
}

/**
 * Ensure a date string is displayed in dd.mm.yyyy format.
 * Accepts dd.mm.yyyy passthrough or ISO yyyy-mm-dd conversion.
 */
export function formatDate(dateStr: string): string {
  if (!dateStr) return "";
  // Already dd.mm.yyyy
  if (/^\d{2}\.\d{2}\.\d{4}$/.test(dateStr)) return dateStr;
  // ISO format yyyy-mm-dd
  if (/^\d{4}-\d{2}-\d{2}/.test(dateStr)) {
    const [year, month, day] = dateStr.substring(0, 10).split("-");
    return `${day}.${month}.${year}`;
  }
  return dateStr;
}

/**
 * Format minutes to hh:mm string.
 * Example: 90 → "01:30"
 */
export function formatDuration(minutes: number): string {
  const h = Math.floor(Math.abs(minutes) / 60);
  const m = Math.abs(minutes) % 60;
  const sign = minutes < 0 ? "-" : "";
  return `${sign}${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/**
 * Parse duration string to total minutes. Supports multiple formats:
 * - "01:30"   → 90  (already valid hh:mm)
 * - "800"     → 480 (treat as hhmm → 08:00)
 * - "0800"    → 480 (treat as hhmm → 08:00)
 * - "90"      → 90  (< 100 and no colon → treat as plain minutes)
 * - "1.5"     → 90  (decimal hours)
 */
export function parseDuration(input: string): number {
  if (!input) return 0;
  const s = input.trim();

  // Already valid hh:mm or h:mm
  if (/^\d{1,2}:\d{2}$/.test(s)) {
    const [hStr, mStr] = s.split(":");
    return (
      (Number.parseInt(hStr, 10) || 0) * 60 + (Number.parseInt(mStr, 10) || 0)
    );
  }

  // Pure numeric string
  if (/^\d+$/.test(s)) {
    const n = Number.parseInt(s, 10);
    if (s.length <= 2) {
      // 1–2 digits: treat as plain minutes (e.g. "90" → 90 min)
      return n;
    }
    // 3–4 digits: treat as hhmm (e.g. "800" → 08:00 → 480, "0800" → 08:00 → 480)
    const padded = s.padStart(4, "0");
    const h = Number.parseInt(padded.slice(0, -2), 10) || 0;
    const m = Number.parseInt(padded.slice(-2), 10) || 0;
    return h * 60 + m;
  }

  // Decimal hours (e.g. "1.5" → 90 min)
  if (/^\d+\.\d+$/.test(s)) {
    return Math.round(Number.parseFloat(s) * 60);
  }

  return 0;
}

/**
 * Returns today's date as "dd.mm.yyyy".
 */
export function todayDate(): string {
  const now = new Date();
  const day = String(now.getDate()).padStart(2, "0");
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const year = now.getFullYear();
  return `${day}.${month}.${year}`;
}

/**
 * Parse dd.mm.yyyy to a JS Date object.
 */
export function parseDate(dateStr: string): Date {
  if (/^\d{2}\.\d{2}\.\d{4}$/.test(dateStr)) {
    const [day, month, year] = dateStr.split(".");
    return new Date(Number(year), Number(month) - 1, Number(day));
  }
  return new Date(dateStr);
}

/**
 * Round minutes up to the nearest N minutes.
 * Example: roundUpTo(7, 5) → 10
 */
export function roundUpTo(minutes: number, step: number): number {
  if (step <= 0) return minutes;
  return Math.ceil(minutes / step) * step;
}

/**
 * Schweizer 5-Rappen-Rundung (kommerzielles Runden) für Rappen-Werte (bigint).
 *
 * Rundet einen ganzzahligen Rappen-Wert auf den nächsten 5-Rappen-Schritt,
 * wobei genau die Mitte (Rest 2 oder 3 vom unteren Schritt) nach OBEN rundet
 * (round half up, entspricht Math.round für positive Werte).
 *
 * Beispiele (Rappen):
 *   227659 → 227660   (Rest 4 → ab 3 aufrunden, hier 4 ≥ 3 → auf)
 *   1923   → 1925     (Rest 3 → Mitte → auf)
 *   1925   → 1925     (bereits auf Schritt)
 *   1927   → 1925     (Rest 2 vom OBEREN Schritt → abrunden)
 *   1928   → 1930     (Rest 3 vom OBEREN Schritt → aufrunden)
 *
 * Wird ausschliesslich für die ANZEIGE und den PDF-/Word-Export verwendet.
 * Die im Backend gespeicherten Rappen-Werte bleiben unverändert (exakt).
 */
export function roundTo5Rappen(rappen: bigint): bigint {
  if (rappen < 0n) return rappen;
  const step = 5n;
  const remainder = rappen % step;
  // Mitte ist bei 2.5; da wir ganzzahlig arbeiten, rundet Rest 0/1/2 ab,
  // Rest 3/4 auf. (Rest 2 wäre 2.5 von 5 → exakt Mitte → round half up → auf.
  // Aber 2 ist näher am unteren Schritt als am oberen: 2 < 2.5 → abrunden.
  // Rest 3 ist 3 von 5 → näher am oberen (Distanz 2) als am unteren (Distanz 3) → aufrunden.)
  if (remainder >= 3n) {
    return rappen + (step - remainder);
  }
  return rappen - remainder;
}

/**
 * Convenience: 5-Rappen-Rundung anwenden und dann formatCHF ausgeben.
 * Für Anzeige und Export; DB-Wert bleibt ungerundet.
 * `currency` ist optional und wird an formatCHF durchgereicht.
 */
export function formatCHFRounded(
  rappen: bigint | number,
  currency?: string,
): string {
  const r = typeof rappen === "bigint" ? rappen : BigInt(rappen);
  return formatCHF(roundTo5Rappen(r), currency);
}

/**
 * Resolve a mandate/invoice currency to a non-empty display symbol.
 *
 * Root Cause (Fix 10): Historisch war die App eine reine CHF-Anwendung; das
 * Datenmodell enthielt keine Währung pro Mandat/Rechnung, daher waren alle
 * Beträge und Labels implizit CHF. Mit der Einführung von `Mandat.waehrung`
 * und `Rechnung.waehrung` (CHF/EUR/USD) müssen UI-Labels und formatierte
 * Beträge die effektive Währung des Mandats/der Rechnung verwenden, nicht
 * mehr hart codiert "CHF". Dieser Helper normalisiert fehlende/leere Werte
 * sicher auf "CHF", sodass Aufrufer nie null/undefined prüfen müssen.
 *
 * Beispiel: currencySymbol("EUR") → "EUR"; currencySymbol(undefined) → "CHF".
 */
export function currencySymbol(currency?: string | null): string {
  return currency && currency.length > 0 ? currency : "CHF";
}

// ─── Fälligkeitsdatum (mirror of backend lib/rechnungen.mo) ──────────────────
//
// Diese drei Funktionen spiegeln die Backend-Logik aus
// src/backend/lib/rechnungen.mo BYTE-FÜR-BYTE: parseZahlungsbedingungenTage,
// addDays und resolveFaelligkeitsdatum. Sie sind die EINZIGE Stelle im
// Frontend, an der ein Fälligkeitsdatum berechnet wird — sowohl die
// Word-Vorschau (RechnungenPage.handlePreviewExport) als auch etwaige
// andere Frontend-Darstellungen ohne persistierten Wert nutzen diesen
// Resolver, sodass Vorschau und definitive createRechnung (Backend) für
// identische Eingaben identische Fälligkeitsdaten liefern.
//
// WICHTIG — es wird KEINE zweite Parsing-Logik eingeführt: dieser Parser
// ist eine 1:1-Portierung des bestehenden Backend-Parsers (erste
// Ziffernfolge, Fallback 30). Der Fallback 30 greift NUR, wenn der Text
// keine Ziffernfolge enthält (leer, "sofort", "bei Erhalt") — er ist
// bewusst konservativ und wird unverändert übernommen. Es gibt KEINEN
// Fallback auf das rechnungsdatum selbst und KEINEN Hardcode "+30" an
// Aufrufstellen.

/**
 * Parse die Anzahl Tage aus einem Zahlungsbedingungen-Text.
 *
 * Spiegelt backend `parseZahlungsbedingungenTage` exakt: extrahiert die
 * erste zusammenhängende Ziffernfolge und interpretiert sie als Tagesanzahl.
 * Der Scanner bricht am Ende der ersten Ziffernfolge ab (genau wie das
 * Backend mit `break`).
 *
 * Fallback 30 wird NUR zurückgegeben, wenn keine Ziffernfolge gefunden
 * wird (leerer Text, "sofort", "bei Erhalt"). Dieser Default ist bewusst
 * konservativ und wird transparent angewendet — dokumentiert, nicht
 * versteckt. Es gibt keinen Fallback auf 0 oder auf das rechnungsdatum.
 *
 * Beispiele (identisch zum Backend):
 *   "30 Tage netto"          → 30
 *   "Zahlbar innert 14 Tagen" → 14
 *   "10 days"                 → 10
 *   "Netto 30"                → 30
 *   ""                        → 30 (Fallback)
 *   "sofort"                  → 30 (Fallback)
 */
export function parseZahlungsbedingungenTage(
  zahlungsbedingungen: string,
): number {
  let value = 0;
  let inNumber = false;
  let found = false;
  for (const c of zahlungsbedingungen) {
    const isDigit = c >= "0" && c <= "9";
    if (isDigit) {
      const digit = c.charCodeAt(0) - "0".charCodeAt(0);
      value = value * 10 + digit;
      inNumber = true;
    } else if (inNumber) {
      // End of the first digit run — we have our number.
      found = true;
      break;
    }
  }
  return found || inNumber ? value : 30;
}

/**
 * Tage pro Monat mit korrekter Schaltjahr-Regel.
 * Spiegelt backend `daysInMonth` exakt (Gregorianische Schaltjahr-Regel:
 * Jahr durch 4 teilbar und nicht durch 100, ODER durch 400 teilbar).
 */
function daysInMonth(month: number, year: number): number {
  if (month === 2) {
    const leap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
    return leap ? 29 : 28;
  }
  if (month === 4 || month === 6 || month === 9 || month === 11) {
    return 30;
  }
  return 31;
}

/**
 * Addiert exakt `days` Tage zu einem ISO-Datum ("yyyy-mm-dd") und liefert
 * ein ISO-Datum zurück. Spiegelt backend `addDays` exakt: manueller
 * Tages-Overflow-Loop mit daysInMonth (Monats- und Jahresgrenzen,
 * Schaltjahre). Keine DST-/Zeitzonen-Einflüsse — reine Datumsarithmetik.
 *
 * Bei ungültigem Eingabedatum wird dieses unverändert zurückgegeben
 * (entspricht dem Backend `parseDate` → null → date-Fallback).
 *
 * Beispiele (identisch zum Backend):
 *   addDays("2026-08-13", 30) → "2026-09-12"
 *   addDays("2024-02-28", 1)  → "2024-02-29" (Schaltjahr)
 *   addDays("2023-02-28", 1)  → "2023-03-01" (kein Schaltjahr)
 *   addDays("2026-01-31", 30) → "2026-03-02"
 */
export function addDays(isoDate: string, days: number): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate);
  if (!m) return isoDate; // fallback: return unchanged (wie Backend)
  let year = Number(m[1]);
  let month = Number(m[2]);
  let day = Number(m[3]) + days;
  // Normalise the day overflow (identisch zum Backend-Loop)
  let keepGoing = true;
  while (keepGoing) {
    const dim = daysInMonth(month, year);
    if (day > dim) {
      day -= dim;
      month += 1;
      if (month > 12) {
        month = 1;
        year += 1;
      }
    } else {
      keepGoing = false;
    }
  }
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${year}-${pad(month)}-${pad(day)}`;
}

/**
 * Zentrale Resolver-Funktion für das Fälligkeitsdatum (Frontend-Spiegel
 * von backend `resolveFaelligkeitsdatum`).
 *
 * Berechnet faelligkeitsdatum = rechnungsdatum + tage, wobei `tage` aus
 * dem übergebenen zahlungsbedingungen-Text via parseZahlungsbedingungenTage
 * geparst wird. Es wird KEINE zweite Parsing-Logik und KEIN Hardcode
 * "+30" verwendet — ausschliesslich der bestehende (gespiegelte) Parser.
 *
 * Fallback-Verhalten (transparent, dokumentiert):
 * Enthält der zahlungsbedingungen-Text keine Ziffernfolge (z.B. leer,
 * "sofort", "bei Erhalt"), greift der bestehende Default von
 * parseZahlungsbedingungenTage = 30 Tage. Dieser Default ist bewusst
 * konservativ und wird unverändert übernommen — es gibt keinen Fallback
 * auf das rechnungsdatum selbst.
 *
 * Das Ergebnis ist für identische Eingaben BYTE-FÜR-BYTE identisch mit
 * dem Backend (z.B. "2026-08-13" + "Zahlbar innert 30 Tagen." →
 * "2026-09-12").
 *
 * `rechnungsdatum` muss ein ISO-Datum ("yyyy-mm-dd") sein; andere Formate
 * werden unverändert durchgereicht (Backend-Verhalten).
 */
export function resolveFaelligkeitsdatum(
  rechnungsdatum: string,
  zahlungsbedingungen: string,
): string {
  const tage = parseZahlungsbedingungenTage(zahlungsbedingungen);
  return addDays(rechnungsdatum, tage);
}
