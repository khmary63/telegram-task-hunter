import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Star, ExternalLink, Download, Eye, EyeOff, Loader2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/leads")({
  head: () => ({ meta: [{ title: "Лиды — TG Lead Parser" }] }),
  component: LeadsPage,
});

type Lead = {
  id: string;
  chat_username: string | null;
  chat_title: string | null;
  message_link: string | null;
  author_username: string | null;
  author_display_name: string | null;
  message_text: string;
  matched_phrase: string | null;
  matched_niche_id: string | null;
  posted_at: string;
  found_at: string;
  is_read: boolean;
  is_starred: boolean;
};
type Niche = { id: string; name: string };

function LeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [niches, setNiches] = useState<Niche[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [nicheFilter, setNicheFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");

  const load = async () => {
    setLoading(true);
    let q = supabase.from("leads").select("*").order("posted_at", { ascending: false }).limit(500);
    if (dateFrom) q = q.gte("posted_at", new Date(dateFrom).toISOString());
    if (dateTo) q = q.lte("posted_at", new Date(dateTo + "T23:59:59").toISOString());
    if (nicheFilter !== "all") q = q.eq("matched_niche_id", nicheFilter);
    if (statusFilter === "unread") q = q.eq("is_read", false);
    if (statusFilter === "starred") q = q.eq("is_starred", true);
    const { data, error } = await q;
    if (error) toast.error(error.message);
    else setLeads((data as Lead[]) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    supabase.from("niches").select("id,name").order("name").then(({ data }) => setNiches((data as Niche[]) ?? []));
  }, []);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateFrom, dateTo, nicheFilter, statusFilter]);

  useEffect(() => {
    const ch = supabase
      .channel("leads-stream")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "leads" }, (payload) => {
        setLeads((prev) => [payload.new as Lead, ...prev].slice(0, 500));
        toast.success("Новый лид");
      })
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, []);

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    if (!s) return leads;
    return leads.filter(
      (l) =>
        l.message_text.toLowerCase().includes(s) ||
        l.author_username?.toLowerCase().includes(s) ||
        l.chat_username?.toLowerCase().includes(s) ||
        l.matched_phrase?.toLowerCase().includes(s),
    );
  }, [leads, search]);

  const nicheName = (id: string | null) => niches.find((n) => n.id === id)?.name ?? "—";

  const toggle = async (lead: Lead, field: "is_read" | "is_starred") => {
    const next = !lead[field];
    setLeads((prev) => prev.map((l) => (l.id === lead.id ? { ...l, [field]: next } : l)));
    const patch = field === "is_read" ? { is_read: next } : { is_starred: next };
    await supabase.from("leads").update(patch).eq("id", lead.id);
  };

  const exportCsv = () => {
    const rows = [
      ["posted_at", "chat", "author", "niche", "matched", "text", "link"],
      ...filtered.map((l) => [
        l.posted_at,
        l.chat_username ?? "",
        l.author_username ?? "",
        nicheName(l.matched_niche_id),
        l.matched_phrase ?? "",
        l.message_text.replace(/\n/g, " "),
        l.message_link ?? "",
      ]),
    ];
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `leads-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-2">
        <div className="space-y-1">
          <div className="text-xs text-muted-foreground">Поиск</div>
          <Input placeholder="Текст, ник, чат…" value={search} onChange={(e) => setSearch(e.target.value)} className="w-64" />
        </div>
        <div className="space-y-1">
          <div className="text-xs text-muted-foreground">Ниша</div>
          <Select value={nicheFilter} onValueChange={setNicheFilter}>
            <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Все ниши</SelectItem>
              {niches.map((n) => <SelectItem key={n.id} value={n.id}>{n.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <div className="text-xs text-muted-foreground">Статус</div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Все</SelectItem>
              <SelectItem value="unread">Непрочитанные</SelectItem>
              <SelectItem value="starred">В избранном</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <div className="text-xs text-muted-foreground">С даты</div>
          <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="w-40" />
        </div>
        <div className="space-y-1">
          <div className="text-xs text-muted-foreground">По дату</div>
          <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="w-40" />
        </div>
        <Button variant="outline" onClick={exportCsv} disabled={!filtered.length}>
          <Download className="h-4 w-4 mr-2" /> CSV
        </Button>
        <div className="ml-auto text-sm text-muted-foreground">{filtered.length} лидов</div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin mr-2" />Загрузка…</div>
      ) : filtered.length === 0 ? (
        <Card className="p-12 text-center text-muted-foreground">
          Лидов пока нет. Запустите воркер на VPS и добавьте чаты в мониторинг.
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered.map((l) => (
            <Card key={l.id} className={`p-4 ${l.is_read ? "opacity-70" : ""}`}>
              <div className="flex items-start gap-3">
                <div className="flex-1 min-w-0 space-y-2">
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    {l.author_username ? (
                      <a href={`https://t.me/${l.author_username}`} target="_blank" rel="noreferrer" className="font-medium text-foreground hover:underline">
                        @{l.author_username}
                      </a>
                    ) : (
                      <span className="font-medium text-foreground">{l.author_display_name ?? "—"}</span>
                    )}
                    <span className="text-muted-foreground">в</span>
                    {l.chat_username ? (
                      <a href={`https://t.me/${l.chat_username}`} target="_blank" rel="noreferrer" className="text-muted-foreground hover:text-foreground hover:underline">
                        {l.chat_title || `@${l.chat_username}`}
                      </a>
                    ) : (
                      <span className="text-muted-foreground">{l.chat_title}</span>
                    )}
                    <span className="text-muted-foreground">·</span>
                    <span className="text-muted-foreground">{new Date(l.posted_at).toLocaleString("ru-RU")}</span>
                    {l.matched_niche_id && <Badge variant="secondary">{nicheName(l.matched_niche_id)}</Badge>}
                    {l.matched_phrase && <Badge variant="outline">«{l.matched_phrase}»</Badge>}
                  </div>
                  <p className="text-sm whitespace-pre-wrap break-words">{l.message_text}</p>
                </div>
                <div className="flex flex-col gap-1">
                  <Button variant="ghost" size="icon" onClick={() => toggle(l, "is_starred")}>
                    <Star className={`h-4 w-4 ${l.is_starred ? "fill-yellow-400 text-yellow-400" : ""}`} />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => toggle(l, "is_read")}>
                    {l.is_read ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                  {l.message_link && (
                    <Button variant="ghost" size="icon" asChild>
                      <a href={l.message_link} target="_blank" rel="noreferrer"><ExternalLink className="h-4 w-4" /></a>
                    </Button>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
