import { SupportCategory } from "@/backend";
import { useCreateSupportConversation } from "@/utils/backend";
import { useLocation } from "@tanstack/react-router";
import { Check, X } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

/**
 * App-Version-Konstante für Feedback-Conversations. Es existiert keine
 * Env-Variable; der Wert wird beim Anlegen einer Conversation persistiert
 * und dient dem Support-Team zur Zuordnung von Reports zu Builds.
 */
const APP_VERSION = "draft";

interface FeedbackModalProps {
  open: boolean;
  onClose: () => void;
}

interface CategoryOption {
  value: SupportCategory;
  label: string;
}

const CATEGORY_OPTIONS: CategoryOption[] = [
  { value: SupportCategory.feedback, label: "Feedback" },
  { value: SupportCategory.frage, label: "Frage" },
  { value: SupportCategory.fehler, label: "Fehler" },
  {
    value: SupportCategory.verbesserungsvorschlag,
    label: "Verbesserungsvorschlag",
  },
];

/**
 * FeedbackModal — kompakter Modal-Editor zum Einreichen von Feedback &
 * Support-Anliegen. Wird auf Layout-Ebene gerendert und über das gelbe
 * Demo-Badge ("Feedback geben") geöffnet. Pflichtfelder: Kategorie, Betreff,
 * Nachricht. Der Submit ist deaktiviert, bis alle Felder ausgefüllt sind.
 * Nach erfolgreichem Absenden wird ein Erfolg-Zustand gezeigt und das
 * Modal nach kurzer Verzögerung geschlossen/zurückgesetzt.
 */
export function FeedbackModal({ open, onClose }: FeedbackModalProps) {
  const location = useLocation();
  const createConversation = useCreateSupportConversation();

  const [category, setCategory] = useState<SupportCategory>(
    SupportCategory.feedback,
  );
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [showSuccess, setShowSuccess] = useState(false);

  // Reset-Effect: wenn das Modal geschlossen wird, Form + Erfolg-Zustand
  // nach einer kurzen Verzögerung zurücksetzen (damit der Erfolg-Zustand
  // sa ausblenden kann, bevor das Form wieder leer ist).
  useEffect(() => {
    if (!open) {
      const t = setTimeout(() => {
        setCategory(SupportCategory.feedback);
        setSubject("");
        setMessage("");
        setShowSuccess(false);
        createConversation.reset();
      }, 200);
      return () => clearTimeout(t);
    }
  }, [open, createConversation]);

  // Escape schliesst das Modal (nur im Form-Zustand, nicht während des
  // Erfolg-Zustands, damit der Erfolg sichtbar bleibt).
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !showSuccess && !createConversation.isPending) {
        onClose();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, showSuccess, createConversation.isPending, onClose]);

  if (!open) return null;

  const isFormValid = subject.trim().length > 0 && message.trim().length > 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isFormValid || createConversation.isPending) return;

    try {
      await createConversation.mutateAsync({
        category,
        subject: subject.trim(),
        message: message.trim(),
        appRoute: location.pathname,
        appVersion: APP_VERSION,
      });
      setShowSuccess(true);
      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (err) {
      toast.error(
        "Feedback konnte nicht gesendet werden. Bitte später erneut versuchen.",
      );
      // eslint-disable-next-line no-console
      console.error("createSupportConversation failed:", err);
    }
  };

  return (
    <dialog
      open={open}
      className="feedback-modal-overlay"
      aria-modal="true"
      aria-labelledby="feedback-modal-title"
      onClick={(e) => {
        if (
          e.target === e.currentTarget &&
          !showSuccess &&
          !createConversation.isPending
        ) {
          onClose();
        }
      }}
      onKeyDown={(e) => {
        if (
          e.key === "Escape" &&
          !showSuccess &&
          !createConversation.isPending
        ) {
          e.preventDefault();
          onClose();
        }
      }}
    >
      <div className="feedback-modal-panel" data-ocid="feedback.modal.panel">
        {showSuccess ? (
          <div className="feedback-success" data-ocid="feedback.success_state">
            <div className="feedback-success-icon">
              <Check size={20} aria-hidden="true" />
            </div>
            <p className="feedback-success-title">Feedback gesendet</p>
            <p className="feedback-success-text">
              Vielen Dank! Ihr Feedback wurde übermittelt und wird vom
              Support-Team geprüft.
            </p>
          </div>
        ) : (
          <>
            <div className="feedback-modal-header">
              <h2 id="feedback-modal-title" className="feedback-modal-title">
                Feedback geben
              </h2>
              <button
                type="button"
                data-ocid="feedback.modal.close_button"
                className="feedback-modal-close"
                onClick={onClose}
                disabled={createConversation.isPending}
                aria-label="Schliessen"
              >
                <X size={18} aria-hidden="true" />
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="feedback-modal-body">
                <div className="feedback-field">
                  <label
                    htmlFor="feedback-category"
                    className="feedback-label feedback-label-required"
                  >
                    Kategorie
                  </label>
                  <select
                    id="feedback-category"
                    data-ocid="feedback.modal.category_select"
                    className="feedback-select"
                    value={category}
                    onChange={(e) =>
                      setCategory(e.target.value as SupportCategory)
                    }
                    disabled={createConversation.isPending}
                  >
                    {CATEGORY_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="feedback-field">
                  <label
                    htmlFor="feedback-subject"
                    className="feedback-label feedback-label-required"
                  >
                    Betreff
                  </label>
                  <input
                    id="feedback-subject"
                    data-ocid="feedback.modal.subject_input"
                    type="text"
                    className="feedback-input"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    disabled={createConversation.isPending}
                    maxLength={200}
                    placeholder="Kurze Zusammenfassung"
                  />
                </div>

                <div className="feedback-field">
                  <label
                    htmlFor="feedback-message"
                    className="feedback-label feedback-label-required"
                  >
                    Nachricht
                  </label>
                  <textarea
                    id="feedback-message"
                    data-ocid="feedback.modal.message_textarea"
                    className="feedback-textarea"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    disabled={createConversation.isPending}
                    maxLength={4000}
                    placeholder="Beschreiben Sie Ihr Anliegen …"
                  />
                </div>
              </div>

              <div className="feedback-modal-footer">
                <button
                  type="button"
                  data-ocid="feedback.modal.cancel_button"
                  className="btn-ghost"
                  onClick={onClose}
                  disabled={createConversation.isPending}
                >
                  Abbrechen
                </button>
                <button
                  type="submit"
                  data-ocid="feedback.modal.submit_button"
                  className="btn-primary"
                  disabled={!isFormValid || createConversation.isPending}
                >
                  {createConversation.isPending ? "Wird gesendet …" : "Senden"}
                </button>
              </div>
            </form>
          </>
        )}
      </div>
    </dialog>
  );
}
