"use client";
// 처음 들어오면 보이는 메인 화면: 내 폰트 프로젝트 목록.
// 가장 최근 작업은 크게 강조하고 '이어서 하기'로 마지막 단계·글자로 돌아간다.
// 카드마다 열기 · 이름 바꾸기 · 복제 · 삭제.
import { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  Copy,
  History,
  Lock,
  MoreHorizontal,
  PencilLine,
  Plus,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Kicker } from "@/components/ui-kit";
import { cn } from "@/lib/utils";
import { Thumbnail } from "./Preview";
import { useT } from "../lib/i18n";
import type { ProjectSummary } from "../lib/storage";
import type { ResumePoint } from "../lib/resume";

const STEP_LABEL: Record<number, string> = {
  0: "브러시 고르기",
  1: "견본 고르기",
  2: "글자 쓰기",
  3: "자모 나누기",
  4: "폰트 완성",
};

function when(at: number, t: ReturnType<typeof useT>) {
  const minutes = Math.round((Date.now() - at) / 60000);
  if (minutes < 1) return t("방금");
  if (minutes < 60) return t("{n}분 전", { n: minutes });
  const hours = Math.round(minutes / 60);
  if (hours < 24) return t("{n}시간 전", { n: hours });
  const days = Math.round(hours / 24);
  if (days < 7) return t("{n}일 전", { n: days });
  return new Date(at).toLocaleDateString();
}

export default function HomeScreen({
  projects,
  resume,
  busy,
  onOpen,
  onNew,
  onRename,
  onDuplicate,
  onDelete,
}: {
  projects: ProjectSummary[] | null;
  resume: Record<string, ResumePoint>;
  busy: boolean;
  onOpen: (id: string) => void;
  onNew: () => void;
  onRename: (id: string, name: string) => void;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const t = useT();
  const [renaming, setRenaming] = useState<string | null>(null);
  // 이름 바꾸기를 고르면 메뉴가 닫히며 버튼으로 초점을 돌려 입력칸이 바로 닫히지 않게
  const keepFocus = useRef(false);
  const [deleting, setDeleting] = useState<ProjectSummary | null>(null);
  const [recent, ...rest] = projects ?? [];

  const where = (p: ProjectSummary) => {
    const point = resume[p.id];
    if (!point) return t("글자 쓰기");
    const step = t(STEP_LABEL[point.step] ?? "글자 쓰기");
    return point.step === 2 && point.char
      ? t("{step} · ‘{char}’ 쓰던 중", { step, char: point.char })
      : step;
  };

  const menu = (p: ProjectSummary) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          className="sg-home-menu shrink-0 text-muted-foreground"
          aria-label={t("{name} 프로젝트 메뉴", { name: p.name })}
          disabled={busy}
        >
          <MoreHorizontal />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        onCloseAutoFocus={(event) => {
          if (keepFocus.current) event.preventDefault();
          keepFocus.current = false;
        }}
      >
        <DropdownMenuItem
          onSelect={() => {
            keepFocus.current = true;
            setRenaming(p.id);
          }}
        >
          <PencilLine />
          {t("이름 바꾸기")}
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => onDuplicate(p.id)}>
          <Copy />
          {t("복제")}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onSelect={() => setDeleting(p)}>
          <Trash2 />
          {t("삭제")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  const title = (p: ProjectSummary, large?: boolean) =>
    renaming === p.id ? (
      <RenameField
        name={p.name}
        onDone={(name) => {
          setRenaming(null);
          if (name && name !== p.name) onRename(p.id, name);
        }}
      />
    ) : (
      <strong
        className={cn(
          "sg-home-name block truncate font-bold tracking-[-0.02em] text-foreground",
          large ? "text-[22px]" : "text-[16px]",
        )}
        title={p.name}
      >
        {p.name}
      </strong>
    );

  const badges = (p: ProjectSummary) => (
    <span className="flex flex-wrap items-center gap-1.5 text-[11.5px]">
      <span className="rounded-full border border-border bg-card px-2 py-px font-medium text-muted-foreground">
        {p.script === "ja" ? "日本語" : t("한글")}
      </span>
      {p.purchased && (
        <span className="inline-flex items-center gap-1 rounded-full bg-wash px-2 py-px font-semibold text-primary">
          <Lock className="size-3" />
          {t("결제한 폰트")}
        </span>
      )}
    </span>
  );

  return (
    <section
      data-ui
      className="sg-home journey-panel min-h-0 flex-1 overflow-y-auto"
      aria-labelledby="sg-home-title"
    >
      <div className="mx-auto grid w-full max-w-[1120px] gap-8 px-4 py-8 wide:px-10 wide:py-10">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div className="grid gap-2">
            <Kicker>{t("내 폰트")}</Kicker>
            <h1
              id="sg-home-title"
              tabIndex={-1}
              className="m-0 text-[clamp(26px,3vw,36px)] leading-tight font-extrabold tracking-[-0.04em] outline-none"
            >
              {recent
                ? t("어디서부터 이어 쓸까요?")
                : t("첫 손글씨 폰트를 만들어 볼까요?")}
            </h1>
          </div>
          <Button
            size="lg"
            className="sg-home-new"
            disabled={busy}
            onClick={onNew}
          >
            <Plus />
            {t("새 폰트 시작")}
          </Button>
        </header>

        {projects === null ? (
          <p className="m-0 text-sm text-muted-foreground">
            {t("불러오는 중")}
          </p>
        ) : !recent ? (
          <div className="grid justify-items-center gap-4 rounded-2xl border border-dashed border-border bg-card/60 px-6 py-16 text-center">
            <p className="m-0 max-w-[30em] text-[15px] leading-relaxed text-muted-foreground">
              {t(
                "아직 만든 폰트가 없어요. 브러시를 고르고 글자를 쓰기 시작하면 여기에 차곡차곡 보관돼요.",
              )}
            </p>
            <Button size="lg" onClick={onNew} disabled={busy}>
              {t("첫 폰트 만들기")}
              <ArrowRight />
            </Button>
          </div>
        ) : (
          <>
            {/* 가장 최근 작업: 크게, 강조 테두리와 '최근 작업' 표시 */}
            <article
              className="sg-home-recent relative grid gap-5 rounded-2xl border border-transparent bg-card p-5 shadow-lift [background:linear-gradient(var(--sheet),var(--sheet))_padding-box,var(--brand-grad)_border-box] sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:p-6"
              data-project-id={recent.id}
            >
              <div className="grid min-w-0 gap-3">
                <span className="inline-flex w-max items-center gap-1.5 rounded-full bg-brand-grad px-2.5 py-1 text-[11.5px] font-semibold text-white">
                  <History className="size-3.5" />
                  {t("최근 작업")}
                </span>
                <div className="flex min-w-0 items-start gap-2">
                  <div className="grid min-w-0 flex-1 gap-1.5">
                    {title(recent, true)}
                    <span className="sg-home-where text-[14px] font-medium text-foreground/85">
                      {where(recent)}
                    </span>
                    <span className="text-[12.5px] text-muted-foreground">
                      {t("{n}자 작성", { n: recent.count })} ·{" "}
                      {when(recent.updatedAt, t)}
                    </span>
                    {badges(recent)}
                  </div>
                  {menu(recent)}
                </div>
                <Preview items={recent.preview} large />
              </div>
              <Button
                size="xl"
                className="sg-home-resume w-full sm:w-auto"
                disabled={busy}
                onClick={() => onOpen(recent.id)}
              >
                {t("이어서 하기")}
                <ArrowRight className="size-5" />
              </Button>
            </article>

            {rest.length > 0 && (
              <section className="grid gap-3">
                <h2 className="m-0 font-mono text-[11px] font-medium tracking-[0.08em] text-dim uppercase">
                  {t("보관한 프로젝트")} · {rest.length}
                </h2>
                <div className="sg-home-list grid gap-3 sm:grid-cols-2 wide:grid-cols-3">
                  {rest.map((p) => (
                    <article
                      key={p.id}
                      data-project-id={p.id}
                      className="group grid gap-3 rounded-xl border border-border bg-card p-4 shadow-soft transition-[border-color,box-shadow] hover:border-primary/40"
                    >
                      <div className="flex min-w-0 items-start gap-2">
                        <div className="grid min-w-0 flex-1 gap-1">
                          {title(p)}
                          <span className="truncate text-[12.5px] text-muted-foreground">
                            {where(p)} · {t("{n}자", { n: p.count })} ·{" "}
                            {when(p.updatedAt, t)}
                          </span>
                        </div>
                        {menu(p)}
                      </div>
                      <Preview items={p.preview} />
                      <div className="flex items-center justify-between gap-2">
                        {badges(p)}
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={busy}
                          onClick={() => onOpen(p.id)}
                          aria-label={t("{name} 프로젝트 열기", {
                            name: p.name,
                          })}
                        >
                          {t("열기")}
                          <ArrowRight />
                        </Button>
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </div>

      <AlertDialog
        open={!!deleting}
        onOpenChange={(open) => !open && setDeleting(null)}
      >
        <AlertDialogContent
          className="sg-home-delete sm:max-w-[420px]"
          onOverlayClick={() => setDeleting(null)}
        >
          <AlertDialogHeader>
            <AlertDialogTitle>{t("프로젝트를 삭제할까요?")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t(
                "‘{name}’ 프로젝트를 영구 삭제할까요? 이 동작은 되돌릴 수 없어요.",
                { name: deleting?.name ?? "" },
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDeleting(null)}>
              {t("취소")}
            </Button>
            <Button
              variant="destructive"
              className="sg-home-delete-confirm"
              onClick={() => {
                if (deleting) onDelete(deleting.id);
                setDeleting(null);
              }}
            >
              <Trash2 />
              {t("확인하고 삭제")}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}

function Preview({
  items,
  large,
}: {
  items: ProjectSummary["preview"];
  large?: boolean;
}) {
  const t = useT();
  if (!items.length)
    return (
      <div
        className={cn(
          "grid place-items-center rounded-lg border border-dashed border-border bg-background/60 text-xs text-muted-foreground",
          large ? "h-[72px]" : "h-[52px]",
        )}
      >
        {t("아직 쓴 글자가 없어요")}
      </div>
    );
  return (
    <div className="flex gap-1.5 overflow-hidden" aria-hidden="true">
      {items.slice(0, large ? 6 : 4).map((item) => (
        <span
          key={item.char}
          className={cn(
            "grid shrink-0 place-items-center rounded-lg border border-border bg-background/60",
            large
              ? "size-[72px] [&_canvas]:!size-14"
              : "size-[52px] [&_canvas]:!size-10",
          )}
        >
          <Thumbnail strokes={item.strokes} size={large ? 112 : 80} />
        </span>
      ))}
    </div>
  );
}

function RenameField({
  name,
  onDone,
}: {
  name: string;
  onDone: (name: string) => void;
}) {
  const t = useT();
  const [value, setValue] = useState(name);
  const ref = useRef<HTMLInputElement>(null);
  const done = useRef(false);
  const finish = (next: string) => {
    if (done.current) return;
    done.current = true;
    onDone(next);
  };
  useEffect(() => {
    const timer = setTimeout(() => {
      ref.current?.focus();
      ref.current?.select();
    }, 30);
    return () => clearTimeout(timer);
  }, []);
  return (
    <form
      className="flex gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        finish(value.trim());
      }}
    >
      <Input
        ref={ref}
        className="sg-home-rename h-9"
        aria-label={t("프로젝트 이름")}
        value={value}
        maxLength={80}
        onChange={(event) => setValue(event.target.value)}
        onBlur={(event) => {
          // 초점이 아직 들어오기 전의 blur 는 무시
          if (document.hasFocus() && event.relatedTarget === null && !value)
            return;
          finish(value.trim());
        }}
        onKeyDown={(event) => {
          if (event.key === "Escape") finish(name);
        }}
      />
    </form>
  );
}
