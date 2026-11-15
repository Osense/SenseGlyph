// 안드로이드 앱(Capacitor)에서 파일을 저장·공유하는 다리.
// 앱 안의 화면(WebView)은 브라우저처럼 <a download> 로 파일을 받거나 navigator.share 로
// 파일을 보낼 수 없어서, 앱에서는 기기 저장소와 안드로이드 공유 창을 직접 씁니다.
// 웹(브라우저)에서는 아무것도 하지 않고 기존 방식을 그대로 씁니다.
import { Capacitor } from "@capacitor/core";

export function isNativeApp() {
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}

function toBase64(data: ArrayBuffer | string) {
  const bytes =
    typeof data === "string"
      ? new TextEncoder().encode(data)
      : new Uint8Array(data);
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk)
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  return btoa(binary);
}

const FOLDER = "SenseGlyph";

/**
 * 기기의 '다운로드/SenseGlyph' 폴더에 저장한다. 안 되면 '문서/SenseGlyph' 에 저장한다.
 * 저장한 곳을 사람이 읽을 수 있는 말로 돌려준다.
 */
export async function saveToDevice(
  name: string,
  data: ArrayBuffer | string,
): Promise<string> {
  const { Filesystem, Directory } = await import("@capacitor/filesystem");
  // 안드로이드 10 이하는 저장 권한이 필요하다(11 이상은 다운로드 폴더에 바로 쓸 수 있음).
  try {
    const status = await Filesystem.checkPermissions();
    if (status.publicStorage !== "granted")
      await Filesystem.requestPermissions();
  } catch {
    /* 권한을 묻지 않는 기기 */
  }
  const base64 = toBase64(data);
  const attempts: {
    directory: (typeof Directory)[keyof typeof Directory];
    path: string;
    label: string;
  }[] = [
    {
      directory: Directory.ExternalStorage,
      path: `Download/${FOLDER}/${name}`,
      label: `다운로드/${FOLDER}`,
    },
    {
      directory: Directory.Documents,
      path: `${FOLDER}/${name}`,
      label: `문서/${FOLDER}`,
    },
  ];
  let lastError: unknown;
  for (const attempt of attempts) {
    try {
      await Filesystem.writeFile({
        path: attempt.path,
        data: base64,
        directory: attempt.directory,
        recursive: true,
      });
      return attempt.label;
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError instanceof Error
    ? lastError
    : new Error("저장하지 못했어요.");
}

/** 안드로이드 공유 창(카카오톡, 네이버 웍스, 메일, 드라이브 등)으로 파일을 보낸다. */
export async function shareFromDevice(
  name: string,
  data: ArrayBuffer | string,
  text = "내 손글씨로 만든 폰트예요.",
) {
  const { Filesystem, Directory } = await import("@capacitor/filesystem");
  const { Share } = await import("@capacitor/share");
  const written = await Filesystem.writeFile({
    path: `share/${name}`,
    data: toBase64(data),
    directory: Directory.Cache,
    recursive: true,
  });
  try {
    await Share.share({
      title: name,
      text,
      files: [written.uri],
      dialogTitle: "폰트 보내기",
    });
  } catch (error) {
    // 사람이 공유 창을 닫은 경우는 오류가 아니다.
    if (error instanceof Error && /cancel/i.test(error.message)) return;
    throw error;
  }
}
