# 공모주 노트: GitHub + Vercel 배포 안내

## 1. GitHub에 올리기
1. GitHub → New repository → 이름 예: `ipo-note-demo` → Create repository
2. "uploading an existing file" 링크(또는 Add file → Upload files)를 눌러요.
3. `Downloads\공모주노트_github` 폴더 **안의 내용 전체**를 끌어다 놓아요.
   - `api` 폴더도 폴더째 끌어다 놓아야 `api/yujin/[model].js` 경로가 유지돼요.
   - `.nojekyll`은 숨김 파일이에요. 탐색기 보기 → 숨긴 항목을 켜면 보여요(Vercel에는 필요 없어요).
4. Commit changes를 눌러요.
5. 저장소 화면에서 `api/yujin/[model].js`, `vercel.json`, `index.html`, `detail.html`이 보이는지 확인해요.

## 2. Vercel에 배포하기
1. https://vercel.com → Sign Up(또는 Log in) → **Continue with GitHub**
2. Add New… → **Project** → 방금 만든 저장소 옆 **Import**
3. 설정 화면에서
   - Framework Preset: **Other**
   - Root Directory: 그대로(./)
   - Build Command / Output Directory: 비워 두기
   - **Environment Variables**: Key에 `GEMINI_API_KEY`, Value에 AI Studio에서 복사한 키를 붙여 넣고 Add
4. **Deploy**를 눌러요. 1분쯤 뒤 `https://ipo-note-demo-xxxx.vercel.app` 주소가 생겨요.

## 3. 확인
1. 주소를 열면 공모주 노트 첫 화면이 보여요.
2. 종목을 눌러 유진이를 열면 위쪽에 **"AI 연결됨 · Gemini(서버)"**가 보여야 해요.
3. 질문해서 답 아래에 `Gemini(gemini-3.8-flash)` 같은 모델 이름이 나오면 성공이에요.
4. 브라우저 주소창에 `<주소>/api/yujin/health`를 열면 `{"ok":true,"ai":true}`가 보여야 해요. `"ai":false`면 환경변수가 빠진 거예요(넣은 뒤 Deployments → Redeploy).

## 4. 문제가 생기면
- Vercel 프로젝트 → **Logs**에서 오류를 확인해요.
- 유진이 ⚙ → **진단 로그 파일로 저장**으로 로그를 받아요.

## 5. 시연이 끝나면
- Vercel 프로젝트 → Settings → 맨 아래 **Delete Project**
- AI Studio에서 쓴 키를 삭제하거나 새로 바꿔요.
