import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** shadcn/ui 규칙: 조건부 클래스를 합치고 겹치는 Tailwind 클래스는 뒤의 것을 남긴다. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
