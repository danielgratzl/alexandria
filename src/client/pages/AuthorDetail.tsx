import { useRef, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, bookCoverUrl, authorPhotoUrl } from "@/lib/api";
import type { AuthorDetail as AuthorDetailType } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { ArrowLeft, BookOpen, Headphones, Tablet, Pencil, Trash2, Upload, User } from "lucide-react";

const formatIcons: Record<string, typeof BookOpen> = {
  book: BookOpen,
  ebook: Tablet,
  audiobook: Headphones,
};

export function AuthorDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);

  const { data: author, isLoading } = useQuery<AuthorDetailType>({
    queryKey: ["author", id],
    queryFn: () => api.authors.get(id!),
    enabled: !!id,
  });

  const deleteMutation = useMutation({
    mutationFn: () => api.authors.delete(id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["authors"] });
      queryClient.invalidateQueries({ queryKey: ["books"] });
      toast.success("Author deleted");
      navigate("/authors");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (!author) {
    return (
      <div className="py-12 text-center">
        <p className="text-muted-foreground">Author not found</p>
        <Button variant="link" asChild>
          <Link to="/authors">Back to authors</Link>
        </Button>
      </div>
    );
  }

  const photoSrc = authorPhotoUrl(author.photoUrl);

  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" asChild>
        <Link to="/authors">
          <ArrowLeft className="mr-1 h-4 w-4" />
          Authors
        </Link>
      </Button>

      <div className="flex items-start gap-4">
        {photoSrc ? (
          <img src={photoSrc} alt={author.name} className="h-20 w-20 shrink-0 rounded-full object-cover" />
        ) : (
          <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full bg-muted">
            <User className="h-10 w-10 text-muted-foreground" />
          </div>
        )}
        <div className="flex-1">
          <h1 className="text-2xl font-bold">{author.name}</h1>
          <p className="text-muted-foreground">
            {author.books.length} {author.books.length === 1 ? "book" : "books"}
          </p>
          <div className="mt-2 flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
              <Pencil className="mr-1 h-4 w-4" />
              Edit
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="text-destructive"
              onClick={() => deleteMutation.mutate()}
              disabled={deleteMutation.isPending}
            >
              <Trash2 className="mr-1 h-4 w-4" />
              {deleteMutation.isPending ? "Deleting..." : "Delete"}
            </Button>
          </div>
        </div>
      </div>

      {author.books.length > 0 && (
        <div className="space-y-1">
          <h2 className="mb-2 text-lg font-semibold">Books</h2>
          {author.books.map((book) => {
            const FormatIcon = formatIcons[book.format] ?? BookOpen;
            return (
              <Link
                key={book.id}
                to={`/books/${book.id}`}
                className="flex items-center gap-3 rounded-lg border px-3 py-2 transition-colors hover:bg-accent/50"
              >
                {bookCoverUrl(book.coverUrl) ? (
                  <img
                    src={bookCoverUrl(book.coverUrl)!}
                    alt={book.title}
                    className="h-10 w-7 shrink-0 rounded object-cover"
                  />
                ) : (
                  <div className="flex h-10 w-7 shrink-0 items-center justify-center rounded bg-muted">
                    <FormatIcon className="h-4 w-4 text-muted-foreground" />
                  </div>
                )}
                <p className="min-w-0 flex-1 truncate text-sm font-medium">
                  {book.title}
                  {book.subtitle && <span className="font-normal text-muted-foreground">: {book.subtitle}</span>}
                </p>
                <Badge variant="outline" className="shrink-0 text-xs">{book.format}</Badge>
                <Badge variant="secondary" className="shrink-0 text-xs">{book.readStatus}</Badge>
              </Link>
            );
          })}
        </div>
      )}

      {editing && (
        <EditAuthorDialog
          author={author}
          open={true}
          onOpenChange={(open) => { if (!open) setEditing(false); }}
        />
      )}
    </div>
  );
}

function EditAuthorDialog({
  author,
  open,
  onOpenChange,
}: {
  author: AuthorDetailType;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const [name, setName] = useState(author.name);
  const [photoFilename, setPhotoFilename] = useState(author.photoUrl ?? "");
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const updateMutation = useMutation({
    mutationFn: () => api.authors.update(author.id, { name, photoUrl: photoFilename || null }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["authors"] });
      queryClient.invalidateQueries({ queryKey: ["author", author.id] });
      queryClient.invalidateQueries({ queryKey: ["books"] });
      toast.success("Author updated");
      onOpenChange(false);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoPreview(URL.createObjectURL(file));
    setUploading(true);
    try {
      const filename = await api.covers.upload("authors", file);
      setPhotoFilename(filename);
    } catch {
      setPhotoPreview(null);
    } finally {
      setUploading(false);
    }
  }

  function removePhoto() {
    setPhotoFilename("");
    setPhotoPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  const displaySrc = photoPreview ?? authorPhotoUrl(photoFilename || null);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Author</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            {displaySrc ? (
              <img src={displaySrc} alt={name} className="h-20 w-20 rounded-full object-cover" />
            ) : (
              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-muted">
                <User className="h-10 w-10 text-muted-foreground" />
              </div>
            )}
            <div className="flex flex-col gap-2">
              <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
              <Button type="button" variant="outline" size="sm" disabled={uploading} onClick={() => fileInputRef.current?.click()}>
                <Upload className="mr-1 h-3 w-3" />
                {uploading ? "Uploading..." : "Upload Photo"}
              </Button>
              {photoFilename && (
                <Button type="button" variant="ghost" size="sm" onClick={removePhoto}>
                  <Trash2 className="mr-1 h-3 w-3" />
                  Remove
                </Button>
              )}
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="authorName">Name</Label>
            <Input id="authorName" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button onClick={() => updateMutation.mutate()} disabled={updateMutation.isPending || uploading || !name.trim()}>
              {updateMutation.isPending ? "Saving..." : "Save"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
