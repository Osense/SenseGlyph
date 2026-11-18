// WSNS studio 제품 공통 머리글 로고: 2×2 WSNS 마크 + 제품 이름 + "WSNS studio [웨스엔에스 스튜디오]".
// (쎈스 초퍼·쎈스 디렉터와 같은 방식. 로고와 읽는 법을 함께 보여 주는 것이 규칙)
import { BASE_PATH } from "../lib/base-path";
import { cn } from "@/lib/utils";

export function WsnsMark({ className }: { className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={BASE_PATH + "/brand/wsns-mark.svg"}
      alt=""
      width={166}
      height={212}
      draggable={false}
      className={cn("block h-[34px] w-auto shrink-0", className)}
    />
  );
}

/** WSNS studio [웨스엔에스 스튜디오] — 읽는 법은 브랜드 그라데이션 */
export function WsnsPron({
  className,
  hideEnglish,
}: {
  className?: string;
  /** 좁은 화면에서 영문을 숨길 클래스(예: "max-sm:hidden") */
  hideEnglish?: string;
}) {
  return (
    <small
      className={cn(
        "block text-[10.5px] font-semibold tracking-[-0.01em] whitespace-nowrap text-muted-foreground",
        className,
      )}
    >
      <span className={hideEnglish}>WSNS studio </span>
      <span className="text-brand-grad font-bold">[웨스엔에스 스튜디오]</span>
    </small>
  );
}

/** 제품 이름이 붙은 가로형 로고 */
export function WsnsWordmark({
  product,
  className,
  markClassName,
  nameClassName,
}: {
  product: string;
  className?: string;
  markClassName?: string;
  nameClassName?: string;
}) {
  return (
    <span
      className={cn(
        "group/brand inline-flex min-w-0 items-center gap-2.5 select-none",
        className,
      )}
    >
      <WsnsMark
        className={cn(
          "transition-transform duration-300 group-hover/brand:scale-105 group-hover/brand:-rotate-[5deg]",
          markClassName,
        )}
      />
      <span className="grid min-w-0 leading-[1.15]">
        <b
          className={cn(
            "truncate text-[16px] font-extrabold tracking-[-0.03em] text-foreground",
            nameClassName,
          )}
        >
          {product}
        </b>
        <WsnsPron className="mt-0.5" hideEnglish="max-[420px]:hidden" />
      </span>
    </span>
  );
}
