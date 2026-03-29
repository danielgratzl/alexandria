import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { BookInput, OpenLibraryResult, OpenLibrarySearchItem } from "@/lib/api";
import { BookForm } from "@/components/BookForm";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { BookOpen, CheckCircle, Loader2, Search, Upload, XCircle, Copy } from "lucide-react";

function looksLikeIsbn(value: string): boolean {
  const clean = value.replace(/[-\s]/g, "");
  return /^\d{10}(\d{3})?$/.test(clean);
}

function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') {
        current += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        current += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === "," || ch === ";" || ch === "\t") {
      fields.push(current.trim());
      current = "";
    } else {
      current += ch;
    }
  }
  fields.push(current.trim());
  return fields;
}

function parseCsv(text: string): { headers: string[]; rows: string[][] } {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length === 0) return { headers: [], rows: [] };
  const headers = parseCsvLine(lines[0]);
  const rows = lines.slice(1).map(parseCsvLine);
  return { headers, rows };
}

const NONE = "-1";

function detectColumn(headers: string[], patterns: RegExp[]): number {
  for (const pat of patterns) {
    const idx = headers.findIndex((h) => pat.test(h));
    if (idx >= 0) return idx;
  }
  return -1;
}

function detectIsbnColumn(headers: string[], rows: string[][]): number {
  const idx = detectColumn(headers, [/^isbn/i, /isbn/i]);
  if (idx >= 0) return idx;
  // Fallback: column with most ISBN-like values
  let bestCol = -1;
  let bestCount = 0;
  for (let col = 0; col < headers.length; col++) {
    const count = rows.filter((r) => r[col] && looksLikeIsbn(r[col])).length;
    if (count > bestCount) { bestCount = count; bestCol = col; }
  }
  return bestCol;
}

function detectColumns(headers: string[], rows: string[][]) {
  return {
    isbn: detectIsbnColumn(headers, rows),
    title: detectColumn(headers, [/^title$/i, /title/i, /^name$/i]),
    subtitle: detectColumn(headers, [/^subtitle$/i, /sub.?title/i]),
    authors: detectColumn(headers, [/^authors?$/i, /author/i, /^writer/i]),
  };
}

// ---- Import CSV Tab ----

interface ImportProgress {
  current: number;
  total: number;
  imported: number;
  duplicates: number;
  notFound: number;
  errors: number;
  lastTitle: string;
  lastStatus: string;
}

interface ImportResult {
  imported: { isbn: string; title: string; source: string }[];
  notFound: string[];
  duplicates: { isbn: string; title: string }[];
  errors: string[];
}

function ImportCsvTab() {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<string[][]>([]);
  const [colMap, setColMap] = useState<{ isbn: number; title: number; subtitle: number; authors: number }>({ isbn: -1, title: -1, subtitle: -1, authors: -1 });
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState<ImportProgress | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setResult(null);
    setProgress(null);

    const reader = new FileReader();
    reader.onload = () => {
      const text = reader.result as string;
      const { headers: h, rows: r } = parseCsv(text);
      setHeaders(h);
      setRows(r);
      setColMap(detectColumns(h, r));
    };
    reader.readAsText(file);
  }

  function buildImportRows() {
    return rows
      .map((row) => ({
        isbn: colMap.isbn >= 0 ? row[colMap.isbn]?.trim() : undefined,
        title: colMap.title >= 0 ? row[colMap.title]?.trim() : undefined,
        subtitle: colMap.subtitle >= 0 ? row[colMap.subtitle]?.trim() : undefined,
        authors: colMap.authors >= 0 ? row[colMap.authors]?.trim() : undefined,
      }))
      .filter((r) => r.isbn || r.title);
  }

  const importRows = headers.length > 0 ? buildImportRows() : [];
  const isbnCount = importRows.filter((r) => r.isbn && looksLikeIsbn(r.isbn)).length;

  async function handleImport() {
    if (importRows.length === 0) return;
    setImporting(true);
    setResult(null);
    setProgress({ current: 0, total: importRows.length, imported: 0, duplicates: 0, notFound: 0, errors: 0, lastTitle: "", lastStatus: "" });

    try {
      const res = await fetch(api.import.url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows: importRows }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(err.error || "Import failed");
      }

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let counts = { imported: 0, duplicates: 0, notFound: 0, errors: 0 };

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split("\n\n");
        buffer = parts.pop() || "";

        for (const part of parts) {
          const lines = part.trim().split("\n");
          let event = "";
          let data = "";
          for (const line of lines) {
            if (line.startsWith("event:")) event = line.slice(6).trim();
            else if (line.startsWith("data:")) data = line.slice(5).trim();
          }
          if (!data) continue;

          try {
            const parsed = JSON.parse(data);

            if (event === "progress") {
              if (parsed.status === "imported") counts.imported++;
              else if (parsed.status === "duplicate") counts.duplicates++;
              else if (parsed.status === "not_found") counts.notFound++;
              else if (parsed.status === "error") counts.errors++;

              setProgress({
                current: parsed.current,
                total: parsed.total,
                ...counts,
                lastTitle: parsed.title || parsed.isbn || "",
                lastStatus: parsed.status,
              });
            } else if (event === "done") {
              setResult(parsed);
              queryClient.invalidateQueries({ queryKey: ["books"] });
              queryClient.invalidateQueries({ queryKey: ["authors"] });
              if (parsed.imported.length > 0) {
                toast.success(`${parsed.imported.length} book${parsed.imported.length > 1 ? "s" : ""} imported`);
              }
            }
          } catch {
            // skip unparseable chunks
          }
        }
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Import failed");
    } finally {
      setImporting(false);
    }
  }

  function reset() {
    setHeaders([]);
    setRows([]);
    setColMap({ isbn: -1, title: -1, subtitle: -1, authors: -1 });
    setResult(null);
    setProgress(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function colSelect(label: string, field: keyof typeof colMap) {
    return (
      <div className="space-y-1">
        <Label className="text-xs">{label}</Label>
        <Select
          value={colMap[field] >= 0 ? String(colMap[field]) : NONE}
          onValueChange={(v) => setColMap((prev) => ({ ...prev, [field]: v === NONE ? -1 : Number(v) }))}
        >
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NONE}>-- none --</SelectItem>
            {headers.map((h, i) => (
              <SelectItem key={i} value={String(i)}>
                {h || `Column ${i + 1}`}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {!result ? (
        <>
          <div className="space-y-2">
            <Label>CSV File</Label>
            <Input
              ref={fileInputRef}
              type="file"
              accept=".csv,.tsv,.txt"
              onChange={handleFileChange}
            />
          </div>

          {headers.length > 0 && (
            <>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {colSelect("ISBN", "isbn")}
                {colSelect("Title", "title")}
                {colSelect("Subtitle", "subtitle")}
                {colSelect("Authors", "authors")}
              </div>

              <div className="rounded-lg border p-3 text-sm">
                <p className="font-medium">
                  {importRows.length} row{importRows.length !== 1 ? "s" : ""} to import
                  {isbnCount > 0 && ` (${isbnCount} with ISBN)`}
                </p>
                <p className="mt-1 text-muted-foreground">
                  Books with ISBN will be looked up on OpenLibrary. Others will be imported from CSV data.
                </p>
              </div>

              {!importing && (
                <Button
                  onClick={handleImport}
                  disabled={importRows.length === 0}
                >
                  <Upload className="mr-1 h-4 w-4" />
                  Import {importRows.length} book{importRows.length !== 1 ? "s" : ""}
                </Button>
              )}

              {importing && progress && (
                <div className="space-y-3 rounded-lg border p-4">
                  <div className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span>
                        {progress.current} / {progress.total}
                      </span>
                      <span className="text-muted-foreground">
                        {Math.round((progress.current / progress.total) * 100)}%
                      </span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-primary transition-all"
                        style={{ width: `${(progress.current / progress.total) * 100}%` }}
                      />
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
                    <span className="text-green-600">{progress.imported} imported</span>
                    <span className="text-yellow-600">{progress.duplicates} duplicates</span>
                    <span className="text-red-500">{progress.notFound} not found</span>
                    {progress.errors > 0 && <span className="text-destructive">{progress.errors} errors</span>}
                  </div>
                  {progress.lastTitle && (
                    <p className="truncate text-xs text-muted-foreground">
                      {progress.lastStatus === "imported" ? "Imported" : progress.lastStatus === "duplicate" ? "Duplicate" : "Processed"}: {progress.lastTitle}
                    </p>
                  )}
                </div>
              )}
            </>
          )}
        </>
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-3">
            <Card className="flex-1">
              <CardContent className="flex items-center gap-2 p-3">
                <CheckCircle className="h-5 w-5 text-green-600" />
                <div>
                  <p className="text-lg font-semibold">{result.imported.length}</p>
                  <p className="text-xs text-muted-foreground">Imported</p>
                </div>
              </CardContent>
            </Card>
            <Card className="flex-1">
              <CardContent className="flex items-center gap-2 p-3">
                <XCircle className="h-5 w-5 text-red-500" />
                <div>
                  <p className="text-lg font-semibold">{result.notFound.length}</p>
                  <p className="text-xs text-muted-foreground">Not Found</p>
                </div>
              </CardContent>
            </Card>
            <Card className="flex-1">
              <CardContent className="flex items-center gap-2 p-3">
                <Copy className="h-5 w-5 text-yellow-500" />
                <div>
                  <p className="text-lg font-semibold">{result.duplicates.length}</p>
                  <p className="text-xs text-muted-foreground">Duplicates</p>
                </div>
              </CardContent>
            </Card>
          </div>

          {result.imported.length > 0 && (
            <div>
              <h3 className="mb-1 text-sm font-medium">Imported</h3>
              <div className="space-y-1">
                {result.imported.map((b, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm">
                    {b.isbn && <Badge variant="outline" className="shrink-0 text-xs">{b.isbn}</Badge>}
                    <span className="truncate">{b.title}</span>
                    <Badge variant="secondary" className="shrink-0 text-xs">{b.source === "openlibrary" ? "OpenLibrary" : "CSV"}</Badge>
                  </div>
                ))}
              </div>
            </div>
          )}

          {result.duplicates.length > 0 && (
            <div>
              <h3 className="mb-1 text-sm font-medium text-muted-foreground">Already in library</h3>
              <div className="space-y-1">
                {result.duplicates.map((b) => (
                  <div key={b.isbn} className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Badge variant="secondary" className="shrink-0 text-xs">{b.isbn}</Badge>
                    <span className="truncate">{b.title}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {result.notFound.length > 0 && (
            <div>
              <h3 className="mb-1 text-sm font-medium text-muted-foreground">Not found (no ISBN or title)</h3>
              <div className="flex flex-wrap gap-1">
                {result.notFound.map((isbn) => (
                  <Badge key={isbn} variant="secondary" className="text-xs">{isbn}</Badge>
                ))}
              </div>
            </div>
          )}

          {result.errors.length > 0 && (
            <div>
              <h3 className="mb-1 text-sm font-medium text-destructive">Errors</h3>
              <div className="space-y-1">
                {result.errors.map((err, i) => (
                  <p key={i} className="text-xs text-muted-foreground">{err}</p>
                ))}
              </div>
            </div>
          )}

          <Button variant="outline" onClick={reset}>
            Import another file
          </Button>
        </div>
      )}
    </div>
  );
}

// ---- Main AddBook Page ----

export function AddBook() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [query, setQuery] = useState("");
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupResult, setLookupResult] = useState<OpenLibraryResult | null>(null);
  const [searchResults, setSearchResults] = useState<OpenLibrarySearchItem[]>([]);
  const [lookupError, setLookupError] = useState("");
  const [selectedIsbnLoading, setSelectedIsbnLoading] = useState(false);

  const createMutation = useMutation({
    mutationFn: (data: BookInput) => api.books.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["books"] });
      toast.success("Book added to your library");
      navigate("/");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  async function handleLookup(e: React.FormEvent) {
    e.preventDefault();
    const q = query.trim();
    if (!q) return;

    setLookupLoading(true);
    setLookupError("");
    setLookupResult(null);
    setSearchResults([]);

    try {
      if (looksLikeIsbn(q)) {
        const result = await api.lookup.isbn(q);
        setLookupResult(result);
      } else {
        const results = await api.lookup.search(q);
        if (results.length === 0) {
          setLookupError("No books found. Try a different search term.");
        } else {
          setSearchResults(results);
        }
      }
    } catch {
      setLookupError("No results found. Try a different search term or ISBN.");
    } finally {
      setLookupLoading(false);
    }
  }

  async function handleSelectSearchResult(item: OpenLibrarySearchItem) {
    if (item.isbn) {
      setSelectedIsbnLoading(true);
      try {
        const result = await api.lookup.isbn(item.isbn);
        setLookupResult(result);
        setSearchResults([]);
      } catch {
        toast.error("Could not load full details for this book.");
      } finally {
        setSelectedIsbnLoading(false);
      }
    } else {
      setLookupResult({
        title: item.title,
        authors: item.authors.map((name) => ({ name })),
        coverUrl: item.coverUrl,
        openlibraryKey: item.openlibraryKey,
      });
      setSearchResults([]);
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Add Book</h1>

      <Tabs defaultValue="lookup">
        <TabsList>
          <TabsTrigger value="lookup">Search OpenLibrary</TabsTrigger>
          <TabsTrigger value="manual">Manual Entry</TabsTrigger>
          <TabsTrigger value="import">Import CSV</TabsTrigger>
        </TabsList>

        <TabsContent value="lookup" className="space-y-4">
          <form onSubmit={handleLookup} className="flex gap-2">
            <div className="flex-1">
              <Label htmlFor="query" className="sr-only">
                Search
              </Label>
              <Input
                id="query"
                placeholder="Search by title or ISBN..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
            <Button type="submit" disabled={lookupLoading || !query.trim()}>
              {lookupLoading ? (
                <Loader2 className="mr-1 h-4 w-4 animate-spin" />
              ) : (
                <Search className="mr-1 h-4 w-4" />
              )}
              Search
            </Button>
          </form>

          {lookupError && (
            <p className="text-sm text-destructive">{lookupError}</p>
          )}

          {searchResults.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">
                {searchResults.length} results found. Select a book to import.
              </p>
              {searchResults.map((item, i) => (
                <button
                  key={i}
                  type="button"
                  disabled={selectedIsbnLoading}
                  className="flex w-full items-center gap-3 rounded-lg border p-3 text-left transition-colors hover:bg-accent/50 disabled:opacity-50"
                  onClick={() => handleSelectSearchResult(item)}
                >
                  {item.coverUrl ? (
                    <img
                      src={item.coverUrl}
                      alt={item.title}
                      className="h-16 w-11 shrink-0 rounded object-cover"
                    />
                  ) : (
                    <div className="flex h-16 w-11 shrink-0 items-center justify-center rounded bg-muted">
                      <BookOpen className="h-5 w-5 text-muted-foreground" />
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="truncate font-medium">{item.title}</p>
                    {item.authors.length > 0 && (
                      <p className="truncate text-sm text-muted-foreground">
                        {item.authors.join(", ")}
                      </p>
                    )}
                    {item.firstPublishYear && (
                      <p className="text-xs text-muted-foreground">
                        {item.firstPublishYear}
                      </p>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}

          {lookupResult && (
            <Card>
              <CardContent className="p-4">
                <div className="mb-4 flex flex-col items-center gap-4 sm:flex-row sm:items-start">
                  {lookupResult.coverUrl && (
                    <img
                      src={lookupResult.coverUrl}
                      alt={lookupResult.title}
                      className="h-24 w-auto rounded sm:h-32"
                    />
                  )}
                  <div>
                    <h3 className="font-medium">{lookupResult.title}</h3>
                    {lookupResult.authors.length > 0 && (
                      <p className="text-sm text-muted-foreground">
                        {lookupResult.authors.map((a) => a.name).join(", ")}
                      </p>
                    )}
                    <p className="mt-1 text-xs text-muted-foreground">
                      Review and edit the details below, then save.
                    </p>
                  </div>
                </div>
                <BookForm
                  key={lookupResult.openlibraryKey ?? lookupResult.title}
                  initialData={{
                    title: lookupResult.title,
                    subtitle: lookupResult.subtitle,
                    isbn10: lookupResult.isbn10,
                    isbn13: lookupResult.isbn13,
                    language: lookupResult.language,
                    pageCount: lookupResult.pageCount,
                    coverUrl: lookupResult.coverUrl,
                    seriesName: lookupResult.seriesName,
                    openlibraryKey: lookupResult.openlibraryKey,
                    authors: lookupResult.authors,
                  }}
                  onSubmit={(data) => createMutation.mutate(data)}
                  submitLabel="Add to Library"
                  loading={createMutation.isPending}
                />
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="manual">
          <BookForm
            onSubmit={(data) => createMutation.mutate(data)}
            submitLabel="Add to Library"
            loading={createMutation.isPending}
          />
        </TabsContent>

        <TabsContent value="import">
          <ImportCsvTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
