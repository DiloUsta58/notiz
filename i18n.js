const LANG_KEY = "notiz_lang";

const dict = {
  de: {
    appName: "Notiz",
    minimal: "minimal",
    languageName: "Deutsch",
    backup: "Backups",
    export: "Export",
    import: "Import",
    newNote: "Neue Notiz",
    toggleTheme: "Theme umschalten",
    notesList: "Notizenliste",
    search: "Suchen…",
    notes: "Notizen",
    hits: "Treffer",
    thisWeek: "Diese Woche",
    lastWeek: "Letzte Woche",
    untitled: "Ohne Titel",
    untitledCopy: "Ohne Titel (Kopie)",
    copySuffix: "(Kopie)",
    open: "Öffnen",
    duplicate: "Duplizieren",
    delete: "Löschen",
    deleteTitle: "Löschen",
    deleteConfirm: "Wirklich {label} löschen?",
    thisNote: "diese Notiz",
    importFailed: "Import fehlgeschlagen (ungültige Datei).",
    startFailed: "Start fehlgeschlagen.",
    error: "Fehler",
    restore: "Restore",
    restoreLatest: "Letztes Backup wiederherstellen? (Vorhandene Notizen werden überschrieben)",
    restoreBackup: "Backup von {when} wiederherstellen? (Überschreibt aktuelle Notizen)",
    edit: "Bearbeiten",
    backOverview: "Zurück zur Übersicht",
    editNote: "Notiz bearbeiten",
    title: "Titel",
    category: "Kategorie",
    tags: "Tags",
    tagsPlaceholder: "z.B. einkauf, arbeit",
    textTools: "Textwerkzeuge",
    basic: "Basis",
    bold: "Fett",
    italic: "Kursiv",
    underline: "Unterstreichen",
    orderedList: "Nummerierung",
    unorderedList: "Aufzählung",
    outdent: "Ebene hoch",
    indent: "Ebene runter",
    checklist: "Checkliste",
    alignLeft: "Links",
    alignCenter: "Zentriert",
    alignRight: "Rechts",
    justify: "Blocksatz",
    insertImage: "Bild einfügen",
    style: "Stil",
    format: "Format",
    normal: "Normal",
    heading1: "Überschrift 1",
    heading2: "Überschrift 2",
    code: "Code",
    size: "Textgröße",
    font: "Schriftart",
    system: "System",
    textColor: "Schriftfarbe",
    highlight: "Texthervorhebung",
    resetNormal: "Normal (Format zurücksetzen)",
    removeFormat: "Format entfernen",
    writePlaceholder: "Schreib los…",
    saved: "Gespeichert",
    saving: "Änderungen…",
    saveFailed: "Fehler beim Speichern",
    ready: "Bereit",
    newNoteStatus: "Neue Notiz",
    tapToCreate: "Tippe los zum Erstellen",
    notFound: "Notiz nicht gefunden",
    unsavedTitle: "Ungespeichert",
    unsavedLeave: "Ungespeicherte Änderungen verwerfen und zurück?",
    leave: "Verlassen",
    stay: "Bleiben",
    image: "Bild",
    chooseImageFile: "Bitte eine Bilddatei auswählen.",
    imageReadFailed: "Bild konnte nicht gelesen werden.",
    imageInsertFailed: "Bild konnte nicht eingefügt werden.",
    imagePickerFailed: "Bildauswahl konnte nicht geöffnet werden.",
    imageSize: "Bildgröße",
    width: "Breite",
    heightAuto: "Höhe (leer = auto)",
    keepRatio: "Seitenverhältnis halten",
    cancel: "Abbrechen",
    remove: "Entfernen",
    apply: "Übernehmen",
    ok: "OK",
    invalidSize: "Ungültige Größe. Erlaubt: Zahl, px, %, oder auto.",
  },
  tr: {
    appName: "Not",
    minimal: "minimal",
    languageName: "Türkçe",
    backup: "Yedekler",
    export: "Dışa aktar",
    import: "İçe aktar",
    newNote: "Yeni not",
    toggleTheme: "Temayı değiştir",
    notesList: "Not listesi",
    search: "Ara…",
    notes: "Not",
    hits: "Sonuç",
    thisWeek: "Bu hafta",
    lastWeek: "Geçen hafta",
    untitled: "Başlıksız",
    untitledCopy: "Başlıksız (Kopya)",
    copySuffix: "(Kopya)",
    open: "Aç",
    duplicate: "Çoğalt",
    delete: "Sil",
    deleteTitle: "Sil",
    deleteConfirm: "{label} silinsin mi?",
    thisNote: "bu notu",
    importFailed: "İçe aktarma başarısız (geçersiz dosya).",
    startFailed: "Başlatma başarısız.",
    error: "Hata",
    restore: "Geri yükle",
    restoreLatest: "Son yedek geri yüklensin mi? (Mevcut notların üzerine yazılır)",
    restoreBackup: "{when} tarihli yedek geri yüklensin mi? (Mevcut notların üzerine yazılır)",
    edit: "Düzenle",
    backOverview: "Listeye dön",
    editNote: "Notu düzenle",
    title: "Başlık",
    category: "Kategori",
    tags: "Etiketler",
    tagsPlaceholder: "örn. alışveriş, iş",
    textTools: "Metin araçları",
    basic: "Temel",
    bold: "Kalın",
    italic: "İtalik",
    underline: "Altı çizili",
    orderedList: "Numaralı liste",
    unorderedList: "Madde listesi",
    outdent: "Seviye azalt",
    indent: "Seviye artır",
    checklist: "Kontrol listesi",
    alignLeft: "Sola hizala",
    alignCenter: "Ortala",
    alignRight: "Sağa hizala",
    justify: "İki yana yasla",
    insertImage: "Resim ekle",
    style: "Stil",
    format: "Biçim",
    normal: "Normal",
    heading1: "Başlık 1",
    heading2: "Başlık 2",
    code: "Kod",
    size: "Yazı boyutu",
    font: "Yazı tipi",
    system: "Sistem",
    textColor: "Yazı rengi",
    highlight: "Vurgu rengi",
    resetNormal: "Normal (biçimi sıfırla)",
    removeFormat: "Biçimi kaldır",
    writePlaceholder: "Yazmaya başla…",
    saved: "Kaydedildi",
    saving: "Değişiklikler…",
    saveFailed: "Kaydetme hatası",
    ready: "Hazır",
    newNoteStatus: "Yeni not",
    tapToCreate: "Oluşturmak için yazmaya başla",
    notFound: "Not bulunamadı",
    unsavedTitle: "Kaydedilmedi",
    unsavedLeave: "Kaydedilmemiş değişiklikler atılıp geri dönülsün mü?",
    leave: "Çık",
    stay: "Kal",
    image: "Resim",
    chooseImageFile: "Lütfen bir resim dosyası seç.",
    imageReadFailed: "Resim okunamadı.",
    imageInsertFailed: "Resim eklenemedi.",
    imagePickerFailed: "Resim seçimi açılamadı.",
    imageSize: "Resim boyutu",
    width: "Genişlik",
    heightAuto: "Yükseklik (boş = auto)",
    keepRatio: "Oranı koru",
    cancel: "İptal",
    remove: "Kaldır",
    apply: "Uygula",
    ok: "OK",
    invalidSize: "Geçersiz boyut. İzin verilen: sayı, px, %, veya auto.",
  },
};

export function getLang() {
  let saved = "";
  try {
    // @ts-ignore Android WebView bridge
    saved = globalThis.NotizAndroid?.getAppSetting?.(LANG_KEY) || "";
  } catch {
    saved = "";
  }
  if (!saved) {
    try {
      saved = localStorage.getItem(LANG_KEY) || "";
    } catch {
      saved = "";
    }
  }
  return saved === "tr" ? "tr" : "de";
}

export function setLang(lang) {
  const next = lang === "tr" ? "tr" : "de";
  try {
    // @ts-ignore Android WebView bridge
    globalThis.NotizAndroid?.setAppSetting?.(LANG_KEY, next);
  } catch {
    // ignore
  }
  try {
    localStorage.setItem(LANG_KEY, next);
  } catch {
    // ignore
  }
  document.documentElement.lang = next;
  applyI18n();
}

export function t(key, vars = {}) {
  const table = dict[getLang()] || dict.de;
  const fallback = dict.de[key] || key;
  return String(table[key] || fallback).replace(/\{(\w+)\}/g, (_, name) => vars[name] ?? "");
}

export function applyI18n(root = document) {
  document.documentElement.lang = getLang();
  root.querySelectorAll("[data-i18n]").forEach((el) => {
    el.textContent = t(el.getAttribute("data-i18n"));
  });
  root.querySelectorAll("[data-i18n-title]").forEach((el) => {
    const value = t(el.getAttribute("data-i18n-title"));
    el.setAttribute("title", value);
    el.setAttribute("aria-label", value);
  });
  root.querySelectorAll("[data-i18n-aria]").forEach((el) => {
    el.setAttribute("aria-label", t(el.getAttribute("data-i18n-aria")));
  });
  root.querySelectorAll("[data-i18n-placeholder]").forEach((el) => {
    el.setAttribute("placeholder", t(el.getAttribute("data-i18n-placeholder")));
  });
  root.querySelectorAll("[data-i18n-data-placeholder]").forEach((el) => {
    el.setAttribute("data-placeholder", t(el.getAttribute("data-i18n-data-placeholder")));
  });
}

export function initLanguageSwitcher(onChange) {
  const select = document.querySelector("#langSelect");
  const flag = document.querySelector("#langFlag");
  if (!(select instanceof HTMLSelectElement) || !(flag instanceof HTMLImageElement)) return;

  const sync = () => {
    const lang = getLang();
    select.value = lang;
    flag.src = lang === "tr" ? "./flags/flagtr.png" : "./flags/flagde.png";
    flag.alt = lang === "tr" ? "Türkçe" : "Deutsch";
  };

  sync();
  select.addEventListener("change", () => {
    setLang(select.value);
    sync();
    onChange?.();
  });
}
