import type {
  Auslage,
  Auslagenregelung,
  Klient,
  Leistung,
  Leistungserbringer,
  Mandat,
} from "@/backend.d";
import { MandatStatus } from "@/backend.d";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import {
  queryKeys,
  useBackend,
  useDsgVersion,
  useRecordConsent,
} from "@/utils/backend";
import { currencySymbol, formatCHF } from "@/utils/format";
import type { Principal } from "@icp-sdk/core/principal";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  Archive,
  ChevronDown,
  ChevronUp,
  ChevronsUpDown,
  Plus,
  Trash2,
  Users,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";

// ─── Types ──────────────────────────────────────────────────────────────────

interface TableRow {
  klient: Klient;
  mandat: Mandat;
  akquisiteur: Leistungserbringer | undefined;
  offeneLeistungen: bigint;
  offeneAuslagen: bigint;
  verrechneteBetraege: bigint;
}

type SortKey =
  | "klient"
  | "mandat"
  | "akquisiteur"
  | "offeneLeistungen"
  | "verrechneteBetraege";
type SortDir = "asc" | "desc";

type PanelMode = "closed" | "new-klient" | "new-mandat" | "edit";

interface KlientFormValues {
  name: string;
  strasse: string;
  plzOrt: string;
  telefon: string;
  email: string;
}

interface MandatFormValues {
  bezeichnung: string;
  akquisiteurId: string;
  akquisitionsbonus: string;
  mwstSatz: string;
  budget: string;
  rundungAktiv: boolean;
  auslagenregelung: string;
  pauschalBetrag: string;
  zahlungsbedingungen: string;
  waehrung: string;
  standardStundensatz: string;
  kostenProKopie: string;
  kostenProScan: string;
  portoAPost: string;
  portoBPost: string;
  portoEinschreiben: string;
  autokilometer: string;
  leistungenAusweisen: boolean;
}

// ─── Sort Icon ───────────────────────────────────────────────────────────────

function SortIcon({
  col,
  current,
  dir,
}: {
  col: SortKey;
  current: SortKey;
  dir: SortDir;
}) {
  if (col !== current)
    return <ChevronsUpDown size={14} className="opacity-40" />;
  return dir === "asc" ? <ChevronUp size={14} /> : <ChevronDown size={14} />;
}

// ─── Confirm Dialog ──────────────────────────────────────────────────────────

function ConfirmDialog({
  open,
  message,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-foreground/20"
        onClick={onCancel}
        onKeyDown={(e) => e.key === "Escape" && onCancel()}
        role="presentation"
      />
      <div
        data-ocid="klienten.dialog"
        className="relative bg-card border border-border rounded-xl shadow-lg p-6 max-w-sm w-full mx-4 space-y-4"
      >
        <div className="flex items-start gap-3">
          <AlertTriangle
            size={20}
            className="text-destructive mt-0.5 shrink-0"
          />
          <p className="text-sm text-foreground">{message}</p>
        </div>
        <div className="flex justify-end gap-2">
          <Button
            variant="ghost"
            size="sm"
            data-ocid="klienten.cancel_button"
            onClick={onCancel}
          >
            Abbrechen
          </Button>
          <Button
            variant="destructive"
            size="sm"
            data-ocid="klienten.confirm_button"
            onClick={onConfirm}
          >
            Bestätigen
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export function KlientenPage() {
  const { actor, isLoading: actorLoading } = useBackend();
  const qc = useQueryClient();

  // ── Data queries ──────────────────────────────────────────────────────────
  const { data: klienten = [], isLoading: klientenLoading } = useQuery({
    queryKey: queryKeys.klienten(),
    queryFn: async (): Promise<Klient[]> => (actor ? actor.getKlienten() : []),
    enabled: !!actor && !actorLoading,
  });

  const { data: mandate = [], isLoading: mandateLoading } = useQuery({
    queryKey: queryKeys.mandate(),
    queryFn: async (): Promise<Mandat[]> =>
      actor ? actor.getMandate(null) : [],
    enabled: !!actor && !actorLoading,
  });

  const { data: leistungserbringer = [] } = useQuery({
    queryKey: queryKeys.leistungserbringer(),
    queryFn: async (): Promise<Leistungserbringer[]> =>
      actor ? actor.getLeistungserbringer() : [],
    enabled: !!actor && !actorLoading,
  });

  // Offene Leistungen & Auslagen pro Mandat — analog zu RechnungenPage.
  // Gruppierung nach mandatId und Summierung von honorar/betrag erfolgt in
  // allRows; hier werden nur die Rohdaten mit status-Filter 'offen' geladen.
  const { data: offeneLeistungen = [] } = useQuery<Leistung[]>({
    queryKey: queryKeys.leistungen({ status: "offen" }),
    queryFn: async () => {
      if (!actor) return [];
      return actor.getLeistungen({ status: "offen" as Leistung["status"] });
    },
    enabled: !!actor && !actorLoading,
  });

  const { data: offeneAuslagen = [] } = useQuery<Auslage[]>({
    queryKey: queryKeys.auslagen({ status: "offen" }),
    queryFn: async () => {
      if (!actor) return [];
      return actor.getAuslagen({ status: "offen" as Auslage["status"] });
    },
    enabled: !!actor && !actorLoading,
  });

  const isLoading = klientenLoading || mandateLoading;

  // ── Filter state ──────────────────────────────────────────────────────────
  const [selectedAkquisiteure, setSelectedAkquisiteure] = useState<string[]>(
    [],
  );
  const [statusFilter, setStatusFilter] = useState<
    "alle" | "aktiv" | "archiviert"
  >("alle");

  // ── Sort state ────────────────────────────────────────────────────────────
  const [sortKey, setSortKey] = useState<SortKey>("klient");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  // ── Panel state ───────────────────────────────────────────────────────────
  const [panelMode, setPanelMode] = useState<PanelMode>("closed");
  const [selectedKlientId, setSelectedKlientId] = useState<string | null>(null);
  const [selectedMandatId, setSelectedMandatId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // ── Consent state (revDSG: Einwilligung bei Mandantenregistrierung) ──────
  const [consentGiven, setConsentGiven] = useState(false);
  const { data: dsgVersion } = useDsgVersion();
  const recordConsentMut = useRecordConsent();

  const selectedKlient = klienten.find((k) => k.id === selectedKlientId);
  const selectedMandat = mandate.find((m) => m.id === selectedMandatId);

  // ── Forms ─────────────────────────────────────────────────────────────────
  const klientForm = useForm<KlientFormValues>({
    defaultValues: {
      name: "",
      strasse: "",
      plzOrt: "",
      telefon: "",
      email: "",
    },
  });
  const mandatForm = useForm<MandatFormValues>({
    defaultValues: {
      bezeichnung: "",
      akquisiteurId: "",
      akquisitionsbonus: "0",
      mwstSatz: "8.1",
      budget: "0",
      rundungAktiv: false,
      auslagenregelung: "Keine",
      pauschalBetrag: "0",
      zahlungsbedingungen: "30 Tage netto",
      waehrung: "CHF",
      standardStundensatz: "0",
      kostenProKopie: "0",
      kostenProScan: "0",
      portoAPost: "0",
      portoBPost: "0",
      portoEinschreiben: "0",
      autokilometer: "0",
      leistungenAusweisen: true,
    },
  });

  // Populate forms when selection changes
  const klientFormReset = klientForm.reset;
  const mandatFormReset = mandatForm.reset;
  useEffect(() => {
    if (selectedKlient) {
      klientFormReset({
        name: selectedKlient.name,
        strasse: selectedKlient.strasse,
        plzOrt: selectedKlient.plzOrt,
        telefon: selectedKlient.telefon,
        email: selectedKlient.email,
      });
    }
    if (selectedMandat) {
      mandatFormReset({
        bezeichnung: selectedMandat.bezeichnung,
        akquisiteurId: selectedMandat.akquisiteurId.toString(),
        akquisitionsbonus: String(Number(selectedMandat.akquisitionsbonus)),
        mwstSatz: String(Number(selectedMandat.mwstSatz) / 100),
        budget: String(Number(selectedMandat.budget) / 100),
        rundungAktiv: selectedMandat.rundungAktiv,
        auslagenregelung: selectedMandat.auslagenregelung || "Keine",
        pauschalBetrag: String(
          Number(selectedMandat.pauschalBetrag ?? 0n) / 100,
        ),
        zahlungsbedingungen: selectedMandat.zahlungsbedingungen,
        waehrung: selectedMandat.waehrung || "CHF",
        standardStundensatz: String(
          Number(selectedMandat.standardStundensatz) / 100,
        ),
        kostenProKopie: String(selectedMandat.kostenProKopie),
        kostenProScan: String(selectedMandat.kostenProScan),
        portoAPost: String(selectedMandat.portoAPost),
        portoBPost: String(selectedMandat.portoBPost),
        portoEinschreiben: String(selectedMandat.portoEinschreiben),
        autokilometer: String(selectedMandat.autokilometer),
        leistungenAusweisen: selectedMandat.leistungenAusweisen,
      });
    }
  }, [selectedKlient, selectedMandat, klientFormReset, mandatFormReset]);

  // ── Build rows ────────────────────────────────────────────────────────────
  // Summe der offenen honorar- und betrag-Werte pro Mandat, gruppiert nach
  // mandatId — analog zu RechnungenPage (mandateWithOpenLeistungen).
  const offeneProMandat = useMemo(() => {
    const map = new Map<string, { leistungen: bigint; auslagen: bigint }>();
    for (const l of offeneLeistungen) {
      const cur = map.get(l.mandatId) ?? {
        leistungen: 0n,
        auslagen: 0n,
      };
      cur.leistungen += l.honorar;
      map.set(l.mandatId, cur);
    }
    for (const a of offeneAuslagen) {
      const cur = map.get(a.mandatId) ?? {
        leistungen: 0n,
        auslagen: 0n,
      };
      cur.auslagen += a.betrag;
      map.set(a.mandatId, cur);
    }
    return map;
  }, [offeneLeistungen, offeneAuslagen]);

  const allRows = useMemo<TableRow[]>(
    () =>
      mandate.map((m) => {
        const klient = klienten.find((k) => k.id === m.klientId);
        const akquisiteur = leistungserbringer.find(
          (lb) => lb.id.toString() === m.akquisiteurId.toString(),
        );
        const fallbackKlient: Klient = {
          id: m.klientId,
          name: "–",
          strasse: "",
          plzOrt: "",
          telefon: "",
          email: "",
          kanzleiId: "",
          createdAt: 0n,
        };
        const offene = offeneProMandat.get(m.id);
        return {
          klient: klient ?? fallbackKlient,
          mandat: m,
          akquisiteur,
          offeneLeistungen: offene?.leistungen ?? 0n,
          offeneAuslagen: offene?.auslagen ?? 0n,
          verrechneteBetraege: 0n,
        };
      }),
    [klienten, mandate, leistungserbringer, offeneProMandat],
  );

  // ── Filter rows ───────────────────────────────────────────────────────────
  const filteredRows = useMemo(
    () =>
      allRows.filter((row) => {
        const akquisiteurMatch =
          selectedAkquisiteure.length === 0 ||
          selectedAkquisiteure.includes(row.mandat.akquisiteurId.toString());
        const statusMatch =
          statusFilter === "alle" ||
          row.mandat.status.toString() === statusFilter;
        return akquisiteurMatch && statusMatch;
      }),
    [allRows, selectedAkquisiteure, statusFilter],
  );

  // ── Sort rows ─────────────────────────────────────────────────────────────
  const sortedRows = useMemo(() => {
    return [...filteredRows].sort((a, b) => {
      let cmp = 0;
      if (sortKey === "klient")
        cmp = a.klient.name.localeCompare(b.klient.name);
      else if (sortKey === "mandat")
        cmp = a.mandat.bezeichnung.localeCompare(b.mandat.bezeichnung);
      else if (sortKey === "akquisiteur") {
        const aName = a.akquisiteur
          ? `${a.akquisiteur.vorname} ${a.akquisiteur.nachname}`
          : "";
        const bName = b.akquisiteur
          ? `${b.akquisiteur.vorname} ${b.akquisiteur.nachname}`
          : "";
        cmp = aName.localeCompare(bName);
      } else if (sortKey === "offeneLeistungen")
        cmp = Number(
          a.offeneLeistungen +
            a.offeneAuslagen -
            (b.offeneLeistungen + b.offeneAuslagen),
        );
      else if (sortKey === "verrechneteBetraege")
        cmp = Number(a.verrechneteBetraege - b.verrechneteBetraege);
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [filteredRows, sortKey, sortDir]);

  function handleSort(key: SortKey) {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  // ── Row click ──────────────────────────────────────────────────────────────
  function handleRowClick(row: TableRow) {
    setSelectedKlientId(row.klient.id);
    setSelectedMandatId(row.mandat.id);
    setPanelMode("edit");
  }

  // ── New klient ─────────────────────────────────────────────────────────────
  function handleNewKlient() {
    klientForm.reset({
      name: "",
      strasse: "",
      plzOrt: "",
      telefon: "",
      email: "",
    });
    mandatForm.reset({
      bezeichnung: "",
      akquisiteurId: leistungserbringer[0]?.id.toString() ?? "",
      akquisitionsbonus: "0",
      mwstSatz: "8.1",
      budget: "0",
      rundungAktiv: false,
      auslagenregelung: "Keine",
      pauschalBetrag: "0",
      zahlungsbedingungen: "30 Tage netto",
      waehrung: "CHF",
      standardStundensatz: "0",
      kostenProKopie: "0",
      kostenProScan: "0",
      portoAPost: "0",
      portoBPost: "0",
      portoEinschreiben: "0",
      autokilometer: "0",
      leistungenAusweisen: true,
    });
    setSelectedKlientId(null);
    setSelectedMandatId(null);
    setConsentGiven(false);
    setPanelMode("new-klient");
  }

  function handleNewMandat() {
    mandatForm.reset({
      bezeichnung: "",
      akquisiteurId: leistungserbringer[0]?.id.toString() ?? "",
      akquisitionsbonus: "0",
      mwstSatz: "8.1",
      budget: "0",
      rundungAktiv: false,
      auslagenregelung: "Keine",
      pauschalBetrag: "0",
      zahlungsbedingungen: "30 Tage netto",
      waehrung: "CHF",
      standardStundensatz: "0",
      kostenProKopie: "0",
      kostenProScan: "0",
      portoAPost: "0",
      portoBPost: "0",
      portoEinschreiben: "0",
      autokilometer: "0",
      leistungenAusweisen: true,
    });
    setSelectedMandatId(null);
    setPanelMode("new-mandat");
  }

  // ── Helper to resolve Principal ───────────────────────────────────────────
  function getAkquisiteurPrincipal(akquisiteurId: string): Principal {
    const found = leistungserbringer.find(
      (lb) => lb.id.toString() === akquisiteurId,
    );
    return (found?.id ?? leistungserbringer[0]?.id) as Principal;
  }

  // ── Mutations ──────────────────────────────────────────────────────────────
  const createKlientMut = useMutation({
    mutationFn: async (v: KlientFormValues) => {
      if (!actor) throw new Error("Kein Actor");
      const res = await actor.createKlient(
        v.name,
        v.strasse,
        v.plzOrt,
        v.telefon,
        v.email,
      );
      if (res.__kind__ === "err") throw new Error(res.err);
      return res.ok;
    },
  });

  const updateKlientMut = useMutation({
    mutationFn: async ({ id, v }: { id: string; v: KlientFormValues }) => {
      if (!actor) throw new Error("Kein Actor");
      const res = await actor.updateKlient(
        id,
        v.name,
        v.strasse,
        v.plzOrt,
        v.telefon,
        v.email,
      );
      if (res.__kind__ === "err") throw new Error(res.err);
      return res.ok;
    },
  });

  const createMandatMut = useMutation({
    mutationFn: async ({
      klientId,
      v,
    }: {
      klientId: string;
      v: MandatFormValues;
    }) => {
      if (!actor) throw new Error("Kein Actor");
      const res = await actor.createMandat(
        klientId,
        v.bezeichnung,
        getAkquisiteurPrincipal(v.akquisiteurId),
        BigInt(Math.round(Number(v.akquisitionsbonus))),
        BigInt(Math.round(Number(v.mwstSatz) * 100)),
        BigInt(Math.round(Number(v.budget) * 100)),
        v.rundungAktiv,
        v.auslagenregelung as Auslagenregelung,
        BigInt(Math.round(Number(v.pauschalBetrag) * 100)),
        v.zahlungsbedingungen,
        v.waehrung,
        BigInt(Math.round(Number(v.standardStundensatz) * 100)),
        Number(v.kostenProKopie),
        Number(v.kostenProScan),
        Number(v.portoAPost),
        Number(v.portoBPost),
        Number(v.portoEinschreiben),
        Number(v.autokilometer),
        v.leistungenAusweisen,
      );
      if (res.__kind__ === "err") throw new Error(res.err);
      return res.ok;
    },
  });

  const updateMandatMut = useMutation({
    mutationFn: async ({ id, v }: { id: string; v: MandatFormValues }) => {
      if (!actor) throw new Error("Kein Actor");
      const res = await actor.updateMandat(
        id,
        v.bezeichnung,
        getAkquisiteurPrincipal(v.akquisiteurId),
        BigInt(Math.round(Number(v.akquisitionsbonus))),
        BigInt(Math.round(Number(v.mwstSatz) * 100)),
        BigInt(Math.round(Number(v.budget) * 100)),
        v.rundungAktiv,
        v.auslagenregelung as Auslagenregelung,
        BigInt(Math.round(Number(v.pauschalBetrag) * 100)),
        v.zahlungsbedingungen,
        v.waehrung,
        BigInt(Math.round(Number(v.standardStundensatz) * 100)),
        Number(v.kostenProKopie),
        Number(v.kostenProScan),
        Number(v.portoAPost),
        Number(v.portoBPost),
        Number(v.portoEinschreiben),
        Number(v.autokilometer),
        v.leistungenAusweisen,
      );
      if (res.__kind__ === "err") throw new Error(res.err);
      return res.ok;
    },
  });

  const archivierMut = useMutation({
    mutationFn: async (id: string) => {
      if (!actor) throw new Error("Kein Actor");
      const res = await actor.archivierMandat(id);
      if (res.__kind__ === "err") throw new Error(res.err);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.mandate() });
      toast.success("Mandat archiviert");
      setPanelMode("closed");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMandatMut = useMutation({
    mutationFn: async (id: string) => {
      if (!actor) throw new Error("Kein Actor");
      const res = await actor.deleteMandat(id);
      if (res.__kind__ === "err") throw new Error(res.err);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.mandate() });
      toast.success("Mandat gelöscht");
      setPanelMode("closed");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // ── Save handler ────────────────────────────────────────────────────────────
  async function handleSave() {
    const klientValid = await klientForm.trigger();
    const mandatValid = await mandatForm.trigger();
    if (!klientValid || !mandatValid) return;

    // revDSG: Bei Neuerstellung eines Mandanten ist eine aktive Einwilligung
    // in die Verarbeitung personenbezogener Daten erforderlich.
    if (panelMode === "new-klient" && !consentGiven) {
      toast.error(
        "Einwilligung erforderlich: Bitte bestätigen Sie die Einwilligung in die Datenverarbeitung gemäss revDSG.",
      );
      return;
    }

    const kv = klientForm.getValues();
    const mv = mandatForm.getValues();

    try {
      if (panelMode === "new-klient") {
        const newKlient = await createKlientMut.mutateAsync(kv);
        // Einwilligung mit Zeitstempel und aktueller DSG-Version protokollieren
        if (dsgVersion?.version) {
          try {
            await recordConsentMut.mutateAsync({
              klientId: newKlient.id,
              dsgVersion: dsgVersion.version,
            });
          } catch (consentErr) {
            // Konsensprotokollierung fehlgeschlagen — Klient wurde dennoch erstellt
            toast.error(
              `Einwilligung konnte nicht protokolliert werden: ${(consentErr as Error).message}`,
            );
          }
        }
        const newMandat = await createMandatMut.mutateAsync({
          klientId: newKlient.id,
          v: mv,
        });
        await qc.invalidateQueries({ queryKey: queryKeys.klienten() });
        await qc.invalidateQueries({ queryKey: queryKeys.mandate() });
        setSelectedKlientId(newKlient.id);
        setSelectedMandatId(newMandat.id);
        setPanelMode("edit");
        toast.success("Klient und Mandat erstellt");
      } else if (panelMode === "new-mandat" && selectedKlientId) {
        const newMandat = await createMandatMut.mutateAsync({
          klientId: selectedKlientId,
          v: mv,
        });
        await qc.invalidateQueries({ queryKey: queryKeys.mandate() });
        setSelectedMandatId(newMandat.id);
        setPanelMode("edit");
        toast.success("Mandat erstellt");
      } else if (panelMode === "edit" && selectedKlientId && selectedMandatId) {
        await updateKlientMut.mutateAsync({ id: selectedKlientId, v: kv });
        await updateMandatMut.mutateAsync({ id: selectedMandatId, v: mv });
        await qc.invalidateQueries({ queryKey: queryKeys.klienten() });
        await qc.invalidateQueries({ queryKey: queryKeys.mandate() });
        toast.success("Änderungen gespeichert");
      }
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  const isSaving =
    createKlientMut.isPending ||
    updateKlientMut.isPending ||
    createMandatMut.isPending ||
    updateMandatMut.isPending ||
    recordConsentMut.isPending;

  // ── Akquisiteur toggle ───────────────────────────────────────────────────
  function toggleAkquisiteur(id: string) {
    setSelectedAkquisiteure((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div data-ocid="klienten.page" className="flex flex-col h-full">
      {/* Header */}
      <div className="px-6 py-4 border-b border-border bg-card flex items-center justify-between">
        <div>
          <h1 className="text-xl font-display font-semibold text-foreground">
            Klienten &amp; Mandate
          </h1>
          <p className="text-sm text-muted-foreground">
            Klienten, Mandate und Einstellungen verwalten
          </p>
        </div>
        <Button
          data-ocid="klienten.new_klient_button"
          className="btn-success gap-2"
          onClick={handleNewKlient}
        >
          <Plus size={15} />
          Neuer Klient
        </Button>
      </div>

      {/* Filter Bar */}
      <div className="px-6 py-3 bg-muted/30 border-b border-border flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Akquisiteur:
          </span>
          {leistungserbringer.map((lb) => {
            const lbId = lb.id.toString();
            const cbId = `akq-cb-${lbId.slice(0, 8)}`;
            return (
              <label
                key={lbId}
                htmlFor={cbId}
                className="flex items-center gap-1.5 cursor-pointer"
                data-ocid="klienten.akquisiteur_filter"
              >
                <Checkbox
                  id={cbId}
                  checked={selectedAkquisiteure.includes(lbId)}
                  onCheckedChange={() => toggleAkquisiteur(lbId)}
                />
                <span className="text-sm text-foreground">
                  {lb.vorname} {lb.nachname}
                </span>
              </label>
            );
          })}
        </div>

        <Separator orientation="vertical" className="h-5" />

        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Status:
          </span>
          <Select
            value={statusFilter}
            onValueChange={(v) =>
              setStatusFilter(v as "alle" | "aktiv" | "archiviert")
            }
          >
            <SelectTrigger
              data-ocid="klienten.status_filter"
              className="h-8 text-sm w-36"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="alle">Alle</SelectItem>
              <SelectItem value="aktiv">Aktiv</SelectItem>
              <SelectItem value="archiviert">Archiviert</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Main area */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Table */}
        <div
          className={`flex flex-col min-h-0 overflow-auto transition-all duration-300 ${
            panelMode !== "closed" ? "w-[60%]" : "w-full"
          }`}
        >
          <table className="w-full text-sm border-collapse">
            <thead className="sticky top-0 z-10 bg-card border-b border-border">
              <tr>
                {[
                  { key: "klient" as SortKey, label: "Klient" },
                  { key: "mandat" as SortKey, label: "Mandat" },
                  { key: "akquisiteur" as SortKey, label: "Akquisiteur" },
                ].map(({ key, label }) => (
                  <th
                    key={key}
                    className="text-left px-0 py-0 font-medium text-muted-foreground"
                    data-ocid={`klienten.sort_${key}`}
                  >
                    <button
                      type="button"
                      className="w-full text-left px-4 py-3 flex items-center gap-1 hover:text-foreground transition-colors cursor-pointer"
                      onClick={() => handleSort(key)}
                    >
                      {label}
                      <SortIcon col={key} current={sortKey} dir={sortDir} />
                    </button>
                  </th>
                ))}
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">
                  Status
                </th>
                {[
                  {
                    key: "offeneLeistungen" as SortKey,
                    label: sortedRows.some((r) => r.offeneAuslagen > 0n)
                      ? "Offene Beträge"
                      : "Offene Leistungen",
                  },
                  {
                    key: "verrechneteBetraege" as SortKey,
                    label: "Verrechnete Beträge",
                  },
                ].map(({ key, label }) => (
                  <th
                    key={key}
                    className="text-right px-0 py-0 font-medium text-muted-foreground"
                    data-ocid={`klienten.sort_${key}`}
                  >
                    <button
                      type="button"
                      className="w-full text-right px-4 py-3 flex items-center justify-end gap-1 hover:text-foreground transition-colors cursor-pointer"
                      onClick={() => handleSort(key)}
                    >
                      {label}
                      <SortIcon col={key} current={sortKey} dir={sortDir} />
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                ["s1", "s2", "s3", "s4", "s5"].map((sk) => (
                  <tr
                    key={sk}
                    data-ocid="klienten.loading_state"
                    className="border-b border-border"
                  >
                    {["c1", "c2", "c3", "c4", "c5", "c6"].map((ck) => (
                      <td key={ck} className="px-4 py-3">
                        <Skeleton className="h-4 w-full" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : sortedRows.length === 0 ? (
                <tr>
                  <td colSpan={6}>
                    <div
                      data-ocid="klienten.empty_state"
                      className="flex flex-col items-center justify-center py-20 gap-4"
                    >
                      <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center">
                        <Users size={28} className="text-primary" />
                      </div>
                      <div className="text-center">
                        <p className="font-display font-semibold text-foreground">
                          Keine Klienten gefunden
                        </p>
                        <p className="text-sm text-muted-foreground mt-1">
                          Erstellen Sie einen neuen Klienten mit «+ Neuer
                          Klient».
                        </p>
                      </div>
                    </div>
                  </td>
                </tr>
              ) : (
                sortedRows.map((row, idx) => {
                  const isSelected =
                    row.mandat.id === selectedMandatId &&
                    panelMode !== "closed";
                  return (
                    <tr
                      key={row.mandat.id}
                      data-ocid={`klienten.item.${idx + 1}`}
                      className={`border-b border-border cursor-pointer transition-colors ${
                        isSelected ? "bg-primary/5" : "hover:bg-muted/40"
                      }`}
                      onClick={() => handleRowClick(row)}
                      onKeyDown={(e) =>
                        e.key === "Enter" && handleRowClick(row)
                      }
                    >
                      <td className="px-4 py-3 font-medium text-foreground truncate max-w-[180px]">
                        {row.klient.name}
                      </td>
                      <td className="px-4 py-3 text-foreground truncate max-w-[180px]">
                        {row.mandat.bezeichnung}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {row.akquisiteur
                          ? `${row.akquisiteur.vorname} ${row.akquisiteur.nachname}`
                          : "–"}
                      </td>
                      <td className="px-4 py-3">
                        <MandatStatusBadge status={row.mandat.status} />
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-sm text-foreground">
                        {/* Fix 10: Währung pro Mandat (Mandat.waehrung), nicht hart codiert CHF. */}
                        {formatCHF(
                          row.offeneLeistungen + row.offeneAuslagen,
                          currencySymbol(row.mandat.waehrung),
                        )}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-sm text-foreground">
                        {/* Fix 10: Währung pro Mandat (Mandat.waehrung), nicht hart codiert CHF. */}
                        {formatCHF(
                          row.verrechneteBetraege,
                          currencySymbol(row.mandat.waehrung),
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Detail Panel */}
        {panelMode !== "closed" && (
          <div
            data-ocid="klienten.detail_panel"
            className="w-[40%] border-l border-border bg-card flex flex-col overflow-y-auto"
          >
            {/* Panel header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-border sticky top-0 bg-card z-10">
              <h2 className="font-display font-semibold text-foreground text-base">
                {panelMode === "new-klient"
                  ? "Neuer Klient"
                  : panelMode === "new-mandat"
                    ? "Neues Mandat"
                    : "Klient & Mandat bearbeiten"}
              </h2>
              <button
                type="button"
                data-ocid="klienten.close_button"
                onClick={() => setPanelMode("closed")}
                className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded"
                aria-label="Panel schliessen"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-5 space-y-6 flex-1">
              {/* ── Klient section ── */}
              {(panelMode === "new-klient" || panelMode === "edit") && (
                <section data-ocid="klienten.klient_section">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                    Klient
                  </h3>
                  <div className="space-y-3">
                    <div>
                      <Label
                        htmlFor="klient-name"
                        className="text-xs mb-1 block"
                      >
                        Name <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        id="klient-name"
                        data-ocid="klienten.klient_name_input"
                        {...klientForm.register("name", { required: true })}
                        className={
                          klientForm.formState.errors.name
                            ? "border-destructive"
                            : ""
                        }
                        placeholder="Müller & Partner AG"
                      />
                      {klientForm.formState.errors.name && (
                        <p
                          data-ocid="klienten.name_field_error"
                          className="text-xs text-destructive mt-1"
                        >
                          Name ist erforderlich
                        </p>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label
                          htmlFor="klient-strasse"
                          className="text-xs mb-1 block"
                        >
                          Strasse
                        </Label>
                        <Input
                          id="klient-strasse"
                          data-ocid="klienten.klient_strasse_input"
                          {...klientForm.register("strasse")}
                          placeholder="Bahnhofstrasse 10"
                        />
                      </div>
                      <div>
                        <Label
                          htmlFor="klient-plzort"
                          className="text-xs mb-1 block"
                        >
                          PLZ / Ort
                        </Label>
                        <Input
                          id="klient-plzort"
                          data-ocid="klienten.klient_plzort_input"
                          {...klientForm.register("plzOrt")}
                          placeholder="8001 Zürich"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label
                          htmlFor="klient-telefon"
                          className="text-xs mb-1 block"
                        >
                          Telefon
                        </Label>
                        <Input
                          id="klient-telefon"
                          data-ocid="klienten.klient_telefon_input"
                          {...klientForm.register("telefon")}
                          placeholder="+41 44 123 45 67"
                        />
                      </div>
                      <div>
                        <Label
                          htmlFor="klient-email"
                          className="text-xs mb-1 block"
                        >
                          E-Mail
                        </Label>
                        <Input
                          id="klient-email"
                          data-ocid="klienten.klient_email_input"
                          type="email"
                          {...klientForm.register("email")}
                          placeholder="kontakt@firma.ch"
                        />
                      </div>
                    </div>
                  </div>
                </section>
              )}

              {/* ── Einwilligung (revDSG) — nur bei Neuerstellung ── */}
              {panelMode === "new-klient" && (
                <section
                  data-ocid="klienten.consent_section"
                  className="space-y-2"
                >
                  <div className="flex items-start gap-2.5 rounded-lg border border-border bg-muted/30 p-3">
                    <Checkbox
                      id="klient-consent"
                      data-ocid="klienten.consent_checkbox"
                      checked={consentGiven}
                      onCheckedChange={(v) => setConsentGiven(v === true)}
                      className="mt-0.5"
                    />
                    <Label
                      htmlFor="klient-consent"
                      className="text-xs text-foreground leading-relaxed cursor-pointer"
                    >
                      Ich willige in die Verarbeitung meiner personenbezogenen
                      Daten gemäss Datenschutzerklärung
                      {dsgVersion?.version ? (
                        <>
                          {" "}
                          (DSG-Version{" "}
                          <span className="font-medium font-mono">
                            {dsgVersion.version}
                          </span>
                          ) ein.
                        </>
                      ) : (
                        <> ein.</>
                      )}
                    </Label>
                  </div>
                  {!consentGiven && (
                    <p
                      data-ocid="klienten.consent_required_error"
                      className="text-xs text-destructive"
                    >
                      Die Einwilligung ist erforderlich, um den Mandanten gemäss
                      revDSG zu registrieren.
                    </p>
                  )}
                </section>
              )}

              <Separator />

              {/* ── Mandat section ── */}
              <section data-ocid="klienten.mandat_section">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                  Mandat
                </h3>
                <div className="space-y-3">
                  <div>
                    <Label
                      htmlFor="m-bezeichnung"
                      className="text-xs mb-1 block"
                    >
                      Mandatsbezeichnung{" "}
                      <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="m-bezeichnung"
                      data-ocid="klienten.mandat_bezeichnung_input"
                      {...mandatForm.register("bezeichnung", {
                        required: true,
                      })}
                      className={
                        mandatForm.formState.errors.bezeichnung
                          ? "border-destructive"
                          : ""
                      }
                      placeholder="Vertragsberatung 2024"
                    />
                    {mandatForm.formState.errors.bezeichnung && (
                      <p
                        data-ocid="klienten.bezeichnung_field_error"
                        className="text-xs text-destructive mt-1"
                      >
                        Bezeichnung ist erforderlich
                      </p>
                    )}
                  </div>

                  <div>
                    <Label
                      htmlFor="m-akquisiteur"
                      className="text-xs mb-1 block"
                    >
                      Akquisiteur
                    </Label>
                    <Controller
                      control={mandatForm.control}
                      name="akquisiteurId"
                      render={({ field }) => (
                        <Select
                          value={field.value}
                          onValueChange={field.onChange}
                        >
                          <SelectTrigger
                            id="m-akquisiteur"
                            data-ocid="klienten.akquisiteur_select"
                          >
                            <SelectValue placeholder="Bitte wählen…" />
                          </SelectTrigger>
                          <SelectContent>
                            {leistungserbringer.map((lb) => (
                              <SelectItem
                                key={lb.id.toString()}
                                value={lb.id.toString()}
                              >
                                {lb.vorname} {lb.nachname}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label htmlFor="m-bonus" className="text-xs mb-1 block">
                        Akquisitionsbonus
                      </Label>
                      <div className="relative">
                        <Input
                          id="m-bonus"
                          data-ocid="klienten.akquisitionsbonus_input"
                          type="number"
                          min="0"
                          max="100"
                          step="1"
                          {...mandatForm.register("akquisitionsbonus")}
                          className="pr-8"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">
                          %
                        </span>
                      </div>
                    </div>
                    <div>
                      <Label htmlFor="m-mwst" className="text-xs mb-1 block">
                        MWST-Satz
                      </Label>
                      <div className="relative">
                        <Input
                          id="m-mwst"
                          data-ocid="klienten.mwst_satz_input"
                          type="number"
                          min="0"
                          max="100"
                          step="0.1"
                          {...mandatForm.register("mwstSatz")}
                          className="pr-8"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">
                          %
                        </span>
                      </div>
                    </div>
                  </div>

                  <div>
                    {/* Fix 10: Budget-Label und Suffix aus der gewählten Mandatswährung
                        (mandatForm waehrung), nicht hart codiert CHF. Root Cause:
                        frühere Single-Currency-Annahme (nur CHF). */}
                    <Label htmlFor="m-budget" className="text-xs mb-1 block">
                      Budget ({currencySymbol(mandatForm.watch("waehrung"))})
                    </Label>
                    <div className="relative">
                      <Input
                        id="m-budget"
                        data-ocid="klienten.budget_input"
                        type="number"
                        min="0"
                        step="100"
                        {...mandatForm.register("budget")}
                        className="pr-14"
                        placeholder="0"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">
                        {currencySymbol(mandatForm.watch("waehrung"))}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      0 = kein Budget
                    </p>
                  </div>

                  <div className="flex items-center justify-between py-1">
                    <div>
                      <p className="text-sm font-medium text-foreground">
                        Rundung
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Auf nächste 5 Minuten aufrunden
                      </p>
                    </div>
                    <Controller
                      control={mandatForm.control}
                      name="rundungAktiv"
                      render={({ field }) => (
                        <Switch
                          data-ocid="klienten.rundung_switch"
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      )}
                    />
                  </div>

                  <div>
                    <Label htmlFor="m-auslagen" className="text-xs mb-1 block">
                      Auslagenregelung
                    </Label>
                    <Controller
                      control={mandatForm.control}
                      name="auslagenregelung"
                      render={({ field }) => (
                        <Select
                          value={field.value}
                          onValueChange={field.onChange}
                        >
                          <SelectTrigger
                            id="m-auslagen"
                            data-ocid="klienten.auslagenregelung_select"
                          >
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Keine">Keine</SelectItem>
                            <SelectItem value="Pauschal">Pauschal</SelectItem>
                            <SelectItem value="Effektiv">Effektiv</SelectItem>
                          </SelectContent>
                        </Select>
                      )}
                    />
                  </div>

                  <div>
                    <Label htmlFor="m-zahlung" className="text-xs mb-1 block">
                      Zahlungsbedingungen
                    </Label>
                    <Input
                      id="m-zahlung"
                      data-ocid="klienten.zahlungsbedingungen_input"
                      {...mandatForm.register("zahlungsbedingungen")}
                      placeholder="30 Tage netto"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label
                        htmlFor="m-waehrung"
                        className="text-xs mb-1 block"
                      >
                        Währung
                      </Label>
                      <Controller
                        control={mandatForm.control}
                        name="waehrung"
                        render={({ field }) => (
                          <Select
                            value={field.value}
                            onValueChange={field.onChange}
                          >
                            <SelectTrigger
                              id="m-waehrung"
                              data-ocid="klienten.waehrung_select"
                            >
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="CHF">CHF</SelectItem>
                              <SelectItem value="EUR">EUR</SelectItem>
                              <SelectItem value="USD">USD</SelectItem>
                            </SelectContent>
                          </Select>
                        )}
                      />
                    </div>
                    <div>
                      <Label
                        htmlFor="m-stundensatz"
                        className="text-xs mb-1 block"
                      >
                        Standard-Stundensatz
                      </Label>
                      <div className="relative">
                        <Input
                          id="m-stundensatz"
                          data-ocid="klienten.standard_stundensatz_input"
                          type="number"
                          min="0"
                          step="10"
                          {...mandatForm.register("standardStundensatz")}
                          className="pr-12"
                          placeholder="0"
                        />
                        {/* Fix 10: Suffix aus Mandatswährung, nicht hart codiert CHF. */}
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">
                          {currencySymbol(mandatForm.watch("waehrung"))}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between py-1">
                    <div>
                      <p className="text-sm font-medium text-foreground">
                        Leistungen ausweisen
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Leistungsdetails in Rechnung anzeigen
                      </p>
                    </div>
                    <Controller
                      control={mandatForm.control}
                      name="leistungenAusweisen"
                      render={({ field }) => (
                        <Switch
                          data-ocid="klienten.leistungen_ausweisen_switch"
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      )}
                    />
                  </div>

                  {/* Autokilometer */}
                  <div>
                    {/* Fix 10: Label und Suffix aus Mandatswährung, nicht hart codiert CHF/km. */}
                    <Label htmlFor="m-autokm" className="text-xs mb-1 block">
                      Autokilometer (
                      {currencySymbol(mandatForm.watch("waehrung"))}/km)
                    </Label>
                    <div className="relative">
                      <Input
                        id="m-autokm"
                        data-ocid="klienten.autokilometer_input"
                        type="number"
                        min="0"
                        step="0.05"
                        {...mandatForm.register("autokilometer")}
                        className="pr-14"
                        placeholder="0.70"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">
                        {currencySymbol(mandatForm.watch("waehrung"))}
                      </span>
                    </div>
                  </div>

                  {/* Conditional Pauschal field */}
                  {mandatForm.watch("auslagenregelung") === "Pauschal" && (
                    <div
                      data-ocid="klienten.pauschal_auslagen_section"
                      className="space-y-3 pt-1 border-t border-border"
                    >
                      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground pt-1">
                        Pauschal-Auslagen
                      </p>
                      <div>
                        {/* Fix 10: Pauschalbetrag-Label und Suffix aus Mandatswährung
                            (mandatForm waehrung), nicht hart codiert CHF. Root Cause:
                            frühere Single-Currency-Annahme (nur CHF). */}
                        <Label
                          htmlFor="m-pauschalbetrag"
                          className="text-xs mb-1 block"
                        >
                          Pauschalbetrag (
                          {currencySymbol(mandatForm.watch("waehrung"))})
                        </Label>
                        <div className="relative">
                          <Input
                            id="m-pauschalbetrag"
                            data-ocid="klienten.pauschalbetrag_input"
                            type="number"
                            min="0"
                            step="10"
                            {...mandatForm.register("pauschalBetrag")}
                            className="pr-14"
                            placeholder="0"
                          />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">
                            {currencySymbol(mandatForm.watch("waehrung"))}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Fester Auslagen-Pauschalbetrag pro Abrechnung
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Conditional Effektiv fields */}
                  {mandatForm.watch("auslagenregelung") === "Effektiv" && (
                    <div
                      data-ocid="klienten.effektiv_auslagen_section"
                      className="space-y-3 pt-1 border-t border-border"
                    >
                      {/* Fix 10: Effektiv-Auslagen-Header aus Mandatswährung
                          (mandatForm waehrung), nicht hart codiert CHF. Root Cause:
                          frühere Single-Currency-Annahme (nur CHF). */}
                      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground pt-1">
                        Effektiv-Auslagen (
                        {currencySymbol(mandatForm.watch("waehrung"))})
                      </p>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <Label
                            htmlFor="m-kopie"
                            className="text-xs mb-1 block"
                          >
                            Kosten pro Kopie
                          </Label>
                          <Input
                            id="m-kopie"
                            data-ocid="klienten.kosten_kopie_input"
                            type="number"
                            min="0"
                            step="0.05"
                            {...mandatForm.register("kostenProKopie")}
                            placeholder="0.50"
                          />
                        </div>
                        <div>
                          <Label
                            htmlFor="m-scan"
                            className="text-xs mb-1 block"
                          >
                            Kosten pro Scan
                          </Label>
                          <Input
                            id="m-scan"
                            data-ocid="klienten.kosten_scan_input"
                            type="number"
                            min="0"
                            step="0.05"
                            {...mandatForm.register("kostenProScan")}
                            placeholder="0.50"
                          />
                        </div>
                        <div>
                          <Label
                            htmlFor="m-portoA"
                            className="text-xs mb-1 block"
                          >
                            Porto A-Post
                          </Label>
                          <Input
                            id="m-portoA"
                            data-ocid="klienten.porto_apost_input"
                            type="number"
                            min="0"
                            step="0.05"
                            {...mandatForm.register("portoAPost")}
                            placeholder="1.20"
                          />
                        </div>
                        <div>
                          <Label
                            htmlFor="m-portoB"
                            className="text-xs mb-1 block"
                          >
                            Porto B-Post
                          </Label>
                          <Input
                            id="m-portoB"
                            data-ocid="klienten.porto_bpost_input"
                            type="number"
                            min="0"
                            step="0.05"
                            {...mandatForm.register("portoBPost")}
                            placeholder="0.90"
                          />
                        </div>
                        <div className="col-span-2">
                          <Label
                            htmlFor="m-portoEinschr"
                            className="text-xs mb-1 block"
                          >
                            Porto Einschreiben
                          </Label>
                          <Input
                            id="m-portoEinschr"
                            data-ocid="klienten.porto_einschreiben_input"
                            type="number"
                            min="0"
                            step="0.05"
                            {...mandatForm.register("portoEinschreiben")}
                            placeholder="4.50"
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </section>
            </div>

            {/* Action buttons */}
            <div className="sticky bottom-0 bg-card border-t border-border px-5 py-4 space-y-2">
              <div className="flex gap-2">
                <Button
                  data-ocid="klienten.save_button"
                  className="btn-success flex-1 gap-2"
                  onClick={handleSave}
                  disabled={isSaving}
                >
                  {isSaving && (
                    <span
                      data-ocid="klienten.loading_state"
                      className="w-4 h-4 border-2 border-accent-foreground border-t-transparent rounded-full animate-spin"
                    />
                  )}
                  Speichern
                </Button>
                <Button
                  variant="ghost"
                  data-ocid="klienten.cancel_button"
                  onClick={() => setPanelMode("closed")}
                  className="flex-1"
                >
                  Abbrechen
                </Button>
              </div>

              {panelMode === "edit" && selectedMandatId && (
                <>
                  <Button
                    variant="outline"
                    data-ocid="klienten.new_mandat_button"
                    className="w-full gap-2 border-primary/40 text-primary hover:bg-primary/5"
                    onClick={handleNewMandat}
                  >
                    <Plus size={14} />
                    Neues Mandat
                  </Button>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      data-ocid="klienten.archivieren_button"
                      className="flex-1 gap-2 border border-amber-400 text-amber-700 hover:bg-amber-50 rounded px-3 py-1.5 text-sm font-medium transition-colors"
                      onClick={() => archivierMut.mutate(selectedMandatId)}
                      disabled={archivierMut.isPending}
                    >
                      <Archive size={14} />
                      Archivieren
                    </Button>
                    <Button
                      variant="outline"
                      data-ocid="klienten.delete_button"
                      className="flex-1 gap-2 border-destructive/40 text-destructive hover:bg-destructive/5 hover:border-destructive"
                      onClick={() => setConfirmDelete(true)}
                    >
                      <Trash2 size={14} />
                      Mandat löschen
                    </Button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Confirm delete dialog */}
      <ConfirmDialog
        open={confirmDelete}
        message="Sind Sie sicher, dass Sie dieses Mandat löschen möchten? Diese Aktion kann nicht rückgängig gemacht werden."
        onConfirm={() => {
          if (selectedMandatId) deleteMandatMut.mutate(selectedMandatId);
          setConfirmDelete(false);
        }}
        onCancel={() => setConfirmDelete(false)}
      />
    </div>
  );
}

// ─── Status Badge ────────────────────────────────────────────────────────────

function MandatStatusBadge({ status }: { status: MandatStatus }) {
  if (status === MandatStatus.aktiv) {
    return (
      <Badge className="bg-accent/15 text-accent border-accent/30 text-xs font-medium">
        Aktiv
      </Badge>
    );
  }
  return (
    <Badge
      variant="secondary"
      className="bg-muted text-muted-foreground border-border text-xs font-medium"
    >
      Archiviert
    </Badge>
  );
}
