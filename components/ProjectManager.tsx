"use client";
import { useT } from "../lib/i18n";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Kicker } from "@/components/ui-kit";
import { cn } from "@/lib/utils";
import { useEffect, useRef, useState } from "react";
import { deleteProject, listProjects } from "../lib/storage";
import type { FontProject } from "../lib/types";
export default function ProjectManager({
  current,
  onClose,
  onTransition,
}: {
  current: FontProject;
  onClose: () => void;
  onTransition: (idOrName: string, create: boolean) => Promise<void>;
}) {
  const t = useT();
  const [projects, setProjects] = useState<
      Awaited<ReturnType<typeof listProjects>>
    >([]),
    [name, setName] = useState("새 손글씨"),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [deleting, setDeleting] = useState<string | null>(null);
  const root = useRef<HTMLDivElement>(null);
  const refresh = () =>
    listProjects().then((items) =>
      setProjects([
        {
          id: current.id,
          name: current.name,
          updatedAt: current.updatedAt,
          count: Object.values(current.samples).filter((s) => s.strokes.length)
            .length,
        },
        ...items.filter((item) => item.id !== current.id),
      ]),
    );
  useEffect(() => {
    refresh().catch(() => setError(t("프로젝트 목록을 불러오지 못했어요.")));
  }, []);
  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    setError("");
    try {
      await action();
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : t("저장하지 못했어요. 다시 시도해주세요."),
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog open onOpenChange={(open) => !open && !busy && onClose()}>
      <DialogContent
        className="project-manager gap-5 sm:max-w-[560px]"
        closeLabel={t("프로젝트 관리 닫기")}
        aria-describedby="projects-desc"
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          root.current?.querySelector<HTMLInputElement>("input")?.focus();
        }}
      >
        <div ref={root} className="contents">
          <DialogHeader className="gap-2">
            <Kicker className="step-kicker">{t("나의 작업 보관함")}</Kicker>
            <DialogTitle
              id="projects-title"
              className="text-2xl font-bold tracking-[-0.03em]"
            >
              {t("새로운 글씨를 시작할까요?")}
            </DialogTitle>
            <DialogDescription id="projects-desc" className="leading-relaxed">
              {t(
                "지금 작업은 그대로 보관해요. 새 프로젝트로 시작하고, 아래 목록에서 언제든 다시 열 수 있어요.",
              )}
            </DialogDescription>
          </DialogHeader>
          <form
            className="grid gap-2 rounded-xl border border-border bg-background/60 p-4"
            onSubmit={(e) => {
              e.preventDefault();
              void run(() => onTransition(name, true));
            }}
          >
            <Label htmlFor="new-project-name">{t("새 프로젝트 이름")}</Label>
            <div className="flex gap-2 max-sm:flex-col">
              <Input
                id="new-project-name"
                aria-label={t("새 프로젝트 이름")}
                maxLength={72}
                value={name}
                disabled={busy}
                onChange={(e) => setName(e.target.value)}
              />
              <Button
                className="font-primary shrink-0"
                type="submit"
                disabled={busy || !name.trim()}
              >
                {busy ? <Loader2 className="animate-spin" /> : <Plus />}
                {busy ? t("저장 중…") : t("새 폰트 시작하기")}
              </Button>
            </div>
          </form>
          <section className="grid gap-2">
            <h3 className="m-0 font-mono text-[11px] font-medium tracking-[0.08em] text-dim uppercase">
              {t("보관한 프로젝트")}
            </h3>
            <div className="saved-projects grid max-h-[46dvh] gap-0 divide-y divide-divider overflow-y-auto rounded-xl border border-border">
              {projects.map((item) => (
                <article
                  key={item.id}
                  data-project-id={item.id}
                  className={cn(
                    "grid gap-2 px-4 py-3",
                    item.id === current.id && "bg-wash/60",
                  )}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="grid min-w-0">
                      <strong className="truncate text-sm font-semibold">
                        {item.name}
                      </strong>
                      <small className="text-xs text-muted-foreground">
                        {t("{n}자 작성", { n: item.count })} ·{" "}
                        {new Date(item.updatedAt).toLocaleDateString()}
                        {item.id === current.id && (
                          <span className="ml-1.5 rounded-full bg-primary px-1.5 py-px text-[10px] font-semibold text-primary-foreground">
                            {t("현재 작업")}
                          </span>
                        )}
                      </small>
                    </div>
                    <div className="flex shrink-0 gap-1">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={busy || item.id === current.id}
                        onClick={() =>
                          void run(() => onTransition(item.id, false))
                        }
                        aria-label={t("{name} 프로젝트 열기", {
                          name: item.name,
                        })}
                      >
                        {t("열기")}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        className="text-muted-foreground hover:text-destructive"
                        disabled={busy || item.id === current.id}
                        onClick={() => setDeleting(item.id)}
                        aria-label={t("{name} 프로젝트 삭제", {
                          name: item.name,
                        })}
                      >
                        <Trash2 />
                      </Button>
                    </div>
                  </div>
                  {deleting === item.id && (
                    <div className="project-delete-confirm grid gap-2 rounded-lg border border-destructive/40 bg-destructive-wash p-3">
                      <p className="m-0 text-[13px] text-foreground">
                        {t(
                          "‘{name}’ 프로젝트를 영구 삭제할까요? 이 동작은 되돌릴 수 없어요.",
                          { name: item.name },
                        )}
                      </p>
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={busy}
                          onClick={() => setDeleting(null)}
                        >
                          {t("취소")}
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          disabled={busy}
                          onClick={() =>
                            void run(async () => {
                              await deleteProject(item.id);
                              setDeleting(null);
                              await refresh();
                            })
                          }
                        >
                          {t("확인하고 삭제")}
                        </Button>
                      </div>
                    </div>
                  )}
                </article>
              ))}
            </div>
          </section>
          {error && (
            <p role="alert" className="font-error m-0 text-sm text-destructive">
              {error}
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
