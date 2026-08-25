// Generierte Test-Principals für den iReport Legal Regression-Harness.
//
// Jeder Test-Principal ist ein deterministischer, eindeutiger String. Im
// Harness werden Principals als Strings repräsentiert (siehe types.ts). Die
// Namen spiegeln die Rolle/den Tenant des Principals wider, damit die Tests
// selbsterklärend bleiben.

export const TEST_IDS = {
  // Registrierungs-Tests (Teil 1): neue Kanzlei-Registrierung mit
  // unterschiedlicher Zahlungsmodalität.
  REG_JAEHRLICH: "TEST-REG-JAEHRLICH",
  REG_MONATLICH: "TEST-REG-MONATLICH",

  // Tenant A (Teil 2): Admin + normaler Benutzer.
  TENANT_A_ADMIN: "TEST-TENANT-A-ADMIN",
  TENANT_A_USER: "TEST-TENANT-A-USER",

  // Tenant B (Teil 2): Admin + normaler Benutzer (für Cross-Tenant-Tests).
  TENANT_B_ADMIN: "TEST-TENANT-B-ADMIN",
  TENANT_B_USER: "TEST-TENANT-B-USER",

  // Plattform-Admin (Super-Admin): mandantenübergreifende Verwaltung.
  PLATTFORM_ADMIN: "TEST-PLATTFORM-ADMIN",

  // Vorlagen-Editor-Tests (Teil 5): zwei Kanzleien für Tenant-Isolation der
  // Rechnungsvorlagen. Jede Kanzlei hat ihre eigene Vorlage im VorlageStore.
  VORLAGE_KANZLEI_A: "TEST-VORLAGE-KANZLEI-A",
  VORLAGE_KANZLEI_B: "TEST-VORLAGE-KANZLEI-B",
} as const;

export type TestIdKey = keyof typeof TEST_IDS;
export type TestIdValue = (typeof TEST_IDS)[TestIdKey];
