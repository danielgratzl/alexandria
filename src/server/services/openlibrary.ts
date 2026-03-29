import { normalizeLanguageCode } from "../../shared/languages.js";

export interface OpenLibraryResult {
  title: string;
  subtitle?: string;
  authors: { name: string; openlibraryKey?: string; photoUrl?: string }[];
  isbn10?: string;
  isbn13?: string;
  language?: string;
  pageCount?: number;
  coverUrl?: string;
  seriesName?: string;
  openlibraryKey?: string;
}

const HEADERS = {
  "User-Agent": "Alexandria/0.1 (private book collection manager)",
};

async function fetchJson(url: string): Promise<unknown> {
  const res = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw new Error(`OpenLibrary API error: ${res.status}`);
  return res.json();
}

export interface OpenLibrarySearchItem {
  title: string;
  authors: string[];
  isbn?: string;
  coverUrl?: string;
  firstPublishYear?: number;
  openlibraryKey: string;
}

export async function searchByTitle(query: string): Promise<OpenLibrarySearchItem[]> {
  const url = `https://openlibrary.org/search.json?q=${encodeURIComponent(query)}&limit=10&fields=key,title,author_name,isbn,cover_i,first_publish_year`;
  let data: Record<string, unknown>;
  try {
    data = (await fetchJson(url)) as Record<string, unknown>;
  } catch {
    return [];
  }

  const docs = (data.docs as Record<string, unknown>[]) ?? [];
  return docs.map((doc) => {
    const isbns = doc.isbn as string[] | undefined;
    const coverId = doc.cover_i as number | undefined;
    return {
      title: doc.title as string,
      authors: (doc.author_name as string[] | undefined) ?? [],
      isbn: isbns?.[0],
      coverUrl: coverId ? `https://covers.openlibrary.org/b/id/${coverId}-M.jpg` : undefined,
      firstPublishYear: doc.first_publish_year as number | undefined,
      openlibraryKey: doc.key as string,
    };
  });
}

export async function lookupIsbn(isbn: string): Promise<OpenLibraryResult | null> {
  const clean = isbn.replace(/[-\s]/g, "");

  let edition: Record<string, unknown>;
  try {
    edition = (await fetchJson(`https://openlibrary.org/isbn/${clean}.json`)) as Record<string, unknown>;
  } catch {
    return null;
  }

  const title = (edition.title as string) || "Unknown Title";
  const subtitle = edition.subtitle as string | undefined;
  const pageCount = edition.number_of_pages as number | undefined;

  // Determine ISBNs
  const isbn10List = (edition.isbn_10 as string[] | undefined) ?? [];
  const isbn13List = (edition.isbn_13 as string[] | undefined) ?? [];

  // Get language
  const languages = edition.languages as { key: string }[] | undefined;
  const rawLang = languages?.[0]?.key?.replace("/languages/", "") ?? undefined;
  const language = normalizeLanguageCode(rawLang);

  // Get cover
  const coverId = edition.covers as number[] | undefined;
  const coverUrl = coverId?.[0]
    ? `https://covers.openlibrary.org/b/id/${coverId[0]}-L.jpg`
    : undefined;

  // Get work info for series
  const works = edition.works as { key: string }[] | undefined;
  const workKey = works?.[0]?.key;
  let seriesName: string | undefined;
  let openlibraryKey: string | undefined;

  if (workKey) {
    openlibraryKey = workKey;
    try {
      const work = (await fetchJson(`https://openlibrary.org${workKey}.json`)) as Record<string, unknown>;
      // Series info might be in subjects or other fields
      const series = work.series as string[] | undefined;
      seriesName = series?.[0];
    } catch {
      // Non-critical, continue without work data
    }
  }

  // Get author names
  const authorKeys = edition.authors as { key: string }[] | undefined;
  const authors: { name: string; openlibraryKey?: string; photoUrl?: string }[] = [];

  if (authorKeys) {
    for (const authorRef of authorKeys) {
      try {
        const author = (await fetchJson(`https://openlibrary.org${authorRef.key}.json`)) as Record<string, unknown>;
        const photos = author.photos as number[] | undefined;
        const photoUrl = photos?.[0]
          ? `https://covers.openlibrary.org/a/id/${photos[0]}-L.jpg`
          : undefined;
        authors.push({
          name: author.name as string,
          openlibraryKey: authorRef.key,
          photoUrl,
        });
      } catch {
        // Skip authors we can't fetch
      }
    }
  }

  return {
    title,
    subtitle,
    authors,
    isbn10: isbn10List[0],
    isbn13: isbn13List[0],
    language,
    pageCount,
    coverUrl,
    seriesName,
    openlibraryKey,
  };
}
