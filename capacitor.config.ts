import type { CapacitorConfig } from "@capacitor/cli";

// 안드로이드 앱: 'npm run build'(주소 앞부분 없이)로 만든 out/ 을 앱 안에 담는다.
const config: CapacitorConfig = {
  appId: "studio.osns.senseglyph",
  appName: "쎈스 글리프",
  webDir: "out",
  android: {
    backgroundColor: "#f7f1ef",
    // 펜·손가락으로 쓰는 앱이라 길게 눌러 확대·텍스트 선택 같은 웹 동작을 줄인다.
    allowMixedContent: false,
  },
};

export default config;
