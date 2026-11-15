"use client";
// 프로필 창: 회원정보 · 내 폰트 라이브러리 · 결제 내역 · 로그아웃.
// 회원정보 이름 바꾸기, 라이브러리(내 프로젝트 열기·내보낸 기록), 로그아웃은 실제로 동작한다.
// 결제 내역은 베타라 예시 데이터다.
import { useEffect, useState } from "react";
import {
  clearExportHistory,
  exportHistory,
  SAMPLE_PAYMENTS,
  useAccount,
  type ExportRecord,
} from "../lib/account";
import { ArrowRight, LogOut, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { useLang, useT } from "../lib/i18n";
import { deleteProject, listProjects } from "../lib/storage";
import type { ProjectSummary } from "../lib/project-store";

type Tab = "profile" | "library" | "payments";

export default function AccountPanel({
  currentId,
  onOpenProject,
  onManageProjects,
  onClose,
}: {
  currentId: string;
  onOpenProject: (id: string) => void;
  onManageProjects: () => void;
  onClose: () => void;
}) {
  const t = useT();
  const lang = useLang((state) => state.lang);
  const { session, rename, signOut } = useAccount();
  const [tab, setTab] = useState<Tab>("profile");
  const [name, setName] = useState(session?.name ?? "");
  const [projects, setProjects] = useState<ProjectSummary[] | null>(null);
  const [exports, setExports] = useState<ExportRecord[]>([]);
  /** 삭제 확인 중인 프로젝트 */
  const [confirming, setConfirming] = useState<string | null>(null);
  const remove = async (id: string) => {
    await deleteProject(id);
    setConfirming(null);
    setProjects(await listProjects());
  };
  useEffect(() => {
    listProjects().then(setProjects, () => setProjects([]));
    setExports(exportHistory());
  }, []);
  const date = (time: number) =>
    new Date(time).toLocaleDateString(
      lang === "ko" ? "ko-KR" : lang === "ja" ? "ja-JP" : "en-US",
    );
  const won = (n: number) =>
    lang === "ko" ? n.toLocaleString("ko-KR") + "원" : "₩" + n.toLocaleString();
  const provider = {
    email: t("이메일"),
    google: "Google",
    kakao: t("카카오"),
    naver: t("네이버"),
    guest: t("로그인 없이 시작"),
  }[session?.provider ?? "guest"];
  const tabs: [Tab, string][] = [
    ["profile", t("회원정보")],
    ["library", t("내 폰트 라이브러리")],
    ["payments", t("결제 내역")],
  ];
  const sectionTitle =
    "m-0 font-mono text-[11px] font-medium tracking-[0.08em] text-dim uppercase";
  const listItem = "flex items-center justify-between gap-3 px-4 py-3 text-sm";
  return (
    <Sheet open onOpenChange={(open) => !open && onClose()}>
      <SheetContent
        side="right"
        className="sg-account w-[min(460px,94vw)] gap-0 overflow-y-auto sm:max-w-[460px]"
        closeLabel={t("닫기")}
        aria-describedby={undefined}
      >
        <SheetHeader className="gap-4 border-b border-divider px-6 pt-5 pb-5">
          <SheetTitle id="sg-account-title" className="text-lg">
            {t("내 계정")}
          </SheetTitle>
          <div className="sg-account-head flex items-center gap-3.5">
            <span
              className="grid size-12 shrink-0 place-items-center rounded-full bg-primary text-xl font-bold text-primary-foreground shadow-soft"
              aria-hidden="true"
            >
              {(session?.name ?? "?").slice(0, 1).toUpperCase()}
            </span>
            <div className="grid min-w-0">
              <strong className="truncate text-base font-semibold">
                {t(session?.name ?? "게스트")}
              </strong>
              <small className="truncate text-[13px] text-muted-foreground">
                {session?.email || provider}
              </small>
            </div>
          </div>
        </SheetHeader>
        <Tabs
          value={tab}
          onValueChange={(value) => setTab(value as Tab)}
          className="gap-0 px-6 pt-4 pb-6"
        >
          <TabsList className="sg-account-tabs mb-5 h-10 w-full rounded-xl bg-muted p-1">
            {tabs.map(([id, label]) => (
              <TabsTrigger
                key={id}
                value={id}
                className="h-8 rounded-lg text-[13px] data-[state=active]:font-semibold data-[state=active]:shadow-soft"
              >
                {label}
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value="profile" className="sg-account-body grid gap-5">
            <div className="grid gap-2">
              <Label htmlFor="sg-account-name">{t("이름")}</Label>
              <Input
                id="sg-account-name"
                value={name}
                maxLength={30}
                onChange={(event) => setName(event.target.value)}
                onBlur={() => rename(name)}
              />
            </div>
            <dl
              data-ui
              className="sg-account-info m-0 divide-y divide-divider overflow-hidden rounded-xl border border-border text-[13px]"
            >
              {(
                [
                  [t("이메일"), session?.email || "—"],
                  [t("로그인 방식"), provider],
                  [t("이용 등급"), t("베타 (무료 · 모든 기능)")],
                  [t("가입일"), session ? date(session.since) : "—"],
                  [t("계정 저장"), t("준비 중 · 지금은 이 기기에만 저장돼요")],
                ] as const
              ).map(([label, value]) => (
                <div
                  key={label}
                  className="grid grid-cols-[96px_1fr] gap-3 px-4 py-2.5"
                >
                  <dt className="text-muted-foreground">{label}</dt>
                  <dd className="m-0 min-w-0 break-words text-foreground">
                    {value}
                  </dd>
                </div>
              ))}
            </dl>
            <div className="grid gap-2">
              <Button
                type="button"
                variant="outline"
                className="sg-account-logout w-full"
                onClick={() => {
                  signOut();
                  onClose();
                }}
              >
                <LogOut />
                {t("로그아웃")}
              </Button>
              <p className="m-0 text-xs text-muted-foreground">
                {t(
                  "로그아웃해도 이 기기에 쓴 글씨와 프로젝트는 지워지지 않아요.",
                )}
              </p>
            </div>
          </TabsContent>

          <TabsContent value="library" className="sg-account-body grid gap-5">
            <section className="grid gap-2">
              <h3 className={sectionTitle}>{t("작업 중인 폰트")}</h3>
              {projects === null ? (
                <p className="m-0 text-sm text-muted-foreground">
                  {t("불러오는 중")}
                </p>
              ) : projects.length === 0 ? (
                <p className="m-0 text-sm text-muted-foreground">
                  {t("아직 프로젝트가 없어요.")}
                </p>
              ) : (
                <ul className="sg-account-list m-0 list-none divide-y divide-divider overflow-hidden rounded-xl border border-border p-0">
                  {projects.map((p) => (
                    <li
                      key={p.id}
                      className={cn(
                        listItem,
                        p.id === currentId && "bg-wash/60",
                      )}
                    >
                      <div className="grid min-w-0">
                        <strong className="truncate font-semibold">
                          {p.name}
                        </strong>
                        <small className="text-xs text-muted-foreground">
                          {t("{n}자 작성", { n: p.count })} ·{" "}
                          {date(p.updatedAt)}
                          {p.id === currentId && (
                            <span className="ml-1.5 rounded-full bg-primary px-1.5 py-px text-[10px] font-semibold text-primary-foreground">
                              {t("현재 작업")}
                            </span>
                          )}
                        </small>
                      </div>
                      {p.id !== currentId &&
                        (confirming === p.id ? (
                          <span className="sg-account-actions flex shrink-0 gap-1.5">
                            <Button
                              type="button"
                              variant="destructive"
                              size="sm"
                              className="is-danger"
                              onClick={() => remove(p.id)}
                            >
                              {t("영구 삭제")}
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => setConfirming(null)}
                            >
                              {t("취소")}
                            </Button>
                          </span>
                        ) : (
                          <span className="sg-account-actions flex shrink-0 gap-1">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                onOpenProject(p.id);
                                onClose();
                              }}
                            >
                              {t("열기")}
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon-sm"
                              className="text-muted-foreground hover:text-destructive"
                              aria-label={t("{name} 프로젝트 삭제", {
                                name: p.name,
                              })}
                              onClick={() => setConfirming(p.id)}
                            >
                              <Trash2 />
                            </Button>
                          </span>
                        ))}
                    </li>
                  ))}
                </ul>
              )}
              <Button
                type="button"
                variant="link"
                className="sg-account-link justify-self-start text-[13px]"
                onClick={() => {
                  onManageProjects();
                  onClose();
                }}
              >
                {t("새 폰트 시작은 ‘내 폰트’에서")}
                <ArrowRight />
              </Button>
            </section>
            <section className="grid gap-2">
              <h3 className={sectionTitle}>{t("내보낸 폰트 파일")}</h3>
              {exports.length === 0 ? (
                <p className="m-0 text-sm leading-relaxed text-muted-foreground">
                  {t(
                    "아직 내보낸 폰트가 없어요. 폰트 완성 단계에서 내려받으면 여기에 기록돼요.",
                  )}
                </p>
              ) : (
                <>
                  <ul className="sg-account-list m-0 list-none divide-y divide-divider overflow-hidden rounded-xl border border-border p-0">
                    {exports.map((record) => (
                      <li key={record.at + record.file} className={listItem}>
                        <div className="grid min-w-0">
                          <strong className="truncate font-mono text-[13px] font-semibold">
                            {record.file}
                          </strong>
                          <small className="truncate text-xs text-muted-foreground">
                            {record.projectName} ·{" "}
                            {record.script === "ja" ? "日本語" : t("한글")} ·{" "}
                            {date(record.at)}
                          </small>
                        </div>
                        {record.projectId !== currentId && (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              onOpenProject(record.projectId);
                              onClose();
                            }}
                          >
                            {t("열기")}
                          </Button>
                        )}
                      </li>
                    ))}
                  </ul>
                  <p className="m-0 text-xs leading-relaxed text-muted-foreground">
                    {t(
                      "파일은 기기에 저장돼 있어요. 다시 받으려면 그 프로젝트를 열고 폰트 완성 → 내보내기를 눌러 주세요.",
                    )}
                  </p>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="sg-account-link justify-self-start text-muted-foreground"
                    onClick={() => {
                      clearExportHistory();
                      setExports([]);
                    }}
                  >
                    {t("기록 지우기")}
                  </Button>
                </>
              )}
            </section>
          </TabsContent>

          <TabsContent value="payments" className="sg-account-body grid gap-4">
            <p className="sg-account-badge m-0 rounded-lg bg-muted px-3.5 py-2.5 text-[13px] leading-relaxed text-muted-foreground">
              {t(
                "베타 기간이라 결제한 내역이 없어요. 아래는 정식 출시 후 보일 화면의 예시예요.",
              )}
            </p>
            <div className="overflow-hidden rounded-xl border border-border">
              <table className="sg-account-table w-full border-collapse text-[13px]">
                <thead className="bg-muted text-left text-xs text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 font-medium">{t("날짜")}</th>
                    <th className="px-3 py-2 font-medium">{t("항목")}</th>
                    <th className="px-3 py-2 text-right font-medium">
                      {t("금액")}
                    </th>
                    <th className="px-3 py-2 font-medium">{t("상태")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-divider">
                  {SAMPLE_PAYMENTS.map((row) => (
                    <tr
                      key={row.date + row.item}
                      className="is-sample text-foreground/60"
                    >
                      <td className="px-3 py-2.5 font-mono text-xs">
                        {row.date}
                      </td>
                      <td className="px-3 py-2.5">{t(row.item)}</td>
                      <td className="px-3 py-2.5 text-right font-mono text-xs tabular-nums">
                        {won(row.amount)}
                      </td>
                      <td className="px-3 py-2.5">
                        <span className="rounded-full border border-dashed border-border px-2 py-px text-[11px]">
                          {t(row.status)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}
