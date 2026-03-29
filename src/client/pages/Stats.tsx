import { useQuery } from "@tanstack/react-query";
import { api, authorPhotoUrl } from "@/lib/api";
import { languageDisplayName } from "@shared/languages";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { BookOpen, Users, MapPin, Clock, FileText, TrendingUp } from "lucide-react";

function StatCard({ label, value, icon: Icon }: { label: string; value: string | number; icon: typeof BookOpen }) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted">
          <Icon className="h-5 w-5 text-muted-foreground" />
        </div>
        <div>
          <p className="text-2xl font-bold">{value}</p>
          <p className="text-xs text-muted-foreground">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function BarRow({ label, count, max }: { label: string; count: number; max: number }) {
  const pct = max > 0 ? (count / max) * 100 : 0;
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-sm">
        <span className="truncate">{label}</span>
        <span className="shrink-0 text-muted-foreground">{count}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h < 24) return m > 0 ? `${h}h ${m}m` : `${h}h`;
  const d = Math.floor(h / 24);
  const rh = h % 24;
  return rh > 0 ? `${d}d ${rh}h` : `${d}d`;
}

export function Stats() {
  const { data, isLoading } = useQuery({
    queryKey: ["stats"],
    queryFn: () => api.stats(),
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Statistics</h1>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  if (!data) return null;

  const maxFormat = Math.max(...data.byFormat.map((r) => r.count), 1);
  const maxStatus = Math.max(...data.byStatus.map((r) => r.count), 1);
  const maxCategory = Math.max(...data.byCategory.map((r) => r.count), 1);
  const maxLocation = Math.max(...data.byLocation.map((r) => r.count), 1);
  const maxAuthor = Math.max(...data.topAuthors.map((r) => r.count), 1);
  const maxLanguage = Math.max(...data.byLanguage.map((r) => r.count), 1);

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold">Statistics</h1>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard label="Books" value={data.totals.books} icon={BookOpen} />
        <StatCard label="Authors" value={data.totals.authors} icon={Users} />
        <StatCard label="Locations" value={data.totals.locations} icon={MapPin} />
        <StatCard label="Total Pages" value={data.totals.pages.toLocaleString()} icon={FileText} />
        <StatCard label="Listening Time" value={data.totals.minutes > 0 ? formatDuration(data.totals.minutes) : "0m"} icon={Clock} />
        <StatCard label="Added (30 days)" value={data.recentlyAdded} icon={TrendingUp} />
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">By Format</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {data.byFormat.map((r) => (
              <BarRow key={r.format} label={r.format} count={r.count} max={maxFormat} />
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Read Status</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {data.byStatus.map((r) => (
              <BarRow key={r.status} label={r.status} count={r.count} max={maxStatus} />
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Fiction vs Non-Fiction</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {data.byCategory.map((r) => (
              <BarRow key={r.category} label={r.category} count={r.count} max={maxCategory} />
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">By Location</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {data.byLocation.map((r) => (
              <BarRow key={r.location} label={r.location} count={r.count} max={maxLocation} />
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Top Authors</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.topAuthors.map((r) => (
              <div key={r.name} className="flex items-center gap-2">
                {authorPhotoUrl(r.photoUrl) ? (
                  <img src={authorPhotoUrl(r.photoUrl)!} alt={r.name} className="h-6 w-6 shrink-0 rounded-full object-cover" />
                ) : (
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted">
                    <Users className="h-3 w-3 text-muted-foreground" />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <BarRow label={r.name} count={r.count} max={maxAuthor} />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">By Language</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {data.byLanguage.map((r) => (
              <BarRow key={r.language} label={languageDisplayName(r.language)} count={r.count} max={maxLanguage} />
            ))}
          </CardContent>
        </Card>

        {data.topSeries.length > 0 && (
          <Card className="sm:col-span-2">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Top Series</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-2 sm:grid-cols-2">
              {data.topSeries.map((r) => (
                <BarRow key={r.name} label={r.name} count={r.count} max={data.topSeries[0].count} />
              ))}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
