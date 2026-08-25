// OQL entity declarations for the Super-Admin domain.
//
// Exposes the persisted superAdminWhitelist collection
// (Map<Principal, SuperAdminWhitelistEntry>) as an OQL-queryable entity.
//
// Authorization: #controllerOnly (the most restrictive built-in TableAuth
// level — only the canister controller can query), matching the existing
// Datenschutz entities. App-level super-admin enforcement is handled
// separately at the application layer (SuperAdminApi / ActiveUsersApi /
// RolesApi mixins). OQL is an additional read surface for the controller,
// not a replacement for the mixin's RBAC.
//
// The Map key is the Principal; the value record also carries the
// `principal` field, so iterating values via .toEntityManual is sufficient
// (no key promotion needed).

import Common "../types/common";
import SuperAdminTypes "../types/super-admin";
import Map "mo:core/Map";
import OQL "mo:caffeineai-oql";
import Entity "mo:caffeineai-oql/Entity";
import MapEntity "mo:caffeineai-oql/MapEntity";
import PrincipalValue "mo:caffeineai-oql/PrincipalValue";
import IntValue "mo:caffeineai-oql/IntValue";

module {
  type Decl = OQL.Decl;

  // superAdminWhitelist: SuperAdminWhitelistEntry — all flat fields, no variants.
  public func superAdminWhitelistEntity(
    superAdminWhitelist : Map.Map<Principal, SuperAdminTypes.SuperAdminWhitelistEntry>,
  ) : Decl {
    superAdminWhitelist.toEntityManual(
      "superAdminWhitelist",
      "SuperAdminWhitelistEntry",
      "principal",
    )
      .payload("principal", func (e : SuperAdminTypes.SuperAdminWhitelistEntry) : Principal = e.principal)
      .payload("addedAt", func (e : SuperAdminTypes.SuperAdminWhitelistEntry) : Common.Timestamp = e.addedAt)
      .controllerOnly()
      .build();
  };

  // ─── Aggregate entity list ─────────────────────────────────────────────────
  //
  // Returns the Super-Admin OQL entities for inclusion in
  // Expose({ entities = [...] }) in main.mo.

  public func allEntities(
    superAdminWhitelist : Map.Map<Principal, SuperAdminTypes.SuperAdminWhitelistEntry>,
  ) : [Decl] = [
    superAdminWhitelistEntity(superAdminWhitelist),
  ];
};
