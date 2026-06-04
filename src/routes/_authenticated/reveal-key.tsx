import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { revealServiceRoleKey } from "@/lib/reveal-key.functions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/reveal-key")({
  head: () => ({ meta: [{ title: "Service Role Key" }] }),
  component: RevealKeyPage,
});

function RevealKeyPage() {
  const fetchKey = useServerFn(revealServiceRoleKey);
  const { data, isLoading, error } = useQuery({
    queryKey: ["service-role-key"],
    queryFn: () => fetchKey(),
    staleTime: 0,
    gcTime: 0,
  });

  const copy = (val: string) => {
    navigator.clipboard.writeText(val);
    toast.success("Скопировано");
  };

  return (
    <div className="min-h-screen bg-muted/30 p-6 flex justify-center">
      <Card className="w-full max-w-3xl">
        <CardHeader>
          <CardTitle>Ключи для воркера на VPS</CardTitle>
          <CardDescription>
            ⚠️ Это секретные данные. Скопируйте и вставьте в <code>.env</code> на сервере. Никому не передавайте.
            После использования удалите эту страницу из проекта.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {isLoading && <p>Загрузка…</p>}
          {error && <p className="text-destructive">Ошибка: {(error as Error).message}</p>}
          {data && (
            <>
              <Field label="SUPABASE_URL" value={data.SUPABASE_URL ?? ""} onCopy={copy} />
              <Field label="SUPABASE_SERVICE_ROLE_KEY" value={data.SUPABASE_SERVICE_ROLE_KEY ?? ""} onCopy={copy} secret />
              <div className="pt-4 border-t">
                <p className="text-sm font-medium mb-2">Готовый блок для .env:</p>
                <pre className="bg-muted p-3 rounded text-xs overflow-x-auto whitespace-pre-wrap break-all">
{`SUPABASE_URL=${data.SUPABASE_URL ?? ""}
SUPABASE_SERVICE_ROLE_KEY=${data.SUPABASE_SERVICE_ROLE_KEY ?? ""}`}
                </pre>
                <Button
                  className="mt-2"
                  onClick={() =>
                    copy(
                      `SUPABASE_URL=${data.SUPABASE_URL ?? ""}\nSUPABASE_SERVICE_ROLE_KEY=${data.SUPABASE_SERVICE_ROLE_KEY ?? ""}\n`,
                    )
                  }
                >
                  Скопировать весь блок
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Field({ label, value, onCopy, secret }: { label: string; value: string; onCopy: (v: string) => void; secret?: boolean }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-sm font-medium">{label}</span>
        <Button size="sm" variant="outline" onClick={() => onCopy(value)}>Копировать</Button>
      </div>
      <div className="bg-muted p-2 rounded text-xs font-mono break-all">
        {secret ? value.slice(0, 12) + "…" + value.slice(-8) : value}
      </div>
    </div>
  );
}
