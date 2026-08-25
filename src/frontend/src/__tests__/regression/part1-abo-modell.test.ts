// Teil 1 — Abo-Modell aus Registrierung (Regressionstests).
//
// Diese Tests verifizieren, dass das Abo-Modell korrekt aus der
// Zahlungsmodalität bei der Kanzlei-Registrierung abgeleitet wird:
//   - 'jahres' → AboModell 'jahres'
//   - 'monats' → AboModell 'monats'
//   - null     → AboModell 'keine' (Alt-Kanzlei ohne Zahlungsmodalität)
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
  TRAP_MESSAGES,
  createFreshState,
  deriveAboModell,
  getAllKanzleienOverview,
  registerKanzlei,
} from "./harness/backend-replica";
import { TEST_IDS } from "./harness/test-ids";
import type { HarnessState, KanzleiOverview } from "./harness/types";

// ── Fixter Zeitstempel für deterministische Tests ────────────────────────────
const NOW = Date.UTC(2026, 7, 9); // 2026-08-09T00:00:00Z

// ── Hilfsfunktion: Super-Admin-Caller für getAllKanzleienOverview ────────────
//
// getAllKanzleienOverview trapt 'Nur Super-Admins...', wenn der caller
// nicht in der superAdminWhitelist steht. Wir verwenden TEST_PLATTFORM_ADMIN
// als Super-Admin. Damit die Whitelist diesen Principal enthält, muss er
// entweder via autoPromoteFirstSuperAdmin (erste Registrierung) oder
// manuell in die Whitelist eingetragen werden.
//
// In den Testfällen A und B registrieren wir zuerst TEST_PLATTFORM_ADMIN
// (leere Whitelist → auto-promote). Anschließend registrieren wir die
// eigentliche Test-Kanzlei. Für Testfall C (Alt-Kanzlei ohne
// Zahlungsmodalität) legen wir die Kanzlei direkt im State an, ohne
// registerKanzlei aufzurufen — daher stellen wir sicher, dass
// TEST_PLATTFORM_ADMIN bereits Super-Admin ist.
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

describe("Teil 1 — Abo-Modell aus Registrierung", () => {
  // ── Test A: Jahres-Abo aus Registrierung ────────────────────────────────────
  it("Test A — Registrierung mit zahlungsmodalitaet='jahres' liefert aboModell='jahres'", () => {
    const testfall = "A-JAEHRLICH";
    const methode =
      "echter Backend-Call-Replik (registerKanzlei + deriveAboModell + getAllKanzleienOverview)";

    const state = setupWithSuperAdmin();

    // Registriere TEST-REG-JAEHRLICH mit zahlungsmodalitaet='jahres'.
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
      "jahres",
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
    expect(kanzlei?.zahlungsmodalitaet).toBe("jahres");
    expect(derived).toBe("jahres");
    expect(overview?.aboModell).toBe("jahres");

    // Ergebnis-Protokoll.
    const allPass = check1 && check2 && check3;
    const ergebnis = allPass ? "PASS" : "FAIL";
    const beobachtet =
      `kanzlei.zahlungsmodalitaet=${String(kanzlei?.zahlungsmodalitaet)}, ` +
      `deriveAboModell=${derived}, ` +
      `overview.aboModell=${String(overview?.aboModell)}`;
    logResult(testfall, ergebnis, beobachtet, methode);

    expect(allPass).toBe(true);
  });

  // ── Test B: Monats-Abo aus Registrierung ────────────────────────────────────
  it("Test B — Registrierung mit zahlungsmodalitaet='monats' liefert aboModell='monats'", () => {
    const testfall = "B-MONATLICH";
    const methode =
      "echter Backend-Call-Replik (registerKanzlei + deriveAboModell + getAllKanzleienOverview)";

    const state = setupWithSuperAdmin();

    // Registriere TEST-REG-MONATLICH mit zahlungsmodalitaet='monats'.
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
      "monats",
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
    expect(kanzlei?.zahlungsmodalitaet).toBe("monats");
    expect(derived).toBe("monats");
    expect(overview?.aboModell).toBe("monats");

    // Ergebnis-Protokoll.
    const allPass = check1 && check2 && check3;
    const ergebnis = allPass ? "PASS" : "FAIL";
    const beobachtet =
      `kanzlei.zahlungsmodalitaet=${String(kanzlei?.zahlungsmodalitaet)}, ` +
      `deriveAboModell=${derived}, ` +
      `overview.aboModell=${String(overview?.aboModell)}`;
    logResult(testfall, ergebnis, beobachtet, methode);

    expect(allPass).toBe(true);
  });

  // ── Test C: Alt-Kanzlei ohne Zahlungsmodalität (null) → 'keine' ─────────────
  it("Test C — Alt-Kanzlei ohne zahlungsmodalitaet (null) liefert aboModell='keine'", () => {
    const testfall = "C-KEINE";
    const methode =
      "echter Backend-Call-Replik (deriveAboModell + getAllKanzleienOverview) + direkter State-Aufbau für Alt-Kanzlei";

    const state = setupWithSuperAdmin();

    // Alt-Kanzlei: zahlungsmodalitaet = null (Legacy-Datensatz ohne das
    // Feld). Wir legen die Kanzlei direkt im State an, da
    // registerKanzlei immer eine Zahlungsmodalität (oder null) setzt —
    // eine Alt-Kanzlei entstand vor Einführung des Feldes und hat
    // schlicht keinen Wert. Dies simuliert den Migrationsfall.
    const altKanzleiId = "TEST-ALT-KANZLEI";
    state.kanzleien.set(altKanzleiId, {
      id: altKanzleiId,
      name: "Alt-Kanzlei (Legacy)",
      defaultStundensatz: 0,
      zahlungsmodalitaet: null,
      status: "aktiv",
      createdAt: NOW,
    });

    // (1) kanzlei.zahlungsmodalitaet === null im gespeicherten Datensatz.
    const kanzlei = state.kanzleien.get(altKanzleiId);
    expect(kanzlei).toBeDefined();
    const check1 = kanzlei?.zahlungsmodalitaet === null;

    // (2) deriveAboModell(null) === 'keine'.
    const derived = deriveAboModell(kanzlei?.zahlungsmodalitaet ?? null);
    const check2 = derived === "keine";

    // (3) getAllKanzleienOverview (Super-Admin caller) liefert
    //     aboModell === 'keine' für diese Alt-Kanzlei.
    const overviews = getAllKanzleienOverview(
      state.kanzleien,
      state.users,
      TEST_IDS.PLATTFORM_ADMIN,
      state.superAdminWhitelist,
    );
    const overview = findOverview(overviews, altKanzleiId);
    expect(overview).toBeDefined();
    const check3 = overview?.aboModell === "keine";

    // Assertions (Vitest).
    expect(kanzlei?.zahlungsmodalitaet).toBeNull();
    expect(derived).toBe("keine");
    expect(overview?.aboModell).toBe("keine");

    // Ergebnis-Protokoll.
    const allPass = check1 && check2 && check3;
    const ergebnis = allPass ? "PASS" : "FAIL";
    const beobachtet =
      `kanzlei.zahlungsmodalitaet=${String(kanzlei?.zahlungsmodalitaet)}, ` +
      `deriveAboModell=${derived}, ` +
      `overview.aboModell=${String(overview?.aboModell)}`;
    logResult(testfall, ergebnis, beobachtet, methode);

    expect(allPass).toBe(true);
  });

  // ── Guard-Verifikation: getAllKanzleienOverview trapt für Nicht-Super-Admin ─
  it("Guard — getAllKanzleienOverview trapt für Nicht-Super-Admin", () => {
    const testfall = "GUARD-NON-SUPER-ADMIN";
    const methode =
      "echter Backend-Call-Replik (getAllKanzleienOverview mit Nicht-Super-Admin caller)";

    const state = setupWithSuperAdmin();

    // Registriere eine weitere Kanzlei mit einem Nicht-Super-Admin-Principal.
    registerKanzlei(
      state.kanzleien,
      state.users,
      state.superAdminWhitelist,
      TEST_IDS.TENANT_A_ADMIN,
      "Tenant A",
      "RA",
      "Tenant",
      "Admin",
      "tenant-a@example.com",
      "jahres",
      NOW,
    );

    // TENANT_A_ADMIN ist KEIN Super-Admin (Whitelist enthält nur
    // PLATTFORM_ADMIN). Der Aufruf muss trapen.
    let trapped = false;
    let trapMessage = "";
    try {
      getAllKanzleienOverview(
        state.kanzleien,
        state.users,
        TEST_IDS.TENANT_A_ADMIN,
        state.superAdminWhitelist,
      );
    } catch (e) {
      trapped = true;
      trapMessage = e instanceof Error ? e.message : String(e);
    }

    expect(trapped).toBe(true);
    expect(trapMessage).toBe(TRAP_MESSAGES.SUPER_ADMIN_ONLY);

    const ergebnis = trapped ? "PASS" : "FAIL";
    const beobachtet = trapped
      ? `trap geworfen: '${trapMessage}'`
      : "kein trap — Guard verletzt";
    logResult(testfall, ergebnis, beobachtet, methode);

    expect(trapped).toBe(true);
  });
});

// ── Teil 1 (Ergänzung) — Badge-Renderer-Regression ──────────────────────────
//
// Diese Tests decken die echte Decoder→Renderer/Badge-Kette ab, nicht nur
// Backend-Replik/String-Vergleiche. Sie importieren die echten
// AboModellBadge / BillingStatusBadge aus @/pages/PlattformAdminPage und
// rendern sie mit den tatsächlichen Decoder-Werten (AboModell-Enum aus
// @/backend bzw. BillingStatus-Strings) via renderToStaticMarkup aus
// react-dom/server. Die vitest-Konfiguration verwendet environment 'node'
// (kein jsdom / @testing-library/react), daher renderToStaticMarkup statt
// RTL-render.
//
// Assertiert wird, dass das gerenderte HTML die korrekten deutschen Labels
// („Jährlich"/„Monatlich"/„Keine" und „Bezahlt"/„Offen"/„Überfällig") und
// die korrekten data-ocid-Attribute enthält. Dies beweist, dass die Badges
// nicht mehr wegen fehlendem __kind__ in den default-Fall fallen.

import { AboModell } from "@/backend";
import { AboModellBadge, BillingStatusBadge } from "@/pages/PlattformAdminPage";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

describe("Teil 1 — Badge-Renderer (echte Komponenten)", () => {
  // ── Test A: AboModellBadge mit Decoder-Wert jahres/monats/keine ───────────
  it("Test A — AboModellBadge rendert Jährlich/Monatlich/Keine für AboModell.jahres/monats/keine", () => {
    const testfall = "A-ABO-MODELL-BADGE";
    const methode =
      "echte Badge-Komponente (AboModellBadge aus PlattformAdminPage) via renderToStaticMarkup mit AboModell-Enum aus @/backend";

    // jahres → „Jährlich"
    const htmlJahres = renderToStaticMarkup(
      createElement(AboModellBadge, { abo: AboModell.jahres }),
    );
    expect(htmlJahres).toContain("Jährlich");
    expect(htmlJahres).toContain(
      'data-ocid="plattform_admin.abo_badge.jahres"',
    );

    // monats → „Monatlich"
    const htmlMonats = renderToStaticMarkup(
      createElement(AboModellBadge, { abo: AboModell.monats }),
    );
    expect(htmlMonats).toContain("Monatlich");
    expect(htmlMonats).toContain(
      'data-ocid="plattform_admin.abo_badge.monats"',
    );

    // keine → „Keine"
    const htmlKeine = renderToStaticMarkup(
      createElement(AboModellBadge, { abo: AboModell.keine }),
    );
    expect(htmlKeine).toContain("Keine");
    expect(htmlKeine).toContain('data-ocid="plattform_admin.abo_badge.keine"');

    // Beweis, dass die Badges nicht in den default-Fall fallen: das
    // unknown-Attribut darf in keinem der drei Fälle auftauchen.
    expect(htmlJahres).not.toContain(
      'data-ocid="plattform_admin.abo_badge.unknown"',
    );
    expect(htmlMonats).not.toContain(
      'data-ocid="plattform_admin.abo_badge.unknown"',
    );
    expect(htmlKeine).not.toContain(
      'data-ocid="plattform_admin.abo_badge.unknown"',
    );

    const beobachtet = `jahres→${htmlJahres} | monats→${htmlMonats} | keine→${htmlKeine}`;
    logResult(testfall, "PASS", beobachtet, methode);
  });

  // ── Test B: BillingStatusBadge mit allen realen Decoder-Werten ─────────────
  it("Test B — BillingStatusBadge rendert Bezahlt/Offen/Überfällig für alle Decoder-Strings", () => {
    const testfall = "B-BILLING-STATUS-BADGE";
    const methode =
      "echte Badge-Komponente (BillingStatusBadge aus PlattformAdminPage) via renderToStaticMarkup mit Decoder-Strings 'offen'/'bezahlt'/'ueberfaellig'";

    // bezahlt → „Bezahlt"
    const htmlBezahlt = renderToStaticMarkup(
      createElement(BillingStatusBadge, { status: "bezahlt" }),
    );
    expect(htmlBezahlt).toContain("Bezahlt");
    expect(htmlBezahlt).toContain(
      'data-ocid="plattform_admin.billing_badge.bezahlt"',
    );

    // offen → „Offen"
    const htmlOffen = renderToStaticMarkup(
      createElement(BillingStatusBadge, { status: "offen" }),
    );
    expect(htmlOffen).toContain("Offen");
    expect(htmlOffen).toContain(
      'data-ocid="plattform_admin.billing_badge.offen"',
    );

    // ueberfaellig → „Überfällig"
    const htmlUeberfaellig = renderToStaticMarkup(
      createElement(BillingStatusBadge, { status: "ueberfaellig" }),
    );
    expect(htmlUeberfaellig).toContain("Überfällig");
    expect(htmlUeberfaellig).toContain(
      'data-ocid="plattform_admin.billing_badge.ueberfaellig"',
    );

    // Beweis, dass die Badges nicht in den default-Fall fallen: das
    // unknown-Attribut und der „—" Default-Text dürfen nicht auftauchen.
    expect(htmlBezahlt).not.toContain(
      'data-ocid="plattform_admin.billing_badge.unknown"',
    );
    expect(htmlOffen).not.toContain(
      'data-ocid="plattform_admin.billing_badge.unknown"',
    );
    expect(htmlUeberfaellig).not.toContain(
      'data-ocid="plattform_admin.billing_badge.unknown"',
    );

    const beobachtet = `bezahlt→${htmlBezahlt} | offen→${htmlOffen} | ueberfaellig→${htmlUeberfaellig}`;
    logResult(testfall, "PASS", beobachtet, methode);
  });
});
