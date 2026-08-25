import type { backendInterface, AuslagenKategorie, AuslagenStatus, MandatStatus, ZahlungsStatus, ZahlungEingangStatus, Leistung, DsrRequest, RetentionPolicy, DataInventoryEntry, DataFlowEntry, DsgVersion, ConsentRecord, KanzleiId, Rechnungsvorlage, SupportConversation, SupportConversationId, SupportConversationWithMessages, SupportMessage, Result, Result_3, Result_13, Result_15, Result_21, Result_23, Result_25, Result_27, PendingRegistrationView, PendingRegistrationId } from "../backend.d";
import { Auslagenregelung, DsrStatus, DsrType, Position, Role, Zahlungsmodalitaet, SupportCategory, SupportStatus, SupportSenderType, VerificationError } from "../backend.d";

const KANZLEI_ID = "kanzlei-001";
const PROVIDER_ID = { _isPrincipal: true, toString: () => "provider-001" } as any;
const KLIENT_ID_1 = "klient-001";
const KLIENT_ID_2 = "klient-002";
const MANDAT_ID_1 = "mandat-001";
const MANDAT_ID_2 = "mandat-002";

// ─── Support (Feedback) Sample Data ──────────────────────────────────────────
// Sample conversations + messages so the admin inbox, "Meine Nachrichten"
// list, status badges, unread indicators, and message thread bubbles can be
// visually verified. Timestamps are fixed offsets from a base so the
// rendered dates are deterministic across runs.
const SUPPORT_BASE_MS = Date.UTC(2026, 7, 13, 12, 41, 0); // 13.08.2026 12:41 UTC
const SUPPORT_CONVERSATIONS: SupportConversation[] = [
  {
    id: "support-conv-001",
    status: SupportStatus.neu,
    appRoute: "/einstellungen/rechnungsvorlage",
    subject: "Beim Word-Export wird die Empfängeradresse falsch positioniert",
    createdByUserId: PROVIDER_ID.toString(),
    createdAt: BigInt(SUPPORT_BASE_MS),
    appVersion: "draft",
    updatedAt: BigInt(SUPPORT_BASE_MS),
    category: SupportCategory.fehler,
    kanzleiId: KANZLEI_ID,
    createdByUserName: "Dr. Andreas Müller",
  } as SupportConversation,
  {
    id: "support-conv-002",
    status: SupportStatus.in_bearbeitung,
    appRoute: "/rechnungen",
    subject: "Frage zur Zahlungsbedingungen-Vorschau",
    createdByUserId: PROVIDER_ID.toString(),
    createdAt: BigInt(SUPPORT_BASE_MS - 86_400_000),
    appVersion: "draft",
    updatedAt: BigInt(SUPPORT_BASE_MS + 3_600_000),
    category: SupportCategory.frage,
    kanzleiId: KANZLEI_ID,
    createdByUserName: "Dr. Andreas Müller",
  } as SupportConversation,
  {
    id: "support-conv-003",
    status: SupportStatus.erledigt,
    appRoute: "/dashboard",
    subject: "Verbesserung: Sidebar sollte aktiven Punkt hervorheben",
    createdByUserId: PROVIDER_ID.toString(),
    createdAt: BigInt(SUPPORT_BASE_MS - 3 * 86_400_000),
    appVersion: "draft",
    updatedAt: BigInt(SUPPORT_BASE_MS - 2 * 86_400_000),
    category: SupportCategory.verbesserungsvorschlag,
    kanzleiId: KANZLEI_ID,
    createdByUserName: "Dr. Andreas Müller",
  } as SupportConversation,
];

const SUPPORT_MESSAGES: SupportMessage[] = [
  {
    id: "support-msg-001",
    senderUserName: "Dr. Andreas Müller",
    createdAt: BigInt(SUPPORT_BASE_MS),
    conversationId: "support-conv-001",
    message:
      "Beim Word-Export wird die Empfängeradresse falsch positioniert. Sie rutscht im fertigen Dokument etwa 5 mm nach links.",
    senderType: SupportSenderType.user,
    senderUserId: PROVIDER_ID.toString(),
  } as SupportMessage,
  {
    id: "support-msg-002",
    senderUserName: "Dr. Andreas Müller",
    createdAt: BigInt(SUPPORT_BASE_MS - 86_400_000),
    conversationId: "support-conv-002",
    message:
      "Kann ich die Vorschau der Zahlungsbedingungen vor dem Speichern sehen, ohne eine Rechnung anzulegen?",
    senderType: SupportSenderType.user,
    senderUserId: PROVIDER_ID.toString(),
  } as SupportMessage,
  {
    id: "support-msg-003",
    senderUserName: "Plattform-Support",
    createdAt: BigInt(SUPPORT_BASE_MS + 3_600_000),
    conversationId: "support-conv-002",
    message:
      "Danke für die Frage. Die Vorschau ist aktuell an den Rechnungs-Editor gebunden; eine eigenständige Vorschau ist für den nächsten Draft geplant.",
    senderType: SupportSenderType.platformAdmin,
    senderUserId: "platform-admin-001",
  } as SupportMessage,
  {
    id: "support-msg-004",
    senderUserName: "Dr. Andreas Müller",
    createdAt: BigInt(SUPPORT_BASE_MS - 3 * 86_400_000),
    conversationId: "support-conv-003",
    message:
      "Die Sidebar hebt den aktiven Menüpunkt nur schwach hervor. Ein kräftigerer Akzent würde die Orientierung erleichtern.",
    senderType: SupportSenderType.user,
    senderUserId: PROVIDER_ID.toString(),
  } as SupportMessage,
  {
    id: "support-msg-005",
    senderUserName: "Plattform-Support",
    createdAt: BigInt(SUPPORT_BASE_MS - 2 * 86_400_000),
    conversationId: "support-conv-003",
    message:
      "Guter Hinweis — wurde umgesetzt und ist im nächsten Draft enthalten. Wir markieren das Anliegen als erledigt.",
    senderType: SupportSenderType.platformAdmin,
    senderUserId: "platform-admin-001",
  } as SupportMessage,
];

export const mockBackend: backendInterface = {
  addZahlung: async () => ({
    __kind__: "ok",
    ok: {
      id: "zahlung-001",
      status: "eingegangen" as ZahlungEingangStatus,
      createdAt: BigInt(Date.now()),
      rechnungId: "rechnung-001",
      betrag: BigInt(250000),
      datum: "17.04.2026",
      kanzleiId: KANZLEI_ID,
    },
  }),

  archivierMandat: async () => ({ __kind__: "ok", ok: null }),

  createAuslage: async () => ({
    __kind__: "ok",
    ok: {
      id: "auslage-new",
      status: "offen" as AuslagenStatus,
      createdAt: BigInt(Date.now()),
      leistungserbringerId: PROVIDER_ID,
      betrag: BigInt(5000),
      kategorie: "porto" as AuslagenKategorie,
      beschreibung: "Porto",
      datum: "17.04.2026",
      mandatId: MANDAT_ID_1,
      kanzleiId: KANZLEI_ID,
    },
  }),

  createKlient: async () => ({
    __kind__: "ok",
    ok: {
      id: "klient-new",
      plzOrt: "8001 Zürich",
      name: "Neuer Klient AG",
      createdAt: BigInt(Date.now()),
      email: "info@neuer-klient.ch",
      telefon: "+41 44 123 45 67",
      kanzleiId: KANZLEI_ID,
      strasse: "Bahnhofstrasse 1",
    },
  }),

  createLeistung: async () => ({
    __kind__: "ok",
    ok: {
      id: "leistung-new",
      status: "offen" as Leistung["status"],
      taetigkeit: "Beratung",
      createdAt: BigInt(Date.now()),
      leistungserbringerId: PROVIDER_ID,
      datum: "17.04.2026",
      dauer: BigInt(60),
      honorar: BigInt(25000),
      mandatId: MANDAT_ID_1,
      kanzleiId: KANZLEI_ID,
    },
  }),

  createMandat: async () => ({
    __kind__: "ok",
    ok: {
      id: "mandat-new",
      status: "aktiv" as MandatStatus,
      rundungAktiv: false,
      bezeichnung: "Neues Mandat",
      auslagenregelung: Auslagenregelung.Keine,
      createdAt: BigInt(Date.now()),
      akquisitionsbonus: BigInt(0),
      mwstSatz: BigInt(8100),
      standardStundensatz: BigInt(0),
      pauschalBetrag: BigInt(0),
      zahlungsbedingungen: "30 Tage netto",
      akquisiteurId: PROVIDER_ID,
      budget: BigInt(1000000),
      waehrung: "CHF",
      kostenProKopie: 0,
      kostenProScan: 0,
      portoAPost: 0,
      portoBPost: 0,
      portoEinschreiben: 0,
      autokilometer: 0,
      leistungenAusweisen: true,
      klientId: KLIENT_ID_1,
      kanzleiId: KANZLEI_ID,
    },
  }),

  createRechnung: async () => ({
    __kind__: "ok",
    ok: {
      id: "rechnung-new",
      rechnungsnummer: "RE-2026-004",
      total: BigInt(350000),
      waehrung: "CHF",
      rechnungsdatum: "17.04.2026",
      createdAt: BigInt(Date.now()),
      mwstBetrag: BigInt(27450),
      leistungserbringerId: PROVIDER_ID,
      faelligkeitsdatum: "17.05.2026",
      zahlungsstatus: "offen" as ZahlungsStatus,
      zahlungsbedingungen: "30 Tage netto",
      leistungszeitraumBis: "31.03.2026",
      leistungszeitraumVon: "01.03.2026",
      leistungspositionen: [],
      auslageIds: [],
      mandatId: MANDAT_ID_1,
      kanzleiId: KANZLEI_ID,
      subtotal: BigInt(322550),
    },
  }),

  deleteAuslage: async () => ({ __kind__: "ok", ok: null }),
  deleteKlient: async () => ({ __kind__: "ok", ok: null }),
  deleteLeistung: async () => ({ __kind__: "ok", ok: null }),
  deleteMandat: async () => ({ __kind__: "ok", ok: null }),

  getAuslagen: async () => [
    {
      id: "auslage-001",
      status: "offen" as AuslagenStatus,
      createdAt: BigInt(1713000000000),
      leistungserbringerId: PROVIDER_ID,
      betrag: BigInt(8500),
      kategorie: "porto" as AuslagenKategorie,
      beschreibung: "Einschreiben an Gericht",
      datum: "15.04.2026",
      mandatId: MANDAT_ID_1,
      kanzleiId: KANZLEI_ID,
    },
    {
      id: "auslage-002",
      status: "offen" as AuslagenStatus,
      createdAt: BigInt(1712000000000),
      leistungserbringerId: PROVIDER_ID,
      betrag: BigInt(12000),
      kategorie: "kopien" as AuslagenKategorie,
      beschreibung: "Aktenkopien",
      datum: "10.04.2026",
      mandatId: MANDAT_ID_2,
      kanzleiId: KANZLEI_ID,
    },
  ],

  getBudgetSummaries: async () => [
    {
      mandatId: MANDAT_ID_1,
      totalBudget: BigInt(2000000),
      totalHonorar: BigInt(122500),
      totalAuslagen: BigInt(8500),
      restbudget: BigInt(1869000),
    },
    {
      mandatId: MANDAT_ID_2,
      totalBudget: BigInt(500000),
      totalHonorar: BigInt(70000),
      totalAuslagen: BigInt(12000),
      restbudget: BigInt(418000),
    },
  ],

  getBudgetSummary: async () => ({
    __kind__: "ok" as const,
    ok: {
      mandatId: MANDAT_ID_1,
      totalBudget: BigInt(2000000),
      totalHonorar: BigInt(122500),
      totalAuslagen: BigInt(8500),
      restbudget: BigInt(1869000),
    },
  }),

  getCurrentUser: async () => ({
    id: PROVIDER_ID,
    titel: "Dr.",
    nachname: "Müller",
    stundensatz: BigInt(35000),
    email: "mueller@kanzlei-beispiel.ch",
    vorname: "Andreas",
    isAdmin: true,
    status: "aktiv",
    statusHistory: [],
    registeredAt: BigInt(1700000000000),
    kanzleiId: KANZLEI_ID,
    role: Role.admin,
  }),

  getGehaltReport: async () => [
    {
      leistungsbasiert: BigInt(850000),
      kanzleianteil: BigInt(200000),
      provider: {
        id: PROVIDER_ID,
        titel: "Dr.",
        nachname: "Müller",
        stundensatz: BigInt(35000),
        email: "mueller@kanzlei-beispiel.ch",
        vorname: "Andreas",
        isAdmin: true,
        status: "aktiv",
        statusHistory: [],
        registeredAt: BigInt(1700000000000),
        kanzleiId: KANZLEI_ID,
      },
      gesamtgehalt: BigInt(1050000),
      akquisitionsboni: BigInt(50000),
    },
  ],

  getKanzleiReport: async () => ({
    monthlyBreakdown: [
      { month: BigInt(1), total: BigInt(520000), auslagen: BigInt(20000), year: BigInt(2026), verrechnete: BigInt(500000), honorar: BigInt(500000) },
      { month: BigInt(2), total: BigInt(680000), auslagen: BigInt(30000), year: BigInt(2026), verrechnete: BigInt(650000), honorar: BigInt(650000) },
      { month: BigInt(3), total: BigInt(750000), auslagen: BigInt(25000), year: BigInt(2026), verrechnete: BigInt(725000), honorar: BigInt(725000) },
      { month: BigInt(4), total: BigInt(420000), auslagen: BigInt(15000), year: BigInt(2026), verrechnete: BigInt(405000), honorar: BigInt(405000) },
    ],
    totals: { month: BigInt(0), total: BigInt(2370000), auslagen: BigInt(90000), year: BigInt(2026), verrechnete: BigInt(2280000), honorar: BigInt(2280000) },
  }),

  getKlient: async () => ({
    id: KLIENT_ID_1,
    plzOrt: "8001 Zürich",
    name: "Huber & Partner AG",
    createdAt: BigInt(1700000000000),
    email: "info@huber-partner.ch",
    telefon: "+41 44 222 33 44",
    kanzleiId: KANZLEI_ID,
    strasse: "Paradeplatz 5",
  }),

  getKlienten: async () => [
    {
      id: KLIENT_ID_1,
      plzOrt: "8001 Zürich",
      name: "Huber & Partner AG",
      createdAt: BigInt(1700000000000),
      email: "info@huber-partner.ch",
      telefon: "+41 44 222 33 44",
      kanzleiId: KANZLEI_ID,
      strasse: "Paradeplatz 5",
    },
    {
      id: KLIENT_ID_2,
      plzOrt: "3001 Bern",
      name: "Schmid Immobilien GmbH",
      createdAt: BigInt(1705000000000),
      email: "kontakt@schmid-immo.ch",
      telefon: "+41 31 444 55 66",
      kanzleiId: KANZLEI_ID,
      strasse: "Bundesplatz 3",
    },
  ],

  getLeistungen: async () => [
    {
      id: "leistung-001",
      status: "offen" as Leistung["status"],
      taetigkeit: "Vertragsberatung",
      createdAt: BigInt(1712000000000),
      leistungserbringerId: PROVIDER_ID,
      datum: "15.04.2026",
      dauer: BigInt(90),
      honorar: BigInt(52500),
      mandatId: MANDAT_ID_1,
      kanzleiId: KANZLEI_ID,
    },
    {
      id: "leistung-002",
      status: "offen" as Leistung["status"],
      taetigkeit: "Schriftsatz erstellen",
      createdAt: BigInt(1711000000000),
      leistungserbringerId: PROVIDER_ID,
      datum: "10.04.2026",
      dauer: BigInt(120),
      honorar: BigInt(70000),
      mandatId: MANDAT_ID_2,
      kanzleiId: KANZLEI_ID,
    },
  ],

  getLeistungserbringer: async () => [
    {
      id: PROVIDER_ID,
      titel: "Dr.",
      nachname: "Müller",
      stundensatz: BigInt(35000),
      email: "mueller@kanzlei-beispiel.ch",
      vorname: "Andreas",
      isAdmin: true,
      status: "aktiv",
      statusHistory: [],
      registeredAt: BigInt(1700000000000),
      kanzleiId: KANZLEI_ID,
      role: Role.admin,
    },
    {
      id: { _isPrincipal: true, toString: () => "provider-002" } as any,
      titel: "lic. iur.",
      nachname: "Weber",
      stundensatz: BigInt(28000),
      email: "weber@kanzlei-beispiel.ch",
      vorname: "Sandra",
      isAdmin: false,
      status: "aktiv",
      statusHistory: [],
      registeredAt: BigInt(1701000000000),
      kanzleiId: KANZLEI_ID,
      role: Role.anwalt,
    },
    {
      id: { _isPrincipal: true, toString: () => "provider-003" } as any,
      titel: "—",
      nachname: "Berger",
      stundensatz: BigInt(22000),
      email: "berger@kanzlei-beispiel.ch",
      vorname: "Thomas",
      isAdmin: false,
      status: "aktiv",
      statusHistory: [],
      registeredAt: BigInt(1702000000000),
      kanzleiId: KANZLEI_ID,
      role: Role.mitarbeiter,
    },
    {
      id: { _isPrincipal: true, toString: () => "provider-004" } as any,
      titel: "—",
      nachname: "Frei",
      stundensatz: BigInt(0),
      email: "frei@mandant.ch",
      vorname: "Claudia",
      isAdmin: false,
      status: "aktiv",
      statusHistory: [],
      registeredAt: BigInt(1703000000000),
      kanzleiId: KANZLEI_ID,
      role: Role.mandant,
    },
  ],

  getLeistungserbringerByKanzlei: async (_kanzleiId: KanzleiId) => [],

  getLeistungserbringerReport: async () => ({
    monthlyBreakdown: [
      { month: BigInt(1), total: BigInt(320000), auslagen: BigInt(10000), year: BigInt(2026), verrechnete: BigInt(310000), honorar: BigInt(310000) },
      { month: BigInt(2), total: BigInt(410000), auslagen: BigInt(15000), year: BigInt(2026), verrechnete: BigInt(395000), honorar: BigInt(395000) },
      { month: BigInt(3), total: BigInt(480000), auslagen: BigInt(20000), year: BigInt(2026), verrechnete: BigInt(460000), honorar: BigInt(460000) },
      { month: BigInt(4), total: BigInt(250000), auslagen: BigInt(8000), year: BigInt(2026), verrechnete: BigInt(242000), honorar: BigInt(242000) },
    ],
    totals: { month: BigInt(0), total: BigInt(1460000), auslagen: BigInt(53000), year: BigInt(2026), verrechnete: BigInt(1407000), honorar: BigInt(1407000) },
    comparisonData: [
      {
        total: BigInt(1460000),
        provider: {
          id: PROVIDER_ID,
          titel: "Dr.",
          nachname: "Müller",
          stundensatz: BigInt(35000),
          email: "mueller@kanzlei-beispiel.ch",
          vorname: "Andreas",
          isAdmin: true,
          status: "aktiv",
          statusHistory: [],
          registeredAt: BigInt(1700000000000),
          kanzleiId: KANZLEI_ID,
        },
      },
      {
        total: BigInt(910000),
        provider: {
          id: { _isPrincipal: true, toString: () => "provider-002" } as any,
          titel: "lic. iur.",
          nachname: "Weber",
          stundensatz: BigInt(28000),
          email: "weber@kanzlei-beispiel.ch",
          vorname: "Sandra",
          isAdmin: false,
          status: "aktiv",
          statusHistory: [],
          registeredAt: BigInt(1701000000000),
          kanzleiId: KANZLEI_ID,
        },
      },
    ],
  }),

  getMandat: async () => ({
    id: MANDAT_ID_1,
    status: "aktiv" as MandatStatus,
    rundungAktiv: true,
    bezeichnung: "Gesellschaftsrecht – Fusion",
    auslagenregelung: Auslagenregelung.Effektiv,
    createdAt: BigInt(1700000000000),
    akquisitionsbonus: BigInt(10000),
    mwstSatz: BigInt(8100),
    standardStundensatz: BigInt(35000),
    pauschalBetrag: BigInt(0),
    zahlungsbedingungen: "30 Tage netto",
    akquisiteurId: PROVIDER_ID,
    budget: BigInt(2000000),
    waehrung: "CHF",
    kostenProKopie: 0.5,
    kostenProScan: 0.5,
    portoAPost: 1.2,
    portoBPost: 0.9,
    portoEinschreiben: 4.5,
    autokilometer: 0.7,
    leistungenAusweisen: true,
    klientId: KLIENT_ID_1,
    kanzleiId: KANZLEI_ID,
  }),

  getMandate: async () => [
    {
      id: MANDAT_ID_1,
      status: "aktiv" as MandatStatus,
      rundungAktiv: true,
      bezeichnung: "Gesellschaftsrecht – Fusion",
      auslagenregelung: Auslagenregelung.Effektiv,
      createdAt: BigInt(1700000000000),
      akquisitionsbonus: BigInt(10000),
      mwstSatz: BigInt(8100),
      standardStundensatz: BigInt(35000),
      pauschalBetrag: BigInt(0),
      zahlungsbedingungen: "30 Tage netto",
      akquisiteurId: PROVIDER_ID,
      budget: BigInt(2000000),
      waehrung: "CHF",
      kostenProKopie: 0.5,
      kostenProScan: 0.5,
      portoAPost: 1.2,
      portoBPost: 0.9,
      portoEinschreiben: 4.5,
      autokilometer: 0.7,
      leistungenAusweisen: true,
      klientId: KLIENT_ID_1,
      kanzleiId: KANZLEI_ID,
    },
    {
      id: MANDAT_ID_2,
      status: "aktiv" as MandatStatus,
      rundungAktiv: false,
      bezeichnung: "Immobilientransaktion Basel",
      auslagenregelung: Auslagenregelung.Pauschal,
      createdAt: BigInt(1705000000000),
      akquisitionsbonus: BigInt(0),
      mwstSatz: BigInt(8100),
      standardStundensatz: BigInt(0),
      pauschalBetrag: BigInt(0),
      zahlungsbedingungen: "10 Tage netto",
      akquisiteurId: PROVIDER_ID,
      budget: BigInt(500000),
      waehrung: "CHF",
      kostenProKopie: 0,
      kostenProScan: 0,
      portoAPost: 0,
      portoBPost: 0,
      portoEinschreiben: 0,
      autokilometer: 0,
      leistungenAusweisen: true,
      klientId: KLIENT_ID_2,
      kanzleiId: KANZLEI_ID,
    },
  ],

  getOrCreateUser: async () => ({
    __kind__: "ok",
    ok: {
      id: PROVIDER_ID,
      titel: "Dr.",
      nachname: "Müller",
      stundensatz: BigInt(35000),
      email: "mueller@kanzlei-beispiel.ch",
      vorname: "Andreas",
      isAdmin: true,
      status: "aktiv",
      statusHistory: [],
      registeredAt: BigInt(1700000000000),
      kanzleiId: KANZLEI_ID,
    },
  }),

  getRechnung: async () => ({
    id: "rechnung-001",
    rechnungsnummer: "RE-2026-001",
    total: BigInt(250000),
    waehrung: "CHF",
    rechnungsdatum: "01.03.2026",
    createdAt: BigInt(1709000000000),
    mwstBetrag: BigInt(19575),
    leistungserbringerId: PROVIDER_ID,
    faelligkeitsdatum: "31.03.2026",
    zahlungsstatus: "bezahlt" as ZahlungsStatus,
    zahlungsbedingungen: "30 Tage netto",
    leistungszeitraumBis: "28.02.2026",
    leistungszeitraumVon: "01.02.2026",
    leistungspositionen: [],
    auslageIds: [],
    mandatId: MANDAT_ID_1,
    kanzleiId: KANZLEI_ID,
    subtotal: BigInt(230425),
  }),

  getRechnungen: async () => [
    {
      id: "rechnung-001",
      rechnungsnummer: "RE-2026-001",
      total: BigInt(250000),
      waehrung: "CHF",
      rechnungsdatum: "01.03.2026",
      createdAt: BigInt(1709000000000),
      mwstBetrag: BigInt(19575),
      leistungserbringerId: PROVIDER_ID,
      faelligkeitsdatum: "31.03.2026",
      zahlungsstatus: "bezahlt" as ZahlungsStatus,
      zahlungsbedingungen: "30 Tage netto",
      leistungszeitraumBis: "28.02.2026",
      leistungszeitraumVon: "01.02.2026",
      leistungspositionen: [],
      auslageIds: [],
      mandatId: MANDAT_ID_1,
      kanzleiId: KANZLEI_ID,
      subtotal: BigInt(230425),
    },
    {
      id: "rechnung-002",
      rechnungsnummer: "RE-2026-002",
      total: BigInt(185000),
      waehrung: "CHF",
      rechnungsdatum: "01.04.2026",
      createdAt: BigInt(1711900000000),
      mwstBetrag: BigInt(14468),
      leistungserbringerId: PROVIDER_ID,
      faelligkeitsdatum: "01.05.2026",
      zahlungsstatus: "offen" as ZahlungsStatus,
      zahlungsbedingungen: "30 Tage netto",
      leistungszeitraumBis: "31.03.2026",
      leistungszeitraumVon: "01.03.2026",
      leistungspositionen: [],
      auslageIds: [],
      mandatId: MANDAT_ID_2,
      kanzleiId: KANZLEI_ID,
      subtotal: BigInt(170532),
    },
    {
      id: "rechnung-003",
      rechnungsnummer: "RE-2026-003",
      total: BigInt(320000),
      waehrung: "CHF",
      rechnungsdatum: "15.03.2026",
      createdAt: BigInt(1710500000000),
      mwstBetrag: BigInt(25032),
      leistungserbringerId: PROVIDER_ID,
      faelligkeitsdatum: "14.04.2026",
      zahlungsstatus: "ueberfaellig" as ZahlungsStatus,
      zahlungsbedingungen: "30 Tage netto",
      leistungszeitraumBis: "14.03.2026",
      leistungszeitraumVon: "01.02.2026",
      leistungspositionen: [],
      auslageIds: [],
      mandatId: MANDAT_ID_1,
      kanzleiId: KANZLEI_ID,
      subtotal: BigInt(294968),
    },
  ],

  getTimer: async () => ({
    startTime: BigInt(Date.now() - 1800000),
    userId: PROVIDER_ID,
    leistungId: "leistung-001",
    baseDauer: BigInt(30),
  }),

  listTimers: async () => [
    {
      startTime: BigInt(Date.now() - 1800000),
      userId: PROVIDER_ID,
      leistungId: "leistung-001",
      baseDauer: BigInt(30),
    },
  ],

  startTimer: async () => ({
    __kind__: "ok" as const,
    ok: {
      startTime: BigInt(Date.now()),
      userId: PROVIDER_ID,
      leistungId: "leistung-001",
      baseDauer: BigInt(0),
    },
  }),

  stopTimer: async () => ({
    __kind__: "ok" as const,
    ok: BigInt(90),
  }),

  getZahlungen: async () => [
    {
      id: "zahlung-001",
      status: "bestaetigt" as ZahlungEingangStatus,
      createdAt: BigInt(1709500000000),
      rechnungId: "rechnung-001",
      betrag: BigInt(250000),
      datum: "28.03.2026",
      kanzleiId: KANZLEI_ID,
    },
  ],

  registerKanzlei: async () => ({ __kind__: "ok", ok: "kanzlei-001" }),

  updateAuslage: async () => ({
    __kind__: "ok",
    ok: {
      id: "auslage-001",
      status: "offen" as AuslagenStatus,
      createdAt: BigInt(1712000000000),
      leistungserbringerId: PROVIDER_ID,
      betrag: BigInt(8500),
      kategorie: "porto" as AuslagenKategorie,
      beschreibung: "Einschreiben",
      datum: "15.04.2026",
      mandatId: MANDAT_ID_1,
      kanzleiId: KANZLEI_ID,
    },
  }),

  updateKlient: async () => ({
    __kind__: "ok",
    ok: {
      id: KLIENT_ID_1,
      plzOrt: "8001 Zürich",
      name: "Huber & Partner AG",
      createdAt: BigInt(1700000000000),
      email: "info@huber-partner.ch",
      telefon: "+41 44 222 33 44",
      kanzleiId: KANZLEI_ID,
      strasse: "Paradeplatz 5",
    },
  }),

  updateLeistung: async () => ({
    __kind__: "ok",
    ok: {
      id: "leistung-001",
      status: "offen" as Leistung["status"],
      taetigkeit: "Beratung",
      createdAt: BigInt(1712000000000),
      leistungserbringerId: PROVIDER_ID,
      datum: "15.04.2026",
      dauer: BigInt(90),
      honorar: BigInt(52500),
      mandatId: MANDAT_ID_1,
      kanzleiId: KANZLEI_ID,
    },
  }),

  updateMandat: async () => ({
    __kind__: "ok",
    ok: {
      id: MANDAT_ID_1,
      status: "aktiv" as MandatStatus,
      rundungAktiv: true,
      bezeichnung: "Gesellschaftsrecht – Fusion",
      auslagenregelung: Auslagenregelung.Effektiv,
      createdAt: BigInt(1700000000000),
      akquisitionsbonus: BigInt(10000),
      mwstSatz: BigInt(8100),
      standardStundensatz: BigInt(35000),
      pauschalBetrag: BigInt(0),
      zahlungsbedingungen: "30 Tage netto",
      akquisiteurId: PROVIDER_ID,
      budget: BigInt(2000000),
      waehrung: "CHF",
      kostenProKopie: 0.5,
      kostenProScan: 0.5,
      portoAPost: 1.2,
      portoBPost: 0.9,
      portoEinschreiben: 4.5,
      autokilometer: 0.7,
      leistungenAusweisen: true,
      klientId: KLIENT_ID_1,
      kanzleiId: KANZLEI_ID,
    },
  }),

  updateUserProfile: async () => ({ __kind__: "ok", ok: null }),
  updateZahlungsstatus: async () => ({ __kind__: "ok", ok: null }),

  createInviteLink: async () => ({ __kind__: "ok", ok: "invite-token-001" }),

  getInviteLinks: async () => [
    {
      token: "invite-token-001",
      email: "neuer.anwalt@kanzlei-beispiel.ch",
      createdAt: BigInt(1712000000000),
      createdBy: PROVIDER_ID,
      kanzleiId: KANZLEI_ID,
    },
  ],

  getKanzlei: async () => ({
    id: KANZLEI_ID,
    name: "Müller & Partner Rechtsanwälte",
    defaultStundensatz: BigInt(35000),
    status: "aktiv",
    zahlungsmodalitaet: Zahlungsmodalitaet.jahres,
    createdAt: BigInt(1700000000000),
  }),

  redeemInviteLink: async () => ({
    __kind__: "ok",
    ok: {
      id: PROVIDER_ID,
      titel: "lic. iur.",
      nachname: "Neuer",
      stundensatz: BigInt(28000),
      email: "neuer.anwalt@kanzlei-beispiel.ch",
      vorname: "Hans",
      isAdmin: false,
      status: "aktiv",
      statusHistory: [],
      registeredAt: BigInt(Date.now()),
      kanzleiId: KANZLEI_ID,
    },
  }),

  removeLeistungserbringer: async () => ({ __kind__: "ok", ok: null }),

  // ─── Neue Lösch-/Deaktivieren-Methoden ─────────────────────────────────────
  // deleteLeistungserbringer (physisch löschen), deleteKanzlei (physisch
  // löschen), deactivateKanzlei (status='inaktiv'), reactivateKanzlei
  // (status='aktiv'). Alle geben Result zurück.
  deleteLeistungserbringer: async () => ({ __kind__: "ok" as const, ok: null }),

  deleteKanzlei: async () => ({ __kind__: "ok" as const, ok: null }),

  deactivateKanzlei: async () => ({ __kind__: "ok" as const, ok: null }),

  reactivateKanzlei: async () => ({ __kind__: "ok" as const, ok: null }),

  updateKanzleiStundensatz: async () => ({ __kind__: "ok", ok: null }),

  updateLeistungserbringer: async () => ({ __kind__: "ok", ok: null }),

  // ─── Datenschutz (revDSG) Mocks ────────────────────────────────────────────
  getAuditTrail: async () => [
    {
      id: "audit-001",
      action: "schreiben",
      entityId: "klient-001",
      afterValue: "Huber & Partner AG",
      timestamp: BigInt(1713000000000),
      beforeValue: "Huber AG",
      actorPrincipal: PROVIDER_ID,
      entityType: "Klient",
      kanzleiId: KANZLEI_ID,
    },
    {
      id: "audit-002",
      action: "lesen",
      entityId: "mandat-001",
      timestamp: BigInt(1712900000000),
      actorPrincipal: PROVIDER_ID,
      entityType: "Mandat",
      kanzleiId: KANZLEI_ID,
    },
    {
      id: "audit-003",
      action: "loeschen",
      entityId: "rechnung-005",
      timestamp: BigInt(1712800000000),
      actorPrincipal: PROVIDER_ID,
      entityType: "Rechnung",
      kanzleiId: KANZLEI_ID,
    },
  ],

  getConsentRecords: async () => [
    {
      id: "consent-001",
      principal: PROVIDER_ID,
      dsgVersion: "v1.2",
      timestamp: BigInt(1700000000000),
      consentGiven: true,
      klientId: KLIENT_ID_1,
      kanzleiId: KANZLEI_ID,
    },
    {
      id: "consent-002",
      principal: PROVIDER_ID,
      dsgVersion: "v1.2",
      timestamp: BigInt(1705000000000),
      consentGiven: true,
      klientId: KLIENT_ID_2,
      kanzleiId: KANZLEI_ID,
    },
  ],

  getDsrRequests: async () => [
    {
      id: "dsr-001",
      status: DsrStatus.inBearbeitung,
      dsrType: DsrType.auskunft,
      createdAt: BigInt(1712000000000),
      updatedAt: BigInt(1712500000000),
      requesterEmail: "max.mustermann@beispiel.ch",
      requesterName: "Max Mustermann",
      kanzleiId: KANZLEI_ID,
      requesterId: KLIENT_ID_1,
    },
    {
      id: "dsr-002",
      status: DsrStatus.erfasst,
      dsrType: DsrType.loeschung,
      createdAt: BigInt(1712300000000),
      updatedAt: BigInt(1712300000000),
      requesterEmail: "anna.beispiel@beispiel.ch",
      requesterName: "Anna Beispiel",
      kanzleiId: KANZLEI_ID,
      requesterId: KLIENT_ID_2,
    },
    {
      id: "dsr-003",
      status: DsrStatus.abgeschlossen,
      dsrType: DsrType.berichtigung,
      completedAt: BigInt(1712400000000),
      createdAt: BigInt(1711000000000),
      updatedAt: BigInt(1712400000000),
      requesterEmail: "peter.dritter@beispiel.ch",
      requesterName: "Peter Dritter",
      kanzleiId: KANZLEI_ID,
    },
  ],

  createDsrRequest: async (req: DsrRequest) => ({
    id: "dsr-new",
    status: DsrStatus.erfasst,
    dsrType: req.dsrType ?? DsrType.auskunft,
    createdAt: BigInt(Date.now()),
    updatedAt: BigInt(Date.now()),
    requesterEmail: req.requesterEmail,
    requesterName: req.requesterName,
    kanzleiId: req.kanzleiId ?? KANZLEI_ID,
    requesterId: req.requesterId,
    assignedTo: req.assignedTo,
    completedAt: req.completedAt,
    notes: req.notes,
  } as DsrRequest),

  updateDsrRequest: async () => ({
    __kind__: "ok" as const,
    ok: {
      id: "dsr-001",
      status: DsrStatus.inBearbeitung,
      dsrType: DsrType.auskunft,
      createdAt: BigInt(1700000000000),
      updatedAt: BigInt(Date.now()),
      requesterEmail: "mandant@beispiel.ch",
      requesterName: "Max Mustermann",
      kanzleiId: KANZLEI_ID,
    } as DsrRequest,
  }),

  getRetentionPolicies: async () => [
    {
      id: "retention-001",
      retentionYears: BigInt(10),
      categoryName: "Mandatsakten",
      createdAt: BigInt(1700000000000),
      updatedAt: BigInt(1700000000000),
      legalBasis: "Art. 962 OR",
      isLocked: true,
      kanzleiId: KANZLEI_ID,
    },
    {
      id: "retention-002",
      retentionYears: BigInt(10),
      categoryName: "Rechnungen",
      createdAt: BigInt(1700000000000),
      updatedAt: BigInt(1700000000000),
      legalBasis: "Art. 957 OR",
      isLocked: true,
      kanzleiId: KANZLEI_ID,
    },
    {
      id: "retention-003",
      retentionYears: BigInt(2),
      categoryName: "Audit-Logs",
      createdAt: BigInt(1700000000000),
      updatedAt: BigInt(1700000000000),
      legalBasis: "Art. 12 revDSG",
      isLocked: false,
      kanzleiId: KANZLEI_ID,
    },
  ],

  updateRetentionPolicy: async () => ({
    __kind__: "ok" as const,
    ok: {
      id: "retention-001",
      retentionYears: BigInt(10),
      categoryName: "Mandatsakten",
      createdAt: BigInt(1700000000000),
      updatedAt: BigInt(Date.now()),
      isLocked: false,
      kanzleiId: KANZLEI_ID,
    } as RetentionPolicy,
  }),

  getPendingDeletions: async () => [
    ["Mandatsakten", "mandat-005", BigInt(1710000000000)],
    ["Rechnungen", "rechnung-008", BigInt(1710500000000)],
  ],

  executeDeletion: async () => ({ __kind__: "ok" as const, ok: null }),

  getDataInventory: async () => [
    {
      id: "inventory-001",
      storageDuration: "10 Jahre",
      categoryName: "Mandatsakten",
      accessRole: Role.anwalt,
      description: "Sämtliche Mandatsdokumente und Korrespondenz",
      storageLocation: "Caffeine File Storage",
      kanzleiId: KANZLEI_ID,
    },
    {
      id: "inventory-002",
      storageDuration: "10 Jahre",
      categoryName: "Rechnungen",
      accessRole: Role.admin,
      description: "Ausgestellte Rechnungen und Zahlungen",
      storageLocation: "Canister Storage",
      kanzleiId: KANZLEI_ID,
    },
    {
      id: "inventory-003",
      storageDuration: "2 Jahre",
      categoryName: "Audit-Logs",
      accessRole: Role.admin,
      description: "Unveränderliche Protokollierung aller Änderungen",
      storageLocation: "Canister Storage",
      kanzleiId: KANZLEI_ID,
    },
    {
      id: "inventory-004",
      storageDuration: "Laufzeit Mandat",
      categoryName: "Mitarbeiterdaten",
      accessRole: Role.admin,
      description: "Stammdaten der Leistungserbringer",
      storageLocation: "Canister Storage",
      kanzleiId: KANZLEI_ID,
    },
  ],

  updateDataInventoryEntry: async () => ({
    __kind__: "ok" as const,
    ok: {
      id: "inventory-001",
      storageDuration: "10 Jahre",
      categoryName: "Mandatsakten",
      accessRole: Role.anwalt,
      storageLocation: "Lokal",
      kanzleiId: KANZLEI_ID,
    } as DataInventoryEntry,
  }),

  getDataFlows: async () => [
    {
      id: "flow-001",
      destination: "Caffeine File Storage",
      what: "Mandatsdokumente",
      isExternal: false,
      flowName: "Dokumentenspeicherung",
      legalBasis: "Art. 6 revDSG",
      purpose: "Sichere Ablage von Mandatsakten",
      kanzleiId: KANZLEI_ID,
    },
    {
      id: "flow-002",
      destination: "OpenAI API",
      what: "Anonymisierte Texte",
      isExternal: true,
      flowName: "KI-gestützte Zusammenfassung",
      legalBasis: "Art. 6 revDSG (Auftragsverarbeitung)",
      purpose: "Automatische Zusammenfassung von Dokumenten",
      kanzleiId: KANZLEI_ID,
    },
    {
      id: "flow-003",
      destination: "Bexio",
      what: "Rechnungsdaten",
      isExternal: true,
      flowName: "Buchhaltungssynchronisation",
      legalBasis: "Art. 6 revDSG (Auftragsverarbeitung)",
      purpose: "Buchhaltungs- und Rechnungswesen",
      kanzleiId: KANZLEI_ID,
    },
    {
      id: "flow-004",
      destination: "E-Mail-Versand",
      what: "Rechnungen",
      isExternal: true,
      flowName: "Rechnungsversand",
      legalBasis: "Art. 6 revDSG",
      purpose: "Zustellung von Rechnungen an Mandanten",
      kanzleiId: KANZLEI_ID,
    },
  ],

  updateDataFlowEntry: async () => ({
    __kind__: "ok" as const,
    ok: {
      id: "flow-001",
      destination: "Gericht",
      what: "Klageunterlagen",
      isExternal: true,
      flowName: "Klageeinreichung",
      legalBasis: "Art. 31 revDSG",
      purpose: "Rechtsdurchsetzung",
      kanzleiId: KANZLEI_ID,
    } as DataFlowEntry,
  }),

  getDsgVersion: async () => ({
    version: "v1.2",
    content: "Datenschutzerklärung der iServices AG gemäss revDSG…",
    publishedAt: BigInt(1700000000000),
  }),

  updateDsgVersion: async (version: string, content: string | null) => ({
    version,
    content: content ?? undefined,
    publishedAt: BigInt(Date.now()),
  } as DsgVersion),

  getDashboardStats: async () => ({
    totalRecordsByCategory: [
      ["Mandatsakten", BigInt(124)],
      ["Rechnungen", BigInt(86)],
      ["Mitarbeiterdaten", BigInt(12)],
      ["Audit-Logs", BigInt(1540)],
    ] as Array<[string, bigint]>,
    pendingDeletions: BigInt(2),
    openDsrRequests: BigInt(2),
    auditExports: BigInt(7),
    missingConsents: BigInt(1),
  }),

  logDataAccess: async () => undefined,

  logAuditEntry: async () => undefined,

  exportAuditTrailCsv: async () => "",

  exportAuditTrailPdf: async () => new Uint8Array(),

  recordConsent: async (klientId: string, dsgVersion: string) => ({
    id: "consent-new",
    principal: PROVIDER_ID,
    dsgVersion,
    timestamp: BigInt(Date.now()),
    consentGiven: true,
    klientId,
    kanzleiId: KANZLEI_ID,
  } as ConsentRecord),

  schema: async () => "",

  execute: async () => ({
    hasMore: false,
    rows: [],
  }),

  // ─── Super-Admin & Kanzlei-Verwaltung Mocks ────────────────────────────────
  addSuperAdmin: async () => ({ __kind__: "ok" as const, ok: null }),

  removeSuperAdmin: async () => ({ __kind__: "ok" as const, ok: null }),

  getSuperAdmins: async () => [
    {
      principal: PROVIDER_ID,
      addedAt: BigInt(1700000000000),
    },
  ],

  isSuperAdmin: async () => true,

  getAllKanzleienOverview: async () => [
    {
      id: KANZLEI_ID,
      status: "aktiv",
      billingStatus: { __kind__: "bezahlt" } as any,
      name: "Müller & Partner Rechtsanwälte",
      createdAt: BigInt(1700000000000),
      aboModell: { __kind__: "jahres" } as any,
      userCount: BigInt(4),
      stammdatenKanzleiname: "Müller & Partner Rechtsanwälte",
      stammdatenUid: "CHE-123.456.789",
      stammdatenMwstNr: "CHE-123.456.789 MWST",
      stammdatenAdresse: "Bahnhofstrasse 12, 8001 Zürich",
    },
    {
      id: "kanzlei-002",
      status: "aktiv",
      billingStatus: { __kind__: "offen" } as any,
      name: "Weber & Söhne AG",
      createdAt: BigInt(1705000000000),
      aboModell: { __kind__: "monats" } as any,
      userCount: BigInt(7),
      stammdatenKanzleiname: "Weber & Söhne AG",
      stammdatenUid: "CHE-987.654.321",
      stammdatenMwstNr: "CHE-987.654.321 MWST",
      stammdatenAdresse: "Marktplatz 5, 4001 Basel",
    },
    {
      id: "kanzlei-003",
      status: "inaktiv",
      billingStatus: { __kind__: "ueberfaellig" } as any,
      name: "Berner Treuhand GmbH",
      createdAt: BigInt(1710000000000),
      aboModell: { __kind__: "keine" } as any,
      userCount: BigInt(2),
      stammdatenKanzleiname: "Berner Treuhand GmbH",
      stammdatenUid: "CHE-555.111.222",
      stammdatenMwstNr: "CHE-555.111.222 MWST",
      stammdatenAdresse: "Schauplatzgasse 1, 3011 Bern",
    },
  ],

  exportKanzleienCsv: async () => "",

  exportKanzleienPdf: async () => new Uint8Array(0),

  getActiveUsersPerMonth: async (kanzleiId: KanzleiId, year: bigint) => {
    const P1 = { _isPrincipal: true, toString: () => "provider-001" } as any;
    const P2 = { _isPrincipal: true, toString: () => "provider-002" } as any;
    const P3 = { _isPrincipal: true, toString: () => "provider-003" } as any;
    const months = [
        { month: BigInt(1), year, total: BigInt(3), users: [
          { userId: P1, name: "Dr. Andreas Müller", isActive: true },
          { userId: P2, name: "Sandra Weber", isActive: true },
          { userId: P3, name: "Thomas Berger", isActive: true },
        ] },
        { month: BigInt(2), year, total: BigInt(3), users: [
          { userId: P1, name: "Dr. Andreas Müller", isActive: true },
          { userId: P2, name: "Sandra Weber", isActive: true },
          { userId: P3, name: "Thomas Berger", isActive: true },
        ] },
        { month: BigInt(3), year, total: BigInt(2), users: [
          { userId: P1, name: "Dr. Andreas Müller", isActive: true },
          { userId: P2, name: "Sandra Weber", isActive: false },
          { userId: P3, name: "Thomas Berger", isActive: true },
        ] },
        { month: BigInt(4), year, total: BigInt(3), users: [
          { userId: P1, name: "Dr. Andreas Müller", isActive: true },
          { userId: P2, name: "Sandra Weber", isActive: true },
          { userId: P3, name: "Thomas Berger", isActive: true },
        ] },
        { month: BigInt(5), year, total: BigInt(2), users: [
          { userId: P1, name: "Dr. Andreas Müller", isActive: true },
          { userId: P2, name: "Sandra Weber", isActive: true },
          { userId: P3, name: "Thomas Berger", isActive: false },
        ] },
        { month: BigInt(6), year, total: BigInt(3), users: [
          { userId: P1, name: "Dr. Andreas Müller", isActive: true },
          { userId: P2, name: "Sandra Weber", isActive: true },
          { userId: P3, name: "Thomas Berger", isActive: true },
        ] },
        { month: BigInt(7), year, total: BigInt(3), users: [
          { userId: P1, name: "Dr. Andreas Müller", isActive: true },
          { userId: P2, name: "Sandra Weber", isActive: true },
          { userId: P3, name: "Thomas Berger", isActive: true },
        ] },
        { month: BigInt(8), year, total: BigInt(2), users: [
          { userId: P1, name: "Dr. Andreas Müller", isActive: false },
          { userId: P2, name: "Sandra Weber", isActive: true },
          { userId: P3, name: "Thomas Berger", isActive: true },
        ] },
        { month: BigInt(9), year, total: BigInt(3), users: [
          { userId: P1, name: "Dr. Andreas Müller", isActive: true },
          { userId: P2, name: "Sandra Weber", isActive: true },
          { userId: P3, name: "Thomas Berger", isActive: true },
        ] },
        { month: BigInt(10), year, total: BigInt(3), users: [
          { userId: P1, name: "Dr. Andreas Müller", isActive: true },
          { userId: P2, name: "Sandra Weber", isActive: true },
          { userId: P3, name: "Thomas Berger", isActive: true },
        ] },
        { month: BigInt(11), year, total: BigInt(2), users: [
          { userId: P1, name: "Dr. Andreas Müller", isActive: true },
          { userId: P2, name: "Sandra Weber", isActive: false },
          { userId: P3, name: "Thomas Berger", isActive: true },
        ] },
        { month: BigInt(12), year, total: BigInt(3), users: [
          { userId: P1, name: "Dr. Andreas Müller", isActive: true },
          { userId: P2, name: "Sandra Weber", isActive: true },
          { userId: P3, name: "Thomas Berger", isActive: true },
        ] },
      ];
    // Jahrestotal = Anzahl DISTINCT aktiver Benutzer über die 12 Monate
    // (dedup nach userId.toString()). P1, P2, P3 sind jeweils in mind. einem
    // Monat aktiv → yearTotal = 3.
    const activeUserIds = new Set<string>();
    for (const m of months) {
      for (const u of m.users) {
        if (u.isActive) activeUserIds.add(u.userId.toString());
      }
    }
    return {
      year,
      kanzleiId,
      months,
      yearTotal: BigInt(activeUserIds.size),
    };
  },

  getAllActiveUsersPerMonth: async (year: bigint) => {
    const P1 = { _isPrincipal: true, toString: () => "provider-001" } as any;
    const P2 = { _isPrincipal: true, toString: () => "provider-002" } as any;
    const P3 = { _isPrincipal: true, toString: () => "provider-003" } as any;
    const buildMonths = (totals: number[]) =>
      totals.map((t, i) => ({
        month: BigInt(i + 1),
        year,
        total: BigInt(t),
        users: Array.from({ length: t }, (_, j) => ({
          userId: j === 0 ? P1 : j === 1 ? P2 : P3,
          name:
            j === 0
              ? "Dr. Andreas Müller"
              : j === 1
                ? "Sandra Weber"
                : "Thomas Berger",
          isActive: true,
        })),
      }));
    // Jahrestotal = Anzahl DISTINCT aktiver Benutzer über die 12 Monate
    // (dedup nach userId.toString()). Für die Mocks baut buildMonths pro
    // Monat bis zu 3 distinct Benutzer (P1/P2/P3); das Maximum über alle
    // Monate entspricht der Anzahl jemals aktiver distinct Benutzer.
    const buildYearTotal = (totals: number[]) => {
      const activeUserIds = new Set<string>();
      const months = buildMonths(totals);
      for (const m of months) {
        for (const u of m.users) {
          if (u.isActive) activeUserIds.add(u.userId.toString());
        }
      }
      return BigInt(activeUserIds.size);
    };
    return [
      {
        kanzleiId: KANZLEI_ID,
        kanzleiName: "Müller & Partner Rechtsanwälte",
        year,
        months: buildMonths([3, 3, 2, 3, 2, 3, 3, 2, 3, 3, 2, 3]),
        yearTotal: buildYearTotal([3, 3, 2, 3, 2, 3, 3, 2, 3, 3, 2, 3]),
      },
      {
        kanzleiId: "kanzlei-002",
        kanzleiName: "Weber & Söhne AG",
        year,
        months: buildMonths([7, 7, 6, 7, 7, 7, 7, 6, 7, 7, 7, 7]),
        yearTotal: buildYearTotal([7, 7, 6, 7, 7, 7, 7, 6, 7, 7, 7, 7]),
      },
      {
        kanzleiId: "kanzlei-003",
        kanzleiName: "Berner Treuhand GmbH",
        year,
        months: buildMonths([2, 2, 2, 2, 1, 2, 2, 2, 2, 2, 2, 2]),
        yearTotal: buildYearTotal([2, 2, 2, 2, 1, 2, 2, 2, 2, 2, 2, 2]),
      },
    ];
  },

  migrateRoles: async () => ({
    __kind__: "ok" as const,
    ok: {
      convertedCount: BigInt(0),
      unchangedCount: BigInt(0),
      results: [],
    },
  }),

  updateUserRole: async () => ({
    __kind__: "ok" as const,
    ok: {
      id: PROVIDER_ID,
      titel: "Dr.",
      nachname: "Müller",
      stundensatz: BigInt(35000),
      email: "mueller@kanzlei-beispiel.ch",
      vorname: "Andreas",
      isAdmin: true,
      status: "aktiv",
      statusHistory: [],
      registeredAt: BigInt(1700000000000),
      kanzleiId: KANZLEI_ID,
      role: Role.admin,
    },
  }),

  getMyRole: async () => Role.admin,

  getUserRole: async () => ({
    __kind__: "ok" as const,
    ok: Role.anwalt,
  }),

  promoteJoaoMarques: async () => ({
    __kind__: "ok" as const,
    ok: {
      principal: PROVIDER_ID,
      email: "joao.marques@beispiel.ch",
      changed: true,
      whitelistAdded: true,
    },
  }),

  // ─── Rechnungsvorlagen Mocks ────────────────────────────────────────────────
  getRechnungsvorlage: async () => null,

  saveRechnungsvorlage: async (vorlage: Rechnungsvorlage) => ({
    __kind__: "ok" as const,
    ok: {
      ...vorlage,
      kanzleiId: KANZLEI_ID,
      updatedAt: BigInt(Date.now()),
    },
  }),

  uploadLogo: async () => ({
    __kind__: "ok" as const,
    ok: null,
  }),

  getLogo: () => Promise.resolve(null),
  removeLogo: async () => ({ __kind__: "ok" as const, ok: null }),

  getKanzleiStammdaten: async () => ({
    kanzleiname: "Müller & Partner Rechtsanwälte",
    strasseHausnummer: "Bahnhofstrasse 12",
    plz: "8001",
    ort: "Zürich",
    land: "Schweiz",
    telefon: "+41 44 123 45 67",
    email: "kontakt@mueller-partner.ch",
    website: "www.mueller-partner.ch",
    uid: "CHE-123.456.789",
    mwstNr: "CHE-123.456.789 MWST",
    kanzleiLogoBlob: new Uint8Array(0),
  }),

  updateKanzleiStammdaten: async () => ({
    __kind__: "ok" as const,
    ok: {
      kanzleiname: "Müller & Partner Rechtsanwälte",
      strasseHausnummer: "Bahnhofstrasse 12",
      plz: "8001",
      ort: "Zürich",
      land: "Schweiz",
      telefon: "+41 44 123 45 67",
      email: "kontakt@mueller-partner.ch",
      website: "www.mueller-partner.ch",
      uid: "CHE-123.456.789",
      mwstNr: "CHE-123.456.789 MWST",
      kanzleiLogoBlob: new Uint8Array(0),
    },
  }),

  // ─── Support (Feedback) Mocks ─────────────────────────────────────────────
  // Sample data (SUPPORT_CONVERSATIONS / SUPPORT_MESSAGES) is declared at
  // module scope above so the stubs below can reference it. Stubs implement
  // all 9 support methods of backendInterface.
  addSupportMessage: async (_conversationId: SupportConversationId, _message: string): Promise<Result_27> => ({
    __kind__: "ok" as const,
    ok: {
      id: "support-msg-new",
      senderUserName: "Dr. Andreas Müller",
      createdAt: BigInt(Date.now()),
      conversationId: _conversationId,
      message: _message,
      senderType: SupportSenderType.user,
      senderUserId: PROVIDER_ID.toString(),
    } as SupportMessage,
  }),

  createSupportConversation: async (
    _category: SupportCategory,
    _subject: string,
    _message: string,
    _appRoute: string,
    _appVersion: string,
  ): Promise<Result_3> => ({
    __kind__: "ok" as const,
    ok: {
      id: "support-conv-new",
      status: SupportStatus.neu,
      appRoute: _appRoute,
      subject: _subject,
      createdByUserId: PROVIDER_ID.toString(),
      createdAt: BigInt(Date.now()),
      appVersion: _appVersion,
      updatedAt: BigInt(Date.now()),
      category: _category,
      kanzleiId: KANZLEI_ID,
      createdByUserName: "Dr. Andreas Müller",
    } as SupportConversation,
  }),

  getAllSupportConversations: async (): Promise<Result_23> => ({
    __kind__: "ok" as const,
    ok: SUPPORT_CONVERSATIONS,
  }),

  getMySupportConversations: async () => SUPPORT_CONVERSATIONS,

  getSupportConversation: async (_conversationId: SupportConversationId): Promise<Result_21> => {
    const conv = SUPPORT_CONVERSATIONS.find((c) => c.id === _conversationId);
    if (!conv) {
      return { __kind__: "err" as const, err: "Conversation not found (mock)" };
    }
    const msgs = SUPPORT_MESSAGES.filter((m) => m.conversationId === _conversationId);
    return {
      __kind__: "ok" as const,
      ok: {
        conversation: conv,
        messages: msgs,
      } as SupportConversationWithMessages,
    };
  },

  getUnreadSupportCountForAdmin: async (): Promise<Result_13> => ({
    __kind__: "ok" as const,
    ok: BigInt(
      SUPPORT_CONVERSATIONS.filter((c) => c.status === SupportStatus.neu).length,
    ),
  }),

  getUnreadSupportCountForUser: async () => BigInt(1),

  markSupportMessageRead: async (_conversationId: SupportConversationId): Promise<Result> => ({
    __kind__: "ok" as const,
    ok: null,
  }),

  updateSupportStatus: async (
    _conversationId: SupportConversationId,
    _newStatus: SupportStatus,
  ): Promise<Result_3> => ({
    __kind__: "ok" as const,
    ok: {
      id: _conversationId,
      status: _newStatus,
      appRoute: "/",
      subject: "Support-Anfrage",
      createdByUserId: PROVIDER_ID.toString(),
      createdAt: BigInt(Date.now()),
      appVersion: "0.0.0",
      updatedAt: BigInt(Date.now()),
      category: SupportCategory.frage,
      kanzleiId: KANZLEI_ID,
      createdByUserName: "Dr. Andreas Müller",
    } as SupportConversation,
  }),

  // ─── Registrierung (PendingRegistration) Mocks ─────────────────────────────
  changeEmail: async (): Promise<Result> => ({
    __kind__: "ok" as const,
    ok: null,
  }),

  completeRegistration: async (): Promise<Result_25> => ({
    __kind__: "ok" as const,
    ok: KANZLEI_ID,
  }),

  getPendingRegistration: async (): Promise<PendingRegistrationView | null> => null,

  sendVerificationCode: async (): Promise<Result_15> => ({
    __kind__: "ok" as const,
    ok: "pending-reg-001",
  }),

  verifyEmail: async (): Promise<Result> => ({
    __kind__: "ok" as const,
    ok: null,
  }),
};
