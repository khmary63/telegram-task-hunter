import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "TG Lead Parser" },
      { name: "description", content: "Парсер Telegram-чатов для поиска лидов" },
    ],
  }),
  ssr: false,
  component: Index,
});

function Index() {
  const [target, setTarget] = useState<string | null>(null);
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setTarget(data.user ? "/leads" : "/auth");
    });
  }, []);
  if (!target) return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Загрузка…</div>;
  return <Navigate to={target} replace />;
}
