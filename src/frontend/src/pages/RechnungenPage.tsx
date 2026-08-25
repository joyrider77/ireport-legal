import {
  type Auslage,
  Auslagenregelung,
  type Klient,
  type Leistung,
  type Leistungserbringer,
  type Mandat,
  type Rechnung,
  type Zahlung,
  ZahlungEingangStatus,
  ZahlungsStatus,
} from "@/backend.d";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { KanzleiStammdaten } from "@/types";
import {
  queryKeys,
  useBackend,
  useGetKanzleiStammdaten,
  useGetLogo,
  useRechnungsvorlage,
} from "@/utils/backend";
import { exportRechnungDocx } from "@/utils/export";
import {
  currencySymbol,
  formatCHF,
  formatDate,
  resolveFaelligkeitsdatum,
  roundTo5Rappen,
  todayDate,
} from "@/utils/format";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  ArrowUpDown,
  ChevronDown,
  ChevronUp,
  Download,
  FileText,
  Plus,
  Search,
} from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";

// ─── Types ─────────────────────────────────────────────────────────────────

type SortField = "rechnungsnummer" | "total" | "faelligkeitsdatum";
type SortDir = "asc" | "desc";
type FaelligkeitFilter = "alle" | "faellig" | "nichtFaellig" | "ueberfaellig";
type ZahlungsStatusFilter = "alle" | ZahlungsStatus;

// ─── Status Badge ───────────────────────────────────────────────────────────

function ZahlungsStatusBadge({ status }: { status: ZahlungsStatus }) {
  const cfg = {
    [ZahlungsStatus.offen]: {
      label: "Offen",
      cls: "text-amber-700 bg-amber-50 border border-amber-200",
    },
    [ZahlungsStatus.bezahlt]: {
      label: "Bezahlt",
      cls: "text-emerald-700 bg-emerald-50 border border-emerald-200",
    },
    [ZahlungsStatus.ueberfaellig]: {
      label: "Überfällig",
      cls: "text-red-700 bg-red-50 border border-red-200",
    },
  };
  const { label, cls } = cfg[status] ?? {
    label: status,
    cls: "bg-muted text-muted-foreground",
  };
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}
    >
      {label}
    </span>
  );
}

function ZahlungEingangBadge({ status }: { status: ZahlungEingangStatus }) {
  const cfg = {
    [ZahlungEingangStatus.eingegangen]: {
      label: "Eingegangen",
      cls: "text-amber-700 bg-amber-50 border border-amber-200",
    },
    [ZahlungEingangStatus.bestaetigt]: {
      label: "Bestätigt",
      cls: "text-emerald-700 bg-emerald-50 border border-emerald-200",
    },
  };
  const { label, cls } = cfg[status] ?? {
    label: status,
    cls: "bg-muted text-muted-foreground",
  };
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}
    >
      {label}
    </span>
  );
}

// ─── Sort Header ────────────────────────────────────────────────────────────

function SortHeader({
  label,
  field,
  current,
  dir,
  onSort,
}: {
  label: string;
  field: SortField;
  current: SortField;
  dir: SortDir;
  onSort: (f: SortField) => void;
}) {
  const active = current === field;
  return (
    <button
      type="button"
      onClick={() => onSort(field)}
      className="flex items-center gap-1 hover:text-foreground transition-colors text-left font-medium"
    >
      {label}
      {active ? (
        dir === "asc" ? (
          <ChevronUp size={14} />
        ) : (
          <ChevronDown size={14} />
        )
      ) : (
        <ArrowUpDown size={14} className="opacity-40" />
      )}
    </button>
  );
}

// ─── Create Invoice Modal ───────────────────────────────────────────────────

interface CreateRechnungModalProps {
  open: boolean;
  onClose: () => void;
  mandat: Mandat | null;
  klient: Klient | null;
  leistungen: Leistung[];
  auslagen: Auslage[];
  // P1-Fix WYSIWYG: Kanzlei-Stammdaten (Einstellungen > Kanzleidaten) sind
  // die kanonische Quelle für die Absenderadresse im Word-Export. Der Export
  // baut die Absenderadresse via getAbsenderadresse(stammdaten) auf — KEIN
  // Fallback auf currentUser-Namen (vorher: kanzleiName = "vorname nachname,
  // Rechtsanwalt").
  stammdaten: KanzleiStammdaten | null;
  // Liste aller Leistungserbringer der Kanzlei — benötigt, um pro Position
  // (Leistung/Auslage) den LE-Namen aufzulösen und an den Word-Export
  // weiterzureichen.
  leistungserbringer: Leistungserbringer[];
}

function CreateRechnungModal({
  open,
  onClose,
  mandat,
  klient,
  leistungen,
  auslagen,
  stammdaten,
  leistungserbringer,
}: CreateRechnungModalProps) {
  const { actor } = useBackend();
  const queryClient = useQueryClient();
  const { data: vorlage } = useRechnungsvorlage();
  const { data: logoBlob } = useGetLogo();

  const [rechnungsdatum, setRechnungsdatum] = useState(todayDate());
  const [zeitraumVon, setZeitraumVon] = useState("");
  const [zeitraumBis, setZeitraumBis] = useState(todayDate());
  const [selectedLeistungen, setSelectedLeistungen] = useState<Set<string>>(
    new Set(leistungen.map((l) => l.id)),
  );
  const [selectedAuslagen, setSelectedAuslagen] = useState<Set<string>>(
    new Set(auslagen.map((a) => a.id)),
  );
  // Preview-Export-Status: verhindert Mehrfachklicks und zeigt einen
  // sauberen Loading-/Disabled-State auf dem Vorschau-Export-Button.
  const [isPreviewExporting, setIsPreviewExporting] = useState(false);
  // MWST is read from the Mandat's mwstSatz, stored as basis points (810 = 8.1%).
  // The backend createRechnung pulls mwstSatz from the Mandat, so the modal
  // displays the Mandat's rate read-only — the saved invoice always matches.
  // Default fallback is 810 (8.1%), the current standard Swiss MWST rate.
  const mwstSatzBp = Number(mandat?.mwstSatz ?? 810);
  const mwstPct = mwstSatzBp / 100;
  const [zahlungsbedingungen, setZahlungsbedingungen] = useState(
    mandat?.zahlungsbedingungen ?? "Zahlbar innert 30 Tagen.",
  );

  const selLeistungen = leistungen.filter((l) => selectedLeistungen.has(l.id));
  const selAuslagen = auslagen.filter((a) => selectedAuslagen.has(a.id));

  // Lookup `leistungserbringerId-als-String → "Vorname Nachname"` für alle LE,
  // die in den aktuell ausgewählten Leistungen/Auslagen vorkommen. Wird an
  // exportRechnungDocx als `leistungsErbringerProPosition` übergeben.
  const buildLeLookup = (
    ls: Leistung[],
    as: Auslage[],
  ): Record<string, string> => {
    const lookup: Record<string, string> = {};
    const ids = new Set<string>();
    for (const l of ls) ids.add(l.leistungserbringerId.toString());
    for (const a of as) ids.add(a.leistungserbringerId.toString());
    for (const idStr of ids) {
      const le = leistungserbringer.find((x) => x.id.toString() === idStr);
      if (le) lookup[idStr] = `${le.vorname} ${le.nachname}`;
    }
    return lookup;
  };

  // Auslagenregelung am Mandat steuert, welche Auslagenposition im Modal
  // angezeigt wird:
  //  - "Pauschal":  eine eigene "Pauschal-Spesen"-Position mit pauschalBetrag
  //                 (keine Einzelauslagen, Betrag nicht editierbar im Modal).
  //  - "Effektiv":   die erfassten Einzelauslagen bleiben auswählbar sichtbar.
  //  - "Keine":      keine Auslagenposition wird gezeigt.
  // Der pauschale Betrag ist in Rappen (CHFAmount) am Mandat hinterlegt und
  // wird in die Zwischensumme und Gesamtsumme einbezogen.
  const isPauschal =
    mandat?.auslagenregelung === Auslagenregelung.Pauschal &&
    Number(mandat?.pauschalBetrag ?? 0) > 0;
  const pauschalBetragRappen = isPauschal ? Number(mandat?.pauschalBetrag) : 0;

  const subtotalRappen =
    selLeistungen.reduce((s, l) => s + Number(l.honorar), 0) +
    selAuslagen.reduce((s, a) => s + Number(a.betrag), 0) +
    pauschalBetragRappen;
  const mwstRappen = Math.round(subtotalRappen * (mwstSatzBp / 10000));
  const totalRappen = subtotalRappen + mwstRappen;

  const toggleLeistung = (id: string) => {
    setSelectedLeistungen((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleAuslage = (id: string) => {
    setSelectedAuslagen((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toIso = (ddmmyyyy: string) => {
    if (!ddmmyyyy) return "";
    if (/^\d{2}\.\d{2}\.\d{4}$/.test(ddmmyyyy)) {
      const [d, m, y] = ddmmyyyy.split(".");
      return `${y}-${m}-${d}`;
    }
    return ddmmyyyy;
  };

  const mutation = useMutation({
    mutationFn: async () => {
      if (!actor || !mandat) throw new Error("Nicht bereit");
      const result = await actor.createRechnung(
        mandat.id,
        Array.from(selectedLeistungen),
        Array.from(selectedAuslagen),
        toIso(rechnungsdatum),
        zahlungsbedingungen,
        toIso(zeitraumVon || rechnungsdatum),
        toIso(zeitraumBis),
      );
      if (result.__kind__ === "err") throw new Error(result.err);
      return result.ok;
    },
    onSuccess: async (rechnung) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.rechnungen() });
      queryClient.invalidateQueries({ queryKey: queryKeys.leistungen() });
      queryClient.invalidateQueries({ queryKey: queryKeys.auslagen() });
      toast.success("Rechnung erfolgreich erstellt");
      // Auto-Word-Export nach erfolgreicher Erstellung. Der Export wird
      // sauber awaited; schlägt er fehl, wird eine sichtbare Warnung
      // gezeigt (die Erstellung selbst bleibt erfolgreich). Das Modal
      // schliesst sich erst nach Abschluss des Exports.
      try {
        const logoBytes = logoBlob ? await logoBlob.getBytes() : null;
        await exportRechnungDocx(
          {
            rechnung,
            klient,
            mandat,
            leistungen: selLeistungen,
            auslagen: selAuslagen,
            stammdaten,
            leistungsErbringerProPosition: buildLeLookup(
              selLeistungen,
              selAuslagen,
            ),
            filename: `Rechnung-${rechnung.rechnungsnummer}-${klient?.name ?? "Klient"}.docx`,
          },
          vorlage ?? null,
          logoBytes,
        );
      } catch (exportErr) {
        toast.warning(
          `Rechnung erstellt, aber Word-Export fehlgeschlagen: ${exportErr instanceof Error ? exportErr.message : "Unbekannter Fehler"}`,
        );
      }
      onClose();
    },
    onError: (e: Error) => {
      toast.error(`Fehler: ${e.message}`);
    },
  });

  const handlePreviewExport = async () => {
    if (!mandat || isPreviewExporting) return;
    setIsPreviewExporting(true);
    try {
      const draftRechnung: Rechnung = {
        id: "draft",
        rechnungsnummer: "VORSCHAU",
        total: BigInt(totalRappen),
        waehrung: mandat.waehrung ?? "CHF",
        rechnungsdatum: toIso(rechnungsdatum),
        createdAt: BigInt(Date.now()),
        mwstBetrag: BigInt(mwstRappen),
        leistungserbringerId:
          selLeistungen[0]?.leistungserbringerId ??
          ({} as Rechnung["leistungserbringerId"]),
        // P1-Fix Fälligkeitsdatum: Vorschau berechnet das Fälligkeitsdatum
        // JETZT identisch zum Backend createRechnung-Pfad via
        // resolveFaelligkeitsdatum(rechnungsdatum, zahlungsbedingungen)
        // (gespiegelte Backend-Logik aus lib/rechnungen.mo: erste Ziffernfolge
        // aus zahlungsbedingungen, Fallback 30, +Tage mit korrekter
        // Kalenderarithmetik). Vorher: faelligkeitsdatum: toIso(zeitraumBis)
        // — BUG: verwendete das Leistungszeitraum-Bis als Fälligkeitsdatum,
        // sodass Vorschau und definitive Rechnung unterschiedliche
        // Fälligkeitsdaten lieferten. Kein Hardcode "+30", kein Fallback auf
        // rechnungsdatum; der bestehende Parser wird wiederverwendet.
        faelligkeitsdatum: resolveFaelligkeitsdatum(
          toIso(rechnungsdatum),
          zahlungsbedingungen,
        ),
        zahlungsstatus: ZahlungsStatus.offen,
        zahlungsbedingungen,
        leistungszeitraumBis: toIso(zeitraumBis),
        leistungszeitraumVon: toIso(zeitraumVon || rechnungsdatum),
        leistungspositionen: Array.from(selectedLeistungen),
        auslageIds: Array.from(selectedAuslagen),
        mandatId: mandat.id,
        kanzleiId: mandat.kanzleiId,
        subtotal: BigInt(subtotalRappen),
      };
      const logoBytes = logoBlob ? await logoBlob.getBytes() : null;
      await exportRechnungDocx(
        {
          rechnung: draftRechnung,
          klient,
          mandat,
          leistungen: selLeistungen,
          auslagen: selAuslagen,
          stammdaten,
          leistungsErbringerProPosition: buildLeLookup(
            selLeistungen,
            selAuslagen,
          ),
          filename: `Rechnung-Vorschau-${klient?.name ?? "Klient"}.docx`,
        },
        vorlage ?? null,
        logoBytes,
      );
      toast.success("Word-Vorschau wird heruntergeladen");
    } catch (err) {
      toast.error(
        `Word-Export fehlgeschlagen: ${err instanceof Error ? err.message : "Unbekannter Fehler"}`,
      );
    } finally {
      setIsPreviewExporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        data-ocid="create-rechnung.dialog"
        className="sm:max-w-3xl lg:max-w-6xl xl:max-w-7xl max-h-[calc(100vh-2rem)] overflow-hidden flex flex-col"
      >
        <DialogHeader>
          <DialogTitle className="font-display text-lg">
            Neue Rechnung erstellen
          </DialogTitle>
        </DialogHeader>

        <div className="overflow-y-auto overflow-x-hidden flex-1 min-h-0 px-1">
          <div className="space-y-4 py-1">
            {/* Dates — fix ausserhalb des Scrollbereichs */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="rechnungsdatum">Rechnungsdatum</Label>
                <Input
                  id="rechnungsdatum"
                  data-ocid="create-rechnung.rechnungsdatum.input"
                  placeholder="z.B. 17.04.2026"
                  value={rechnungsdatum}
                  onChange={(e) => setRechnungsdatum(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label>Leistungszeitraum</Label>
                <div className="flex items-center gap-2">
                  <Input
                    data-ocid="create-rechnung.zeitraum-von.input"
                    placeholder="z.B. 01.01.2026"
                    value={zeitraumVon}
                    onChange={(e) => setZeitraumVon(e.target.value)}
                    className="flex-1"
                  />
                  <span className="text-muted-foreground text-sm">–</span>
                  <Input
                    data-ocid="create-rechnung.zeitraum-bis.input"
                    placeholder="z.B. 31.03.2026"
                    value={zeitraumBis}
                    onChange={(e) => setZeitraumBis(e.target.value)}
                    className="flex-1"
                  />
                </div>
              </div>
            </div>

            {/* Positionslisten — scrollbar; Summen bleiben darunter fix sichtbar.
              table-fixed + feste Spaltenbreiten verhindern horizontales
              Springen der Werte bei unterschiedlich langen Inhalten. */}
            <div className="max-h-[42vh] overflow-y-auto space-y-3 pr-1">
              {/* Leistungen */}
              {leistungen.length > 0 && (
                <div className="space-y-1.5">
                  <Label className="text-sm font-medium">
                    Leistungspositionen
                  </Label>
                  <div className="border border-border rounded-md overflow-hidden">
                    <table className="w-full text-sm table-fixed">
                      <colgroup>
                        <col className="w-8" />
                        <col className="w-20" />
                        <col />
                        <col className="w-14" />
                        <col className="w-24" />
                      </colgroup>
                      <thead className="bg-muted/50">
                        <tr>
                          <th className="p-2" />
                          <th className="p-2 text-left text-muted-foreground font-medium">
                            Datum
                          </th>
                          <th className="p-2 text-left text-muted-foreground font-medium">
                            Tätigkeit
                          </th>
                          <th className="p-2 text-right text-muted-foreground font-medium">
                            Dauer
                          </th>
                          <th className="p-2 text-right text-muted-foreground font-medium">
                            Honorar
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {leistungen.map((l, idx) => (
                          <tr
                            key={l.id}
                            className="border-t border-border hover:bg-muted/20"
                          >
                            <td className="p-2">
                              <Checkbox
                                data-ocid={`create-rechnung.leistung.${idx + 1}`}
                                checked={selectedLeistungen.has(l.id)}
                                onCheckedChange={() => toggleLeistung(l.id)}
                              />
                            </td>
                            <td className="p-2 text-muted-foreground tabular-nums">
                              {formatDate(l.datum)}
                            </td>
                            <td className="p-2 truncate" title={l.taetigkeit}>
                              {l.taetigkeit}
                            </td>
                            <td className="p-2 text-right font-mono text-xs tabular-nums">
                              {`${Math.floor(Number(l.dauer) / 60)}:${String(Number(l.dauer) % 60).padStart(2, "0")}`}
                            </td>
                            <td className="p-2 text-right font-mono text-xs tabular-nums">
                              {/* Fix 10: Währung aus dem gewählten Mandat (mandat.waehrung),
                                  nicht hart codiert CHF. Root Cause: frühere
                                  Single-Currency-Annahme (nur CHF). */}
                              {formatCHF(
                                l.honorar,
                                currencySymbol(mandat?.waehrung),
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Auslagen — abhängig von der Auslagenregelung am Mandat:
                Pauschal  → einzelne hervorgehobene "Pauschal-Spesen"-Position
                Effektiv  → Tabelle der erfassten Einzelauslagen (auswählbar)
                Keine     → keine Auslagenposition */}
              {isPauschal && (
                <div className="space-y-1.5">
                  <Label className="text-sm font-medium">Auslagen</Label>
                  <div className="border border-border rounded-md overflow-hidden">
                    <table className="w-full text-sm table-fixed">
                      <colgroup>
                        <col className="w-8" />
                        <col className="w-20" />
                        <col />
                        <col className="w-24" />
                      </colgroup>
                      <thead className="bg-muted/50">
                        <tr>
                          <th className="p-2" />
                          <th className="p-2 text-left text-muted-foreground font-medium">
                            Datum
                          </th>
                          <th className="p-2 text-left text-muted-foreground font-medium">
                            Beschreibung
                          </th>
                          <th className="p-2 text-right text-muted-foreground font-medium">
                            Betrag
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr
                          data-ocid="create-rechnung.pauschal_spesen.1"
                          className="border-t border-border bg-primary/5"
                        >
                          <td className="p-2 text-center">
                            <span
                              className="inline-flex h-4 w-4 items-center justify-center rounded-sm border border-primary bg-primary text-primary-foreground"
                              aria-label="Pauschal-Spesen aktiv"
                            >
                              <svg
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="3"
                                className="h-3 w-3"
                                role="img"
                                aria-label="Pauschal-Spesen aktiv"
                              >
                                <title>Pauschal-Spesen aktiv</title>
                                <path d="M5 13l4 4L19 7" />
                              </svg>
                            </span>
                          </td>
                          <td className="p-2 text-muted-foreground tabular-nums">
                            {formatDate(rechnungsdatum)}
                          </td>
                          <td className="p-2">
                            <span className="font-medium text-foreground">
                              Pauschal-Spesen
                            </span>
                            <span className="ml-2 text-xs text-muted-foreground">
                              (gemäss Mandat-Auslagenregelung)
                            </span>
                          </td>
                          <td className="p-2 text-right font-mono text-xs font-semibold tabular-nums">
                            {/* Fix 10: Pauschal-Spesen in Mandatswährung (mandat.waehrung),
                                nicht hart codiert CHF. Root Cause: frühere
                                Single-Currency-Annahme (nur CHF). */}
                            {formatCHF(
                              mandat?.pauschalBetrag ?? 0,
                              currencySymbol(mandat?.waehrung),
                            )}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {!isPauschal && auslagen.length > 0 && (
                <div className="space-y-1.5">
                  <Label className="text-sm font-medium">Auslagen</Label>
                  <div className="border border-border rounded-md overflow-hidden">
                    <table className="w-full text-sm table-fixed">
                      <colgroup>
                        <col className="w-8" />
                        <col className="w-20" />
                        <col />
                        <col className="w-24" />
                      </colgroup>
                      <thead className="bg-muted/50">
                        <tr>
                          <th className="p-2" />
                          <th className="p-2 text-left text-muted-foreground font-medium">
                            Datum
                          </th>
                          <th className="p-2 text-left text-muted-foreground font-medium">
                            Beschreibung
                          </th>
                          <th className="p-2 text-right text-muted-foreground font-medium">
                            Betrag
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {auslagen.map((a, idx) => (
                          <tr
                            key={a.id}
                            className="border-t border-border hover:bg-muted/20"
                          >
                            <td className="p-2">
                              <Checkbox
                                data-ocid={`create-rechnung.auslage.${idx + 1}`}
                                checked={selectedAuslagen.has(a.id)}
                                onCheckedChange={() => toggleAuslage(a.id)}
                              />
                            </td>
                            <td className="p-2 text-muted-foreground tabular-nums">
                              {formatDate(a.datum)}
                            </td>
                            <td className="p-2 truncate" title={a.beschreibung}>
                              {a.beschreibung}
                            </td>
                            <td className="p-2 text-right font-mono text-xs tabular-nums">
                              {/* Fix 10: Währung aus dem gewählten Mandat (mandat.waehrung),
                                  nicht hart codiert CHF. Root Cause: frühere
                                  Single-Currency-Annahme (nur CHF). */}
                              {formatCHF(
                                a.betrag,
                                currencySymbol(mandat?.waehrung),
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            {/* Subtotal / MWST / Total — fix sichtbar ausserhalb des
              Positions-Scrollbereichs.
              Schweizer 5-Rappen-Rundung gilt NUR für die Anzeige hier im
              Modal und im PDF-/Word-Export. Die an das Backend gesendeten
              Werte (createRechnung) bleiben exakt in Rappen — der persistierte
              Rechnungs-Datensatz wird nicht gerundet. */}
            <div className="flex justify-end">
              <div className="space-y-1 rounded-lg bg-muted/40 p-2.5 border border-border w-full sm:w-80">
                {/* Fix 10: Subtotal/MWST/Total in Mandatswährung (mandat.waehrung),
                    nicht hart codiert CHF. Root Cause: frühere Single-Currency-
                    Annahme (nur CHF). */}
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span className="font-mono tabular-nums">
                    {formatCHF(
                      roundTo5Rappen(BigInt(subtotalRappen)),
                      currencySymbol(mandat?.waehrung),
                    )}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">
                    MWST ({mwstPct.toFixed(1)}%)
                  </span>
                  <span className="font-mono tabular-nums">
                    {formatCHF(
                      roundTo5Rappen(BigInt(mwstRappen)),
                      currencySymbol(mandat?.waehrung),
                    )}
                  </span>
                </div>
                <div className="flex justify-between text-sm font-semibold border-t border-border pt-1 mt-1">
                  <span>Total {currencySymbol(mandat?.waehrung)}</span>
                  <span className="font-mono tabular-nums">
                    {formatCHF(
                      roundTo5Rappen(BigInt(totalRappen)),
                      currencySymbol(mandat?.waehrung),
                    )}
                  </span>
                </div>
              </div>
            </div>

            {/* Zahlungsbedingungen */}
            <div className="space-y-1.5">
              <Label htmlFor="zb">Zahlungsbedingungen</Label>
              <Input
                id="zb"
                data-ocid="create-rechnung.zahlungsbedingungen.input"
                value={zahlungsbedingungen}
                onChange={(e) => setZahlungsbedingungen(e.target.value)}
              />
            </div>
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2 shrink-0">
          <Button
            type="button"
            variant="ghost"
            data-ocid="create-rechnung.cancel_button"
            onClick={onClose}
            disabled={mutation.isPending || isPreviewExporting}
          >
            Abbrechen
          </Button>
          <Button
            type="button"
            variant="outline"
            data-ocid="create-rechnung.preview_export_button"
            onClick={handlePreviewExport}
            disabled={
              isPreviewExporting ||
              mutation.isPending ||
              (selectedLeistungen.size + selectedAuslagen.size === 0 &&
                !isPauschal)
            }
            className="border-primary text-primary hover:bg-primary/5"
          >
            {isPreviewExporting ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-primary border-t-transparent rounded-full animate-spin mr-1.5" />
                Wird exportiert…
              </>
            ) : (
              <>
                <Download size={14} className="mr-1.5" />
                Als Word exportieren (Vorschau)
              </>
            )}
          </Button>
          <Button
            type="button"
            data-ocid="create-rechnung.submit_button"
            onClick={() => mutation.mutate()}
            disabled={
              mutation.isPending ||
              isPreviewExporting ||
              (selectedLeistungen.size + selectedAuslagen.size === 0 &&
                !isPauschal)
            }
            className="btn-success"
          >
            {mutation.isPending ? "Wird erstellt…" : "Rechnung erstellen"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Zahlung Erfassen Modal ─────────────────────────────────────────────────

interface ZahlungModalProps {
  open: boolean;
  onClose: () => void;
  offeneRechnungen: Rechnung[];
}

function ZahlungModal({ open, onClose, offeneRechnungen }: ZahlungModalProps) {
  const { actor } = useBackend();
  const queryClient = useQueryClient();

  const [rechnungId, setRechnungId] = useState("");
  const [datum, setDatum] = useState(todayDate());
  const [betrag, setBetrag] = useState("");

  // Fix 10: Währung der ausgewählten Rechnung (Rechnung.waehrung) für das
  // Betrag-Label, nicht hart codiert CHF. Root Cause: frühere Single-Currency-
  // Annahme (nur CHF).
  const selectedRechnung = offeneRechnungen.find((r) => r.id === rechnungId);
  const selectedWaehrung = currencySymbol(selectedRechnung?.waehrung);

  const toIso = (ddmmyyyy: string) => {
    if (/^\d{2}\.\d{2}\.\d{4}$/.test(ddmmyyyy)) {
      const [d, m, y] = ddmmyyyy.split(".");
      return `${y}-${m}-${d}`;
    }
    return ddmmyyyy;
  };

  const mutation = useMutation({
    mutationFn: async () => {
      if (!actor || !rechnungId) throw new Error("Bitte Rechnung auswählen");
      const betragRappen = BigInt(Math.round(Number.parseFloat(betrag) * 100));
      const result = await actor.addZahlung(
        rechnungId,
        toIso(datum),
        betragRappen,
      );
      if (result.__kind__ === "err") throw new Error(result.err);
      return result.ok;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.zahlungen() });
      queryClient.invalidateQueries({ queryKey: queryKeys.rechnungen() });
      toast.success("Zahlung erfasst");
      setRechnungId("");
      setBetrag("");
      onClose();
    },
    onError: (e: Error) => toast.error(`Fehler: ${e.message}`),
  });

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent data-ocid="zahlung.dialog" className="max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display">Zahlung erfassen</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label>Rechnung</Label>
            <Select value={rechnungId} onValueChange={setRechnungId}>
              <SelectTrigger data-ocid="zahlung.rechnung.select">
                <SelectValue placeholder="Rechnung auswählen…" />
              </SelectTrigger>
              <SelectContent>
                {offeneRechnungen.map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    {/* Fix 10: Währung pro Rechnung (r.waehrung), nicht hart
                        codiert CHF. Root Cause: frühere Single-Currency-Annahme. */}
                    {r.rechnungsnummer} —{" "}
                    {formatCHF(r.total, currencySymbol(r.waehrung))}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="zdatum">Datum</Label>
              <Input
                id="zdatum"
                data-ocid="zahlung.datum.input"
                placeholder="z.B. 17.04.2026"
                value={datum}
                onChange={(e) => setDatum(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              {/* Fix 10: Betrag-Label in Währung der ausgewählten Rechnung,
                  nicht hart codiert CHF. Root Cause: frühere Single-Currency-
                  Annahme (nur CHF). */}
              <Label htmlFor="zbetrag">Betrag ({selectedWaehrung})</Label>
              <Input
                id="zbetrag"
                data-ocid="zahlung.betrag.input"
                type="number"
                step="0.05"
                min="0"
                placeholder="0.00"
                value={betrag}
                onChange={(e) => setBetrag(e.target.value)}
              />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button
            type="button"
            variant="ghost"
            data-ocid="zahlung.cancel_button"
            onClick={onClose}
          >
            Abbrechen
          </Button>
          <Button
            type="button"
            data-ocid="zahlung.submit_button"
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending || !rechnungId || !betrag}
            className="btn-success"
          >
            {mutation.isPending ? "Wird gespeichert…" : "Speichern"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Date utils (module-level to avoid stale deps) ─────────────────────────

function parseDateStr(ddmmyyyy: string): Date {
  if (/^\d{2}\.\d{2}\.\d{4}$/.test(ddmmyyyy)) {
    const [d, m, y] = ddmmyyyy.split(".");
    return new Date(Number(y), Number(m) - 1, Number(d));
  }
  return new Date(ddmmyyyy);
}

// ─── Main Page ──────────────────────────────────────────────────────────────

export function RechnungenPage() {
  const { actor, isLoading: actorLoading } = useBackend();
  const { data: vorlage } = useRechnungsvorlage();
  const { data: logoBlob } = useGetLogo();
  // P1-Fix WYSIWYG: Kanzlei-Stammdaten (Einstellungen > Kanzleidaten) sind
  // die kanonische Quelle für die Absenderadresse im Word-Export. Der Export
  // baut die Absenderadresse via getAbsenderadresse(stammdaten) auf — KEIN
  // Fallback auf currentUser-Namen. Wird an CreateRechnungModal und an den
  // Word-Export bestehender Rechnungen (handleWordExport) durchgereicht.
  const { data: stammdaten } = useGetKanzleiStammdaten();

  // Filters
  const [akquisiteurFilter, setAkquisiteurFilter] = useState("alle");
  const [faelligkeitFilter, setFaelligkeitFilter] =
    useState<FaelligkeitFilter>("alle");
  const [statusFilter, setStatusFilter] =
    useState<ZahlungsStatusFilter>("alle");
  const [sortField, setSortField] = useState<SortField>("faelligkeitsdatum");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [searchQuery, setSearchQuery] = useState("");
  const [zahlungAkquisiteurFilter, setZahlungAkquisiteurFilter] =
    useState("alle");

  // Modal state
  const [createRechnungMandat, setCreateRechnungMandat] =
    useState<Mandat | null>(null);
  const [zahlungModalOpen, setZahlungModalOpen] = useState(false);

  // Word-Export-Status in der Übersicht: speichert die ID der Rechnung, die
  // gerade exportiert wird. Verhindert Mehrfachklicks und zeigt einen
  // sauberen Loading-State auf dem betroffenen Word-Button.
  const [exportingRechnungId, setExportingRechnungId] = useState<string | null>(
    null,
  );

  // Aktiver Tab (controlled) — ermöglicht den Wechsel zu Tab 2 ("offene")
  // über den "Rechnung erstellen"-Button im Page-Header der Übersicht.
  // Vor FIX 2.6 war Tabs uncontrolled (defaultValue), wodurch der Create-
  // Button im Übersichts-Header den Tab nicht wechseln konnte.
  const [activeTab, setActiveTab] = useState<
    "uebersicht" | "offene" | "zahlungen"
  >("uebersicht");

  // Fetch data
  const { data: rechnungen = [], isLoading: rechnungenLoading } = useQuery<
    Rechnung[]
  >({
    queryKey: queryKeys.rechnungen(),
    queryFn: async () => {
      if (!actor) return [];
      return actor.getRechnungen({});
    },
    enabled: !!actor && !actorLoading,
  });

  const { data: mandate = [] } = useQuery<Mandat[]>({
    queryKey: queryKeys.mandate(),
    queryFn: async () => {
      if (!actor) return [];
      return actor.getMandate(null);
    },
    enabled: !!actor && !actorLoading,
  });

  const { data: klienten = [] } = useQuery<Klient[]>({
    queryKey: queryKeys.klienten(),
    queryFn: async () => {
      if (!actor) return [];
      return actor.getKlienten();
    },
    enabled: !!actor && !actorLoading,
  });

  const { data: leistungserbringer = [] } = useQuery<Leistungserbringer[]>({
    queryKey: queryKeys.leistungserbringer(),
    queryFn: async () => {
      if (!actor) return [];
      return actor.getLeistungserbringer();
    },
    enabled: !!actor && !actorLoading,
  });

  const { data: alleLeistungen = [] } = useQuery<Leistung[]>({
    queryKey: queryKeys.leistungen({ status: "offen" }),
    queryFn: async () => {
      if (!actor) return [];
      return actor.getLeistungen({ status: "offen" as Leistung["status"] });
    },
    enabled: !!actor && !actorLoading,
  });

  const { data: alleAuslagen = [] } = useQuery<Auslage[]>({
    queryKey: queryKeys.auslagen({ status: "offen" }),
    queryFn: async () => {
      if (!actor) return [];
      return actor.getAuslagen({ status: "offen" as Auslage["status"] });
    },
    enabled: !!actor && !actorLoading,
  });

  const { data: zahlungen = [] } = useQuery<Zahlung[]>({
    queryKey: queryKeys.zahlungen(),
    queryFn: async () => {
      if (!actor) return [];
      return actor.getZahlungen();
    },
    enabled: !!actor && !actorLoading,
  });

  // P1-Fix WYSIWYG: kanzleiName wird NICHT mehr aus currentUser (vorname
  // nachname, Rechtsanwalt) gebildet. Die Absenderadresse im Word-Export
  // kommt ausschliesslich aus KanzleiStammdaten (stammdaten, siehe oben) via
  // getAbsenderadresse(stammdaten). Die frühere currentUser-Query wurde
  // entfernt, da sie nur für kanzleiName verwendet wurde — keine andere
  // Stelle in RechnungenPage benötigt currentUser.

  // Helpers
  // getKlient erwartet eine KlientId (z.B. Mandat.klientId). Für Rechnungen,
  // die nur eine mandatId halten, muss der Klient über das Mandat aufgelöst
  // werden: Rechnung.mandatId -> Mandat.klientId -> Klient. Diese Two-Step-
  // Auflösung übernimmt getKlientByMandatId, damit die Klient-Spalte nicht
  // fälschlich eine MandatId als KlientId interpretiert (vgl. LeistungenPage
  // und KlientenPage). Bei fehlendem Mandat oder gelöschtem Klienten wird
  // undefined zurückgegeben, sodass die Aufrufstellen '—' anzeigen.
  const getKlient = (id: string) => klienten.find((k) => k.id === id);
  const getMandat = (id: string) => mandate.find((m) => m.id === id);
  const getKlientByMandatId = useCallback(
    (mandatId: string) => {
      const mandat = mandate.find((m) => m.id === mandatId);
      if (!mandat) return undefined;
      return klienten.find((k) => k.id === mandat.klientId);
    },
    [mandate, klienten],
  );
  const getLE = (principal: Leistungserbringer["id"]) =>
    leistungserbringer.find((le) => le.id.toString() === principal.toString());

  // ── LE-Lookup pro Position (für Word-Export) ──────────────────────────────
  // Bau einen Lookup `leistungserbringerId-als-String → "Vorname Nachname"` für
  // alle Leistungserbringer, die in den übergebenen Leistungen/Auslagen einer
  // Rechnung vorkommen. Leistung und Auslage tragen jeweils ihren eigenen
  // leistungserbringerId (Principal) — die pro-Position LE ist in den Quelldaten
  // gespeichert. Der Lookup wird an exportRechnungDocx als
  // `leistungsErbringerProPosition` übergeben, sodass der Word-Renderer pro
  // Position den korrekten LE-Namen anzeigen kann.
  const buildLeLookup = (
    leistungen: Leistung[],
    auslagen: Auslage[],
  ): Record<string, string> => {
    const lookup: Record<string, string> = {};
    const ids = new Set<string>();
    for (const l of leistungen) ids.add(l.leistungserbringerId.toString());
    for (const a of auslagen) ids.add(a.leistungserbringerId.toString());
    for (const idStr of ids) {
      const le = leistungserbringer.find((x) => x.id.toString() === idStr);
      if (le) lookup[idStr] = `${le.vorname} ${le.nachname}`;
    }
    return lookup;
  };

  const todayTs = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  }, []);

  // Sort handler
  const handleSort = (field: SortField) => {
    if (sortField === field) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortField(field);
      setSortDir("asc");
    }
  };

  // ─ Tab 1: Übersicht ────────────────────────────────────────

  const filteredRechnungen = useMemo(() => {
    let list = [...rechnungen];

    if (akquisiteurFilter !== "alle") {
      list = list.filter((r) => {
        const m = mandate.find((x) => x.id === r.mandatId);
        return m?.akquisiteurId.toString() === akquisiteurFilter;
      });
    }

    if (statusFilter !== "alle") {
      list = list.filter((r) => r.zahlungsstatus === statusFilter);
    }

    if (faelligkeitFilter !== "alle") {
      const today = new Date(todayTs);
      list = list.filter((r) => {
        const faellig = parseDateStr(formatDate(r.faelligkeitsdatum));
        const isPast = faellig < today;
        const isToday = faellig.toDateString() === today.toDateString();
        if (faelligkeitFilter === "faellig") return isToday || !isPast;
        if (faelligkeitFilter === "ueberfaellig")
          return (
            isPast && !isToday && r.zahlungsstatus !== ZahlungsStatus.bezahlt
          );
        if (faelligkeitFilter === "nichtFaellig") return faellig > today;
        return true;
      });
    }

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      list = list.filter((r) => {
        const k = getKlientByMandatId(r.mandatId);
        const m = mandate.find((x) => x.id === r.mandatId);
        return (
          r.rechnungsnummer.toLowerCase().includes(q) ||
          k?.name.toLowerCase().includes(q) ||
          m?.bezeichnung.toLowerCase().includes(q)
        );
      });
    }

    list.sort((a, b) => {
      let av = 0;
      let bv = 0;
      if (sortField === "rechnungsnummer") {
        return sortDir === "asc"
          ? a.rechnungsnummer.localeCompare(b.rechnungsnummer)
          : b.rechnungsnummer.localeCompare(a.rechnungsnummer);
      }
      if (sortField === "total") {
        av = Number(a.total);
        bv = Number(b.total);
      }
      if (sortField === "faelligkeitsdatum") {
        av = parseDateStr(formatDate(a.faelligkeitsdatum)).getTime();
        bv = parseDateStr(formatDate(b.faelligkeitsdatum)).getTime();
      }
      return sortDir === "asc" ? av - bv : bv - av;
    });

    return list;
  }, [
    rechnungen,
    getKlientByMandatId,
    mandate,
    akquisiteurFilter,
    statusFilter,
    faelligkeitFilter,
    searchQuery,
    sortField,
    sortDir,
    todayTs,
  ]);

  // Word export for existing invoice
  const handleWordExport = async (rechnung: Rechnung) => {
    if (exportingRechnungId) return; // Mehrfachklicks verhindern
    setExportingRechnungId(rechnung.id);
    try {
      const klient = getKlientByMandatId(rechnung.mandatId) ?? null;
      const mandat = getMandat(rechnung.mandatId) ?? null;
      const leistungen = alleLeistungen.filter((l) =>
        rechnung.leistungspositionen.includes(l.id),
      );
      const auslagen = alleAuslagen.filter((a) =>
        rechnung.auslageIds.includes(a.id),
      );
      const logoBytes = logoBlob ? await logoBlob.getBytes() : null;
      await exportRechnungDocx(
        {
          rechnung,
          klient,
          mandat,
          leistungen,
          auslagen,
          stammdaten: stammdaten ?? null,
          leistungsErbringerProPosition: buildLeLookup(leistungen, auslagen),
          filename: `Rechnung-${rechnung.rechnungsnummer}-${klient?.name ?? "Klient"}.docx`,
        },
        vorlage ?? null,
        logoBytes,
      );
      toast.success("Word-Dokument wird heruntergeladen");
    } catch (err) {
      toast.error(
        `Word-Export fehlgeschlagen: ${err instanceof Error ? err.message : "Unbekannter Fehler"}`,
      );
    } finally {
      setExportingRechnungId(null);
    }
  };

  // ─ Tab 2: Offene Leistungen ────────────────────────────────

  const mandateWithOpenLeistungen = useMemo(() => {
    const mandatMap = new Map<
      string,
      { mandat: Mandat; leistungen: Leistung[]; auslagen: Auslage[] }
    >();

    for (const l of alleLeistungen) {
      if (!mandatMap.has(l.mandatId)) {
        const m = mandate.find((x) => x.id === l.mandatId);
        if (m)
          mandatMap.set(l.mandatId, {
            mandat: m,
            leistungen: [],
            auslagen: [],
          });
      }
      mandatMap.get(l.mandatId)?.leistungen.push(l);
    }
    for (const a of alleAuslagen) {
      if (!mandatMap.has(a.mandatId)) {
        const m = mandate.find((x) => x.id === a.mandatId);
        if (m)
          mandatMap.set(a.mandatId, {
            mandat: m,
            leistungen: [],
            auslagen: [],
          });
      }
      mandatMap.get(a.mandatId)?.auslagen.push(a);
    }

    return Array.from(mandatMap.values());
  }, [alleLeistungen, alleAuslagen, mandate]);

  const createMandatLeistungen = createRechnungMandat
    ? alleLeistungen.filter((l) => l.mandatId === createRechnungMandat.id)
    : [];
  const createMandatAuslagen = createRechnungMandat
    ? alleAuslagen.filter((a) => a.mandatId === createRechnungMandat.id)
    : [];

  // ─ Tab 3: Zahlungseingänge ─────────────────────────────────

  const filteredZahlungen = useMemo(() => {
    if (zahlungAkquisiteurFilter === "alle") return zahlungen;
    return zahlungen.filter((z) => {
      const r = rechnungen.find((r) => r.id === z.rechnungId);
      if (!r) return false;
      const m = mandate.find((x) => x.id === r.mandatId);
      return m?.akquisiteurId.toString() === zahlungAkquisiteurFilter;
    });
  }, [zahlungen, rechnungen, mandate, zahlungAkquisiteurFilter]);

  const offeneRechnungen = rechnungen.filter(
    (r) => r.zahlungsstatus !== ZahlungsStatus.bezahlt,
  );

  const isLoading = rechnungenLoading || actorLoading;

  // ─── Render ─────────────────────────────────────────────────────────────

  return (
    <div data-ocid="rechnungen.page" className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-display font-semibold text-foreground">
            Rechnungen & Zahlungen
          </h2>
          <p className="text-sm text-muted-foreground">
            Rechnungen erstellen, verwalten und als Word exportieren.
          </p>
        </div>
        <Button
          type="button"
          onClick={() => setActiveTab("offene")}
          data-ocid="rechnungen.create_button"
          className="btn-success gap-1.5 h-8 text-sm"
        >
          <Plus size={14} />
          Rechnung erstellen
        </Button>
      </div>

      <Tabs
        value={activeTab}
        onValueChange={(v) =>
          setActiveTab(v as "uebersicht" | "offene" | "zahlungen")
        }
        data-ocid="rechnungen.tabs"
      >
        <TabsList className="mb-4">
          <TabsTrigger value="uebersicht" data-ocid="rechnungen.tab.uebersicht">
            Übersicht
          </TabsTrigger>
          <TabsTrigger value="offene" data-ocid="rechnungen.tab.offene">
            Offene Leistungen
          </TabsTrigger>
          <TabsTrigger value="zahlungen" data-ocid="rechnungen.tab.zahlungen">
            Zahlungseingänge
          </TabsTrigger>
        </TabsList>

        {/* ══════════════════════════════════════════════
            TAB 1: ÜBERSICHT
        ══════════════════════════════════════════════ */}
        <TabsContent value="uebersicht" className="space-y-4">
          {/* Filter bar */}
          <Card className="border border-border">
            <CardContent className="pt-4 pb-3">
              <div className="flex flex-wrap gap-3 items-end">
                {/* Search */}
                <div className="flex-1 min-w-[200px] space-y-1">
                  <Label className="text-xs text-muted-foreground">Suche</Label>
                  <div className="relative">
                    <Search
                      size={14}
                      className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground"
                    />
                    <Input
                      data-ocid="rechnungen.search_input"
                      className="pl-8 h-8 text-sm"
                      placeholder="Rechnungsnummer, Klient…"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                  </div>
                </div>

                {/* Akquisiteur */}
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">
                    Akquisiteur
                  </Label>
                  <Select
                    value={akquisiteurFilter}
                    onValueChange={setAkquisiteurFilter}
                  >
                    <SelectTrigger
                      data-ocid="rechnungen.akquisiteur.select"
                      className="h-8 text-sm w-44"
                    >
                      <SelectValue placeholder="Alle" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="alle">Alle</SelectItem>
                      {leistungserbringer.map((le) => (
                        <SelectItem
                          key={le.id.toString()}
                          value={le.id.toString()}
                        >
                          {le.vorname} {le.nachname}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Fälligkeit */}
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">
                    Fälligkeit
                  </Label>
                  <Select
                    value={faelligkeitFilter}
                    onValueChange={(v) =>
                      setFaelligkeitFilter(v as FaelligkeitFilter)
                    }
                  >
                    <SelectTrigger
                      data-ocid="rechnungen.faelligkeit.select"
                      className="h-8 text-sm w-36"
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="alle">Alle</SelectItem>
                      <SelectItem value="faellig">Fällig</SelectItem>
                      <SelectItem value="nichtFaellig">Nicht fällig</SelectItem>
                      <SelectItem value="ueberfaellig">Überfällig</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Zahlungsstatus */}
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">
                    Zahlungsstatus
                  </Label>
                  <Select
                    value={statusFilter}
                    onValueChange={(v) =>
                      setStatusFilter(v as ZahlungsStatusFilter)
                    }
                  >
                    <SelectTrigger
                      data-ocid="rechnungen.status.select"
                      className="h-8 text-sm w-36"
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="alle">Alle</SelectItem>
                      <SelectItem value={ZahlungsStatus.offen}>
                        Offen
                      </SelectItem>
                      <SelectItem value={ZahlungsStatus.bezahlt}>
                        Bezahlt
                      </SelectItem>
                      <SelectItem value={ZahlungsStatus.ueberfaellig}>
                        Überfällig
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Table */}
          <Card className="border border-border">
            {isLoading ? (
              <CardContent className="py-12 flex justify-center">
                <div
                  data-ocid="rechnungen.loading_state"
                  className="flex items-center gap-2 text-muted-foreground"
                >
                  <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                  <span className="text-sm">Wird geladen…</span>
                </div>
              </CardContent>
            ) : filteredRechnungen.length === 0 ? (
              <CardContent
                data-ocid="rechnungen.empty_state"
                className="py-16 flex flex-col items-center gap-3"
              >
                <FileText size={32} className="text-muted-foreground/40" />
                <div className="text-center">
                  <p className="font-medium text-foreground">
                    Keine Rechnungen gefunden
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Passen Sie die Filter an oder erstellen Sie eine neue
                    Rechnung.
                  </p>
                </div>
              </CardContent>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-muted/40 border-b border-border">
                      <th className="px-4 py-3 text-left text-muted-foreground">
                        <SortHeader
                          label="Rechnungsnr."
                          field="rechnungsnummer"
                          current={sortField}
                          dir={sortDir}
                          onSort={handleSort}
                        />
                      </th>
                      <th className="px-4 py-3 text-left text-muted-foreground font-medium">
                        Klient
                      </th>
                      <th className="px-4 py-3 text-left text-muted-foreground font-medium">
                        Mandat
                      </th>
                      <th className="px-4 py-3 text-right text-muted-foreground">
                        {/* Fix 11: mandatsübergreifende Übersicht — Spaltenkopf
                            ohne hartcodierte Währung, da Rechnungen unterschiedlicher
                            Mandate verschiedene Währungen tragen. Pro Zeile wird
                            r.waehrung angezeigt. Root Cause: frühere Single-
                            Currency-Annahme (nur CHF). */}
                        <SortHeader
                          label="Betrag"
                          field="total"
                          current={sortField}
                          dir={sortDir}
                          onSort={handleSort}
                        />
                      </th>
                      <th className="px-4 py-3 text-left text-muted-foreground">
                        <SortHeader
                          label="Fälligkeitsdatum"
                          field="faelligkeitsdatum"
                          current={sortField}
                          dir={sortDir}
                          onSort={handleSort}
                        />
                      </th>
                      <th className="px-4 py-3 text-left text-muted-foreground font-medium">
                        Status
                      </th>
                      <th className="px-4 py-3 text-left text-muted-foreground font-medium">
                        Akquisiteur
                      </th>
                      <th className="px-4 py-3 text-right text-muted-foreground font-medium">
                        Aktionen
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRechnungen.map((r, idx) => {
                      const klient = getKlientByMandatId(r.mandatId);
                      const mandat = getMandat(r.mandatId);
                      const akq = getLE(r.leistungserbringerId);
                      return (
                        <tr
                          key={r.id}
                          data-ocid={`rechnungen.item.${idx + 1}`}
                          className="border-b border-border hover:bg-muted/20 transition-colors"
                        >
                          <td className="px-4 py-3 font-mono text-xs font-medium text-primary">
                            {r.rechnungsnummer}
                          </td>
                          <td className="px-4 py-3 font-medium">
                            {klient?.name ?? "—"}
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">
                            {mandat?.bezeichnung ?? "—"}
                          </td>
                          <td className="px-4 py-3 text-right font-mono text-xs font-semibold">
                            {/* Fix 10: Währung pro Rechnung (r.waehrung), nicht
                                hart codiert CHF. Root Cause: frühere Single-
                                Currency-Annahme (nur CHF). */}
                            {formatCHF(r.total, currencySymbol(r.waehrung))}
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">
                            {formatDate(r.faelligkeitsdatum)}
                          </td>
                          <td className="px-4 py-3">
                            <ZahlungsStatusBadge status={r.zahlungsstatus} />
                          </td>
                          <td className="px-4 py-3 text-muted-foreground text-xs">
                            {akq ? `${akq.vorname} ${akq.nachname}` : "—"}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              data-ocid={`rechnungen.word_export_button.${idx + 1}`}
                              onClick={() => handleWordExport(r)}
                              disabled={
                                !!exportingRechnungId &&
                                exportingRechnungId !== r.id
                              }
                              aria-label={`Rechnung ${r.rechnungsnummer} als Word exportieren`}
                              className="h-7 text-xs gap-1 border-primary/30 text-primary hover:bg-primary/5 disabled:opacity-60 disabled:cursor-not-allowed"
                            >
                              {exportingRechnungId === r.id ? (
                                <>
                                  <div className="w-3 h-3 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                                  <span>Wird exportiert…</span>
                                </>
                              ) : (
                                <>
                                  <Download size={12} />
                                  Word
                                </>
                              )}
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </TabsContent>

        {/* ══════════════════════════════════════════════
            TAB 2: OFFENE LEISTUNGEN
        ══════════════════════════════════════════════ */}
        <TabsContent value="offene" className="space-y-4">
          <Card className="border border-border">
            {isLoading ? (
              <CardContent className="py-12 flex justify-center">
                <div
                  data-ocid="offene.loading_state"
                  className="flex items-center gap-2 text-muted-foreground"
                >
                  <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                  <span className="text-sm">Wird geladen…</span>
                </div>
              </CardContent>
            ) : mandateWithOpenLeistungen.length === 0 ? (
              <CardContent
                data-ocid="offene.empty_state"
                className="py-16 flex flex-col items-center gap-3"
              >
                <AlertCircle size={32} className="text-muted-foreground/40" />
                <div className="text-center">
                  <p className="font-medium text-foreground">
                    Keine offenen Leistungen
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Alle Leistungen wurden bereits verrechnet.
                  </p>
                </div>
              </CardContent>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-muted/40 border-b border-border">
                      <th className="px-4 py-3 text-left text-muted-foreground font-medium">
                        Klient
                      </th>
                      <th className="px-4 py-3 text-left text-muted-foreground font-medium">
                        Mandat
                      </th>
                      <th className="px-4 py-3 text-right text-muted-foreground font-medium">
                        Offene Leistungen
                      </th>
                      <th className="px-4 py-3 text-right text-muted-foreground font-medium">
                        Auslagen
                      </th>
                      <th className="px-4 py-3 text-left text-muted-foreground font-medium">
                        Akquisiteur
                      </th>
                      <th className="px-4 py-3 text-right text-muted-foreground font-medium">
                        Aktionen
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {mandateWithOpenLeistungen.map(
                      ({ mandat, leistungen: ls, auslagen: as }, idx) => {
                        const klient = getKlient(mandat.klientId);
                        const akq = leistungserbringer.find(
                          (le) =>
                            le.id.toString() ===
                            mandat.akquisiteurId.toString(),
                        );
                        const leistungenTotal = ls.reduce(
                          (s, l) => s + Number(l.honorar),
                          0,
                        );
                        const auslagenTotal = as.reduce(
                          (s, a) => s + Number(a.betrag),
                          0,
                        );
                        return (
                          <tr
                            key={mandat.id}
                            data-ocid={`offene.item.${idx + 1}`}
                            className="border-b border-border hover:bg-muted/20 transition-colors"
                          >
                            <td className="px-4 py-3 font-medium">
                              {klient?.name ?? "—"}
                            </td>
                            <td className="px-4 py-3 text-muted-foreground">
                              {mandat.bezeichnung}
                            </td>
                            <td className="px-4 py-3 text-right font-mono text-xs">
                              {/* Fix 10: Währung pro Mandat (mandat.waehrung),
                                  nicht hart codiert CHF. Root Cause: frühere
                                  Single-Currency-Annahme (nur CHF). */}
                              {formatCHF(
                                leistungenTotal,
                                currencySymbol(mandat.waehrung),
                              )}
                              <span className="ml-1 text-muted-foreground">
                                ({ls.length} Pos.)
                              </span>
                            </td>
                            <td className="px-4 py-3 text-right font-mono text-xs">
                              {/* Fix 10: Währung pro Mandat (mandat.waehrung),
                                  nicht hart codiert CHF. Root Cause: frühere
                                  Single-Currency-Annahme (nur CHF). */}
                              {formatCHF(
                                auslagenTotal,
                                currencySymbol(mandat.waehrung),
                              )}
                              {as.length > 0 && (
                                <span className="ml-1 text-muted-foreground">
                                  ({as.length} Pos.)
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-muted-foreground text-xs">
                              {akq ? `${akq.vorname} ${akq.nachname}` : "—"}
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center justify-end gap-2">
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  data-ocid={`offene.rechnung_erstellen.${idx + 1}`}
                                  onClick={() =>
                                    setCreateRechnungMandat(mandat)
                                  }
                                  className="h-7 text-xs btn-success"
                                >
                                  <Plus size={12} className="mr-1" />
                                  Rechnung erstellen
                                </Button>
                              </div>
                            </td>
                          </tr>
                        );
                      },
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </TabsContent>

        {/* ══════════════════════════════════════════════
            TAB 3: ZAHLUNGSEINGÄNGE
        ══════════════════════════════════════════════ */}
        <TabsContent value="zahlungen" className="space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">
                  Akquisiteur
                </Label>
                <Select
                  value={zahlungAkquisiteurFilter}
                  onValueChange={setZahlungAkquisiteurFilter}
                >
                  <SelectTrigger
                    data-ocid="zahlungen.akquisiteur.select"
                    className="h-8 text-sm w-44"
                  >
                    <SelectValue placeholder="Alle" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="alle">Alle</SelectItem>
                    {leistungserbringer.map((le) => (
                      <SelectItem
                        key={le.id.toString()}
                        value={le.id.toString()}
                      >
                        {le.vorname} {le.nachname}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Button
              type="button"
              data-ocid="zahlungen.add_button"
              onClick={() => setZahlungModalOpen(true)}
              className="btn-success gap-1.5 h-8 text-sm"
            >
              <Plus size={14} />
              Zahlung erfassen
            </Button>
          </div>

          <Card className="border border-border">
            {isLoading ? (
              <CardContent className="py-12 flex justify-center">
                <div
                  data-ocid="zahlungen.loading_state"
                  className="flex items-center gap-2 text-muted-foreground"
                >
                  <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                  <span className="text-sm">Wird geladen…</span>
                </div>
              </CardContent>
            ) : filteredZahlungen.length === 0 ? (
              <CardContent
                data-ocid="zahlungen.empty_state"
                className="py-16 flex flex-col items-center gap-3"
              >
                <FileText size={32} className="text-muted-foreground/40" />
                <div className="text-center">
                  <p className="font-medium text-foreground">
                    Keine Zahlungen erfasst
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Erfassen Sie eingehende Zahlungen mit dem Button oben.
                  </p>
                </div>
              </CardContent>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-muted/40 border-b border-border">
                      <th className="px-4 py-3 text-left text-muted-foreground font-medium">
                        Datum
                      </th>
                      <th className="px-4 py-3 text-left text-muted-foreground font-medium">
                        Klient
                      </th>
                      <th className="px-4 py-3 text-left text-muted-foreground font-medium">
                        Mandat
                      </th>
                      <th className="px-4 py-3 text-left text-muted-foreground font-medium">
                        Rechnung
                      </th>
                      <th className="px-4 py-3 text-right text-muted-foreground font-medium">
                        {/* Fix 11: mandatsübergreifende Zahlungsübersicht —
                            Spaltenkopf ohne hartcodierte Währung, da Zahlungen
                            auf Rechnungen unterschiedlicher Mandate/Währungen
                            referenzieren. Pro Zeile wird die Rechnungswährung
                            angezeigt; keine gemeinsame Summe über gemischte
                            Währungen. Root Cause: frühere Single-Currency-
                            Annahme (nur CHF). */}
                        Betrag
                      </th>
                      <th className="px-4 py-3 text-left text-muted-foreground font-medium">
                        Status
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredZahlungen.map((z, idx) => {
                      const rechnung = rechnungen.find(
                        (r) => r.id === z.rechnungId,
                      );
                      const klient = rechnung
                        ? getKlientByMandatId(rechnung.mandatId)
                        : null;
                      const mandat = rechnung
                        ? getMandat(rechnung.mandatId)
                        : null;
                      return (
                        <tr
                          key={z.id}
                          data-ocid={`zahlungen.item.${idx + 1}`}
                          className="border-b border-border hover:bg-muted/20 transition-colors"
                        >
                          <td className="px-4 py-3 text-muted-foreground">
                            {formatDate(z.datum)}
                          </td>
                          <td className="px-4 py-3 font-medium">
                            {klient?.name ?? "—"}
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">
                            {mandat?.bezeichnung ?? "—"}
                          </td>
                          <td className="px-4 py-3 font-mono text-xs text-primary">
                            {rechnung?.rechnungsnummer ?? "—"}
                          </td>
                          <td className="px-4 py-3 text-right font-mono text-xs font-semibold">
                            {/* Fix 10: Währung der zugehörigen Rechnung
                                (rechnung.waehrung), nicht hart codiert CHF.
                                Root Cause: frühere Single-Currency-Annahme
                                (nur CHF). */}
                            {formatCHF(
                              z.betrag,
                              currencySymbol(rechnung?.waehrung),
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <ZahlungEingangBadge status={z.status} />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </TabsContent>
      </Tabs>

      {/* Create Rechnung Modal */}
      {createRechnungMandat && (
        <CreateRechnungModal
          open={!!createRechnungMandat}
          onClose={() => setCreateRechnungMandat(null)}
          mandat={createRechnungMandat}
          klient={getKlient(createRechnungMandat.klientId) ?? null}
          leistungen={createMandatLeistungen}
          auslagen={createMandatAuslagen}
          stammdaten={stammdaten ?? null}
          leistungserbringer={leistungserbringer}
        />
      )}

      {/* Zahlung Modal */}
      <ZahlungModal
        open={zahlungModalOpen}
        onClose={() => setZahlungModalOpen(false)}
        offeneRechnungen={offeneRechnungen}
      />
    </div>
  );
}
