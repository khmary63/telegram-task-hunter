import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Trash2, Plus, Check, X } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/chats")({
  head: () => ({ meta: [{ title: "Чаты — TG Lead Parser" }] }),
  component: ChatsPage,
});

type Niche = { id: string; name: string };
type Chat = { id: string; username: string; title: string | null; niche_id: string | null; is_active: boolean };
type Sugg = { id: string; username: string; source_chat: string | null; mentions_count: number; status: string };

function ChatsPage() {
  const [niches, setNiches] = useState<Niche[]>([]);
  const [chats, setChats] = useState<Chat[]>([]);
  const [suggs, setSuggs] = useState<Sugg[]>([]);
  const [username, setUsername] = useState("");
  const [nicheId, setNicheId] = useState<string>("none");

  const load = async () => {
    const [n, c, s] = await Promise.all([
      supabase.from("niches").select("*").order("name"),
      supabase.from("chats").select("*").order("username"),
      supabase.from("chat_suggestions").select("*").eq("status", "new").order("mentions_count", { ascending: false }).limit(100),
    ]);
    setNiches((n.data as Niche[]) ?? []);
    setChats((c.data as Chat[]) ?? []);
    setSuggs((s.data as Sugg[]) ?? []);
  };
  useEffect(() => { load(); }, []);

  const normalize = (u: string) => u.replace(/^https?:\/\/t\.me\//, "").replace(/^@/, "").trim();

  const add = async (uname?: string) => {
    const u = normalize(uname ?? username);
    if (!u) return;
    const { error } = await supabase.from("chats").insert({
      username: u,
      niche_id: nicheId === "none" ? null : nicheId,
    });
    if (error) toast.error(error.message);
    else { setUsername(""); load(); }
  };

  const addFromSugg = async (s: Sugg) => {
    await supabase.from("chats").insert({ username: s.username });
    await supabase.from("chat_suggestions").update({ status: "added" }).eq("id", s.id);
    load();
  };
  const ignoreSugg = async (s: Sugg) => {
    await supabase.from("chat_suggestions").update({ status: "ignored" }).eq("id", s.id);
    setSuggs((prev) => prev.filter((x) => x.id !== s.id));
  };

  const del = async (id: string) => {
    await supabase.from("chats").delete().eq("id", id);
    load();
  };
  const toggle = async (id: string, v: boolean) => {
    await supabase.from("chats").update({ is_active: v }).eq("id", id);
    setChats((prev) => prev.map((c) => (c.id === id ? { ...c, is_active: v } : c)));
  };
  const setNiche = async (id: string, v: string) => {
    await supabase.from("chats").update({ niche_id: v === "none" ? null : v }).eq("id", id);
    setChats((prev) => prev.map((c) => (c.id === id ? { ...c, niche_id: v === "none" ? null : v } : c)));
  };

  const nicheName = (id: string | null) => niches.find((n) => n.id === id)?.name ?? "—";

  return (
    <div className="space-y-4 max-w-3xl">
      <Tabs defaultValue="active">
        <TabsList>
          <TabsTrigger value="active">Активные чаты · {chats.length}</TabsTrigger>
          <TabsTrigger value="suggestions">Найдено воркером · {suggs.length}</TabsTrigger>
        </TabsList>

        <TabsContent value="active" className="space-y-4">
          <Card className="p-4 space-y-3">
            <div className="font-medium">Добавить чат</div>
            <div className="flex flex-wrap gap-2">
              <Input placeholder="@username или t.me/username" value={username} onChange={(e) => setUsername(e.target.value)} className="flex-1 min-w-60" />
              <Select value={nicheId} onValueChange={setNicheId}>
                <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Без ниши</SelectItem>
                  {niches.map((n) => <SelectItem key={n.id} value={n.id}>{n.name}</SelectItem>)}
                </SelectContent>
              </Select>
              <Button onClick={() => add()}><Plus className="h-4 w-4 mr-1" />Добавить</Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Чтобы воркер начал читать чат, ваш Telegram-аккаунт должен быть в нём участником.
            </p>
          </Card>

          <div className="space-y-1">
            {chats.map((c) => (
              <Card key={c.id} className="p-3 flex items-center gap-3">
                <Switch checked={c.is_active} onCheckedChange={(v) => toggle(c.id, v)} />
                <div className="flex-1 min-w-0">
                  <a href={`https://t.me/${c.username}`} target="_blank" rel="noreferrer" className="text-sm font-medium hover:underline">
                    @{c.username}
                  </a>
                  {c.title && <div className="text-xs text-muted-foreground">{c.title}</div>}
                </div>
                <Select value={c.niche_id ?? "none"} onValueChange={(v) => setNiche(c.id, v)}>
                  <SelectTrigger className="w-48 h-8"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Без ниши</SelectItem>
                    {niches.map((n) => <SelectItem key={n.id} value={n.id}>{n.name}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Button variant="ghost" size="icon" onClick={() => del(c.id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </Card>
            ))}
            {chats.length === 0 && (
              <Card className="p-8 text-center text-muted-foreground text-sm">Пока нет чатов. Добавьте первый выше.</Card>
            )}
          </div>
        </TabsContent>

        <TabsContent value="suggestions" className="space-y-2">
          <p className="text-xs text-muted-foreground">
            Воркер собирает упоминания чатов из уже подключённых. Самые частые — сверху.
          </p>
          {suggs.length === 0 && <Card className="p-8 text-center text-muted-foreground text-sm">Предложений пока нет.</Card>}
          {suggs.map((s) => (
            <Card key={s.id} className="p-3 flex items-center gap-3">
              <Badge variant="secondary">×{s.mentions_count}</Badge>
              <div className="flex-1 min-w-0">
                <a href={`https://t.me/${s.username}`} target="_blank" rel="noreferrer" className="text-sm font-medium hover:underline">
                  @{s.username}
                </a>
                {s.source_chat && <div className="text-xs text-muted-foreground">из @{s.source_chat}</div>}
              </div>
              <Button size="sm" variant="outline" onClick={() => addFromSugg(s)}>
                <Check className="h-4 w-4 mr-1" /> В мониторинг
              </Button>
              <Button size="sm" variant="ghost" onClick={() => ignoreSugg(s)}>
                <X className="h-4 w-4" />
              </Button>
            </Card>
          ))}
        </TabsContent>
      </Tabs>
    </div>
  );
}
