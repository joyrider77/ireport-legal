import Common "../types/common";
import KanzleiTypes "../types/kanzlei";
import SuperAdminTypes "../types/super-admin";
import KlientenTypes "../types/klienten";
import LeistungTypes "../types/leistungen";
import RechnungTypes "../types/rechnungen";
import RechnungsvorlagenTypes "../types/rechnungsvorlagen";
import RolesLib "../lib/roles";
import Map "mo:core/Map";
import Principal "mo:core/Principal";
import Runtime "mo:core/Runtime";
import Text "mo:core/Text";
import Nat "mo:core/Nat";
import Int "mo:core/Int";
import Array "mo:core/Array";
import Iter "mo:core/Iter";
import Blob "mo:core/Blob";

module {
  // Prüft, ob ein Principal in der Super-Admin-Whitelist steht.
  public func isSuperAdmin(
    superAdminWhitelist : Map.Map<Principal, SuperAdminTypes.SuperAdminWhitelistEntry>,
    caller : Principal,
  ) : Bool {
    superAdminWhitelist.get(caller) != null;
  };

  // Erste Registrierung via Internet Identity wird automatisch Super-Admin,
  // wenn die Whitelist leer ist. Der Principal wird in die Whitelist
  // eingetragen. Gibt true zurück, wenn der caller als Super-Admin
  // hinzugefügt wurde; false, wenn die Whitelist bereits Einträge enthält
  // oder der caller bereits eingetragen ist.
  public func autoPromoteFirstSuperAdmin(
    superAdminWhitelist : Map.Map<Principal, SuperAdminTypes.SuperAdminWhitelistEntry>,
    caller : Principal,
    now : Common.Timestamp,
  ) : Bool {
    // Bereits eingetragen? Nichts zu tun.
    if (superAdminWhitelist.get(caller) != null) {
      return false;
    };
    // Whitelist bereits belegt? Keine Auto-Beförderung.
    if (not superAdminWhitelist.isEmpty()) {
      return false;
    };
    let entry : SuperAdminTypes.SuperAdminWhitelistEntry = {
      principal = caller;
      addedAt = now;
    };
    superAdminWhitelist.add(caller, entry);
    true;
  };

  // Fügt einen Principal manuell zur Super-Admin-Whitelist hinzu.
  // Nur bestehende Super-Admins dürfen weitere hinzufügen.
  public func addSuperAdmin(
    superAdminWhitelist : Map.Map<Principal, SuperAdminTypes.SuperAdminWhitelistEntry>,
    caller : Principal,
    newAdmin : Principal,
    now : Common.Timestamp,
  ) : Common.Result<(), Text> {
    if (not isSuperAdmin(superAdminWhitelist, caller)) {
      return #err "Nur Super-Admins dürfen weitere Super-Admins hinzufügen";
    };
    if (superAdminWhitelist.get(newAdmin) != null) {
      return #err "Principal ist bereits Super-Admin";
    };
    let entry : SuperAdminTypes.SuperAdminWhitelistEntry = {
      principal = newAdmin;
      addedAt = now;
    };
    superAdminWhitelist.add(newAdmin, entry);
    #ok ();
  };

  // Entfernt einen Principal aus der Super-Admin-Whitelist.
  // Nur bestehende Super-Admins dürfen entfernen. Ein Super-Admin darf sich
  // nicht selbst entfernen (Vermeidung leerer Whitelist).
  public func removeSuperAdmin(
    superAdminWhitelist : Map.Map<Principal, SuperAdminTypes.SuperAdminWhitelistEntry>,
    caller : Principal,
    adminToRemove : Principal,
  ) : Common.Result<(), Text> {
    if (not isSuperAdmin(superAdminWhitelist, caller)) {
      return #err "Nur Super-Admins dürfen Super-Admins entfernen";
    };
    if (Principal.equal(caller, adminToRemove)) {
      return #err "Sie können sich nicht selbst aus der Whitelist entfernen";
    };
    if (superAdminWhitelist.get(adminToRemove) == null) {
      return #err "Principal ist nicht in der Whitelist";
    };
    // Verhindere das Entfernen des letzten verbleibenden Super-Admins,
    // damit die Whitelist nie leer wird (sonst wäre kein Super-Admin-Zugriff
    // mehr möglich und die Auto-Beförderung würde erneut greifen).
    if (superAdminWhitelist.size() <= 1) {
      return #err "Der letzte Super-Admin kann nicht entfernt werden";
    };
    superAdminWhitelist.remove(adminToRemove);
    #ok ();
  };

  // Liefert alle eingetragenen Super-Admins.
  public func getSuperAdmins(
    superAdminWhitelist : Map.Map<Principal, SuperAdminTypes.SuperAdminWhitelistEntry>,
    caller : Principal,
  ) : [SuperAdminTypes.SuperAdminWhitelistEntry] {
    if (not isSuperAdmin(superAdminWhitelist, caller)) {
      Runtime.trap("Nur Super-Admins dürfen die Super-Admin-Liste einsehen");
    };
    superAdminWhitelist.values().toArray();
  };

  // Leitet das Abo-Modell aus der Zahlungsmodalität der Kanzlei ab:
  // #jahres → #jahres, #monats → #monats, null → #keine.
  func deriveAboModell(
    zahlungsmodalitaet : ?KanzleiTypes.Zahlungsmodalitaet,
  ) : SuperAdminTypes.AboModell {
    switch (zahlungsmodalitaet) {
      case (?#jahres) #jahres;
      case (?#monats) #monats;
      case null #keine;
    };
  };

  // Leitet den Billing-Status ab. Da kein separates Billing-Storage
  // existiert (per doNotBuild ausgeschlossen), gilt: wenn eine
  // Zahlungsmodalität gesetzt ist → #bezahlt, sonst #offen.
  func deriveBillingStatus(
    zahlungsmodalitaet : ?KanzleiTypes.Zahlungsmodalitaet,
  ) : SuperAdminTypes.BillingStatus {
    switch (zahlungsmodalitaet) {
      case (?_) #bezahlt;
      case null #offen;
    };
  };

  // Liefert alle Leistungserbringer (Benutzer) EINER bestimmten Kanzlei —
  // mit Name, E-Mail, Rolle, Status — gefiltert nach u.kanzleiId == kanzleiId.
  // Super-Admin-only: nur ein Super-Admin (isSuperAdmin(caller) == true) darf
  // beliebige Kanzleien abfragen. Andernfalls trap mit klarer Fehlermeldung.
  //
  // Die Rückgabe-Struktur ist identisch zu getLeistungserbringer
  // (lib/kanzlei.mo): ein [Leistungserbringer] mit maskierter role.
  // Rollen-Masking: #plattform_admin wird für Nicht-Super-Admin-Viewer als
  // #admin zurückgegeben (siehe lib/roles.mo maskRoleForCaller). Da diese
  // Methode Super-Admin-only ist (caller ist immer Super-Admin), ist das
  // Masking hier faktisch ein No-Op — die Struktur bleibt aber identisch
  // zu getLeistungserbringer, damit das Frontend beide Antworten gleich
  // behandeln kann.
  //
  // Verwendet die bestehende users-Stable-Variable aus main.mo (wird vom
  // Mixin als Parameter injiziert). Ändert NICHT getLeistungserbringer oder
  // deren Tenant-Isolation-Logik.
  public func getLeistungserbringerByKanzlei(
    users : Map.Map<Principal, KanzleiTypes.Leistungserbringer>,
    superAdminWhitelist : Map.Map<Principal, SuperAdminTypes.SuperAdminWhitelistEntry>,
    caller : Principal,
    kanzleiId : Common.KanzleiId,
  ) : [KanzleiTypes.Leistungserbringer] {
    if (not isSuperAdmin(superAdminWhitelist, caller)) {
      Runtime.trap("Nur Super-Admins dürfen Benutzer beliebiger Kanzleien abfragen");
    };
    let callerIsSuperAdmin = true; // per Gate oben ist caller immer Super-Admin
    users.values()
      .filter(func(u : KanzleiTypes.Leistungserbringer) : Bool {
        u.kanzleiId == kanzleiId;
      })
      .map(
        func(u : KanzleiTypes.Leistungserbringer) : KanzleiTypes.Leistungserbringer {
          let maskedRole = switch (u.role) {
            case (?r) ?RolesLib.maskRoleForCaller(r, callerIsSuperAdmin);
            case null null;
          };
          { u with role = maskedRole };
        },
      )
      .toArray();
  };

  // Zählt die Benutzer einer Kanzlei (alle registrierten
  // Leistungserbringer dieser kanzleiId — aktive-Status-Filterung
  // gehört zur Kanzlei-Domain, nicht zum Super-Admin-Modul).
  func countUsersForKanzlei(
    users : Map.Map<Principal, KanzleiTypes.Leistungserbringer>,
    kanzleiId : Common.KanzleiId,
  ) : Nat {
    users.values()
      .filter(func(u : KanzleiTypes.Leistungserbringer) : Bool {
        u.kanzleiId == kanzleiId;
      })
      .toArray()
      .size();
  };

  // Liefert die Übersicht aller Kanzleien (Mandanten) mit Benutzeranzahl,
  // Abo-Modell (Jahres/Monats, derived from zahlungsmodalitaet) und
  // Billing-Status. Nur für Super-Admins — strikte Daten-Trennung: Super-Admin
  // sieht ALLE Kanzleien, reguläre Admins nur ihre eigene (diese Funktion
  // gibt alle zurück; die Zugriffsprüfung erfolgt im Mixin).
  //
  // Workstream A: erweitert um die Abo-Billing-relevanten Kanzlei-Stammdaten
  // (kanzleiname, uid, mwstNr, adresse). Diese Felder werden aus
  // kanzlei.stammdaten abgeleitet ("" falls keine Stammdaten erfasst). Der
  // Plattform-Admin sieht NUR diese Billing-relevanten Felder — KEINE
  // zusätzlichen fachlichen Mandats-/Klientendaten.
  public func getAllKanzleienOverview(
    kanzleien : Map.Map<Common.KanzleiId, KanzleiTypes.Kanzlei>,
    users : Map.Map<Principal, KanzleiTypes.Leistungserbringer>,
    caller : Principal,
    superAdminWhitelist : Map.Map<Principal, SuperAdminTypes.SuperAdminWhitelistEntry>,
  ) : [SuperAdminTypes.KanzleiOverview] {
    if (not isSuperAdmin(superAdminWhitelist, caller)) {
      Runtime.trap("Nur Super-Admins dürfen die Kanzlei-Übersicht einsehen");
    };
    kanzleien.values()
      .map(
        func(k : KanzleiTypes.Kanzlei) : SuperAdminTypes.KanzleiOverview {
          // Billing-relevante Stammdaten ableiten ("" falls keine erfasst).
          let (stammdatenKanzleiname, stammdatenUid, stammdatenMwstNr, stammdatenAdresse) = switch (k.stammdaten) {
            case null ("", "", "", "");
            case (?s) {
              (
                s.kanzleiname,
                s.uid,
                s.mwstNr,
                s.strasseHausnummer # ", " # s.plz # " " # s.ort # ", " # s.land,
              );
            };
          };
          {
            id = k.id;
            name = k.name;
            userCount = countUsersForKanzlei(users, k.id);
            aboModell = deriveAboModell(k.zahlungsmodalitaet);
            billingStatus = deriveBillingStatus(k.zahlungsmodalitaet);
            createdAt = k.createdAt;
            status = k.status;
            stammdatenKanzleiname;
            stammdatenUid;
            stammdatenMwstNr;
            stammdatenAdresse;
          };
        },
      )
      .toArray();
  };

  // Rendert ein AboModell als Text für den CSV-Export.
  func aboModellToText(a : SuperAdminTypes.AboModell) : Text {
    switch (a) {
      case (#jahres) "Jahres";
      case (#monats) "Monats";
      case (#keine) "Keine";
    };
  };

  // Rendert einen BillingStatus als Text für den CSV-Export.
  func billingStatusToText(b : SuperAdminTypes.BillingStatus) : Text {
    switch (b) {
      case (#offen) "Offen";
      case (#bezahlt) "Bezahlt";
      case (#ueberfaellig) "Ueberfaellig";
    };
  };

  // Wandelt einen Int-Timestamp in Text um (für createdAt-Spalte).
  func timestampToText(t : Common.Timestamp) : Text {
    t.toText();
  };

  // CSV-Escape: Felder, die Komma, Anführungszeichen oder Zeilenumbruch
  // enthalten, werden in doppelte Anführungszeichen eingeschlossen und
  // vorhandene Anführungszeichen verdoppelt.
  func csvEscape(field : Text) : Text {
    let needsQuoting = field.contains(#char ',')
      or field.contains(#text "\"")
      or field.contains(#char '\n')
      or field.contains(#char '\r');
    if (needsQuoting) {
      let escaped = field.replace(#text "\"", "\"\"");
      "\"" # escaped # "\"";
    } else {
      field;
    };
  };

  // Exportiert die Kanzlei-Übersicht als CSV-Text für den Download.
  // Nur für Super-Admins.
  public func exportKanzleienCsv(
    kanzleien : Map.Map<Common.KanzleiId, KanzleiTypes.Kanzlei>,
    users : Map.Map<Principal, KanzleiTypes.Leistungserbringer>,
    caller : Principal,
    superAdminWhitelist : Map.Map<Principal, SuperAdminTypes.SuperAdminWhitelistEntry>,
  ) : Text {
    if (not isSuperAdmin(superAdminWhitelist, caller)) {
      Runtime.trap("Nur Super-Admins dürfen den CSV-Export durchführen");
    };
    let header = "Kanzlei-ID;Name;Benutzeranzahl;Abo-Modell;Billing-Status;Erstellt-Am";
    let rows = getAllKanzleienOverview(kanzleien, users, caller, superAdminWhitelist);
    let body = rows.foldLeft(
      "",
      func(acc : Text, o : SuperAdminTypes.KanzleiOverview) : Text {
        let line = csvEscape(o.id)
          # ";" # csvEscape(o.name)
          # ";" # o.userCount.toText()
          # ";" # csvEscape(aboModellToText(o.aboModell))
          # ";" # csvEscape(billingStatusToText(o.billingStatus))
          # ";" # csvEscape(timestampToText(o.createdAt));
        if (acc == "") { line } else { acc # "\n" # line };
      },
    );
    if (body == "") { header } else { header # "\n" # body };
  };

  // Baut ein minimales gültiges PDF als Text-Body. Das PDF besteht aus
  // einem Header, einem Content-Stream (Kanzlei-Übersicht als Text)
  // und einem xref/trailer-Block. Es ist bewusst einfach gehalten —
  // keine externe Bibliothek, nur eine textbasierte PDF-Struktur.
  func buildPdfBody(content : Text) : Text {
    let escaped = content.replace(#char '\\', "\\\\").replace(#char '(', "\\(").replace(#char ')', "\\)");
    let lines = escaped.split(#char '\n').toArray();
    let btLines = lines.foldLeft(
      "",
      func(acc : Text, line : Text) : Text {
        let y = 0; // Position wird vom Viewer gerendert; wir nutzen einfache Tj-Sequenz
        acc # "(" # line # ") Tj T* ";
      },
    );
    let stream = "BT /F1 10 Tf 1 0 0 1 50 750 Tm 14 TL " # btLines # "ET";
    let streamLen = stream.encodeUtf8().size();
    "%PDF-1.4\n"
    # "1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n"
    # "2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n"
    # "3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>\nendobj\n"
    # "4 0 obj\n<< /Length " # streamLen.toText() # " >>\nstream\n" # stream # "\nendstream\nendobj\n"
    # "5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n"
    # "%%EOF";
  };

  // Exportiert die Kanzlei-Übersicht als PDF-Blob für den Download.
  // Nur für Super-Admins.
  public func exportKanzleienPdf(
    kanzleien : Map.Map<Common.KanzleiId, KanzleiTypes.Kanzlei>,
    users : Map.Map<Principal, KanzleiTypes.Leistungserbringer>,
    caller : Principal,
    superAdminWhitelist : Map.Map<Principal, SuperAdminTypes.SuperAdminWhitelistEntry>,
  ) : Blob {
    if (not isSuperAdmin(superAdminWhitelist, caller)) {
      Runtime.trap("Nur Super-Admins dürfen den PDF-Export durchführen");
    };
    let csv = exportKanzleienCsv(kanzleien, users, caller, superAdminWhitelist);
    let pdfText = buildPdfBody(csv);
    pdfText.encodeUtf8();
  };

  // Deaktiviert eine Kanzlei, indem der Kanzlei-Status auf "inaktiv" gesetzt
  // wird (Daten bleiben erhalten — nur der Status ändert sich). Physisches
  // Löschen erfolgt über deleteKanzlei. Nur Super-Admins dürfen deaktivieren.
  public func deactivateKanzlei(
    kanzleien : Map.Map<Common.KanzleiId, KanzleiTypes.Kanzlei>,
    superAdminWhitelist : Map.Map<Principal, SuperAdminTypes.SuperAdminWhitelistEntry>,
    caller : Principal,
    kanzleiId : Text,
  ) : Common.Result<(), Text> {
    // Nur Super-Admins dürfen eine Kanzlei deaktivieren.
    if (not isSuperAdmin(superAdminWhitelist, caller)) {
      return #err "Nur Super-Admins dürfen Kanzleien deaktivieren";
    };
    switch (kanzleien.get(kanzleiId)) {
      case null { #err "Kanzlei nicht gefunden" };
      case (?k) {
        // Status auf "inaktiv" setzen (Daten bleiben erhalten — nur der
        // Status ändert sich). Physisches Löschen erfolgt über deleteKanzlei.
        let updated : KanzleiTypes.Kanzlei = {
          k with
          status = "inaktiv";
        };
        kanzleien.add(kanzleiId, updated);
        #ok ();
      };
    };
  };

  // Entfernt eine Kanzlei PHYSISCH und unwiderruflich — atomar/konsistent
  // kaskadierend über ALLE tenantgebundenen Datensätze der gelöschten
  // kanzleiId. Nur Super-Admins dürfen eine Kanzlei physisch löschen.
  //
  // KORREKTUR (Mandantentrennung / Datenintegrität): die bisherige
  // Implementierung entfernte nur den kanzleien-Eintrag und liess alle
  // tenantgebundenen Datensätze (Benutzer/Leistungserbringer, Klienten,
  // Mandate, Leistungen, Auslagen, Rechnungen, Zahlungen, Rechnungsvorlagen
  // inkl. Logos, Einladungen) als verwaiste Datensätze zurück. Anna Müller
  // blieb nach Löschen von „Müller & Partner AG" fälschlicherweise als
  // aktiver/verwaister Benutzer existieren.
  //
  // Die neue Implementierung löscht atomar/konsistent sämtliche
  // tenantgebundenen Datensätze der gelöschten kanzleiId — keine
  // Teil-Löschung mit verwaisten Benutzern. Ein API-Aufruf mit einem
  // ehemaligen Principal der gelöschten Kanzlei wird danach als nicht
  // registriert/ungültig abgewiesen (users-Map enthält den Principal nicht
  // mehr → getOrCreateUser/getCurrentUser liefern #err bzw. null).
  //
  // Audit-/Compliance-Daten (auditLogs, consentRecords, dsrRequests,
  // retentionPolicies, dataAccessLogs, dataInventory, dataFlows) werden
  // NICHT gelöscht — sie bleiben revisionssicher als historisch erhalten,
  // erzeugen aber keine aktiven Benutzer-/Tenant-Zuordnungen mehr (die
  // zugehörigen kanzleiId/actorPrincipal-Referenzen verweisen auf eine
  // nicht mehr existente Kanzlei und werden als historisch behandelt).
  //
  // Signatur: erhält ALLE tenantgebundenen Maps, damit die Kaskade jede
  // einzelne erreichen kann. Die Reihenfolge der Kaskade wird in der
  // develop-Phase so gewählt, dass fachliche Abhängigkeiten konsistent
  // bleiben (z.B. Rechnungen vor Zahlungen oder umgekehrt — beides ist
  // sicher, da beide vollständig zur kanzleiId gehören).
  public func deleteKanzlei(
    kanzleien : Map.Map<Common.KanzleiId, KanzleiTypes.Kanzlei>,
    users : Map.Map<Principal, KanzleiTypes.Leistungserbringer>,
    inviteTokens : Map.Map<Text, KanzleiTypes.InviteToken>,
    klienten : Map.Map<Common.KlientId, KlientenTypes.Klient>,
    mandate : Map.Map<Common.MandatId, KlientenTypes.Mandat>,
    leistungen : Map.Map<Common.LeistungId, LeistungTypes.Leistung>,
    auslagen : Map.Map<Common.AuslageId, LeistungTypes.Auslage>,
    rechnungen : Map.Map<Common.RechnungId, RechnungTypes.Rechnung>,
    zahlungen : Map.Map<Common.ZahlungId, RechnungTypes.Zahlung>,
    rechnungsvorlagen : Map.Map<Common.KanzleiId, RechnungsvorlagenTypes.Rechnungsvorlage>,
    superAdminWhitelist : Map.Map<Principal, SuperAdminTypes.SuperAdminWhitelistEntry>,
    caller : Principal,
    kanzleiId : Text,
  ) : Common.Result<(), Text> {
    // Nur Super-Admins dürfen eine Kanzlei physisch löschen.
    if (not isSuperAdmin(superAdminWhitelist, caller)) {
      return #err "Nur Super-Admins dürfen Kanzleien löschen";
    };
    // Kanzlei muss existieren.
    if (kanzleien.get(kanzleiId) == null) {
      return #err "Kanzlei nicht gefunden";
    };
    // ATOMARE KASKADE: alle tenantgebundenen Datensätze der kanzleiId
    // entfernen, BEVOR der kanzleien-Eintrag selbst gelöscht wird. Motoko
    // hat keine Transaktionen — alle removes laufen in diesem einen
    // Funktionsaufruf, sodass ein Fehler (trap) sichtbar wird, bevor ein
    // teilweiser Zustand committet wird. Die Reihenfolge ist so gewählt,
    // dass fachliche Abhängigkeiten konsistent bleiben: abhängige Daten
    // (Benutzer, Einladungen, Klienten, Mandate, Leistungen, Auslagen,
    // Rechnungen, Zahlungen, Vorlagen) zuerst, der kanzleien-Eintrag ZULETZT.
    cascadeDeleteUsers(users, kanzleiId);
    cascadeDeleteInviteTokens(inviteTokens, kanzleiId);
    cascadeDeleteKlienten(klienten, kanzleiId);
    cascadeDeleteMandate(mandate, kanzleiId);
    cascadeDeleteLeistungen(leistungen, kanzleiId);
    cascadeDeleteAuslagen(auslagen, kanzleiId);
    cascadeDeleteRechnungen(rechnungen, kanzleiId);
    cascadeDeleteZahlungen(zahlungen, kanzleiId);
    cascadeDeleteRechnungsvorlagen(rechnungsvorlagen, kanzleiId);
    // Zuletzt den kanzleien-Eintrag entfernen — alle abhängigen Daten sind
    // nun weg. Ein API-Aufruf mit einem ehemaligen Principal der gelöschten
    // Kanzlei wird danach als nicht registriert/ungültig abgewiesen, da die
    // users-Map den Principal nicht mehr enthält (getOrCreateUser/getCurrentUser
    // liefern #err bzw. null).
    kanzleien.remove(kanzleiId);
    #ok ();
  };

  // ── Kaskadierende Lösch-Helper (pro tenantgebundenem Map) ──────────────────
  //
  // Jeder Helper entfernt ALLE Einträge des gegebenen Maps, die zur
  // kanzleiId gehören. Für Maps, die direkt nach kanzleiId schlüsseln
  // (kanzleien, rechnungsvorlagen), genügt ein einzelnes remove. Für Maps,
  // deren Werte ein kanzleiId-Feld tragen (users, inviteTokens, klienten,
  // mandate, leistungen, auslagen, rechnungen, zahlungen), wird über alle
  // Einträge iteriert und die zur kanzleiId gehörenden entfernt.
  //
  // Die Helper sind separat, damit deleteKanzlei sie in der develop-Phase
  // in einer festen, konsistenten Reihenfolge aufrufen kann. Sie werden
  // NICHT öffentlich exponiert (private/interne Helper des SuperAdminLib).

  public func cascadeDeleteUsers(
    users : Map.Map<Principal, KanzleiTypes.Leistungserbringer>,
    kanzleiId : Common.KanzleiId,
  ) : () {
    // Snapshot der Einträge holen, dann auf dem Original-Map entfernen
    // (sichere Iteration ohne Mutation während der Iteration).
    let entries : [(Principal, KanzleiTypes.Leistungserbringer)] = users.entries().toArray();
    for ((p, u) in entries.values()) {
      if (u.kanzleiId == kanzleiId) {
        users.remove(p);
      };
    };
  };

  public func cascadeDeleteInviteTokens(
    inviteTokens : Map.Map<Text, KanzleiTypes.InviteToken>,
    kanzleiId : Common.KanzleiId,
  ) : () {
    let entries : [(Text, KanzleiTypes.InviteToken)] = inviteTokens.entries().toArray();
    for ((token, t) in entries.values()) {
      if (t.kanzleiId == kanzleiId) {
        inviteTokens.remove(token);
      };
    };
  };

  public func cascadeDeleteKlienten(
    klienten : Map.Map<Common.KlientId, KlientenTypes.Klient>,
    kanzleiId : Common.KanzleiId,
  ) : () {
    let entries : [(Common.KlientId, KlientenTypes.Klient)] = klienten.entries().toArray();
    for ((id, k) in entries.values()) {
      if (k.kanzleiId == kanzleiId) {
        klienten.remove(id);
      };
    };
  };

  public func cascadeDeleteMandate(
    mandate : Map.Map<Common.MandatId, KlientenTypes.Mandat>,
    kanzleiId : Common.KanzleiId,
  ) : () {
    let entries : [(Common.MandatId, KlientenTypes.Mandat)] = mandate.entries().toArray();
    for ((id, m) in entries.values()) {
      if (m.kanzleiId == kanzleiId) {
        mandate.remove(id);
      };
    };
  };

  public func cascadeDeleteLeistungen(
    leistungen : Map.Map<Common.LeistungId, LeistungTypes.Leistung>,
    kanzleiId : Common.KanzleiId,
  ) : () {
    let entries : [(Common.LeistungId, LeistungTypes.Leistung)] = leistungen.entries().toArray();
    for ((id, l) in entries.values()) {
      if (l.kanzleiId == kanzleiId) {
        leistungen.remove(id);
      };
    };
  };

  public func cascadeDeleteAuslagen(
    auslagen : Map.Map<Common.AuslageId, LeistungTypes.Auslage>,
    kanzleiId : Common.KanzleiId,
  ) : () {
    let entries : [(Common.AuslageId, LeistungTypes.Auslage)] = auslagen.entries().toArray();
    for ((id, a) in entries.values()) {
      if (a.kanzleiId == kanzleiId) {
        auslagen.remove(id);
      };
    };
  };

  public func cascadeDeleteRechnungen(
    rechnungen : Map.Map<Common.RechnungId, RechnungTypes.Rechnung>,
    kanzleiId : Common.KanzleiId,
  ) : () {
    let entries : [(Common.RechnungId, RechnungTypes.Rechnung)] = rechnungen.entries().toArray();
    for ((id, r) in entries.values()) {
      if (r.kanzleiId == kanzleiId) {
        rechnungen.remove(id);
      };
    };
  };

  public func cascadeDeleteZahlungen(
    zahlungen : Map.Map<Common.ZahlungId, RechnungTypes.Zahlung>,
    kanzleiId : Common.KanzleiId,
  ) : () {
    let entries : [(Common.ZahlungId, RechnungTypes.Zahlung)] = zahlungen.entries().toArray();
    for ((id, z) in entries.values()) {
      if (z.kanzleiId == kanzleiId) {
        zahlungen.remove(id);
      };
    };
  };

  public func cascadeDeleteRechnungsvorlagen(
    rechnungsvorlagen : Map.Map<Common.KanzleiId, RechnungsvorlagenTypes.Rechnungsvorlage>,
    kanzleiId : Common.KanzleiId,
  ) : () {
    // Rechnungsvorlagen sind direkt nach kanzleiId geschlüsselt — ein
    // einzelnes remove genügt (sofern ein Eintrag existiert).
    if (rechnungsvorlagen.get(kanzleiId) != null) {
      rechnungsvorlagen.remove(kanzleiId);
    };
  };
};
