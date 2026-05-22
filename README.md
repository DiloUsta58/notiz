# Notiz (Minimal Notes)

Eine dependencies-freie, minimalistische Notizen-App als Web/PWA.

## Features

- Notizen erstellen, bearbeiten, löschen
- Autosave (Debounce + Save on Blur / Strg+S)
- Lokale Speicherung via IndexedDB
- Übersicht mit Titel, Preview und Änderungszeit
- Übersicht gruppiert nach Kalenderwoche (KW)
- Gruppen: „Diese Woche“ / „Letzte Woche“ (fallback Jahr+KW)
- Suche (Titel + Inhalt)
- Dunkel-/Hellmodus (Toggle + Speicherung)
- Rich-Text-Leiste: Listen/Nummerierung, Einrücken (mehrere Ebenen), Ausrichtung, Schriftart/-farbe, Markierung, Checkliste
- Tags & Kategorie (optional) + Anzeige als Chips in der Liste
- Schnellaktionen in der Liste: Rechtsklick/Long-Press/„⋯“ → Öffnen, Duplizieren, Löschen
- Auto-Backup: lokale Snapshots (Button `⟲`) + Restore
- Paste: Standard = Plain-Text, `Shift+Paste` = Format behalten
- Optionaler Offline-Modus (Service Worker Cache)
- Export/Import als JSON (Basis für Cloud-Sync / Gerätewechsel)

## Start

Einfach `index.html` in einem lokalen Webserver öffnen (für Service Worker braucht es `http://`/`https://`, nicht `file://`).

Beispiel (Windows, PowerShell):

```powershell
py -m http.server 5173
```

Dann im Browser öffnen: `http://localhost:5173/`

## Mobile Installation

- Android/Chrome: Seite öffnen, Browser-Menü → „App installieren“ oder „Zum Startbildschirm hinzufügen“.
- iOS/Safari: Teilen-Menü → „Zum Home-Bildschirm“.
- Wichtig: Für echte PWA-Installation braucht der Browser `https://` oder `localhost`. Bei Zugriff vom Handy über eine lokale `http://192.168...` Adresse kann der Service Worker blockiert werden.

## Android APK erstellen

Das Verzeichnis `android/` enthält eine native Android-WebView-App, die die Web-App lokal aus `assets/www` lädt.

```powershell
.\tools\sync-web-assets.ps1
.\tools\build-apk-signed.ps1 -Variant Debug
```

Das erzeugte Debug-APK wird zusätzlich nach `Notiz-debug-signed.apk` im Projektordner kopiert.

Release (signiert):

```powershell
.\tools\build-apk-signed.ps1 -Variant Release
```
