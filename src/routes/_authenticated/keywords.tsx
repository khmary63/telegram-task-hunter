import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Trash2, Plus } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/keywords")({
  head: () => ({ meta: [{ title: "Ключевики — TG Lead Parser" }] }),
  component: KeywordsPage,
});

type Niche = { id: string; name: string };
type Keyword = { id: string; phrase: string; niche_id: string | null; type: "exact" | "semantic"; is_active: boolean };

function KeywordsPage() {
  const [niches, setNiches] = useState<Niche[]>([]);
  const [keywords, setKeywords] = useState<Keyword[]>([]);
  const [phrase, setPhrase] = useState("");
  const [type, setType] = useState<"exact" | "semantic">("exact");
  const [nicheId, setNicheId] = useState<string>("none");

  const load = async () => {
    const [n, k] = await Promise.all([
      supabase.from("niches").select("*").order("name"),
      supabase.from("keywords").select("*").order("type").order("phrase"),
    ]);
    setNiches((n.data as Niche[]) ?? []);
    setKeywords((k.data as Keyword[]) ?? []);
  };
  useEffect(() => { load(); }, []);

  const add = async () => {
    if (!phrase.trim()) return;
    const { error } = await supabase.from("keywords").insert({
      phrase: phrase.trim(),
      type,
      niche_id: nicheId === "none" ? null : nicheId,
    });
    if (error) toast.error(error.message);
    else { setPhrase(""); load(); }
  };

  const del = async (id: string) => {
    await supabase.from("keywords").delete().eq("id", id);
    load();
  };
  const toggle = async (id: string, v: boolean) => {
    await supabase.from("keywords").update({ is_active: v }).eq("id", id);
    setKeywords((prev) => prev.map((k) => (k.id === id ? { ...k, is_active: v } : k)));
  };

  const exact = keywords.filter((k) => k.type === "exact");
  const semantic = keywords.filter((k) => k.type === "semantic");
  const nicheName = (id: string | null) => niches.find((n) => n.id === id)?.name ?? "—";

  return (
    <div className="space-y-6 max-w-3xl">
      <Card className="p-4 space-y-3">
        <div className="font-medium">Добавить ключевик</div>
        <div className="flex flex-wrap gap-2">
          <Input placeholder="Фраза" value={phrase} onChange={(e) => setPhrase(e.target.value)} className="flex-1 min-w-60" />
          <Select value={type} onValueChange={(v: any) => setType(v)}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="exact">Точная фраза</SelectItem>
              <SelectItem value="semantic">Семантика</SelectItem>
            </SelectContent>
          </Select>
          <Select value={nicheId} onValueChange={setNicheId}>
            <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Без ниши</SelectItem>
              {niches.map((n) => <SelectItem key={n.id} value={n.id}>{n.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button onClick={add}><Plus className="h-4 w-4 mr-1" />Добавить</Button>
        </div>
      </Card>

      <Section title="Точные фразы" items={exact} nicheName={nicheName} onToggle={toggle} onDelete={del} />
      <Section title="Семантические (regex по словарю)" items={semantic} nicheName={nicheName} onToggle={toggle} onDelete={del} />
    </div>
  );
}

function Section({
  title, items, nicheName, onToggle, onDelete,
}: {
  title: string;
  items: Keyword[];
  nicheName: (id: string | null) => string;
  onToggle: (id: string, v: boolean) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div className="space-y-2">
      <div className="text-sm font-medium text-muted-foreground">{title} · {items.length}</div>
      <div className="space-y-1">
        {items.map((k) => (
          <Card key={k.id} className="p-3 flex items-center gap-3">
            <Switch checked={k.is_active} onCheckedChange={(v) => onToggle(k.id, v)} />
            <div className="flex-1 min-w-0">
              <div className="text-sm">{k.phrase}</div>
              {k.niche_id && <Badge variant="secondary" className="text-xs mt-1">{nicheName(k.niche_id)}</Badge>}
            </div>
            <Button variant="ghost" size="icon" onClick={() => onDelete(k.id)}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </Card>
        ))}
      </div>
    </div>
  );
}
