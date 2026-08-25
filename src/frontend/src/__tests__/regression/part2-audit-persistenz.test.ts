// Teil 2.6 — Audit-Persistenz Tests
//
// Verifiziert die Persistenz-Eigenschaften der Audit-Log-Logik:
//   2.6.a — Monotone/eindeutige Audit-IDs bei wiederholtem logAuditEntry
//   2.6.b — Append-only: bestehende Einträge werden nicht überschrieben
//   2.6.c — Migration 20260809 mit kanzleiId die '-' enthält
//   2.6.d — Migration mit leeren auditLogs
//   2.6.e — Echter Canister-Upgrade (NOT TESTABLE)
//
// Jeder Testfall protokolliert über console.log: TESTFALL, ERGEBNIS,
// BEOBACHTET, METHODE.

import { describe, expect, it } from "vitest";
import {
  TRAP_MESSAGES,
  createFreshState,
  logAuditEntry,
  migrateAuditCounters,
} from "./harness/backend-replica";
import type { AuditLogEntry } from "./harness/types";

// ── Hilfsfunktion: Basis-Audit-Eintrag ohne id ──────────────────────────────
function makeBaseEntry(kanzleiId: string, actorPrincipal: string, now: number) {
  return {
    kanzleiId,
    actorPrincipal,
    action: "TEST_ACTION",
    entityType: "TestEntity",
    entityId: "test-entity-1",
    timestamp: now,
    beforeValue: null,
    afterValue: null,
  };
}

describe("Teil 2.6 — Audit-Persistenz", () => {
  // ── 2.6.a Monotone/eindeutige Audit-IDs ────────────────────────────────────
  it("2.6.a — logAuditEntry erzeugt eindeutige, streng monotone IDs im Format AUD-{kanzleiId}-{count}", () => {
    const state = createFreshState();
    const kanzleiId = "TEST-TENANT-A";
    const actor = "TEST-TENANT-A-ADMIN";
    const now = 1_700_000_000_000;

    const ids: string[] = [];
    const counts: number[] = [];
    for (let i = 0; i < 5; i += 1) {
      const entry = logAuditEntry(
        state.auditLogs,
        state.nextAuditId,
        makeBaseEntry(kanzleiId, actor, now + i),
      );
      ids.push(entry.id);
      counts.push(Number.parseInt(entry.id.split("-").slice(-1)[0], 10));
    }

    // Eindeutigkeit: keine Duplikate
    const uniqueIds = new Set(ids);
    const isUnique = uniqueIds.size === ids.length;

    // Streng monoton steigend: 1,2,3,4,5
    const isStrictlyMonotonic = counts.every(
      (c, i) => i === 0 || c === counts[i - 1] + 1,
    );
    const expectedCounts = [1, 2, 3, 4, 5];
    const countsMatch = counts.every((c, i) => c === expectedCounts[i]);

    // ID-Format: AUD-{kanzleiId}-{count}
    const formatOk = ids.every((id) => {
      const re = new RegExp(`^AUD-${kanzleiId}-\\d+$`);
      return re.test(id);
    });

    const passed = isUnique && isStrictlyMonotonic && countsMatch && formatOk;

    console.log(
      `TESTFALL=2.6.a Monotone/eindeutige Audit-IDs | ERGEBNIS=${passed ? "PASS" : "FAIL"} | BEOBACHTET=IDs=${ids.join(",")}; counts=${counts.join(",")}; eindeutig=${isUnique}; streng-monoton=${isStrictlyMonotonic}; format-ok=${formatOk} | METHODE=logAuditEntry 5x für kanzleiId='${kanzleiId}' aufgerufen, IDs auf Eindeutigkeit, streng monotones count (1..5) und Format AUD-{kanzleiId}-{count} geprüft`,
    );

    expect(isUnique).toBe(true);
    expect(isStrictlyMonotonic).toBe(true);
    expect(countsMatch).toBe(true);
    expect(formatOk).toBe(true);
    expect(ids).toEqual([
      "AUD-TEST-TENANT-A-1",
      "AUD-TEST-TENANT-A-2",
      "AUD-TEST-TENANT-A-3",
      "AUD-TEST-TENANT-A-4",
      "AUD-TEST-TENANT-A-5",
    ]);
  });

  // ── 2.6.b Append-only (kein Überschreiben) ─────────────────────────────────
  it("2.6.b — logAuditEntry überschreibt bestehende Einträge nicht (append-only)", () => {
    const state = createFreshState();
    const kanzleiId = "TEST-TENANT-A";
    const actor = "TEST-TENANT-A-ADMIN";
    const now = 1_700_000_000_000;

    // Pre-populate auditLogs mit 3 bestehenden Einträgen (IDs wie in der
    // Anforderung vorgegeben). Wir setzen die Counter so, dass die nächsten
    // logAuditEntry-Aufrufe IDs ab count=4 erzeugen — aber die Anforderung
    // verlangt nur, dass die 3 bestehenden Einträge erhalten bleiben und 2
    // neue hinzukommen (total 5). Wir setzen nextAuditId.count=4, damit die
    // neuen IDs 'AUD-TEST-TENANT-A-4' und 'AUD-TEST-TENANT-A-5' sind und sich
    // nicht mit den bestehenden IDs überschneiden.
    const preExistingIds = [
      "AUD-TEST-TENANT-A-1",
      "AUD-TEST-TENANT-A-2",
      "AUD-TEST-TENANT-A-3",
    ];
    for (const id of preExistingIds) {
      const entry: AuditLogEntry = {
        id,
        kanzleiId,
        actorPrincipal: actor,
        action: "PRE_EXISTING",
        entityType: "PreExisting",
        entityId: id,
        timestamp: now,
        beforeValue: null,
        afterValue: null,
      };
      state.auditLogs.set(id, entry);
    }
    state.nextAuditId.count = 4;

    // 2 neue Einträge via logAuditEntry
    const newEntry1 = logAuditEntry(
      state.auditLogs,
      state.nextAuditId,
      makeBaseEntry(kanzleiId, actor, now + 1),
    );
    const newEntry2 = logAuditEntry(
      state.auditLogs,
      state.nextAuditId,
      makeBaseEntry(kanzleiId, actor, now + 2),
    );

    // Verifiziere: 3 bestehende Einträge noch vorhanden (nicht überschrieben)
    const preExistingPreserved = preExistingIds.every((id) => {
      const e = state.auditLogs.get(id);
      return e !== undefined && e.action === "PRE_EXISTING";
    });

    // Verifiziere: 2 neue hinzugekommen (total 5)
    const total = state.auditLogs.size;
    const newIds = [newEntry1.id, newEntry2.id];
    const newAdded = newIds.every((id) => state.auditLogs.has(id));

    const passed = preExistingPreserved && total === 5 && newAdded;

    console.log(
      `TESTFALL=2.6.b Append-only (kein Überschreiben) | ERGEBNIS=${passed ? "PASS" : "FAIL"} | BEOBACHTET=bestehende-erhalten=${preExistingPreserved}; neue-IDs=${newIds.join(",")}; total=${total} (erwartet 5); neue-hinzugekommen=${newAdded} | METHODE=auditLogs mit 3 Einträgen (IDs ${preExistingIds.join(",")}) pre-populated, logAuditEntry 2x aufgerufen, Verifizierung dass 3 bestehende erhalten + 2 neue = total 5`,
    );

    expect(preExistingPreserved).toBe(true);
    expect(total).toBe(5);
    expect(newAdded).toBe(true);
    expect(newEntry1.id).toBe("AUD-TEST-TENANT-A-4");
    expect(newEntry2.id).toBe("AUD-TEST-TENANT-A-5");
  });

  // ── 2.6.c Migration 20260809 mit kanzleiId die '-' enthält ─────────────────
  it("2.6.c — migrateAuditCounters mit kanzleiId die '-' enthält: nextAuditId.count = max(lastSegments)+1", () => {
    const state = createFreshState();
    const now = 1_700_000_000_000;

    // Pre-populate auditLogs mit Einträgen deren IDs '-' im kanzleiId-Teil
    // enthalten. Die kanzleiIds hier sind 'TEST-TENANT-A' und 'TEST-TENANT-B'
    // (beide enthalten '-'). Die IDs lauten:
    //   AUD-TEST-TENANT-A-1  → last segment = 1
    //   AUD-TEST-TENANT-A-2  → last segment = 2
    //   AUD-TEST-TENANT-B-7  → last segment = 7
    // max = 7 → nextAuditId.count = 8
    const seedIds = [
      { id: "AUD-TEST-TENANT-A-1", kanzleiId: "TEST-TENANT-A" },
      { id: "AUD-TEST-TENANT-A-2", kanzleiId: "TEST-TENANT-A" },
      { id: "AUD-TEST-TENANT-B-7", kanzleiId: "TEST-TENANT-B" },
    ];
    for (const s of seedIds) {
      const entry: AuditLogEntry = {
        id: s.id,
        kanzleiId: s.kanzleiId,
        actorPrincipal: "TEST-ACTOR",
        action: "SEED",
        entityType: "Seed",
        entityId: s.id,
        timestamp: now,
        beforeValue: null,
        afterValue: null,
      };
      state.auditLogs.set(s.id, entry);
    }

    const result = migrateAuditCounters(state.auditLogs);

    const nextAuditCountOk = result.nextAuditId.count === 8;
    const dataAccessLogsEmpty = result.dataAccessLogs.size === 0;
    const nextDataAccessCountOk = result.nextDataAccessId.count === 1;

    const passed =
      nextAuditCountOk && dataAccessLogsEmpty && nextDataAccessCountOk;

    console.log(
      `TESTFALL=2.6.c Migration 20260809 mit kanzleiId die '-' enthält | ERGEBNIS=${passed ? "PASS" : "FAIL"} | BEOBACHTET=nextAuditId.count=${result.nextAuditId.count} (erwartet 8); dataAccessLogs.size=${result.dataAccessLogs.size} (erwartet 0); nextDataAccessId.count=${result.nextDataAccessId.count} (erwartet 1); seed-IDs=${seedIds.map((s) => s.id).join(",")} | METHODE=auditLogs mit 3 Einträgen (IDs enthalten '-' in kanzleiId) pre-populated, migrateAuditCounters aufgerufen, last-segment-Max-Logik verifiziert (max(1,2,7)=7 → +1=8)`,
    );

    expect(result.nextAuditId.count).toBe(8);
    expect(result.dataAccessLogs.size).toBe(0);
    expect(result.nextDataAccessId.count).toBe(1);
  });

  // ── 2.6.d Migration mit leeren auditLogs ───────────────────────────────────
  it("2.6.d — migrateAuditCounters mit leeren auditLogs: nextAuditId.count=1, dataAccessLogs leer, nextDataAccessId.count=1", () => {
    const state = createFreshState();
    // auditLogs bleibt leer (createFreshState initialisiert leere Map)

    const result = migrateAuditCounters(state.auditLogs);

    const nextAuditCountOk = result.nextAuditId.count === 1;
    const dataAccessLogsEmpty = result.dataAccessLogs.size === 0;
    const nextDataAccessCountOk = result.nextDataAccessId.count === 1;

    const passed =
      nextAuditCountOk && dataAccessLogsEmpty && nextDataAccessCountOk;

    console.log(
      `TESTFALL=2.6.d Migration mit leeren auditLogs | ERGEBNIS=${passed ? "PASS" : "FAIL"} | BEOBACHTET=nextAuditId.count=${result.nextAuditId.count} (erwartet 1); dataAccessLogs.size=${result.dataAccessLogs.size} (erwartet 0); nextDataAccessId.count=${result.nextDataAccessId.count} (erwartet 1) | METHODE=migrateAuditCounters mit leerer Map aufgerufen, Default-Werte (count=1, leere dataAccessLogs) verifiziert`,
    );

    expect(result.nextAuditId.count).toBe(1);
    expect(result.dataAccessLogs.size).toBe(0);
    expect(result.nextDataAccessId.count).toBe(1);
  });

  // ── 2.6.e Echter Canister-Upgrade-E2E (NOT TESTABLE) ───────────────────────
  it("2.6.e — Echter Canister-Upgrade-E2E: NOT TESTABLE (erfordert neues Build/Deployment)", () => {
    const observed =
      "Echter Canister-Upgrade erfordert neues Build/Deployment — in dieser Umgebung nicht testbar. Migrationlogik und persistierte Zähler wurden funktional verifiziert (Tests 2.6.a-d).";
    const methode =
      "Code-Inspection der Migration 20260809_000000.mo + funktionale Replik";

    console.log(
      `TESTFALL=2.6.e Echter Canister-Upgrade-E2E | ERGEBNIS=NOT TESTABLE | BEOBACHTET=${observed} | METHODE=${methode}`,
    );

    // Sanity-Check: TRAP_MESSAGES ist importierbar (zeigt, dass der Harness
    // korrekt angebunden ist — kein echter Upgrade-Test, nur Plausibilität).
    expect(TRAP_MESSAGES.USER_NOT_REGISTERED).toBeDefined();

    // Markiere explizit als NOT TESTABLE — kein expect mit PASS/FAIL, da dieser
    // Testfall per Definition nicht in dieser Umgebung ausführbar ist.
    expect(true).toBe(true);
  });
});
