import { useEffect, useRef, useState } from "react";
import { api, bookCoverUrl as coverSrc } from "@/lib/api";
import type { BookInput } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { X, Plus, Upload, Trash2 } from "lucide-react";
import { languageOptions } from "@shared/languages";

interface BookFormProps {
  initialData?: Partial<BookInput>;
  onSubmit: (data: BookInput) => void;
  submitLabel?: string;
  loading?: boolean;
}

export function BookForm({
  initialData,
  onSubmit,
  submitLabel = "Save",
  loading,
}: BookFormProps) {
  const [title, setTitle] = useState(initialData?.title ?? "");
  const [subtitle, setSubtitle] = useState(initialData?.subtitle ?? "");
  const [isbn10, setIsbn10] = useState(initialData?.isbn10 ?? "");
  const [isbn13, setIsbn13] = useState(initialData?.isbn13 ?? "");
  const [language, setLanguage] = useState(initialData?.language ?? "en");
  const [pageCount, setPageCount] = useState(initialData?.pageCount?.toString() ?? "");
  const [durationMinutes, setDurationMinutes] = useState(initialData?.durationMinutes?.toString() ?? "");
  const [format, setFormat] = useState<"book" | "ebook" | "audiobook">(initialData?.format ?? "book");
  const [seriesName, setSeriesName] = useState(initialData?.seriesName ?? "");
  const [seriesPosition, setSeriesPosition] = useState(initialData?.seriesPosition?.toString() ?? "");
  const [coverFilename, setCoverFilename] = useState(initialData?.coverUrl ?? "");
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [location, setLocation] = useState(initialData?.location ?? "");
  const [existingLocations, setExistingLocations] = useState<string[]>([]);
  const [notes, setNotes] = useState(initialData?.notes ?? "");
  const [category, setCategory] = useState(initialData?.category ?? "");
  const [readStatus, setReadStatus] = useState<"unread" | "reading" | "read">(initialData?.readStatus ?? "unread");
  const [authors, setAuthors] = useState<string[]>(
    initialData?.authors?.map((a) => a.name) ?? [""],
  );
  const [authorMeta] = useState(() => {
    const map = new Map<string, { openlibraryKey?: string; photoUrl?: string }>();
    for (const a of initialData?.authors ?? []) {
      const meta: Record<string, string> = {};
      if ("openlibraryKey" in a && a.openlibraryKey) meta.openlibraryKey = a.openlibraryKey;
      if ("photoUrl" in a && (a as { photoUrl?: string }).photoUrl) meta.photoUrl = (a as { photoUrl?: string }).photoUrl!;
      if (Object.keys(meta).length > 0) map.set(a.name, meta);
    }
    return map;
  });
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    api.locations.list().then((locs) => setExistingLocations(locs.map((l) => l.name)));
  }, []);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onSubmit({
      title,
      subtitle: subtitle || null,
      isbn10: isbn10 || null,
      isbn13: isbn13 || null,
      language,
      pageCount: pageCount ? Number(pageCount) : null,
      durationMinutes: durationMinutes ? Number(durationMinutes) : null,
      format,
      seriesName: seriesName || null,
      seriesPosition: seriesPosition ? Number(seriesPosition) : null,
      coverUrl: coverFilename || null,
      notes: notes || null,
      category: category as "fiction" | "non-fiction" || null,
      readStatus,
      openlibraryKey: initialData?.openlibraryKey,
      location: location || null,
      authors: authors.filter(Boolean).map((name) => ({ name, ...authorMeta.get(name) })),
    });
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setCoverPreview(URL.createObjectURL(file));
    setUploading(true);
    try {
      const filename = await api.covers.upload("books", file);
      setCoverFilename(filename);
    } catch {
      setCoverPreview(null);
    } finally {
      setUploading(false);
    }
  }

  function removeCover() {
    setCoverFilename("");
    setCoverPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  const displayCoverSrc = coverPreview
    ?? (coverFilename?.startsWith("http") ? coverFilename : coverSrc(coverFilename || null));

  function addAuthor() {
    setAuthors([...authors, ""]);
  }

  function removeAuthor(index: number) {
    setAuthors(authors.filter((_, i) => i !== index));
  }

  function updateAuthor(index: number, value: string) {
    const next = [...authors];
    next[index] = value;
    setAuthors(next);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="title">Title *</Label>
          <Input
            id="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
          />
        </div>

        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="subtitle">Subtitle</Label>
          <Input
            id="subtitle"
            value={subtitle}
            onChange={(e) => setSubtitle(e.target.value)}
          />
        </div>

        <div className="space-y-2 sm:col-span-2">
          <Label>Authors</Label>
          {authors.map((author, i) => (
            <div key={i} className="flex gap-2">
              <Input
                value={author}
                onChange={(e) => updateAuthor(i, e.target.value)}
                placeholder="Author name"
              />
              {authors.length > 1 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => removeAuthor(i)}
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          ))}
          <Button type="button" variant="outline" size="sm" onClick={addAuthor}>
            <Plus className="mr-1 h-3 w-3" />
            Add Author
          </Button>
        </div>

        <div className="space-y-2">
          <Label htmlFor="isbn13">ISBN-13</Label>
          <Input
            id="isbn13"
            value={isbn13}
            onChange={(e) => setIsbn13(e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="isbn10">ISBN-10</Label>
          <Input
            id="isbn10"
            value={isbn10}
            onChange={(e) => setIsbn10(e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="format">Format</Label>
          <Select value={format} onValueChange={(v) => setFormat(v as typeof format)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="book">Book</SelectItem>
              <SelectItem value="ebook">E-Book</SelectItem>
              <SelectItem value="audiobook">Audiobook</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="readStatus">Status</Label>
          <Select
            value={readStatus}
            onValueChange={(v) => setReadStatus(v as typeof readStatus)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="unread">Unread</SelectItem>
              <SelectItem value="reading">Reading</SelectItem>
              <SelectItem value="read">Read</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="category">Category</Label>
          <Select value={category || "none"} onValueChange={(v) => setCategory(v === "none" ? "" : v)}>
            <SelectTrigger>
              <SelectValue placeholder="None" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">None</SelectItem>
              <SelectItem value="fiction">Fiction</SelectItem>
              <SelectItem value="non-fiction">Non-Fiction</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="language">Language</Label>
          <Select value={language} onValueChange={setLanguage}>
            <SelectTrigger>
              <SelectValue placeholder="Select language" />
            </SelectTrigger>
            <SelectContent>
              {languageOptions.map((l) => (
                <SelectItem key={l.code} value={l.code}>{l.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {format === "audiobook" ? (
          <div className="space-y-2">
            <Label htmlFor="durationMinutes">Length (minutes)</Label>
            <Input
              id="durationMinutes"
              type="number"
              value={durationMinutes}
              onChange={(e) => setDurationMinutes(e.target.value)}
            />
          </div>
        ) : (
          <div className="space-y-2">
            <Label htmlFor="pageCount">Pages</Label>
            <Input
              id="pageCount"
              type="number"
              value={pageCount}
              onChange={(e) => setPageCount(e.target.value)}
            />
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="seriesName">Series</Label>
          <Input
            id="seriesName"
            value={seriesName}
            onChange={(e) => setSeriesName(e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="seriesPosition">Series #</Label>
          <Input
            id="seriesPosition"
            type="number"
            step="0.1"
            value={seriesPosition}
            onChange={(e) => setSeriesPosition(e.target.value)}
          />
        </div>

        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="location">Location</Label>
          <Input
            id="location"
            list="location-suggestions"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="e.g. Living room, Audible, Kindle..."
          />
          <datalist id="location-suggestions">
            {existingLocations.map((name) => (
              <option key={name} value={name} />
            ))}
          </datalist>
        </div>

        <div className="space-y-2 sm:col-span-2">
          <Label>Cover</Label>
          <div className="flex items-start gap-4">
            {displayCoverSrc && (
              <img
                src={displayCoverSrc}
                alt="Cover preview"
                className="h-24 w-auto rounded object-cover"
              />
            )}
            <div className="flex flex-col gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="hidden"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={uploading}
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="mr-1 h-3 w-3" />
                {uploading ? "Uploading..." : "Upload Cover"}
              </Button>
              {coverFilename && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={removeCover}
                >
                  <Trash2 className="mr-1 h-3 w-3" />
                  Remove
                </Button>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="notes">Notes</Label>
          <Textarea
            id="notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
          />
        </div>
      </div>

      <Button type="submit" disabled={loading || uploading || !title}>
        {loading ? "Saving..." : submitLabel}
      </Button>
    </form>
  );
}
