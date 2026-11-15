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
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
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
    guest: t("로그인 없이 시작"),
  }[session?.provider ?? "guest"];
  const tabs: [Tab, string][] = [
    ["profile", t("회원정보")],
    ["library", t("내 폰트 라이브러리")],
    ["payments", t("결제 내역")],
  ];
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <section
        className="settings-modal sg-account"
        role="dialog"
        aria-modal="true"
        aria-labelledby="sg-account-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="modal-title">
          <h2 id="sg-account-title">{t("내 계정")}</h2>
          <button onClick={onClose} aria-label={t("닫기")}>
            ✕
          </button>
        </div>
        <div className="sg-account-head">
          <span className="sg-avatar is-large" aria-hidden="true">
            {(session?.name ?? "?").slice(0, 1).toUpperCase()}
          </span>
          <div>
            <strong>{t(session?.name ?? "게스트")}</strong>
            <small>{session?.email || provider}</small>
          </div>
        </div>
        <div className="sg-account-tabs" role="tablist">
          {tabs.map(([id, label]) => (
            <button
              key={id}
              role="tab"
              aria-selected={tab === id}
              onClick={() => setTab(id)}
            >
              {label}
            </button>
          ))}
        </div>

        {tab === "profile" && (
          <div className="sg-account-body" role="tabpanel">
            <label className="field">
              {t("이름")}
              <input
                value={name}
                maxLength={30}
                onChange={(event) => setName(event.target.value)}
                onBlur={() => rename(name)}
              />
            </label>
            <dl className="sg-account-info">
              <dt>{t("이메일")}</dt>
              <dd>{session?.email || "—"}</dd>
              <dt>{t("로그인 방식")}</dt>
              <dd>{provider}</dd>
              <dt>{t("이용 등급")}</dt>
              <dd>{t("베타 (무료 · 모든 기능)")}</dd>
              <dt>{t("가입일")}</dt>
              <dd>{session ? date(session.since) : "—"}</dd>
              <dt>{t("계정 저장")}</dt>
              <dd>{t("준비 중 · 지금은 이 기기에만 저장돼요")}</dd>
            </dl>
            <button
              type="button"
              className="sg-account-logout"
              onClick={() => {
                signOut();
                onClose();
              }}
            >
              {t("로그아웃")}
            </button>
            <p className="settings-help">
              {t(
                "로그아웃해도 이 기기에 쓴 글씨와 프로젝트는 지워지지 않아요.",
              )}
            </p>
          </div>
        )}

        {tab === "library" && (
          <div className="sg-account-body" role="tabpanel">
            <h3>{t("작업 중인 폰트")}</h3>
            {projects === null ? (
              <p className="settings-help">{t("불러오는 중")}</p>
            ) : projects.length === 0 ? (
              <p className="settings-help">{t("아직 프로젝트가 없어요.")}</p>
            ) : (
              <ul className="sg-account-list">
                {projects.map((p) => (
                  <li key={p.id}>
                    <div>
                      <strong>{p.name}</strong>
                      <small>
                        {t("{n}자 작성", { n: p.count })} · {date(p.updatedAt)}
                        {p.id === currentId ? " · " + t("현재 작업") : ""}
                      </small>
                    </div>
                    {p.id !== currentId &&
                      (confirming === p.id ? (
                        <span className="sg-account-actions">
                          <button
                            type="button"
                            className="is-danger"
                            onClick={() => remove(p.id)}
                          >
                            {t("영구 삭제")}
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirming(null)}
                          >
                            {t("취소")}
                          </button>
                        </span>
                      ) : (
                        <span className="sg-account-actions">
                          <button
                            type="button"
                            onClick={() => {
                              onOpenProject(p.id);
                              onClose();
                            }}
                          >
                            {t("열기")}
                          </button>
                          <button
                            type="button"
                            aria-label={t("{name} 프로젝트 삭제", {
                              name: p.name,
                            })}
                            onClick={() => setConfirming(p.id)}
                          >
                            {t("삭제")}
                          </button>
                        </span>
                      ))}
                  </li>
                ))}
              </ul>
            )}
            <button
              type="button"
              className="sg-account-link"
              onClick={() => {
                onManageProjects();
                onClose();
              }}
            >
              {t("새 폰트 시작은 ‘내 폰트’에서 →")}
            </button>
            <h3>{t("내보낸 폰트 파일")}</h3>
            {exports.length === 0 ? (
              <p className="settings-help">
                {t(
                  "아직 내보낸 폰트가 없어요. 폰트 완성 단계에서 내려받으면 여기에 기록돼요.",
                )}
              </p>
            ) : (
              <>
                <ul className="sg-account-list">
                  {exports.map((record) => (
                    <li key={record.at + record.file}>
                      <div>
                        <strong>{record.file}</strong>
                        <small>
                          {record.projectName} ·{" "}
                          {record.script === "ja" ? "日本語" : t("한글")} ·{" "}
                          {date(record.at)}
                        </small>
                      </div>
                      {record.projectId !== currentId && (
                        <button
                          type="button"
                          onClick={() => {
                            onOpenProject(record.projectId);
                            onClose();
                          }}
                        >
                          {t("열기")}
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
                <p className="settings-help">
                  {t(
                    "파일은 기기에 저장돼 있어요. 다시 받으려면 그 프로젝트를 열고 폰트 완성 → 내보내기를 눌러 주세요.",
                  )}
                </p>
                <button
                  type="button"
                  className="sg-account-link"
                  onClick={() => {
                    clearExportHistory();
                    setExports([]);
                  }}
                >
                  {t("기록 지우기")}
                </button>
              </>
            )}
          </div>
        )}

        {tab === "payments" && (
          <div className="sg-account-body" role="tabpanel">
            <p className="sg-account-badge">
              {t(
                "베타 기간이라 결제한 내역이 없어요. 아래는 정식 출시 후 보일 화면의 예시예요.",
              )}
            </p>
            <table className="sg-account-table">
              <thead>
                <tr>
                  <th>{t("날짜")}</th>
                  <th>{t("항목")}</th>
                  <th>{t("금액")}</th>
                  <th>{t("상태")}</th>
                </tr>
              </thead>
              <tbody>
                {SAMPLE_PAYMENTS.map((row) => (
                  <tr key={row.date + row.item} className="is-sample">
                    <td>{row.date}</td>
                    <td>{t(row.item)}</td>
                    <td>{won(row.amount)}</td>
                    <td>{t(row.status)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
