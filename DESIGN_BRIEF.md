# Design-Briefing — Notiz (Minimal Notes)

## Designziele

- **Ruhig, schnell, ablenkungsarm:** Fokus auf Inhalt, keine dekorativen Elemente ohne Nutzen.
- **Glasklare Hierarchie:** Liste links (Scan), Editor rechts (Flow), mit eindeutigen Zuständen.
- **„Unsichtbare“ Interaktion:** Autosave, direkte Rückmeldung („Gespeichert“), keine Dialog-Flut.
- **Skalierbar:** Gleiche Struktur funktioniert für Mobile (Stack) und Desktop (Split View).

## Informationsarchitektur

- **Notizenliste**
  - Titel (oder „Ohne Titel“)
  - Vorschautext (erste ~140 Zeichen)
  - Änderungszeit (für „zuletzt genutzt“)
- **Detailansicht**
  - Status (Bereit / Änderungen… / Gespeichert / Fehler)
  - Titel (single line)
  - Inhalt (multi line)
  - Metadaten (Erstellt/Geändert/ID) als ruhige Infozeile

## Visuelles System

- **Layout:** Split View (360px Liste + flex Editor), auf kleineren Screens automatisch gestapelt.
- **Typography:** System-Font (UI-Sans); Metadaten in Monospace für technische Klarheit.
- **Spacing:** 12–16px Raster; große Touch-Ziele (≥40px) für Buttons.
- **Radius/Shape:** 12–16px (soft, modern, aber nicht „spielerisch“).
- **Farbe:**
  - Dark: sehr dunkler Hintergrund + sanfte Panels (hoher Kontrast ohne „reines Schwarz“)
  - Light: weißes Panel auf sehr hellem Hintergrund
  - Akzent: blau/cyan für Fokus/Selektion
  - Danger: rosa/rot für Löschen

## Interaktionsprinzipien

- **Autosave:** Debounce (~350ms) + Save on Blur + `Ctrl/Cmd+S`.
- **Suchen:** Sofortige Filterung der Liste (Titel + Inhalt), mit Trefferanzeige.
- **Leerer Zustand:** Klarer Call-to-Action („Neue Notiz erstellen“ über +).
- **Fehlerfälle:** Statuszeile + einfache Alerts bei Import-Problemen.

## Accessibility & UX Details

- **Tastatur:** Liste ist per Enter/Space wählbar; Shortcuts `Ctrl/Cmd+N` und `Ctrl/Cmd+S`.
- **ARIA:** Listenelemente nutzen `role=list/listitem` und `aria-selected`.
- **Kontrast:** Fokus-Ringe sind sichtbar in beiden Themes.

## Daten & Sync (Konzept)

- **Lokale Datenhaltung:** IndexedDB (Store `notes`), Sortierung nach `updatedAt`.
- **Versionierung:** Exportformat enthält `schema` und `exportedAt`.
- **Sync-Optionen (weiterer Ausbau):**
  - Account-basiert (z.B. Firebase/Firestore)
  - Geräte-basiert (z.B. iCloud/Google Drive als Datei-Sync)
  - Self-hosted (WebDAV/S3)
  - Konfliktstrategie: `updatedAt` + Merge-Regeln (z.B. „last-write-wins“ oder diff-basiert)

