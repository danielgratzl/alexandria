// OpenLibrary 3-letter codes to ISO 639-1 2-letter codes
const threeToTwo: Record<string, string> = {
  eng: "en", ger: "de", fre: "fr", spa: "es", ita: "it", por: "pt", rus: "ru",
  jpn: "ja", zho: "zh", chi: "zh", kor: "ko", ara: "ar", hin: "hi", tur: "tr",
  pol: "pl", nld: "nl", dut: "nl", swe: "sv", nor: "no", dan: "da", fin: "fi",
  ces: "cs", cze: "cs", hun: "hu", ron: "ro", rum: "ro", bul: "bg", hrv: "hr",
  srp: "sr", slk: "sk", slo: "sk", slv: "sl", ukr: "uk", cat: "ca", ell: "el",
  gre: "el", heb: "he", tha: "th", vie: "vi", ind: "id", msa: "ms", may: "ms",
  lat: "la", gle: "ga", cym: "cy", wel: "cy", eus: "eu", baq: "eu", glg: "gl",
  isl: "is", ice: "is", lit: "lt", lav: "lv", est: "et", fas: "fa", per: "fa",
  urd: "ur", ben: "bn", tam: "ta", tel: "te", mar: "mr", guj: "gu", kan: "kn",
  mal: "ml", pan: "pa", afr: "af", swa: "sw", amh: "am", nep: "ne", sin: "si",
  mya: "my", bur: "my", khm: "km", lao: "lo", kat: "ka", geo: "ka", hye: "hy",
  arm: "hy", aze: "az", uzb: "uz", kaz: "kk", mon: "mn", tgl: "tl", fil: "tl",
  epo: "eo", san: "sa",
};

// ISO 639-1 2-letter codes to display names
const twoToName: Record<string, string> = {
  en: "English", de: "German", fr: "French", es: "Spanish", it: "Italian",
  pt: "Portuguese", ru: "Russian", ja: "Japanese", zh: "Chinese", ko: "Korean",
  ar: "Arabic", hi: "Hindi", tr: "Turkish", pl: "Polish", nl: "Dutch",
  sv: "Swedish", no: "Norwegian", da: "Danish", fi: "Finnish", cs: "Czech",
  hu: "Hungarian", ro: "Romanian", bg: "Bulgarian", hr: "Croatian", sr: "Serbian",
  sk: "Slovak", sl: "Slovenian", uk: "Ukrainian", ca: "Catalan", el: "Greek",
  he: "Hebrew", th: "Thai", vi: "Vietnamese", id: "Indonesian", ms: "Malay",
  la: "Latin", ga: "Irish", cy: "Welsh", eu: "Basque", gl: "Galician",
  is: "Icelandic", lt: "Lithuanian", lv: "Latvian", et: "Estonian", fa: "Persian",
  ur: "Urdu", bn: "Bengali", ta: "Tamil", te: "Telugu", mr: "Marathi",
  gu: "Gujarati", kn: "Kannada", ml: "Malayalam", pa: "Punjabi", af: "Afrikaans",
  sw: "Swahili", am: "Amharic", ne: "Nepali", si: "Sinhala", my: "Burmese",
  km: "Khmer", lo: "Lao", ka: "Georgian", hy: "Armenian", az: "Azerbaijani",
  uz: "Uzbek", kk: "Kazakh", mn: "Mongolian", tl: "Filipino", eo: "Esperanto",
  sa: "Sanskrit",
};

/** All languages sorted by name, for dropdowns */
export const languageOptions: { code: string; name: string }[] =
  Object.entries(twoToName)
    .map(([code, name]) => ({ code, name }))
    .sort((a, b) => a.name.localeCompare(b.name));

/** Normalize a language code: convert 3-letter to 2-letter if needed */
export function normalizeLanguageCode(code: string | undefined | null): string | undefined {
  if (!code) return undefined;
  const lower = code.toLowerCase().trim();
  if (lower.length === 3 && threeToTwo[lower]) return threeToTwo[lower];
  if (lower.length === 2) return lower;
  // Unknown 3-letter code — try returning first 2 chars as fallback
  if (lower.length === 3) return lower.slice(0, 2);
  return lower;
}

/** Get display name for a 2-letter language code */
export function languageDisplayName(code: string | null | undefined): string {
  if (!code) return "";
  return twoToName[code.toLowerCase()] ?? code;
}
