import type { Principal } from "@icp-sdk/core/principal";
export interface Some<T> {
    __kind__: "Some";
    value: T;
}
export interface None {
    __kind__: "None";
}
export type Option<T> = Some<T> | None;
import type { ExternalBlob } from "@caffeineai/object-storage";
export type { ExternalBlob } from "@caffeineai/object-storage";
export type Result_20 = {
    __kind__: "ok";
    ok: Role;
} | {
    __kind__: "err";
    err: string;
};
export type Result_2 = {
    __kind__: "ok";
    ok: Leistungserbringer;
} | {
    __kind__: "err";
    err: string;
};
export type SupportConversationId = string;
export type LeistungId = string;
export interface Result__1 {
    hasMore: boolean;
    rows: Array<Array<Cell>>;
}
export type Result_4 = {
    __kind__: "ok";
    ok: RetentionPolicy;
} | {
    __kind__: "err";
    err: string;
};
export interface Auslage {
    id: AuslageId;
    status: AuslagenStatus;
    createdAt: Timestamp;
    leistungserbringerId: Principal;
    rechnungId?: RechnungId;
    betrag: bigint;
    kategorie: AuslagenKategorie;
    beschreibung: string;
    datum: string;
    mandatId: MandatId;
    kanzleiId: KanzleiId;
}
export interface KanzleiOverview {
    id: KanzleiId;
    stammdatenAdresse: string;
    status: string;
    billingStatus: BillingStatus;
    stammdatenMwstNr: string;
    name: string;
    createdAt: Timestamp;
    stammdatenUid: string;
    stammdatenKanzleiname: string;
    aboModell: AboModell;
    userCount: bigint;
}
export interface MonthlyTotal {
    month: bigint;
    total: bigint;
    auslagen: bigint;
    year: bigint;
    verrechnete: bigint;
    honorar: bigint;
}
export interface VorlageLayout {
    logoPosition: Position;
    empfaengerPosition: Position;
    fusszeile: string;
    absenderPosition: Position;
}
export type AuslageId = string;
export interface Rechnungsvorlage {
    standardtexte: Standardtexte;
    layout: VorlageLayout;
    logoBlob?: ExternalBlob;
    layoutV2?: VorlageLayoutV2;
    updatedAt: Timestamp;
    kanzleiId: KanzleiId;
}
export type Result_6 = {
    __kind__: "ok";
    ok: Leistung;
} | {
    __kind__: "err";
    err: string;
};
export type Result_26 = {
    __kind__: "ok";
    ok: Zahlung;
} | {
    __kind__: "err";
    err: string;
};
export type Result_12 = {
    __kind__: "ok";
    ok: Auslage;
} | {
    __kind__: "err";
    err: string;
};
export interface DashboardStats {
    pendingDeletions: bigint;
    auditExports: bigint;
    totalRecordsByCategory: Array<[string, bigint]>;
    openDsrRequests: bigint;
    missingConsents: bigint;
}
export type KanzleiId = string;
export type Result = {
    __kind__: "ok";
    ok: null;
} | {
    __kind__: "err";
    err: VerificationError;
};
export type Result_10 = {
    __kind__: "ok";
    ok: DataInventoryEntry;
} | {
    __kind__: "err";
    err: string;
};
export type Result_8 = {
    __kind__: "ok";
    ok: KanzleiStammdaten;
} | {
    __kind__: "err";
    err: string;
};
export interface DataInventoryEntry {
    id: DataInventoryId;
    storageDuration: string;
    categoryName: string;
    accessRole: Role;
    description?: string;
    storageLocation: string;
    kanzleiId: KanzleiId;
}
export type RetentionPolicyId = string;
export interface PendingRegistrationView {
    id: PendingRegistrationId;
    titel: string;
    nachname: string;
    emailVerified: boolean;
    kanzleiName: string;
    createdAt: Timestamp;
    email: string;
    vorname: string;
    zahlungsmodalitaet?: Zahlungsmodalitaet;
    verifiedAt?: Timestamp;
}
export type PendingRegistrationId = string;
export interface AuditTrailFilter {
    toTimestamp?: Timestamp;
    fromTimestamp?: Timestamp;
    entityId?: string;
    actorPrincipal?: Principal;
    entityType?: string;
    kanzleiId: KanzleiId;
}
export type ReportPeriod = {
    __kind__: "monatlich";
    monatlich: bigint;
} | {
    __kind__: "jaehrlich";
    jaehrlich: null;
};
export type Result_13 = {
    __kind__: "ok";
    ok: bigint;
} | {
    __kind__: "err";
    err: string;
};
export type Result_25 = {
    __kind__: "ok";
    ok: KanzleiId;
} | {
    __kind__: "err";
    err: VerificationError;
};
export interface LeistungFilter {
    status?: LeistungStatus;
    datumBis?: string;
    datumVon?: string;
    leistungserbringerId?: Principal;
    mandatId?: MandatId;
}
export type DsrId = string;
export interface SuperAdminWhitelistEntry {
    principal: Principal;
    addedAt: Timestamp;
}
export type Result_11 = {
    __kind__: "ok";
    ok: DataFlowEntry;
} | {
    __kind__: "err";
    err: string;
};
export type Result_27 = {
    __kind__: "ok";
    ok: SupportMessage;
} | {
    __kind__: "err";
    err: string;
};
export type DataFlowId = string;
export interface Klient {
    id: KlientId;
    plzOrt: string;
    name: string;
    createdAt: Timestamp;
    email: string;
    telefon: string;
    kanzleiId: KanzleiId;
    strasse: string;
}
export interface ConsentRecord {
    id: ConsentId;
    principal: Principal;
    dsgVersion: string;
    timestamp: Timestamp;
    consentGiven: boolean;
    klientId: KlientId;
    kanzleiId: KanzleiId;
}
export interface Zahlung {
    id: ZahlungId;
    status: ZahlungEingangStatus;
    createdAt: Timestamp;
    rechnungId: RechnungId;
    betrag: bigint;
    datum: string;
    kanzleiId: KanzleiId;
}
export interface GridArea {
    col: bigint;
    row: bigint;
    rowSpan: bigint;
    colSpan: bigint;
}
export interface FirmReport {
    monthlyBreakdown: Array<MonthlyTotal>;
    totals: MonthlyTotal;
}
export interface DsrRequest {
    id: DsrId;
    status: DsrStatus;
    completedAt?: Timestamp;
    dsrType: DsrType;
    assignedTo?: Principal;
    createdAt: Timestamp;
    updatedAt: Timestamp;
    notes?: string;
    requesterEmail: string;
    requesterName: string;
    kanzleiId: KanzleiId;
    requesterId?: KlientId;
}
export type Result_21 = {
    __kind__: "ok";
    ok: SupportConversationWithMessages;
} | {
    __kind__: "err";
    err: string;
};
export type Result_18 = {
    __kind__: "ok";
    ok: PromotionResult;
} | {
    __kind__: "err";
    err: string;
};
export type Result_3 = {
    __kind__: "ok";
    ok: SupportConversation;
} | {
    __kind__: "err";
    err: string;
};
export interface DataFlowEntry {
    id: DataFlowId;
    destination: string;
    what: string;
    isExternal: boolean;
    flowName: string;
    legalBasis: string;
    purpose: string;
    kanzleiId: KanzleiId;
}
export type Result_23 = {
    __kind__: "ok";
    ok: Array<SupportConversation>;
} | {
    __kind__: "err";
    err: string;
};
export type Result_15 = {
    __kind__: "ok";
    ok: PendingRegistrationId;
} | {
    __kind__: "err";
    err: VerificationError;
};
export type DataInventoryId = string;
export type RechnungId = string;
export interface Rechnung {
    id: RechnungId;
    rechnungsnummer: string;
    total: bigint;
    rechnungsdatum: string;
    createdAt: Timestamp;
    mwstBetrag: bigint;
    leistungserbringerId: Principal;
    faelligkeitsdatum: string;
    zahlungsstatus: ZahlungsStatus;
    zahlungsbedingungen: string;
    leistungszeitraumBis: string;
    leistungszeitraumVon: string;
    leistungspositionen: Array<LeistungId>;
    auslageIds: Array<AuslageId>;
    waehrung: string;
    mandatId: MandatId;
    kanzleiId: KanzleiId;
    subtotal: bigint;
}
export type Result_5 = {
    __kind__: "ok";
    ok: Mandat;
} | {
    __kind__: "err";
    err: string;
};
export interface AllKanzleienActiveUsersReport {
    kanzleiName: string;
    yearTotal: bigint;
    year: bigint;
    months: Array<ActiveUserMonth>;
    kanzleiId: KanzleiId;
}
export interface StatusHistoryEntry {
    status: string;
    month: bigint;
    year: bigint;
}
export interface InviteToken {
    redeemedBy?: Principal;
    token: string;
    createdAt: Timestamp;
    createdBy: Principal;
    email: string;
    kanzleiId: KanzleiId;
}
export interface Cell {
    value: Value;
    name: string;
}
export interface VorlageLayoutV2 {
    marginBottomMm: number;
    pageHeightMm: number;
    gridCols: bigint;
    gridRows: bigint;
    marginRightMm: number;
    marginTopMm: number;
    marginLeftMm: number;
    elements: Array<LayoutElement>;
    pageWidthMm: number;
}
export type Result_7 = {
    __kind__: "ok";
    ok: Klient;
} | {
    __kind__: "err";
    err: string;
};
export interface ProviderComparison {
    total: bigint;
    provider: Leistungserbringer;
}
export interface ActiveUsersYearReport {
    yearTotal: bigint;
    year: bigint;
    months: Array<ActiveUserMonth>;
    kanzleiId: KanzleiId;
}
export interface Kanzlei {
    id: KanzleiId;
    defaultStundensatz: bigint;
    status: string;
    name: string;
    createdAt: Timestamp;
    stammdaten?: KanzleiStammdaten;
    zahlungsmodalitaet?: Zahlungsmodalitaet;
}
export interface TimerState {
    startTime: bigint;
    userId: Principal;
    leistungId: LeistungId;
    baseDauer: bigint;
}
export interface SupportMessage {
    id: SupportMessageId;
    senderUserName: string;
    createdAt: bigint;
    conversationId: SupportConversationId;
    message: string;
    senderType: SupportSenderType;
    senderUserId: string;
    readAt?: bigint;
}
export interface AuditLogEntry {
    id: AuditLogId;
    action: string;
    entityId: string;
    afterValue?: string;
    timestamp: Timestamp;
    beforeValue?: string;
    actorPrincipal: Principal;
    entityType: string;
    kanzleiId: KanzleiId;
}
export type ConsentId = string;
export interface Standardtexte {
    rechnungstitel: string;
    zahlungshinweis: string;
    schlusstext: string;
    einleitung: string;
}
export type Result_9 = {
    __kind__: "ok";
    ok: DsrRequest;
} | {
    __kind__: "err";
    err: string;
};
export interface MigrationSummary {
    convertedCount: bigint;
    results: Array<RoleMigrationResult>;
    unchangedCount: bigint;
}
export interface Leistungserbringer {
    id: Principal;
    status: string;
    titel: string;
    nachname: string;
    role?: Role;
    statusHistory: Array<StatusHistoryEntry>;
    email: string;
    vorname: string;
    isAdmin: boolean;
    registeredAt: Timestamp;
    kanzleiId: KanzleiId;
}
export interface ProviderReport {
    monthlyBreakdown: Array<MonthlyTotal>;
    totals: MonthlyTotal;
    comparisonData: Array<ProviderComparison>;
}
export interface GehaltInfo {
    leistungsbasiert: bigint;
    kanzleianteil: bigint;
    provider: Leistungserbringer;
    gesamtgehalt: bigint;
    akquisitionsboni: bigint;
}
export interface Mandat {
    id: MandatId;
    status: MandatStatus;
    rundungAktiv: boolean;
    bezeichnung: string;
    kostenProScan: number;
    auslagenregelung: Auslagenregelung;
    createdAt: Timestamp;
    kostenProKopie: number;
    leistungenAusweisen: boolean;
    portoEinschreiben: number;
    portoBPost: number;
    akquisitionsbonus: bigint;
    pauschalBetrag: bigint;
    mwstSatz: bigint;
    standardStundensatz: bigint;
    zahlungsbedingungen: string;
    akquisiteurId: Principal;
    budget: bigint;
    autokilometer: number;
    klientId: KlientId;
    waehrung: string;
    portoAPost: number;
    kanzleiId: KanzleiId;
}
export interface SupportConversation {
    id: SupportConversationId;
    status: SupportStatus;
    appRoute: string;
    subject: string;
    createdByUserId: string;
    createdAt: bigint;
    appVersion: string;
    updatedAt: bigint;
    category: SupportCategory;
    kanzleiId: KanzleiId;
    createdByUserName: string;
}
export interface ActiveUserEntry {
    userId: Principal;
    name: string;
    isActive: boolean;
}
export interface ActiveUserMonth {
    month: bigint;
    total: bigint;
    year: bigint;
    users: Array<ActiveUserEntry>;
}
export type Timestamp = bigint;
export type Result_17 = {
    __kind__: "ok";
    ok: string;
} | {
    __kind__: "err";
    err: string;
};
export interface LayoutElement {
    id: LayoutElementId;
    xMm?: number;
    yMm?: number;
    italic?: boolean;
    widthMm?: number;
    heightMm?: number;
    order: bigint;
    bold?: boolean;
    gridArea: GridArea;
    zOrder?: bigint;
    fontFamily?: string;
    visible: boolean;
    fontSize?: bigint;
    alignment?: Position;
}
export type AuditLogId = string;
export type Result_16 = {
    __kind__: "ok";
    ok: Rechnungsvorlage;
} | {
    __kind__: "err";
    err: string;
};
export type Result_1 = {
    __kind__: "ok";
    ok: null;
} | {
    __kind__: "err";
    err: string;
};
export type Result_22 = {
    __kind__: "ok";
    ok: BudgetSummary;
} | {
    __kind__: "err";
    err: string;
};
export type SupportMessageId = string;
export interface BudgetSummary {
    restbudget: bigint;
    totalAuslagen: bigint;
    totalHonorar: bigint;
    totalBudget: bigint;
    mandatId: MandatId;
}
export type ZahlungId = string;
export type Result_19 = {
    __kind__: "ok";
    ok: MigrationSummary;
} | {
    __kind__: "err";
    err: string;
};
export interface PromotionResult {
    principal?: Principal;
    whitelistAdded: boolean;
    email: string;
    changed: boolean;
}
export type Result_24 = {
    __kind__: "ok";
    ok: Rechnung;
} | {
    __kind__: "err";
    err: string;
};
export type Result_14 = {
    __kind__: "ok";
    ok: TimerState;
} | {
    __kind__: "err";
    err: string;
};
export interface Leistung {
    id: LeistungId;
    status: LeistungStatus;
    taetigkeit: string;
    createdAt: Timestamp;
    leistungserbringerId: Principal;
    rechnungId?: RechnungId;
    datum: string;
    dauer: bigint;
    honorar: bigint;
    mandatId: MandatId;
    kanzleiId: KanzleiId;
}
export type Value = {
    __kind__: "int";
    int: bigint;
} | {
    __kind__: "nat";
    nat: bigint;
} | {
    __kind__: "float";
    float: number;
} | {
    __kind__: "bool";
    bool: boolean;
} | {
    __kind__: "null";
    null: null;
} | {
    __kind__: "text";
    text: string;
};
export type KlientId = string;
export interface KanzleiStammdaten {
    ort: string;
    plz: string;
    uid: string;
    land: string;
    kanzleiname: string;
    strasseHausnummer: string;
    kanzleiLogoBlob?: Uint8Array;
    mwstNr: string;
    email: string;
    website: string;
    telefon: string;
}
export interface SupportConversationWithMessages {
    messages: Array<SupportMessage>;
    conversation: SupportConversation;
}
export interface RechnungFilter {
    datumBis?: string;
    datumVon?: string;
    zahlungsstatus?: ZahlungsStatus;
    akquisiteurId?: Principal;
    mandatId?: MandatId;
}
export interface AuslagenFilter {
    status?: AuslagenStatus;
    datumBis?: string;
    datumVon?: string;
    leistungserbringerId?: Principal;
    mandatId?: MandatId;
}
export interface RoleMigrationResult {
    principal: Principal;
    changed: boolean;
    previousRole: Role;
    newRole: Role;
}
export interface DsgVersion {
    content?: string;
    publishedAt: Timestamp;
    version: string;
}
export type MandatId = string;
export interface RetentionPolicy {
    id: RetentionPolicyId;
    retentionYears: bigint;
    categoryName: string;
    createdAt: Timestamp;
    updatedAt: Timestamp;
    legalBasis?: string;
    isLocked: boolean;
    kanzleiId: KanzleiId;
}
export enum AboModell {
    jahres = "jahres",
    monats = "monats",
    keine = "keine"
}
export enum AuslagenKategorie {
    andere = "andere",
    porto = "porto",
    reise = "reise",
    kopien = "kopien"
}
export enum AuslagenStatus {
    offen = "offen",
    verrechnet = "verrechnet"
}
export enum Auslagenregelung {
    Effektiv = "Effektiv",
    Keine = "Keine",
    Pauschal = "Pauschal"
}
export enum DataAccessAction {
    loeschen = "loeschen",
    lesen = "lesen",
    schreiben = "schreiben"
}
export enum DsrStatus {
    inBearbeitung = "inBearbeitung",
    abgeschlossen = "abgeschlossen",
    erfasst = "erfasst"
}
export enum DsrType {
    berichtigung = "berichtigung",
    loeschung = "loeschung",
    auskunft = "auskunft"
}
export enum LayoutElementId {
    summenblock = "summenblock",
    absenderadresse = "absenderadresse",
    spesenAuslagen = "spesenAuslagen",
    rechnungsmetadaten = "rechnungsmetadaten",
    logo = "logo",
    mandatsinfo = "mandatsinfo",
    fusszeile = "fusszeile",
    schlusstext = "schlusstext",
    einleitung = "einleitung",
    empfaengeradresse = "empfaengeradresse",
    leistungspositionen = "leistungspositionen",
    zahlungsinformationen = "zahlungsinformationen"
}
export enum MandatStatus {
    archiviert = "archiviert",
    aktiv = "aktiv"
}
export enum Position {
    zentriert = "zentriert",
    links = "links",
    rechts = "rechts"
}
export enum Role {
    mandant = "mandant",
    admin = "admin",
    mitarbeiter = "mitarbeiter",
    plattform_admin = "plattform_admin",
    anwalt = "anwalt"
}
export enum SupportCategory {
    frage = "frage",
    fehler = "fehler",
    feedback = "feedback",
    verbesserungsvorschlag = "verbesserungsvorschlag"
}
export enum SupportSenderType {
    user = "user",
    platformAdmin = "platformAdmin"
}
export enum SupportStatus {
    neu = "neu",
    archiviert = "archiviert",
    erledigt = "erledigt",
    in_bearbeitung = "in_bearbeitung"
}
export enum VerificationError {
    codeExpired = "codeExpired",
    tooManyAttempts = "tooManyAttempts",
    principalAlreadyUsed = "principalAlreadyUsed",
    invalidInput = "invalidInput",
    sendFailed = "sendFailed",
    notFound = "notFound",
    invalidCode = "invalidCode",
    alreadyRegistered = "alreadyRegistered",
    emailAlreadyVerified = "emailAlreadyVerified",
    resendTooSoon = "resendTooSoon"
}
export enum ZahlungEingangStatus {
    eingegangen = "eingegangen",
    bestaetigt = "bestaetigt"
}
export enum ZahlungsStatus {
    offen = "offen",
    bezahlt = "bezahlt",
    ueberfaellig = "ueberfaellig"
}
export enum Zahlungsmodalitaet {
    jahres = "jahres",
    monats = "monats"
}
export interface backendInterface {
    addSuperAdmin(newAdmin: Principal): Promise<Result_1>;
    addSupportMessage(conversationId: SupportConversationId, message: string): Promise<Result_27>;
    addZahlung(rechnungId: string, datum: string, betrag: bigint): Promise<Result_26>;
    archivierMandat(id: string): Promise<Result_1>;
    changeEmail(pendingId: PendingRegistrationId, newEmail: string): Promise<Result>;
    completeRegistration(pendingId: PendingRegistrationId): Promise<Result_25>;
    createAuslage(mandatId: string, beschreibung: string, kategorie: AuslagenKategorie, betrag: bigint, datum: string): Promise<Result_12>;
    createDsrRequest(req: DsrRequest): Promise<DsrRequest>;
    createInviteLink(email: string): Promise<Result_17>;
    createKlient(name: string, strasse: string, plzOrt: string, telefon: string, email: string): Promise<Result_7>;
    createLeistung(mandatId: string, taetigkeit: string, datum: string, dauer: bigint): Promise<Result_6>;
    createMandat(klientId: string, bezeichnung: string, akquisiteurId: Principal, akquisitionsbonus: bigint, mwstSatz: bigint, budget: bigint, rundungAktiv: boolean, auslagenregelung: Auslagenregelung, pauschalBetrag: bigint, zahlungsbedingungen: string, waehrung: string, standardStundensatz: bigint, kostenProKopie: number, kostenProScan: number, portoAPost: number, portoBPost: number, portoEinschreiben: number, autokilometer: number, leistungenAusweisen: boolean): Promise<Result_5>;
    createRechnung(mandatId: string, leistungsIds: Array<string>, auslageIds: Array<string>, rechnungsdatum: string, zahlungsbedingungen: string, leistungszeitraumVon: string, leistungszeitraumBis: string): Promise<Result_24>;
    createSupportConversation(category: SupportCategory, subject: string, message: string, appRoute: string, appVersion: string): Promise<Result_3>;
    deactivateKanzlei(kanzleiId: string): Promise<Result_1>;
    deleteAuslage(id: string): Promise<Result_1>;
    deleteKanzlei(kanzleiId: string): Promise<Result_1>;
    deleteKlient(id: string): Promise<Result_1>;
    deleteLeistung(id: string): Promise<Result_1>;
    deleteLeistungserbringer(userId: string): Promise<Result_1>;
    deleteMandat(id: string): Promise<Result_1>;
    execute(qJson: string): Promise<Result__1>;
    executeDeletion(categoryName: string, entityId: string): Promise<Result_1>;
    exportAuditTrailCsv(filter: AuditTrailFilter): Promise<string>;
    exportAuditTrailPdf(filter: AuditTrailFilter): Promise<Uint8Array>;
    exportKanzleienCsv(): Promise<string>;
    exportKanzleienPdf(): Promise<Uint8Array>;
    getActiveUsersPerMonth(kanzleiId: KanzleiId, year: bigint): Promise<ActiveUsersYearReport>;
    getAllActiveUsersPerMonth(year: bigint): Promise<Array<AllKanzleienActiveUsersReport>>;
    getAllKanzleienOverview(): Promise<Array<KanzleiOverview>>;
    getAllSupportConversations(): Promise<Result_23>;
    getAuditTrail(filter: AuditTrailFilter): Promise<Array<AuditLogEntry>>;
    getAuslagen(filter: AuslagenFilter): Promise<Array<Auslage>>;
    getBudgetSummaries(): Promise<Array<BudgetSummary>>;
    getBudgetSummary(mandatId: MandatId): Promise<Result_22>;
    getConsentRecords(kanzleiId: KanzleiId): Promise<Array<ConsentRecord>>;
    getCurrentUser(): Promise<Leistungserbringer | null>;
    getDashboardStats(kanzleiId: KanzleiId): Promise<DashboardStats>;
    getDataFlows(kanzleiId: KanzleiId): Promise<Array<DataFlowEntry>>;
    getDataInventory(kanzleiId: KanzleiId): Promise<Array<DataInventoryEntry>>;
    getDsgVersion(): Promise<DsgVersion | null>;
    getDsrRequests(kanzleiId: KanzleiId): Promise<Array<DsrRequest>>;
    getGehaltReport(year: bigint, month: bigint | null): Promise<Array<GehaltInfo>>;
    getInviteLinks(): Promise<Array<InviteToken>>;
    getKanzlei(): Promise<Kanzlei | null>;
    getKanzleiReport(year: bigint, period: ReportPeriod): Promise<FirmReport>;
    getKanzleiStammdaten(): Promise<KanzleiStammdaten | null>;
    getKlient(id: string): Promise<Klient | null>;
    getKlienten(): Promise<Array<Klient>>;
    getLeistungen(filter: LeistungFilter): Promise<Array<Leistung>>;
    getLeistungserbringer(): Promise<Array<Leistungserbringer>>;
    getLeistungserbringerByKanzlei(kanzleiId: KanzleiId): Promise<Array<Leistungserbringer>>;
    getLeistungserbringerReport(providerId: Principal | null, year: bigint, period: ReportPeriod): Promise<ProviderReport>;
    getLogo(): Promise<ExternalBlob | null>;
    getMandat(id: string): Promise<Mandat | null>;
    getMandate(klientId: string | null): Promise<Array<Mandat>>;
    getMyRole(): Promise<Role | null>;
    getMySupportConversations(): Promise<Array<SupportConversation>>;
    getOrCreateUser(): Promise<Result_2>;
    getPendingDeletions(kanzleiId: KanzleiId): Promise<Array<[string, string, bigint]>>;
    getPendingRegistration(pendingId: PendingRegistrationId): Promise<PendingRegistrationView | null>;
    getRechnung(id: string): Promise<Rechnung | null>;
    getRechnungen(filter: RechnungFilter): Promise<Array<Rechnung>>;
    getRechnungsvorlage(): Promise<Rechnungsvorlage | null>;
    getRetentionPolicies(kanzleiId: KanzleiId): Promise<Array<RetentionPolicy>>;
    getSuperAdmins(): Promise<Array<SuperAdminWhitelistEntry>>;
    getSupportConversation(conversationId: SupportConversationId): Promise<Result_21>;
    getTimer(leistungId: LeistungId): Promise<TimerState | null>;
    getUnreadSupportCountForAdmin(): Promise<Result_13>;
    getUnreadSupportCountForUser(): Promise<bigint>;
    getUserRole(userId: Principal): Promise<Result_20>;
    getZahlungen(): Promise<Array<Zahlung>>;
    isSuperAdmin(): Promise<boolean>;
    listTimers(): Promise<Array<TimerState>>;
    logAuditEntry(action: string, entityType: string, entityId: string, beforeValue: string | null, afterValue: string | null): Promise<void>;
    logDataAccess(dataType: string, entityId: string, action: DataAccessAction): Promise<void>;
    markSupportMessageRead(conversationId: SupportConversationId): Promise<Result_1>;
    migrateRoles(): Promise<Result_19>;
    promoteJoaoMarques(): Promise<Result_18>;
    reactivateKanzlei(kanzleiId: string): Promise<Result_1>;
    recordConsent(klientId: KlientId, dsgVersion: string): Promise<ConsentRecord>;
    redeemInviteLink(token: string, vorname: string, nachname: string, titel: string, email: string): Promise<Result_2>;
    registerKanzlei(name: string, adminTitel: string, adminVorname: string, adminNachname: string, adminEmail: string, zahlungsmodalitaet: Zahlungsmodalitaet | null): Promise<Result_17>;
    removeLeistungserbringer(userId: Principal): Promise<Result_1>;
    removeLogo(): Promise<Result_1>;
    removeSuperAdmin(adminToRemove: Principal): Promise<Result_1>;
    saveRechnungsvorlage(vorlage: Rechnungsvorlage): Promise<Result_16>;
    schema(): Promise<string>;
    sendVerificationCode(kanzleiName: string, titel: string, vorname: string, nachname: string, email: string, zahlungsmodalitaet: Zahlungsmodalitaet | null): Promise<Result_15>;
    startTimer(leistungId: LeistungId, baseDauer: bigint): Promise<Result_14>;
    stopTimer(leistungId: LeistungId): Promise<Result_13>;
    updateAuslage(id: string, beschreibung: string, betrag: bigint): Promise<Result_12>;
    updateDataFlowEntry(id: DataFlowId, entry: DataFlowEntry): Promise<Result_11>;
    updateDataInventoryEntry(id: DataInventoryId, entry: DataInventoryEntry): Promise<Result_10>;
    updateDsgVersion(version: string, content: string | null): Promise<DsgVersion>;
    updateDsrRequest(id: DsrId, status: DsrStatus, notes: string | null): Promise<Result_9>;
    updateKanzleiStammdaten(stammdaten: KanzleiStammdaten): Promise<Result_8>;
    updateKanzleiStundensatz(defaultStundensatz: bigint): Promise<Result_1>;
    updateKlient(id: string, name: string, strasse: string, plzOrt: string, telefon: string, email: string): Promise<Result_7>;
    updateLeistung(id: string, taetigkeit: string, dauer: bigint): Promise<Result_6>;
    updateLeistungserbringer(userId: Principal, vorname: string, nachname: string, titel: string): Promise<Result_1>;
    updateMandat(id: string, bezeichnung: string, akquisiteurId: Principal, akquisitionsbonus: bigint, mwstSatz: bigint, budget: bigint, rundungAktiv: boolean, auslagenregelung: Auslagenregelung, pauschalBetrag: bigint, zahlungsbedingungen: string, waehrung: string, standardStundensatz: bigint, kostenProKopie: number, kostenProScan: number, portoAPost: number, portoBPost: number, portoEinschreiben: number, autokilometer: number, leistungenAusweisen: boolean): Promise<Result_5>;
    updateRetentionPolicy(id: RetentionPolicyId, retentionYears: bigint, isLocked: boolean): Promise<Result_4>;
    updateSupportStatus(conversationId: SupportConversationId, newStatus: SupportStatus): Promise<Result_3>;
    updateUserProfile(vorname: string, nachname: string): Promise<Result_1>;
    updateUserRole(userId: Principal, newRole: Role): Promise<Result_2>;
    updateZahlungsstatus(id: string, status: ZahlungsStatus): Promise<Result_1>;
    uploadLogo(blob: ExternalBlob): Promise<Result_1>;
    verifyEmail(pendingId: PendingRegistrationId, code: string): Promise<Result>;
}
