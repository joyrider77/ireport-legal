// security-fixes API mixin
//
// Dieses Mixin exponiert die neuen öffentlichen Endpunkte des Sicherheits-
// Builds. Es ist DÜNN — die gesamte Logik liegt in lib/security-fixes.mo.
// main.mo inkludiert dieses Mixin und reicht den State durch.
//
// Einzige öffentliche Endpoint in diesem Build:
//   - reactivateKanzlei(kanzleiId) -> Result<(), Text>
//
// Die Guard-Helper (requireActiveUser, requireActiveUserAndKanzlei,
// canDeactivateLeistungserbringer) sind interne lib-Funktionen und werden
// NICHT über dieses Mixin exponiert — sie werden von den bestehenden
// mixins (leistungen-api, klienten-api, etc.) aufgerufen, indem diese
// lib/security-fixes.mo importieren.

import Common "../types/common";
import KanzleiTypes "../types/kanzlei";
import SuperAdminTypes "../types/super-admin";
import SecurityLib "../lib/security-fixes";
import Map "mo:core/Map";

mixin (
  kanzleien : Map.Map<Common.KanzleiId, KanzleiTypes.Kanzlei>,
  superAdminWhitelist : Map.Map<Principal, SuperAdminTypes.SuperAdminWhitelistEntry>,
) {

  // Reaktiviert eine deaktivierte Kanzlei (setzt den Kanzlei-Status auf
  // "aktiv" — Spiegel von deactivateKanzlei). Nur Super-Admins.
  // Physisches Löschen bleibt deleteKanzlei vorbehalten.
  //
  // Wird in main.mo neben deactivateKanzlei/deleteKanzlei gewired.
  public shared ({ caller }) func reactivateKanzlei(kanzleiId : Text) : async Common.Result<(), Text> {
    SecurityLib.reactivateKanzlei(kanzleien, superAdminWhitelist, caller, kanzleiId);
  };
};
