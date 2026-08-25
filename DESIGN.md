# iReport Legal Design Brief

## Direction
iReport Legal — refined Swiss legal minimalism for Kanzlei time tracking, invoicing, revDSG Datenschutz, and Super-Admin governance. This brief extends the system for the new 3-step E-Mail-verifizierte Registrierung.

## Tone
Trustworthy, precise, calm legal gravitas — European precision, not Silicon Valley playfulness. Registration reads as a secure, deliberate onboarding with clear progress.

## Differentiation
A disciplined horizontal 3-step indicator (purple = aktiv, green = abgeschlossen) plus a JetBrains-Mono verification-code input make the E-Mail-verified onboarding feel both authoritative and effortless.

## Color Palette
| Token | OKLCH (light) | Role |
|-------|-------|---------|
| Primary Purple | 0.62 0.16 264 | Aktiver Schritt, Fokus, primäre UI |
| Action/Success Green | 0.5 0.2 132 | Abgeschlossener Schritt, CTA, Erfolgsmeldung |
| Info Blue | 0.55 0.16 245 | Status-Hinweise im Flow (bestehend, kein neues Token) |
| Danger Red | 0.55 0.22 25 | Destruktiv, Fehler-/Code-Zurückweisung |
| Neutral Grey | 0.94 0.01 0 | Hintergründe, inaktive Schritte |
| Foreground | 0.12 0.04 264 | Text |

Keine neuen Farb-Tokens — der Flow nutzt ausschliesslich `--primary`, `--success`, `--info`, `--danger`, `--muted`, `--border`.

## Typography
- **Display:** General Sans — Schritt-Titel, Überschriften, Ziffern im Schritt-Indikator
- **Body:** DM Sans — Labels, Hinweise, Buttons
- **Mono:** JetBrains Mono — 6-stelliger Bestätigungscode (gross, zentriert, 0.5em Buchstabenabstand)
- **Scale:** Schritt-Titel text-lg/xl semibold; Labels text-sm; Code text-2xl

## Elevation & Depth
Flacher Card-basierter Flow (card 1.0, 1px border, 0.5rem radius) mit dezentem `shadow-card-hover` beim aktiven Panel. Kein Glow, keine Vollflächen-Gradienten.

## Structural Zones
| Zone | Background | Border | Notes |
|------|-----------|--------|-------|
| Registrierung-Panel | Card (1.0) | 1px border | max-w-lg/md zentriert, `animate-fade-in-up` pro Schritt |
| Schritt-Indikator | Muted (0.94) | — | 3 Kreise + Verbindungslinien, horizontal, responsive |
| Schritt-Formular | Card (1.0) | 1px border | Felder bg-input, Ring-Fokus primary |
| Status-Meldung | info/success 12% Tint | — | `.status-message-info` / `.status-message-success` |
| Footer/Landing | Muted (0.94) | border-t | Kontext bleibt erhalten |

## Spacing & Rhythm
8px-Basis (8/16/24/32/40). Schritt-Gap 24px, Feld-Gap 16px, Panel-Padding 32px. Indikator-Dots 2.25rem, Verbinder min 1.5rem.

## Component Patterns
- **Buttons:** `.btn-primary` (purple) für „E-Mail bestätigen" / „Mit Internet Identity anmelden & Registrierung abschliessen"; `.btn-ghost` für „Code erneut senden" / „E-Mail-Adresse ändern". Rounded 0.5rem.
- **Schritt-Indikator:** `.reg-step` + `.reg-step-dot` (Kreis mit Nummer), `.reg-step-dot-active` (primary, `animate-step-pop`), `.reg-step-dot-complete` (success), `.reg-step-connector` / `-complete`.
- **Code-Eingabe:** `.verification-code-input` — JetBrains Mono, text-2xl, zentriert, letter-spacing 0.5em, Ring-Fokus primary.
- **Status-Meldungen:** `.status-message-info` (info-Blau) für Hinweise, `.status-message-success` (grün) für „E-Mail-Adresse erfolgreich bestätigt.".
- **Badges/Cards:** bestehende Systeme unverändert.

## Motion
- **Entrance:** Schrittwechsel `animate-fade-in-up` (0.35s cubic-bezier 0.4,0,0.2,1).
- **Aktiv:** Aktiver Indikator-Dot `animate-step-pop` (0.4s) beim Fortschritt.
- **Hover:** Buttons opacity 90%, Panel `shadow-card-hover`.
- **Decorative:** keine — produktivitätskonform.

## Constraints
- Keine neuen Farb-Tokens; Status über bestehendes `--info`-Blau (bestehendes `--success`-Grün für Erfolg).
- Keine sensiblen Verifizierungsdaten (Code, Hash) im Local Storage.
- Kein Rate-Limiting pro Client/IP (doNotBuild).
- Keine automatische periodische Bereinigung abgelaufener PendingRegistrations (doNotBuild).
- Reload stellt gültige PendingRegistration wieder her → passender Schritt.
- Deutsche (Schweiz) UI-Labels: „Kanzlei & Person", „E-Mail bestätigen", „Internet Identity verbinden & Registrierung abschliessen".
- Vor erfolgreicher E-Mail-Verifizierung wird keine definitive Kanzlei / kein definitiver Benutzer angelegt.

## Signature Detail
Der horizontale 3-Schritt-Indikator (purple aktiv, grün abgeschlossen) mit JetBrains-Mono-Code-Eingabe verankert die E-Mail-Verifizierung als Dreh- und Angelpunkt der Registrierung — vertrauenswürdige, präzise Onboarding-Choreografie im bestehenden Swiss-legal-Stil, ganz ohne neue Farben.
