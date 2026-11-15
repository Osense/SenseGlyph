# 안드로이드 앱 (Capacitor)

웹에서 만든 화면(`out/`)을 그대로 앱 안에 담아 인터넷 없이도 돌아가는 안드로이드 앱으로 만듭니다.

- 앱 ID: `studio.osns.senseglyph`, 이름: 쎈스 글리프
- 웹과 다른 점(앱에서만): `lib/native.ts`
  - **내려받기**: 기기의 `다운로드/SenseGlyph` 폴더에 저장(안 되면 `문서/SenseGlyph`). 안드로이드 10 이하는 처음 한 번 저장 권한을 묻습니다.
  - **공유하기**: 안드로이드 공유 창으로 카카오톡·네이버 웍스·메일·드라이브 등에 바로 보냅니다(모든 형식).
  - **JSON 백업**도 같은 폴더에 저장. 가져오기는 파일 고르기 창으로.
  - 오프라인 저장(서비스 워커)은 쓰지 않습니다(파일이 앱 안에 있음).

## APK 만들기

필요: Node 22, JDK 21, Android SDK(platform 36, build-tools 36). `android/local.properties` 에 `sdk.dir=…`.

```bash
npm run android:apk
# 결과: android/app/build/outputs/apk/debug/app-debug.apk
```

웹 화면을 고친 뒤에는 `npm run android:sync` 로 앱에 다시 담고 APK 를 다시 만듭니다.
(GitHub Pages 용 배포 `npm run deploy` 와 달리 주소 앞부분(`/SenseGlyph`) 없이 만듭니다.)

## 플레이스토어 출시 전에

- 지금 APK 는 **디버그 서명**이라 직접 설치(테스트)용입니다.
- 출시용은 업로드 키(keystore)를 만들어 `./gradlew bundleRelease` 로 AAB 를 만들고 서명합니다.
  키 파일과 비밀번호는 잃어버리면 앱을 업데이트할 수 없으니 레포가 아닌 안전한 곳에 보관하세요.
- 버전: `android/app/build.gradle` 의 `versionCode`(정수, 올릴 때마다 +1)·`versionName`(0.2.32).

## 개인정보처리방침 주소 (Play 스토어 등록용)

- https://osense.github.io/SenseGlyph/privacy/ — 한국어·일본어·영어. 앱 안에서는 설정 → 개인정보·이용 안내.
- 방문 집계는 `lib/analytics.ts`(Abacus 카운터, 쿠키 없음, 설정에서 끌 수 있음). 수집 범위를 바꾸면 `components/LegalNotice.tsx` 안내도 함께 고친다.
- 누적 숫자 확인: `https://abacus.jasoncameron.dev/get/osense-senseglyph/web-visits` (`web-visitors`, `web-exports`, 앱은 `android-…`).
