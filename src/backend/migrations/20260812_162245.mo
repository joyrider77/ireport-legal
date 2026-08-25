// Migration: erweitert das persistente `LayoutElementId`-Enum um die neue
// Variante `#schlusstext`.
//
// Hintergrund: Bisher wurde der „Schlusstext" im Rechnungsvorlagen-Editor
// nicht als eigenständiges Layout-Element behandelt — es existierte zwar
// als Text in `standardtexte.schlusstext`, aber es gab keine eigene
// Layout-Komponente mit eigener Geometrie/Sichtbarkeit/Typografie. Im
// Word-Export wurde der Schlusstext gemeinsam mit den
// Zahlungsinformationen in einer Zelle/einem Absatzcontainer gerendert,
// was zu Style-Vererbung und ungewollter Kursivierung führte.
//
// Änderung an `LayoutElementId`:
//   - Neue Variante `#schlusstext` (zwischen `#zahlungsinformationen`
//     und `#fusszeile`).
//
// Das Hinzufügen einer neuen Varianten-Konstruktor ist für bestehende
// persistierte Daten semantisch sicher (alte Werte enthalten nie
// `#schlusstext`, sind aber gültige Werte des neuen Typs — der neue Typ
// ist ein Supertyp des alten). Motoko verlangt dennoch eine explizite
// Migration (M0170), weil die stabile Variable `rechnungsvorlagen`
// indirekt über `Rechnungsvorlage.layoutV2.elements[].id` vom Typ
// `LayoutElementId` abhängt. Diese Migration bestätigt die Kompatibilität
// explizit: alle Collections werden 1:1 durchgereicht, keine
// Daten-Transformation.
//
// OldActor entspricht der NewActor des Vorgänger-Files
// (20260812_000000.mo) — d.h. die aktuell deployed State-Shape MIT
// `waehrung`-Feld auf `Rechnung`, aber OHNE `#schlusstext`-Variante in
// `LayoutElementId`.
//
// Self-contained: nur mo:core-Imports, keine Projekt-Imports. Die Typen
// sind inline kopiert (die Migration darf keine Projekt-Module
// importieren — siehe migrating-motoko-actors Skill).

import Array "mo:core/Array";
import Map "mo:core/Map";

module {
  // ── Inline-Typen (self-contained) ──────────────────────────────────────────
  type Timestamp = Int;
  type KanzleiId = Text;
  type KlientId = Text;
  type MandatId = Text;
  type LeistungId = Text;
  type AuslageId = Text;
  type RechnungId = Text;
  type ZahlungId = Text;
  type AuditLogId = Text;
  type ConsentId = Text;
  type DatenschutzId = Text;

  type Zahlungsmodalitaet = { #jahres; #monats };

  type Role = {
    #plattform_admin;
    #admin;
    #anwalt;
    #mitarbeiter;
    #mandant;
  };

  type StatusHistoryEntry = {
    year : Nat;
    month : Nat;
    status : Text;
  };

  type NewKanzlei = {
    id : KanzleiId;
    name : Text;
    defaultStundensatz : Nat;
    zahlungsmodalitaet : ?Zahlungsmodalitaet;
    status : Text;
    createdAt : Timestamp;
  };

  type Leistungserbringer = {
    id : Principal;
    kanzleiId : KanzleiId;
    vorname : Text;
    nachname : Text;
    titel : Text;
    email : Text;
    isAdmin : Bool;
    role : ?Role;
    status : Text;
    registeredAt : Timestamp;
    statusHistory : [StatusHistoryEntry];
  };

  type InviteToken = {
    token : Text;
    kanzleiId : KanzleiId;
    createdBy : Principal;
    email : Text;
    createdAt : Timestamp;
    redeemedBy : ?Principal;
  };

  type SuperAdminWhitelistEntry = {
    principal : Principal;
    addedAt : Timestamp;
  };

  type Klient = {
    id : KlientId;
    kanzleiId : KanzleiId;
    name : Text;
    strasse : Text;
    plzOrt : Text;
    telefon : Text;
    email : Text;
    createdAt : Timestamp;
  };

  type MandatStatus = { #aktiv; #archiviert };
  type Auslagenregelung = { #Keine; #Effektiv; #Pauschal };

  type Mandat = {
    id : MandatId;
    klientId : KlientId;
    kanzleiId : KanzleiId;
    bezeichnung : Text;
    akquisiteurId : Principal;
    akquisitionsbonus : Nat;
    mwstSatz : Nat;
    budget : Nat;
    rundungAktiv : Bool;
    auslagenregelung : Auslagenregelung;
    pauschalBetrag : Nat;
    zahlungsbedingungen : Text;
    status : MandatStatus;
    waehrung : Text;
    standardStundensatz : Nat;
    kostenProKopie : Float;
    kostenProScan : Float;
    portoAPost : Float;
    portoBPost : Float;
    portoEinschreiben : Float;
    autokilometer : Float;
    leistungenAusweisen : Bool;
    createdAt : Timestamp;
  };

  type LeistungStatus = { #offen; #verrechnet };
  type AuslagenKategorie = { #porto; #kopien; #reise; #andere };
  type AuslagenStatus = { #offen; #verrechnet };

  type Leistung = {
    id : LeistungId;
    mandatId : MandatId;
    kanzleiId : KanzleiId;
    leistungserbringerId : Principal;
    taetigkeit : Text;
    datum : Text;
    dauer : Nat;
    honorar : Nat;
    status : LeistungStatus;
    rechnungId : ?RechnungId;
    createdAt : Timestamp;
  };

  type Auslage = {
    id : AuslageId;
    mandatId : MandatId;
    kanzleiId : KanzleiId;
    leistungserbringerId : Principal;
    beschreibung : Text;
    kategorie : AuslagenKategorie;
    betrag : Nat;
    datum : Text;
    status : AuslagenStatus;
    rechnungId : ?RechnungId;
    createdAt : Timestamp;
  };

  type ZahlungsStatus = { #offen; #bezahlt; #ueberfaellig };
  type ZahlungEingangStatus = { #eingegangen; #bestaetigt };

  type Rechnung = {
    id : RechnungId;
    rechnungsnummer : Text;
    kanzleiId : KanzleiId;
    mandatId : MandatId;
    leistungserbringerId : Principal;
    rechnungsdatum : Text;
    leistungszeitraumVon : Text;
    leistungszeitraumBis : Text;
    leistungspositionen : [LeistungId];
    auslageIds : [AuslageId];
    subtotal : Nat;
    mwstBetrag : Nat;
    total : Nat;
    waehrung : Text;
    zahlungsbedingungen : Text;
    zahlungsstatus : ZahlungsStatus;
    faelligkeitsdatum : Text;
    createdAt : Timestamp;
  };

  type Zahlung = {
    id : ZahlungId;
    rechnungId : RechnungId;
    kanzleiId : KanzleiId;
    datum : Text;
    betrag : Nat;
    status : ZahlungEingangStatus;
    createdAt : Timestamp;
  };

  type Position = { #links; #rechts; #zentriert };

  type VorlageLayout = {
    absenderPosition : Position;
    empfaengerPosition : Position;
    logoPosition : Position;
    fusszeile : Text;
  };

  type Standardtexte = {
    rechnungstitel : Text;
    einleitung : Text;
    zahlungshinweis : Text;
    schlusstext : Text;
  };

  // ── V2-Layout-Typen (inline, self-contained) ───────────────────────────────
  // OldLayoutElementId: Shape VOR dieser Migration (ohne #schlusstext).
  type OldLayoutElementId = {
    #absenderadresse;
    #empfaengeradresse;
    #logo;
    #rechnungsmetadaten;
    #mandatsinfo;
    #einleitung;
    #leistungspositionen;
    #spesenAuslagen;
    #summenblock;
    #zahlungsinformationen;
    #fusszeile;
  };

  // NewLayoutElementId: Shape NACH dieser Migration (mit #schlusstext).
  type NewLayoutElementId = {
    #absenderadresse;
    #empfaengeradresse;
    #logo;
    #rechnungsmetadaten;
    #mandatsinfo;
    #einleitung;
    #leistungspositionen;
    #spesenAuslagen;
    #summenblock;
    #zahlungsinformationen;
    #schlusstext;
    #fusszeile;
  };

  type GridArea = {
    row : Nat;
    col : Nat;
    rowSpan : Nat;
    colSpan : Nat;
  };

  // OldLayoutElement: verwendet OldLayoutElementId.
  type OldLayoutElement = {
    id : OldLayoutElementId;
    visible : Bool;
    order : Nat;
    gridArea : GridArea;
    alignment : ?Position;
    fontFamily : ?Text;
    fontSize : ?Nat;
    bold : ?Bool;
    italic : ?Bool;
    xMm : ?Float;
    yMm : ?Float;
    widthMm : ?Float;
    heightMm : ?Float;
    zOrder : ?Nat;
  };

  // NewLayoutElement: verwendet NewLayoutElementId.
  type NewLayoutElement = {
    id : NewLayoutElementId;
    visible : Bool;
    order : Nat;
    gridArea : GridArea;
    alignment : ?Position;
    fontFamily : ?Text;
    fontSize : ?Nat;
    bold : ?Bool;
    italic : ?Bool;
    xMm : ?Float;
    yMm : ?Float;
    widthMm : ?Float;
    heightMm : ?Float;
    zOrder : ?Nat;
  };

  type OldVorlageLayoutV2 = {
    elements : [OldLayoutElement];
    gridCols : Nat;
    gridRows : Nat;
    marginTopMm : Float;
    marginBottomMm : Float;
    marginLeftMm : Float;
    marginRightMm : Float;
    pageWidthMm : Float;
    pageHeightMm : Float;
  };

  type NewVorlageLayoutV2 = {
    elements : [NewLayoutElement];
    gridCols : Nat;
    gridRows : Nat;
    marginTopMm : Float;
    marginBottomMm : Float;
    marginLeftMm : Float;
    marginRightMm : Float;
    pageWidthMm : Float;
    pageHeightMm : Float;
  };

  // OldRechnungsvorlage: verwendet OldVorlageLayoutV2.
  type OldRechnungsvorlage = {
    kanzleiId : KanzleiId;
    layout : VorlageLayout;
    standardtexte : Standardtexte;
    logoBlob : ?Blob;
    layoutV2 : ?OldVorlageLayoutV2;
    updatedAt : Timestamp;
  };

  // NewRechnungsvorlage: verwendet NewVorlageLayoutV2.
  type NewRechnungsvorlage = {
    kanzleiId : KanzleiId;
    layout : VorlageLayout;
    standardtexte : Standardtexte;
    logoBlob : ?Blob;
    layoutV2 : ?NewVorlageLayoutV2;
    updatedAt : Timestamp;
  };

  type AuditLogEntry = {
    id : AuditLogId;
    kanzleiId : KanzleiId;
    actorPrincipal : Principal;
    action : Text;
    entityType : Text;
    entityId : Text;
    timestamp : Timestamp;
    beforeValue : ?Text;
    afterValue : ?Text;
  };

  type ConsentRecord = {
    id : ConsentId;
    kanzleiId : KanzleiId;
    klientId : KlientId;
    consentGiven : Bool;
    timestamp : Timestamp;
    dsgVersion : Text;
    principal : Principal;
  };

  type DataAccessAction = { #lesen; #schreiben; #loeschen };

  type DataAccessLog = {
    id : DatenschutzId;
    kanzleiId : KanzleiId;
    actorPrincipal : Principal;
    dataType : Text;
    entityId : Text;
    action : DataAccessAction;
    timestamp : Timestamp;
  };

  // OldActor: State-Shape VOR dieser Migration (entspricht der NewActor
  // des Vorgänger-Files 20260812_000000.mo). LayoutElementId OHNE
  // #schlusstext-Variante.
  type OldActor = {
    kanzleien : Map.Map<KanzleiId, NewKanzlei>;
    users : Map.Map<Principal, Leistungserbringer>;
    inviteTokens : Map.Map<Text, InviteToken>;
    superAdminWhitelist : Map.Map<Principal, SuperAdminWhitelistEntry>;
    klienten : Map.Map<KlientId, Klient>;
    mandate : Map.Map<MandatId, Mandat>;
    leistungen : Map.Map<LeistungId, Leistung>;
    auslagen : Map.Map<AuslageId, Auslage>;
    rechnungen : Map.Map<RechnungId, Rechnung>;
    zahlungen : Map.Map<ZahlungId, Zahlung>;
    rechnungsvorlagen : Map.Map<KanzleiId, OldRechnungsvorlage>;
    rechnungsNummer : { var count : Nat };
    auditLogs : Map.Map<AuditLogId, AuditLogEntry>;
    consentRecords : Map.Map<ConsentId, ConsentRecord>;
    nextAuditId : { var count : Nat };
    dataAccessLogs : Map.Map<DatenschutzId, DataAccessLog>;
    nextDataAccessId : { var count : Nat };
  };

  // NewActor: State-Shape NACH dieser Migration. Einzig Änderung:
  //   - rechnungsvorlagen : Map.Map<KanzleiId, NewRechnungsvorlage>
  //     wobei NewRechnungsvorlage.layoutV2 : ?NewVorlageLayoutV2 und
  //     NewVorlageLayoutV2.elements : [NewLayoutElement] mit
  //     NewLayoutElement.id : NewLayoutElementId (neue #schlusstext-
  //     Variante). Alle bestehenden Element-Ids bleiben gültig (der
  //     neue Typ ist ein Supertyp des alten); bestehende persistierte
  //     Vorlagen enthalten nie #schlusstext, laden aber fehlerfrei.
  // Alle anderen Collections bleiben unverändert.
  type NewActor = {
    kanzleien : Map.Map<KanzleiId, NewKanzlei>;
    users : Map.Map<Principal, Leistungserbringer>;
    inviteTokens : Map.Map<Text, InviteToken>;
    superAdminWhitelist : Map.Map<Principal, SuperAdminWhitelistEntry>;
    klienten : Map.Map<KlientId, Klient>;
    mandate : Map.Map<MandatId, Mandat>;
    leistungen : Map.Map<LeistungId, Leistung>;
    auslagen : Map.Map<AuslageId, Auslage>;
    rechnungen : Map.Map<RechnungId, Rechnung>;
    zahlungen : Map.Map<ZahlungId, Zahlung>;
    rechnungsvorlagen : Map.Map<KanzleiId, NewRechnungsvorlage>;
    rechnungsNummer : { var count : Nat };
    auditLogs : Map.Map<AuditLogId, AuditLogEntry>;
    consentRecords : Map.Map<ConsentId, ConsentRecord>;
    nextAuditId : { var count : Nat };
    dataAccessLogs : Map.Map<DatenschutzId, DataAccessLog>;
    nextDataAccessId : { var count : Nat };
  };

  // Hilfsfunktion: wandelt ein OldLayoutElement in ein NewLayoutElement
  // um. Da NewLayoutElementId ein Supertyp von OldLayoutElementId ist
  // (alle alten Varianten sind im neuen Enum enthalten), kann die `id`
  // direkt per Typ-Annotation als neue Variante interpretiert werden —
  // kein Wert wird transformiert. Alle anderen Felder bleiben 1:1.
  func upgradeLayoutElement(old : OldLayoutElement) : NewLayoutElement {
    {
      id = old.id : NewLayoutElementId;
      visible = old.visible;
      order = old.order;
      gridArea = old.gridArea;
      alignment = old.alignment;
      fontFamily = old.fontFamily;
      fontSize = old.fontSize;
      bold = old.bold;
      italic = old.italic;
      xMm = old.xMm;
      yMm = old.yMm;
      widthMm = old.widthMm;
      heightMm = old.heightMm;
      zOrder = old.zOrder;
    };
  };

  // Hilfsfunktion: wandelt ein OldVorlageLayoutV2 in ein NewVorlageLayoutV2
  // um, indem jedes Element per upgradeLayoutElement transformiert wird.
  // Alle Raster-/Seitenrand-Felder bleiben unverändert.
  func upgradeLayoutV2(old : OldVorlageLayoutV2) : NewVorlageLayoutV2 {
    {
      elements = old.elements.map(
        func(elem : OldLayoutElement) : NewLayoutElement {
          upgradeLayoutElement(elem);
        },
      );
      gridCols = old.gridCols;
      gridRows = old.gridRows;
      marginTopMm = old.marginTopMm;
      marginBottomMm = old.marginBottomMm;
      marginLeftMm = old.marginLeftMm;
      marginRightMm = old.marginRightMm;
      pageWidthMm = old.pageWidthMm;
      pageHeightMm = old.pageHeightMm;
    };
  };

  // Hilfsfunktion: wandelt eine OldRechnungsvorlage in eine
  // NewRechnungsvorlage um. layoutV2 wird (falls vorhanden) per
  // upgradeLayoutV2 transformiert; alle anderen Felder bleiben 1:1.
  func upgradeVorlage(old : OldRechnungsvorlage) : NewRechnungsvorlage {
    {
      kanzleiId = old.kanzleiId;
      layout = old.layout;
      standardtexte = old.standardtexte;
      logoBlob = old.logoBlob;
      layoutV2 = switch (old.layoutV2) {
        case null null;
        case (?v2) ?upgradeLayoutV2(v2);
      };
      updatedAt = old.updatedAt;
    };
  };

  // Migration:
  //   - Alle Collections unverändert durchreichen, AUSSER
  //     rechnungsvorlagen.
  //   - rechnungsvorlagen: neues Map aufbauen, in dem jeder Eintrag eine
  //     NewRechnungsvorlage ist (mit NewLayoutElementId inkl. #schlusstext).
  //     Bestehende Vorlagen enthalten nie #schlusstext, laden aber
  //     fehlerfrei als neuer Typ. Alle anderen Felder werden 1:1
  //     übernommen.
  //   - KEINE anderen stable Variablen werden transformiert.
  public func migration(old : OldActor) : NewActor {
    let newVorlagen = Map.empty<KanzleiId, NewRechnungsvorlage>();
    for ((kanzleiId, oldVorlage) in old.rechnungsvorlagen.entries()) {
      newVorlagen.add(kanzleiId, upgradeVorlage(oldVorlage));
    };
    {
      kanzleien = old.kanzleien;
      users = old.users;
      inviteTokens = old.inviteTokens;
      superAdminWhitelist = old.superAdminWhitelist;
      klienten = old.klienten;
      mandate = old.mandate;
      leistungen = old.leistungen;
      auslagen = old.auslagen;
      rechnungen = old.rechnungen;
      zahlungen = old.zahlungen;
      rechnungsvorlagen = newVorlagen;
      rechnungsNummer = old.rechnungsNummer;
      auditLogs = old.auditLogs;
      consentRecords = old.consentRecords;
      nextAuditId = old.nextAuditId;
      dataAccessLogs = old.dataAccessLogs;
      nextDataAccessId = old.nextDataAccessId;
    };
  };
};
