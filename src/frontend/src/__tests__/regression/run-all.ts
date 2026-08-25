// run-all.ts — Einstiegspunkt der alle Regressionstests ausführt und eine
// strukturierte Zusammenfassung ausgibt.
//
// Aufruf:
//   pnpm exec tsx src/__tests__/regression/run-all.ts
//   npx tsx src/__tests__/regression/run-all.ts
//   node --experimental-strip-types src/__tests__/regression/run-all.ts
//
// Fallback (wenn tsx nicht verfügbar): das Skript ist reines Node.js und
// nutzt nur child_process + fs. Es kann direkt mit Node (>= 22 mit
// --experimental-strip-types, >= 24 nativ) ausgeführt werden.
//
// Vorgehen:
//   1. `pnpm test` (vitest run) via child_process.execSync ausführen.
//   2. stdout/stderr erfassen und die strukturierten TESTFALL=... Zeilen
//      parsen, die jeder Testfall via console.log ausgibt.
//   3. Zwei Log-Formate unterstützen:
//      (a) Teil 1 + Teil 2 (Security): "TESTFALL=X ERGEBNIS=PASS BEOBACHTET=... METHODE=..."
//          — Schlüssel/Werte durch Leerzeichen getrennt.
//      (b) Teil 2.6 (Audit): "TESTFALL=2.6.a ... | ERGEBNIS=PASS | BEOBACHTET=... | METHODE=..."
//          — Segmente durch " | " getrennt.
//   4. Zusammenfassungstabelle (TESTFALL, ERGEBNIS, BEOBACHTET, METHODE)
//      und Gesamtzusammenfassung (X/14 PASS, Y FAIL, Z NOT TESTABLE) drucken.
//   5. Exit-Code 0 wenn kein FAIL, sonst 1.

import { execSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// ── Typen ────────────────────────────────────────────────────────────────────
type Ergebnis = "PASS" | "FAIL" | "PARTIAL" | "NOT TESTABLE";

interface TestfallErgebnis {
  testfall: string;
  ergebnis: Ergebnis;
  beobachtet: string;
  methode: string;
}

// ── Erwartete Testfälle (für Vollständigkeits-Check) ──────────────────────────
// Reihenfolge wie in der Anforderung vorgegeben: Teil 1 (A, B, C) + Guard,
// Teil 2 (2.1–2.5), Teil 2.6 (a–e), Teil 3 (A–E Tenant-Cascade),
// Teil 4 (A–D reales Frontend-Mapping), Teil 5 (C–G Vorlagen-Editor).
const ERWARTETE_TESTFALL_IDS: string[] = [
  "A-JAEHRLICH",
  "B-MONATLICH",
  "C-KEINE",
  "GUARD-NON-SUPER-ADMIN",
  "2.1-CROSS-TENANT",
  "2.2-ROLLENCHECK",
  "2.3-USER-DEACTIVATED",
  "2.4-KANZLEI-DEACTIVATED",
  "2.5-PLATTFORM-ADMIN",
  "2.6.a",
  "2.6.b",
  "2.6.c",
  "2.6.d",
  "2.6.e",
  "A-TENANT-ISOLATION",
  "B-PLATTFORM-ADMIN-ISOLATION",
  "C-CASCADE-DELETE",
  "D-ORPHAN-COUNT",
  "E-DEACTIVATE-UNCHANGED",
  // Teil 4 — Reales Frontend-Mapping des Registrierungsparameters.
  "A-REAL-JAEHRLICH",
  "B-REAL-MONATLICH",
  "C-REAL-NULL-REGRESSION",
  "D-REAL-SUPER-ADMIN",
  // Teil 5 — Vorlagen-Editor (Drag&Drop, Touch/Pointer, Toggle, Isolation, Migration).
  "C-DRAG-DROP-PERSIST",
  "D-TOUCH-POINTER",
  "E-ELEMENT-TOGGLE",
  "F-TENANT-ISOLATION",
  "G-MIGRATION",
];

// ── ANSI-Escape-Sequenzen entfernen ──────────────────────────────────────────
// vitest färbt stdout ein und stellt Zeilen wie
//   "stdout | src/__tests__/regression/part1-abo-modell.test.ts > Teil 1 > Test A"
// voran. Wir entfernen ANSI-Codes und ignorieren diese Präfix-Zeilen.
const ANSI_RE = new RegExp(`${String.fromCharCode(27)}\\[[0-9;]*m`, "g");

// ── Parser: eine Log-Zeile in TestfallErgebnis umwandeln ─────────────────────
// Unterstützt beide Formate:
//   (a) Leerzeichen-getrennt:  TESTFALL=X ERGEBNIS=PASS BEOBACHTET=... METHODE=...
//   (b) Pipe-getrennt:         TESTFALL=2.6.a ... | ERGEBNIS=PASS | BEOBACHTET=... | METHODE=...
//
// BEOBACHTET und METHODE können selbst Leerzeichen oder "=" enthalten, daher
// extrahieren wir sie als "Rest nach dem Schlüssel".
function parseLogLine(raw: string): TestfallErgebnis | null {
  const line = raw.replace(ANSI_RE, "").trim();
  if (!line.startsWith("TESTFALL=")) return null;

  // Format (b): Pipe-getrennt (Teil 2.6).
  if (line.includes(" | ERGEBNIS=") || line.includes("| ERGEBNIS=")) {
    return parsePipeFormat(line);
  }

  // Format (a): Leerzeichen-getrennt (Teil 1 + Teil 2 Security).
  return parseSpaceFormat(line);
}

// ── Parser: Pipe-Format (Teil 2.6) ───────────────────────────────────────────
// Beispiel:
//   TESTFALL=2.6.a Monotone/eindeutige Audit-IDs | ERGEBNIS=PASS | BEOBACHTET=IDs=... | METHODE=logAuditEntry 5x ...
function parsePipeFormat(line: string): TestfallErgebnis | null {
  const segments = line.split("|").map((s) => s.trim());
  // segments[0] = "TESTFALL=2.6.a Monotone/eindeutige Audit-IDs"
  // segments[1] = "ERGEBNIS=PASS"
  // segments[2] = "BEOBACHTET=IDs=..."
  // segments[3] = "METHODE=logAuditEntry 5x ..."
  if (segments.length < 4) return null;

  const testfallRaw = segments[0];
  const ergebnisRaw = segments[1];
  const beobachtetRaw = segments[2];
  const methodeRaw = segments.slice(3).join(" | ").trim();

  const testfall = extractValueAfterKey(testfallRaw, "TESTFALL");
  const ergebnisStr = extractValueAfterKey(ergebnisRaw, "ERGEBNIS");
  const beobachtet = extractValueAfterKey(beobachtetRaw, "BEOBACHTET");
  const methode = extractValueAfterKey(methodeRaw, "METHODE");

  if (!testfall || !ergebnisStr) return null;

  const ergebnis = normalizeErgebnis(ergebnisStr);
  if (!ergebnis) return null;

  return { testfall, ergebnis, beobachtet, methode };
}

// ── Parser: Leerzeichen-Format (Teil 1 + Teil 2 Security) ───────────────────
// Beispiel:
//   TESTFALL=A-JAEHRLICH ERGEBNIS=PASS BEOBACHTET=kanzlei.zahlungsmodalitaet=jahres, ... METHODE=echter Backend-Call-Replik (...)
//
// Strategie: Wir finden die Positionen der Schlüsselmarker ERGEBNIS=,
// BEOBACHTET= und METHODE= und schneiden die Werte dazwischen aus.
function parseSpaceFormat(line: string): TestfallErgebnis | null {
  const idxErgebnis = line.indexOf(" ERGEBNIS=");
  const idxBeobachtet = line.indexOf(" BEOBACHTET=");
  const idxMethode = line.indexOf(" METHODE=");

  if (idxErgebnis === -1 || idxBeobachtet === -1 || idxMethode === -1) {
    return null;
  }
  if (idxBeobachtet <= idxErgebnis || idxMethode <= idxBeobachtet) {
    return null;
  }

  const testfall = line.slice("TESTFALL=".length, idxErgebnis).trim();
  const ergebnisStr = line
    .slice(idxErgebnis + " ERGEBNIS=".length, idxBeobachtet)
    .trim();
  const beobachtet = line
    .slice(idxBeobachtet + " BEOBACHTET=".length, idxMethode)
    .trim();
  const methode = line.slice(idxMethode + " METHODE=".length).trim();

  if (!testfall || !ergebnisStr) return null;

  const ergebnis = normalizeErgebnis(ergebnisStr);
  if (!ergebnis) return null;

  return { testfall, ergebnis, beobachtet, methode };
}

// ── Hilfsfunktion: Wert nach "KEY=" extrahieren ──────────────────────────────
function extractValueAfterKey(segment: string, key: string): string {
  const prefix = `${key}=`;
  const idx = segment.indexOf(prefix);
  if (idx === -1) return "";
  return segment.slice(idx + prefix.length).trim();
}

// ── Hilfsfunktion: Ergebnis normalisieren ────────────────────────────────────
function normalizeErgebnis(raw: string): Ergebnis | null {
  const upper = raw.trim().toUpperCase();
  if (upper === "PASS") return "PASS";
  if (upper === "FAIL") return "FAIL";
  if (upper === "PARTIAL") return "PARTIAL";
  if (upper === "NOT TESTABLE" || upper === "NOT_TESTABLE") {
    return "NOT TESTABLE";
  }
  return null;
}

// ── Vitest ausführen ──────────────────────────────────────────────────────────
// Wir rufen `pnpm test` (vitest run) auf und erfassen stdout+stderr.
// execSync wirft bei Exit-Code != 0 — wir fangen das ab, weil ein FAIL
// Exit-Code 1 liefert, wir aber trotzdem die Zusammenfassung drucken wollen.
function runVitest(): { stdout: string; stderr: string; exitCode: number } {
  const cmd = "pnpm test";
  let stdout = "";
  let stderr = "";
  let exitCode = 0;

  try {
    // stdio: pipe → Ausgaben werden zurückgegeben, nicht direkt auf console.
    const out = execSync(`${cmd} 2>&1`, {
      cwd: resolve(dirname(fileURLToPath(import.meta.url)), "../../.."),
      encoding: "utf-8",
      maxBuffer: 10 * 1024 * 1024,
      stdio: ["ignore", "pipe", "pipe"],
    });
    stdout = out;
  } catch (e: unknown) {
    const err = e as { stdout?: string; stderr?: string; status?: number };
    stdout = err.stdout ?? "";
    stderr = err.stderr ?? "";
    exitCode = err.status ?? 1;
  }

  return { stdout, stderr, exitCode };
}

// ── Ausgabe: Zusammenfassungstabelle ─────────────────────────────────────────
function printTable(results: TestfallErgebnis[]): void {
  // Spaltenbreiten berechnen (mit Mindestbreiten).
  const wTestfall = Math.max(
    "TESTFALL".length,
    ...results.map((r) => r.testfall.length),
  );
  const wErgebnis = Math.max(
    "ERGEBNIS".length,
    ...results.map((r) => r.ergebnis.length),
  );
  // BEOBACHTET und METHODE können sehr lang sein — wir kürzen in der
  // Tabellenansicht auf eine Maximalbreite und drucken die vollen Werte
  // danach als Liste.
  const maxBeob = 80;
  const maxMeth = 60;

  const sep = `+${"-".repeat(wTestfall + 2)}+${"-".repeat(wErgebnis + 2)}+${"-".repeat(maxBeob + 2)}+${"-".repeat(maxMeth + 2)}+`;
  const header = `| ${pad("TESTFALL", wTestfall)} | ${pad("ERGEBNIS", wErgebnis)} | ${pad("BEOBACHTET", maxBeob)} | ${pad("METHODE", maxMeth)} |`;

  console.log("\n=== Zusammenfassungstabelle ===\n");
  console.log(sep);
  console.log(header);
  console.log(sep);

  for (const r of results) {
    const beob = truncate(r.beobachtet, maxBeob);
    const meth = truncate(r.methode, maxMeth);
    console.log(
      `| ${pad(r.testfall, wTestfall)} | ${pad(r.ergebnis, wErgebnis)} | ${pad(beob, maxBeob)} | ${pad(meth, maxMeth)} |`,
    );
  }
  console.log(sep);

  // Vollständige BEOBACHTET/METHODE für jede Zeile (ungekürzt).
  console.log("\n--- Vollständige Beobachtungen ---\n");
  for (const r of results) {
    console.log(`[${r.testfall}] (${r.ergebnis})`);
    console.log(`  BEOBACHTET: ${r.beobachtet}`);
    console.log(`  METHODE:    ${r.methode}`);
    console.log();
  }
}

// ── Hilfsfunktion: String auf feste Breite auffüllen ─────────────────────────
function pad(s: string, width: number): string {
  if (s.length >= width) return s.slice(0, width);
  return s + " ".repeat(width - s.length);
}

// ── Hilfsfunktion: String kürzen mit Ellipse ─────────────────────────────────
function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return `${s.slice(0, max - 1)}…`;
}

// ── Ausgabe: Gesamtzusammenfassung ───────────────────────────────────────────
function printSummary(results: TestfallErgebnis[]): {
  pass: number;
  fail: number;
  partial: number;
  notTestable: number;
  total: number;
} {
  const pass = results.filter((r) => r.ergebnis === "PASS").length;
  const fail = results.filter((r) => r.ergebnis === "FAIL").length;
  const partial = results.filter((r) => r.ergebnis === "PARTIAL").length;
  const notTestable = results.filter(
    (r) => r.ergebnis === "NOT TESTABLE",
  ).length;
  const total = results.length;

  console.log("=== Gesamtzusammenfassung ===\n");
  console.log(`  PASS:         ${pass}`);
  console.log(`  FAIL:         ${fail}`);
  console.log(`  PARTIAL:      ${partial}`);
  console.log(`  NOT TESTABLE: ${notTestable}`);
  console.log(`  GESAMT:       ${total}`);
  console.log(
    `\n  ${pass}/${total} Tests PASS, ${fail} FAIL, ${notTestable} NOT TESTABLE`,
  );

  return { pass, fail, partial, notTestable, total };
}

// ── Vollständigkeits-Check: alle erwarteten Testfälle vorhanden? ─────────────
function checkCompleteness(results: TestfallErgebnis[]): string[] {
  const found = new Set(results.map((r) => r.testfall));
  const missing: string[] = [];
  for (const id of ERWARTETE_TESTFALL_IDS) {
    // Teil 2.6-IDs können als "2.6.a Monotone/..." geloggt werden — wir
    // matchen auf den Start des Testfall-Strings.
    const match = results.some(
      (r) => r.testfall === id || r.testfall.startsWith(`${id} `),
    );
    if (!match && !found.has(id)) {
      missing.push(id);
    }
  }
  return missing;
}

// ── Hauptfunktion ────────────────────────────────────────────────────────────
function main(): void {
  console.log("=== Regressionstest-Runner ===\n");
  console.log(
    "Führe alle Regressionstests via `pnpm test` (vitest run) aus ...\n",
  );

  const { stdout, stderr, exitCode } = runVitest();

  // Wenn vitest selbst fehlschlägt (z.B. keine Tests gefunden), stderr
  // ausgeben und abbrechen.
  if (!stdout && stderr) {
    console.error("FEHLER: vitest hat keine Ausgabe geliefert.\n");
    console.error(stderr);
    process.exit(2);
  }

  // Log-Zeilen parsen. Wir iterieren über alle Zeilen in stdout (vitest
  // leitet die console.log-Ausgaben der Tests weiter).
  const lines = stdout.split("\n");
  const results: TestfallErgebnis[] = [];
  const seen = new Set<string>();

  for (const line of lines) {
    const parsed = parseLogLine(line);
    if (parsed) {
      // Deduplikation: falls dieselbe Zeile mehrfach auftaucht (z.B. durch
      // vitest-Reporter-Quoting), nur die erste Instanz behalten.
      const key = `${parsed.testfall}::${parsed.ergebnis}`;
      if (!seen.has(key)) {
        seen.add(key);
        results.push(parsed);
      }
    }
  }

  // Vollständigkeits-Check.
  const missing = checkCompleteness(results);
  if (missing.length > 0) {
    console.log(
      `WARNUNG: ${missing.length} erwartete Testfälle nicht in der Ausgabe gefunden:`,
    );
    for (const id of missing) {
      console.log(`  - ${id}`);
    }
    console.log();
  }

  // Tabelle drucken.
  printTable(results);

  // Gesamtzusammenfassung.
  const summary = printSummary(results);

  // JSON-Report in die Ausgabe schreiben (für maschinelle Weiterverarbeitung).
  const scriptDir = dirname(fileURLToPath(import.meta.url));
  const reportPath = resolve(scriptDir, "run-all-report.json");
  const report = {
    timestamp: new Date().toISOString(),
    exitCode,
    summary,
    missing,
    results,
  };
  try {
    writeFileSync(reportPath, JSON.stringify(report, null, 2), "utf-8");
    console.log(`\nJSON-Report geschrieben: ${reportPath}`);
  } catch {
    // Nicht kritisch — ignorieren.
  }

  // Exit-Code: 0 wenn kein FAIL, sonst 1. NOT TESTABLE gilt nicht als FAIL.
  const hasFail = summary.fail > 0;
  process.exit(hasFail ? 1 : 0);
}

main();
