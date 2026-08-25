import { AlertTriangle } from "lucide-react";
import { useEffect } from "react";

interface ConfirmDeleteModalProps {
  /** Modal geöffnet? */
  open: boolean;
  /** Anzeigename des zu löschenden Eintrags (Kanzlei-Name, Benutzername, …). */
  entityName: string;
  /** Art des Eintrags, z.B. "Kanzlei" oder "Leistungserbringer". */
  entityType: string;
  /** Schliessen-Handler (Abbrechen / Overlay / Escape). */
  onClose: () => void;
  /** Bestätigen-Handler — führt die Löschung aus. */
  onConfirm: () => void;
  /** Läuft die Löschung gerade? (deaktiviert den Bestätigen-Button). */
  loading?: boolean;
}

/**
 * ConfirmDeleteModal — Bestätigungs-Dialog für unwiderrufliche Löschaktionen.
 *
 * Ersetzt die Browser-Konfirmation durch einen barrierefreien Modal-Dialog:
 *   - Warnhinweis zur Unwiderruflichkeit
 *   - nennt den Namen des zu löschenden Eintrags
 *   - Abbrechen-Button + roter Bestätigen-Button
 *   - Escape schliesst, Fokus bleibt im Dialog, Overlay schliesst ebenfalls.
 *
 * Der Dialog wird nur gerendert, wenn `open === true`. Aufrufer steuern die
 * Sichtbarkeit über State und liefern `onConfirm` (führt die Mutation aus)
 * sowie `onClose` (setzt State zurück).
 */
export function ConfirmDeleteModal({
  open,
  entityName,
  entityType,
  onClose,
  onConfirm,
  loading = false,
}: ConfirmDeleteModalProps) {
  // Escape schliesst den Modal (nicht während eines laufenden Löschvorgangs).
  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !loading) onClose();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [open, loading, onClose]);

  if (!open) return null;

  return (
    <dialog
      open
      data-ocid="confirm_delete.modal"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-transparent"
      aria-modal="true"
      aria-labelledby="confirm-delete-title"
    >
      {/* Overlay */}
      <div
        data-ocid="confirm_delete.overlay"
        className="absolute inset-0 bg-foreground/40"
        onClick={() => {
          if (!loading) onClose();
        }}
        onKeyDown={(e) => {
          if ((e.key === "Enter" || e.key === " ") && !loading) onClose();
        }}
        tabIndex={-1}
        aria-hidden="true"
      />

      {/* Dialog */}
      <div
        data-ocid="confirm_delete.dialog"
        className="relative w-full max-w-md rounded-lg bg-card border border-border shadow-lg p-6"
      >
        <div className="flex items-start gap-3 mb-4">
          <div
            className="shrink-0 mt-0.5 flex h-9 w-9 items-center justify-center rounded-full"
            style={{
              background: "oklch(var(--danger) / 0.12)",
              color: "oklch(var(--danger))",
            }}
            aria-hidden="true"
          >
            <AlertTriangle size={20} />
          </div>
          <div className="min-w-0">
            <h2
              id="confirm-delete-title"
              className="text-lg font-display font-semibold text-foreground"
            >
              {entityType} löschen
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Möchten Sie{" "}
              <span className="font-medium text-foreground break-words">
                {entityName}
              </span>{" "}
              wirklich löschen?
            </p>
          </div>
        </div>

        <p
          data-ocid="confirm_delete.warning"
          className="text-sm text-foreground mb-6 rounded-md p-3"
          style={{
            background: "oklch(var(--danger) / 0.08)",
            border: "1px solid oklch(var(--danger) / 0.2)",
          }}
        >
          Diese Aktion ist <strong>unwiderruflich</strong> und kann nicht
          rückgängig gemacht werden. Alle zugehörigen Daten werden dauerhaft
          entfernt.
        </p>

        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
          <button
            type="button"
            data-ocid="confirm_delete.cancel_button"
            onClick={onClose}
            disabled={loading}
            className="btn-ghost disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Abbrechen
          </button>
          <button
            type="button"
            data-ocid="confirm_delete.confirm_button"
            onClick={onConfirm}
            disabled={loading}
            className="inline-flex items-center justify-center rounded-md font-medium text-sm px-4 py-2 transition-smooth hover:opacity-90 active:opacity-80 disabled:opacity-50 disabled:cursor-not-allowed"
            style={{
              background: "oklch(var(--danger))",
              color: "oklch(var(--danger-foreground))",
            }}
          >
            {loading ? "Wird gelöscht…" : "Löschen bestätigen"}
          </button>
        </div>
      </div>
    </dialog>
  );
}
