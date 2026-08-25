import { Info } from "lucide-react";

interface DemoNoticeProps {
  /** Optional Callback, das das Feedback-Modal öffnet. Wenn nicht gesetzt,
   *  wird die "Feedback geben"-Aktion nicht gerendert (Abwärtskompatibilität
   *  für Aufrufer, die das Modal noch nicht integriert haben). */
  onOpenFeedback?: () => void;
}

/**
 * DemoNotice — gelber Hinweis-Banner für die Demo-Umgebung.
 *
 * Wird in der Layout-Komponente im Kopfbereich (rechts neben dem Logo)
 * gerendert und erscheint somit auf allen Seiten, die das Layout verwenden.
 * Der Hinweistext macht klar, dass es sich um eine kostenlose Demo-Version
 * handelt. Optisch als gelb hinterlegte Zone erkennbar (`.demo-notice` in
 * index.css), dunkler Text für gute Lesbarkeit.
 *
 * Wenn `onOpenFeedback` übergeben wird, wird zusätzlich ein Trenner und eine
 * klickbare "Feedback geben"-Aktion angezeigt, die das Feedback-Modal öffnet.
 * Die bestehende visuelle Gestaltung des gelben Badges bleibt unverändert;
 * es wird nur die Aktion hinzugefügt.
 */
export function DemoNotice({ onOpenFeedback }: DemoNoticeProps) {
  return (
    <output
      data-ocid="demo.notice"
      className="demo-notice"
      aria-label="Hinweis zur Demo-Umgebung"
    >
      <Info size={16} aria-hidden="true" className="shrink-0" />
      <span>– das ist eine kostenlose Demo-Version –</span>
      {onOpenFeedback && (
        <>
          <span className="demo-notice-divider" aria-hidden="true" />
          <button
            type="button"
            data-ocid="demo.notice.feedback_action"
            className="demo-notice-action"
            onClick={onOpenFeedback}
          >
            Feedback geben
          </button>
        </>
      )}
    </output>
  );
}
