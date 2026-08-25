// Migration: erweitert `LayoutElement` (innerhalb von `?VorlageLayoutV2`
// in `Rechnungsvorlage`) um vier optionale Typografie-Felder:
//   - fontFamily : ?Text  (erlaubt: "Arial", "Helvetica", "Times New Roman")
//   - fontSize  : ?Nat   (erlaubt: 8,9,10,11,12,14,16,18,20,24)
//   - bold      : ?Bool
//   - italic    : ?Bool
//
// Motoko betrachtet das Hinzufügen von Feldern zu einem persistenten
// Record NICHT als stable-kompatibel (M0170) — selbst optionale Felder
// erfordern eine explizite Migration. Diese Migration iteriert über alle
// bestehenden Rechnungsvorlagen und setzt für jedes vorhandene
// `layoutV2` (falls nicht null) die vier neuen Felder auf null in
// jedem LayoutElement. Bestehende V1-Vorlagen (layoutV2 = null) werden
// nicht berührt.
//
// Der neue LayoutElementId-Wert `#spesenAuslagen` ist eine additive
// Variant-Erweiterung und damit stable-kompatibel (kein Datenverlust
// für bestehende persistierte Elemente). Er wird hier nur der
// Vollständigkeit halber in den Inline-Typen aufgeführt, benötigt
// aber keine Datentransformation.
//
// OldActor entspricht der NewActor des Vorgänger-Files
// (20260809_000001.mo) — d.h. die aktuell deployed State-Shape MIT
// layoutV2 in Rechnungsvorlage, aber OHNE die Typografie-Felder in
// LayoutElement.
//
// Self-contained: nur mo:core-Imports, keine Projekt-Imports. Die Typen
// sind inline kopiert (die Migration darf keine Projekt-Module
// importieren — siehe migrating-motoko-actors Skill).

import Map "mo:core/Map";
import Array "mo:core/Array";

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
  // OldLayoutElementId: Shape VOR dieser Migration (10 Werte, ohne
  // #spesenAuslagen). Das Hinzufügen von #spesenAuslagen ist stable-
  // kompatibel, aber wir führen den neuen Typ hier auf, um die
  // Transformation sauber zu typisieren.
  type OldLayoutElementId = {
    #absenderadresse;
    #empfaengeradresse;
    #logo;
    #rechnungsmetadaten;
    #mandatsinfo;
    #einleitung;
    #leistungspositionen;
    #summenblock;
    #zahlungsinformationen;
    #fusszeile;
  };

  // NewLayoutElementId: Shape NACH dieser Migration (11 Werte, mit
  // #spesenAuslagen).
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
    #fusszeile;
  };

  type GridArea = {
    row : Nat;
    col : Nat;
    rowSpan : Nat;
    colSpan : Nat;
  };

  // OldLayoutElement: Shape VOR dieser Migration (ohne Typografie-Felder).
  type OldLayoutElement = {
    id : OldLayoutElementId;
    visible : Bool;
    order : Nat;
    gridArea : GridArea;
    alignment : ?Position;
  };

  // NewLayoutElement: Shape NACH dieser Migration (mit vier optionalen
  // Typografie-Feldern, alle initial null).
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
  };

  type OldVorlageLayoutV2 = {
    elements : [OldLayoutElement];
    gridCols : Nat;
    gridRows : Nat;
  };

  type NewVorlageLayoutV2 = {
    elements : [NewLayoutElement];
    gridCols : Nat;
    gridRows : Nat;
  };

  // OldRechnungsvorlage: Shape VOR dieser Migration (mit layoutV2, aber
  // LayoutElement ohne Typografie-Felder).
  type OldRechnungsvorlage = {
    kanzleiId : KanzleiId;
    layout : VorlageLayout;
    standardtexte : Standardtexte;
    logoBlob : ?Blob;
    layoutV2 : ?OldVorlageLayoutV2;
    updatedAt : Timestamp;
  };

  // NewRechnungsvorlage: Shape NACH dieser Migration (LayoutElement mit
  // Typografie-Feldern).
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
  // des Vorgänger-Files 20260809_000001.mo). Rechnungsvorlage MIT
  // layoutV2, aber LayoutElement OHNE Typografie-Felder.
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
  //     wobei NewRechnungsvorlage.layoutV2 (falls nicht null) ein
  //     NewVorlageLayoutV2 enthält, dessen LayoutElemente jeweils die
  //     vier neuen optionalen Typografie-Felder (fontFamily, fontSize,
  //     bold, italic) tragen — initial alle null.
  // Alle anderen Felder bleiben unverändert.
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

  // Hilfsfunktion: wandelt ein OldLayoutElementId in das entsprechende
  // NewLayoutElementId um. Da #spesenAuslagen additiv ist, lassen sich
  // alle bestehenden IDs 1:1 übernehmen (Motoko erlaubt den Cast eines
  // Variant mit weniger Konstruktoren auf einen mit mehr).
  func upgradeElementId(old : OldLayoutElementId) : NewLayoutElementId {
    switch (old) {
      case (#absenderadresse) #absenderadresse;
      case (#empfaengeradresse) #empfaengeradresse;
      case (#logo) #logo;
      case (#rechnungsmetadaten) #rechnungsmetadaten;
      case (#mandatsinfo) #mandatsinfo;
      case (#einleitung) #einleitung;
      case (#leistungspositionen) #leistungspositionen;
      case (#summenblock) #summenblock;
      case (#zahlungsinformationen) #zahlungsinformationen;
      case (#fusszeile) #fusszeile;
    };
  };

  // Hilfsfunktion: wandelt ein OldLayoutElement in ein NewLayoutElement
  // um, indem die vier neuen Typografie-Felder auf null gesetzt werden.
  // Alle bestehenden Felder (id, visible, order, gridArea, alignment)
  // bleiben unverändert erhalten.
  func upgradeElement(old : OldLayoutElement) : NewLayoutElement {
    {
      id = upgradeElementId(old.id);
      visible = old.visible;
      order = old.order;
      gridArea = old.gridArea;
      alignment = old.alignment;
      fontFamily = null;
      fontSize = null;
      bold = null;
      italic = null;
    };
  };

  // Hilfsfunktion: wandelt ein OldVorlageLayoutV2 in ein
  // NewVorlageLayoutV2 um, indem jedes LayoutElement upgegradet wird.
  // gridCols und gridRows bleiben unverändert.
  func upgradeLayoutV2(old : OldVorlageLayoutV2) : NewVorlageLayoutV2 {
    let newElements = old.elements.map(
      func(e) { upgradeElement(e) },
    );
    {
      elements = newElements;
      gridCols = old.gridCols;
      gridRows = old.gridRows;
    };
  };

  // Migration:
  //   - Alle Collections unverändert durchreichen, AUSSER rechnungsvorlagen.
  //   - rechnungsvorlagen: neues Map aufbauen, in dem jeder Eintrag ein
  //     NewRechnungsvorlage ist. Falls layoutV2 nicht null ist, wird
  //     jedes LayoutElement um die vier Typografie-Felder (alle null)
  //     erweitert. Falls layoutV2 null ist (V1-Vorlage), bleibt es null.
  //   - KEINE anderen stable Variablen werden transformiert.
  public func migration(old : OldActor) : NewActor {
    let newVorlagen = Map.empty<KanzleiId, NewRechnungsvorlage>();
    for ((kanzleiId, oldVorlage) in old.rechnungsvorlagen.entries()) {
      let newLayoutV2 : ?NewVorlageLayoutV2 = switch (oldVorlage.layoutV2) {
        case null null;
        case (?oldLayout) ?(upgradeLayoutV2(oldLayout));
      };
      let newVorlage : NewRechnungsvorlage = {
        kanzleiId = oldVorlage.kanzleiId;
        layout = oldVorlage.layout;
        standardtexte = oldVorlage.standardtexte;
        logoBlob = oldVorlage.logoBlob;
        layoutV2 = newLayoutV2;
        updatedAt = oldVorlage.updatedAt;
      };
      newVorlagen.add(kanzleiId, newVorlage);
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
