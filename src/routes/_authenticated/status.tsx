import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/status")({
  head: () => ({ meta: [{ title: "Статус воркера — TG Lead Parser" }] }),
  component: StatusPage,
});

type State = {
  last_heartbeat: string | null;
  last_error: string | null;
  messages_processed: number;
  leads_found: number;
  updated_at: string;
};

function StatusPage() {
  const [state, setState] = useState<State | null>(null);

  const load = async () => {
    const { data } = await supabase.from("worker_state").select("*").eq("id", 1).maybeSingle();
    setState(data as State | null);
  };
  useEffect(() => {
    load();
    const i = setInterval(load, 10000);
    const ch = supabase
      .channel("worker-state-stream")
      .on("postgres_changes", { event: "*", schema: "public", table: "worker_state" }, () => load())
      .subscribe();
    return () => {
      clearInterval(i);
      supabase.removeChannel(ch);
    };
  }, []);

  const alive = state?.last_heartbeat && Date.now() - new Date(state.last_heartbeat).getTime() < 2 * 60 * 1000;

  return (
    <div className="space-y-4 max-w-2xl">
      <Card className="p-6 space-y-4">
        <div className="flex items-center gap-3">
          <Badge variant={alive ? "default" : "destructive"}>{alive ? "Онлайн" : "Не на связи"}</Badge>
          <div className="text-sm text-muted-foreground">
            Последний heartbeat: {state?.last_heartbeat ? new Date(state.last_heartbeat).toLocaleString("ru-RU") : "—"}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Stat label="Сообщений обработано" value={state?.messages_processed ?? 0} />
          <Stat label="Лидов найдено" value={state?.leads_found ?? 0} />
        </div>
        {state?.last_error && (
          <div className="text-sm">
            <div className="text-muted-foreground mb-1">Последняя ошибка:</div>
            <pre className="text-xs bg-muted p-3 rounded overflow-auto">{state.last_error}</pre>
          </div>
        )}
      </Card>

      <Card className="p-6 space-y-2 text-sm">
        <div className="font-medium">Где взять данные для запуска воркера</div>
        <p className="text-muted-foreground">
          Папка <code>worker/</code> в репозитории проекта — там <code>README.md</code> с пошаговой инструкцией для VPS.
        </p>
        <p className="text-muted-foreground">
          Нужны: <code>TG_API_ID</code>, <code>TG_API_HASH</code>, <code>TG_PHONE</code>, <code>SUPABASE_URL</code>, <code>SUPABASE_SERVICE_ROLE_KEY</code>.
        </p>
      </Card>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="text-3xl font-semibold">{value.toLocaleString("ru-RU")}</div>
      <div className="text-xs text-muted-foreground mt-1">{label}</div>
    </div>
  );
}
