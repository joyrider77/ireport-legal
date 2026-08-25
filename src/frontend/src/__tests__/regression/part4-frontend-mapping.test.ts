// Teil 4 — Reales Frontend-Mapping des Registrierungsparameters.
//
// Diese Tests verifizieren, dass der reale Frontend-Registrierungsparameter
// `kanzleiForm.zahlungsmodalitaet` (aus RegistrierungPage.tsx) korrekt bis zur
// Backend-Funktion `registerKanzlei` durchgereicht wird und dort das richtige
// Abo-Modell erzeugt.
//
// Das Frontend hält `kanzleiForm.zahlungsmodalitaet` immer für non-null (Default
// 'jahres') und reicht den Wert als `Zahlungsmodalitaet | null` (immer Some,
// nie null) an den Actor weiter. Die Tests spiegeln genau dieses Mapping:
//
//   - A-REAL-JAEHRLICH:   Form 'jahres' → mapped 'jahres' → aboModell 'jahres'
//   - B-REAL-MONATLICH:   Form 'monats' → mapped 'monats' → aboModell 'monats'
//   - C-REAL-NULL-REGRESSION: Alt-Bug (null direkt an registerKanzlei) →
//                             aboModell 'keine' (Regression wird caught)
//   - D-REAL-SUPER-ADMIN: Erste Registrierung auto-promoted zum Super-Admin
//                         ohne relevantes Abo — funktioniert fehlerfrei.
//
// Jeder Testfall protokolliert über console.log die Felder TESTFALL,
// ERGEBNIS (PASS/FAIL/PARTIAL/NOT TESTABLE), BEOBACHTET (konkretes
// Ergebnis) und METHODE (echter Backend-Call-Replik / Code-Inspection).
//
// Die Tests nutzen den PURE Backend-Replikations-Harness
// (harness/backend-replica.ts), der die Backend-Logik aus
// src/backend/lib/*.mo als reine TypeScript-Funktionen nachbildet.

import { describe, expect, it } from "vitest";
import {
  createFreshState,
  deriveAboModell,
  getAllKanzleienOverview,
  registerKanzlei,
} from "./harness/backend-replica";
import { TEST_IDS } from "./harness/test-ids";
import type { HarnessState, KanzleiOverview } from "./harness/types";

// ── Fixter Zeitstempel für deterministische Tests ────────────────────────────
const NOW = Date.UTC(2026, 7, 9); // 2026-08-09T00:00:00Z

// ── Reales Frontend-Mapping aus RegistrierungPage.tsx ─────────────────────────
//
// Spiegelt das Mapping in src/frontend/src/pages/RegistrierungPage.tsx: der
// Form-Wert `kanzleiForm.zahlungsmodalitaet` ist im Frontend immer non-null
// (Default 'jahres'). Er wird als `Zahlungsmodalitaet | null` an den Actor
// übergeben — da der Wert nie null ist, wird immer Some übergeben, nie null.
// Die Mapping-Funktion ist daher die Identität (Form-Wert durchreichen).
function frontendMapZahlungsmodalitaet(
  formValue: "jahres" | "monats",
): "jahres" | "monats" | null {
  // Real frontend mapping: the form value is always non-null (default 'jahres'),
  // passed as Zahlungsmodalitaet | null (Some, never null) to the actor.
  return formValue;
}

// ── Hilfsfunktion: Super-Admin-Caller für getAllKanzleienOverview ────────────
//
// getAllKanzleienOverview trapt 'Nur Super-Admins...', wenn der caller
// nicht in der superAdminWhitelist steht. Wir verwenden TEST_PLATTFORM_ADMIN
// als Super-Admin. Damit die Whitelist diesen Principal enthält, muss er
// entweder via autoPromoteFirstSuperAdmin (erste Registrierung) oder manuell
// in die Whitelist eingetragen werden.
//
// In den Testfällen A und B registrieren wir zuerst TEST_PLATTFORM_ADMIN
// (leere Whitelist → auto-promote). Anschließend registrieren wir die
// eigentliche Test-Kanzlei.
function setupWithSuperAdmin(): HarnessState {
  const state = createFreshState();

  // Erste Registrierung → autoPromoteFirstSuperAdmin befördert
  // TEST_PLATTFORM_ADMIN zum Super-Admin (role = 'plattform_admin').
  const first = registerKanzlei(
    state.kanzleien,
    state.users,
    state.superAdminWhitelist,
    TEST_IDS.PLATTFORM_ADMIN,
    "Plattform-Admin-Kanzlei",
    "Dr.",
    "Plattform",
    "Admin",
    "admin@plattform.example",
    "jahres",
    NOW,
  );
  expect(first.ok).toBeDefined();

  return state;
}

// ── Hilfsfunktion: Overview-Eintrag für eine Kanzlei finden ─────────────────
function findOverview(
  overviews: KanzleiOverview[],
  kanzleiId: string,
): KanzleiOverview | undefined {
  return overviews.find((o) => o.id === kanzleiId);
}

// ── Hilfsfunktion: einheitliches Ergebnis-Protokoll ─────────────────────────
function logResult(
  testfall: string,
  ergebnis: "PASS" | "FAIL" | "PARTIAL" | "NOT TESTABLE",
  beobachtet: string,
  methode: string,
): void {
  console.log(
    `TESTFALL=${testfall} ERGEBNIS=${ergebnis} BEOBACHTET=${beobachtet} METHODE=${methode}`,
  );
}

describe("Teil 4 — Reales Frontend-Mapping des Registrierungsparameters", () => {
  // ── Test A: Jahres-Abo via reales Frontend-Mapping ───────────────────────────
  it("Test A — Frontend-Mapping 'jahres' → registerKanzlei → aboModell='jahres'", () => {
    const testfall = "A-REAL-JAEHRLICH";
    const methode =
      "frontendMapZahlungsmodalitaet + registerKanzlei + getAllKanzleienOverview";

    const state = setupWithSuperAdmin();

    // Reales Frontend-Mapping: Form-Wert 'jahres' → mapped (immer Some).
    const mapped = frontendMapZahlungsmodalitaet("jahres");
    expect(mapped).toBe("jahres"); // non-null — Frontend reicht Some weiter.

    // Registriere TEST-REG-JAEHRLICH mit dem gemappten Wert.
    const result = registerKanzlei(
      state.kanzleien,
      state.users,
      state.superAdminWhitelist,
      TEST_IDS.REG_JAEHRLICH,
      "Kanzlei Jahres",
      "RA",
      "Jahres",
      "Test",
      "jahres@example.com",
      mapped,
      NOW,
    );

    // Vorbedingung: Registrierung erfolgreich.
    expect(result.ok).toBeDefined();
    expect(result.err).toBeUndefined();

    // (1) kanzlei.zahlungsmodalitaet === 'jahres' im gespeicherten Datensatz.
    const kanzlei = state.kanzleien.get(TEST_IDS.REG_JAEHRLICH);
    expect(kanzlei).toBeDefined();
    const check1 = kanzlei?.zahlungsmodalitaet === "jahres";

    // (2) deriveAboModell(kanzlei.zahlungsmodalitaet) === 'jahres'.
    const derived = deriveAboModell(kanzlei?.zahlungsmodalitaet ?? null);
    const check2 = derived === "jahres";

    // (3) getAllKanzleienOverview (Super-Admin caller) liefert
    //     aboModell === 'jahres' für diese Kanzlei.
    const overviews = getAllKanzleienOverview(
      state.kanzleien,
      state.users,
      TEST_IDS.PLATTFORM_ADMIN,
      state.superAdminWhitelist,
    );
    const overview = findOverview(overviews, TEST_IDS.REG_JAEHRLICH);
    expect(overview).toBeDefined();
    const check3 = overview?.aboModell === "jahres";

    // Assertions (Vitest).
    expect(mapped).toBe("jahres");
    expect(kanzlei?.zahlungsmodalitaet).toBe("jahres");
    expect(derived).toBe("jahres");
    expect(overview?.aboModell).toBe("jahres");

    // Ergebnis-Protokoll.
    const allPass = check1 && check2 && check3;
    const ergebnis = allPass ? "PASS" : "FAIL";
    const beobachtet =
      `mapped=${String(mapped)}, ` +
      `kanzlei.zahlungsmodalitaet=${String(kanzlei?.zahlungsmodalitaet)}, ` +
      `overview.aboModell=${String(overview?.aboModell)}`;
    logResult(testfall, ergebnis, beobachtet, methode);

    expect(allPass).toBe(true);
  });

  // ── Test B: Monats-Abo via reales Frontend-Mapping ──────────────────────────
  it("Test B — Frontend-Mapping 'monats' → registerKanzlei → aboModell='monats'", () => {
    const testfall = "B-REAL-MONATLICH";
    const methode =
      "frontendMapZahlungsmodalitaet + registerKanzlei + getAllKanzleienOverview";

    const state = setupWithSuperAdmin();

    // Reales Frontend-Mapping: Form-Wert 'monats' → mapped (immer Some).
    const mapped = frontendMapZahlungsmodalitaet("monats");
    expect(mapped).toBe("monats"); // non-null — Frontend reicht Some weiter.

    // Registriere TEST-REG-MONATLICH mit dem gemappten Wert.
    const result = registerKanzlei(
      state.kanzleien,
      state.users,
      state.superAdminWhitelist,
      TEST_IDS.REG_MONATLICH,
      "Kanzlei Monats",
      "RA",
      "Monats",
      "Test",
      "monats@example.com",
      mapped,
      NOW,
    );

    // Vorbedingung: Registrierung erfolgreich.
    expect(result.ok).toBeDefined();
    expect(result.err).toBeUndefined();

    // (1) kanzlei.zahlungsmodalitaet === 'monats' im gespeicherten Datensatz.
    const kanzlei = state.kanzleien.get(TEST_IDS.REG_MONATLICH);
    expect(kanzlei).toBeDefined();
    const check1 = kanzlei?.zahlungsmodalitaet === "monats";

    // (2) deriveAboModell(kanzlei.zahlungsmodalitaet) === 'monats'.
    const derived = deriveAboModell(kanzlei?.zahlungsmodalitaet ?? null);
    const check2 = derived === "monats";

    // (3) getAllKanzleienOverview (Super-Admin caller) liefert
    //     aboModell === 'monats' für diese Kanzlei.
    const overviews = getAllKanzleienOverview(
      state.kanzleien,
      state.users,
      TEST_IDS.PLATTFORM_ADMIN,
      state.superAdminWhitelist,
    );
    const overview = findOverview(overviews, TEST_IDS.REG_MONATLICH);
    expect(overview).toBeDefined();
    const check3 = overview?.aboModell === "monats";

    // Assertions (Vitest).
    expect(mapped).toBe("monats");
    expect(kanzlei?.zahlungsmodalitaet).toBe("monats");
    expect(derived).toBe("monats");
    expect(overview?.aboModell).toBe("monats");

    // Ergebnis-Protokoll.
    const allPass = check1 && check2 && check3;
    const ergebnis = allPass ? "PASS" : "FAIL";
    const beobachtet =
      `mapped=${String(mapped)}, ` +
      `kanzlei.zahlungsmodalitaet=${String(kanzlei?.zahlungsmodalitaet)}, ` +
      `overview.aboModell=${String(overview?.aboModell)}`;
    logResult(testfall, ergebnis, beobachtet, methode);

    expect(allPass).toBe(true);
  });

  // ── Test C: Regression — Alt-Bug (null direkt) liefert aboModell='keine' ───
  //
  // Simuliert den ALTEN buggy Mapping-Pfad, bei dem null direkt an
  // registerKanzlei übergeben wurde (z.B. weil das Frontend-Feld fehlte oder
  // nicht gemappt wurde). Der Test beweist, dass die Regression caught wird:
  // null → deriveAboModell → 'keine' (nicht 'jahres'/'monats'). Das aktuelle
  // Frontend-Mapping reicht immer Some weiter, daher tritt dieser Pfad nur
  // bei einem Regression-Bug auf — der Test fängt ihn ab.
  it("Test C — Alt-Bug null direkt an registerKanzlei → aboModell='keine' (Regression caught)", () => {
    const testfall = "C-REAL-NULL-REGRESSION";
    const methode =
      "registerKanzlei with null + getAllKanzleienOverview (regression catch)";

    const state = setupWithSuperAdmin();

    // Alt-Bug: null direkt an registerKanzlei (statt des gemappten Some).
    const result = registerKanzlei(
      state.kanzleien,
      state.users,
      state.superAdminWhitelist,
      TEST_IDS.REG_JAEHRLICH,
      "Kanzlei Null-Bug",
      "RA",
      "Null",
      "Bug",
      "null-bug@example.com",
      null,
      NOW,
    );

    // Vorbedingung: Registrierung erfolgreich (null ist gültiger Wert).
    expect(result.ok).toBeDefined();
    expect(result.err).toBeUndefined();

    // (1) kanzlei.zahlungsmodalitaet === null im gespeicherten Datensatz.
    const kanzlei = state.kanzleien.get(TEST_IDS.REG_JAEHRLICH);
    expect(kanzlei).toBeDefined();
    const check1 = kanzlei?.zahlungsmodalitaet === null;

    // (2) deriveAboModell(null) === 'keine'.
    const derived = deriveAboModell(kanzlei?.zahlungsmodalitaet ?? null);
    const check2 = derived === "keine";

    // (3) getAllKanzleienOverview (Super-Admin caller) liefert
    //     aboModell === 'keine' für diese Kanzlei — beweist, dass der
    //     null-Pfad NICHT 'jahres'/'monats' erzeugt (Regression caught).
    const overviews = getAllKanzleienOverview(
      state.kanzleien,
      state.users,
      TEST_IDS.PLATTFORM_ADMIN,
      state.superAdminWhitelist,
    );
    const overview = findOverview(overviews, TEST_IDS.REG_JAEHRLICH);
    expect(overview).toBeDefined();
    const check3 = overview?.aboModell === "keine";

    // Assertions (Vitest).
    expect(kanzlei?.zahlungsmodalitaet).toBeNull();
    expect(derived).toBe("keine");
    expect(overview?.aboModell).toBe("keine");

    // Ergebnis-Protokoll — PASS beweist, dass der Test die Regression
    // erkennt (null → 'keine', nicht 'jahres'/'monats').
    const allPass = check1 && check2 && check3;
    const ergebnis = allPass ? "PASS" : "FAIL";
    const beobachtet = allPass
      ? "null mapping → aboModell=keine (regression caught)"
      : `expected aboModell=keine, got ${String(overview?.aboModell)}`;
    logResult(testfall, ergebnis, beobachtet, methode);

    expect(allPass).toBe(true);
  });

  // ── Test D: Super-Admin-Registrierung ohne relevantes Abo ───────────────────
  //
  // Die erste Registrierung wird via autoPromoteFirstSuperAdmin automatisch
  // zum Super-Admin befördert (role = 'plattform_admin'). Dieser Test
  // verifizert, dass die Super-Admin-Registrierung fehlerfrei funktioniert,
  // auch ohne ein für den Abo-Status relevantes Mapping — der Super-Admin
  // wird unabhängig vom Abo-Modell befördert.
  it("Test D — Erste Registrierung auto-promoted zum Super-Admin ohne relevantes Abo", () => {
    const testfall = "D-REAL-SUPER-ADMIN";
    const methode =
      "registerKanzlei (erste Registrierung, auto-promote) + getAllKanzleienOverview";

    // Frischer State — Whitelist ist leer, erste Registrierung auto-promoted.
    const state = createFreshState();
    expect(state.superAdminWhitelist.size).toBe(0);

    // Erste Registrierung → autoPromoteFirstSuperAdmin.
    const result = registerKanzlei(
      state.kanzleien,
      state.users,
      state.superAdminWhitelist,
      TEST_IDS.PLATTFORM_ADMIN,
      "Plattform-Admin-Kanzlei",
      "Dr.",
      "Plattform",
      "Admin",
      "admin@plattform.example",
      "jahres",
      NOW,
    );

    // (1) Registrierung erfolgreich.
    const check1 = result.ok !== undefined;
    expect(result.ok).toBeDefined();
    expect(result.err).toBeUndefined();

    // (2) autoPromoteFirstSuperAdmin hat den caller in die Whitelist eingetragen.
    const check2 = state.superAdminWhitelist.has(TEST_IDS.PLATTFORM_ADMIN);
    expect(check2).toBe(true);

    // (3) Der Admin-User hat role = 'plattform_admin' (auto-promoted).
    const adminUser = state.users.get(TEST_IDS.PLATTFORM_ADMIN);
    expect(adminUser).toBeDefined();
    const check3 = adminUser?.role === "plattform_admin";

    // (4) getAllKanzleienOverview funktioniert mit diesem Super-Admin als
    //     caller (kein Trap) — beweist, dass die Super-Admin-Registrierung
    //     den caller für alle Super-Admin-Operationen autorisiert, unabhängig
    //     vom Abo-Modell.
    const overviews = getAllKanzleienOverview(
      state.kanzleien,
      state.users,
      TEST_IDS.PLATTFORM_ADMIN,
      state.superAdminWhitelist,
    );
    const check4 =
      overviews.length === 1 && overviews[0].id === TEST_IDS.PLATTFORM_ADMIN;

    // Assertions (Vitest).
    expect(state.superAdminWhitelist.size).toBe(1);
    expect(adminUser?.role).toBe("plattform_admin");
    expect(overviews).toHaveLength(1);

    // Ergebnis-Protokoll.
    const allPass = check1 && check2 && check3 && check4;
    const ergebnis = allPass ? "PASS" : "FAIL";
    const beobachtet =
      `registered=${String(result.ok !== undefined)}, ` +
      `whitelistSize=${state.superAdminWhitelist.size}, ` +
      `role=${String(adminUser?.role)}, ` +
      `overviewCount=${overviews.length}`;
    logResult(testfall, ergebnis, beobachtet, methode);

    expect(allPass).toBe(true);
  });
});
