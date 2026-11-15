"use client";
// 다음 단계로 넘어가기 전에 한 번 묻는 창. 무엇을 했고 다음에 무엇을 하는지 짧게 알려 주고,
// '네'를 눌러야 넘어간다. '다음부터 묻지 않기'를 고르면 설정에서 다시 켤 때까지 묻지 않는다.
import { useState } from "react";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { useT } from "../lib/i18n";

export interface StepAsk {
  question: string;
  detail: string;
  yes: string;
  no: string;
}

export default function StepQuestion({
  ask,
  onYes,
  onNo,
}: {
  ask: StepAsk;
  onYes: (stopAsking: boolean) => void;
  onNo: () => void;
}) {
  const t = useT();
  const [stop, setStop] = useState(false);
  return (
    <AlertDialog open onOpenChange={(open) => !open && onNo()}>
      <AlertDialogContent
        className="sg-ask sm:max-w-[440px]"
        onOverlayClick={onNo}
      >
        <AlertDialogHeader>
          <AlertDialogTitle id="sg-ask-question" className="text-xl">
            {ask.question}
          </AlertDialogTitle>
          <AlertDialogDescription
            id="sg-ask-detail"
            className="font-serif text-[14.5px] leading-[1.7] break-keep"
          >
            {ask.detail}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="sg-ask-actions gap-2">
          <Button
            type="button"
            variant="outline"
            className="sg-ask-no"
            onClick={onNo}
          >
            {ask.no}
          </Button>
          <Button
            type="button"
            autoFocus
            className="sg-ask-yes"
            onClick={() => onYes(stop)}
          >
            {ask.yes}
          </Button>
        </AlertDialogFooter>
        <label className="sg-ask-stop flex cursor-pointer items-center gap-2.5 border-t border-divider pt-4 text-[13px] text-muted-foreground">
          <input
            type="checkbox"
            className="size-[18px] cursor-pointer accent-[var(--accent)]"
            checked={stop}
            onChange={(event) => setStop(event.target.checked)}
          />
          {t("다음부터 묻지 않고 바로 넘어가기")}
        </label>
      </AlertDialogContent>
    </AlertDialog>
  );
}
