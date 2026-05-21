# prj-lc — Naver Shopping Live 아카이브

`shoppinglive.naver.com` 의 **카테고리 → 방송 → 댓글** 전체를 크롤링하고, 단일 SQLite DB로 정리한 뒤 Next.js 웹앱으로 탐색·다운로드·분석할 수 있는 풀스택 파이프라인입니다.

| 단계 | 산출물 |
|---|---|
| 크롤러 (Python · Playwright · requests) | `data/*.csv` |
| ETL (Python · sqlite3) | `db/lc.sqlite` (FTS5 색인 포함) |
| 분석 (Python · f2a) | `webapp/public/analytics/{data,reports}/` |
| 웹앱 (Next.js 16 · better-sqlite3) | http://localhost:3000 |

## 데이터 스냅샷

| | 개수 |
|---|---:|
| 카테고리 | 9 |
| 채널 | 3,622 |
| 방송 (전체) | 19,256 |
| └ 종영 방송 (Stage 3 대상) | 5,097 |
| └ 숏클립 | 14,145 |
| 상품 | 4,316 |
| **댓글** | **4,703,470** |
| 댓글 보유 방송 | 4,219 |

---

## 빠른 시작 (5분, 크롤링 없이 탐색만)

> 이미 커밋된 CSV 청크 → DB 복원 → 웹앱 실행. 데이터를 새로 긁지 않습니다.

### 사전 준비
| 도구 | 버전 |
|---|---|
| Python | 3.10+ |
| Node.js | 20+ (테스트는 22.17) |
| OS | Windows / macOS / Linux 모두 가능 (Windows 11에서 검증) |

### 단계
```powershell
# 1) Python 패키지 설치
pip install -r requirements.txt

# 2) 분할된 댓글 CSV 청크 → 단일 comments.csv 로 복원 (~10초)
python etl/split_comments.py --merge

# 3) SQLite DB 빌드 — 인덱스/FTS5/comment_count 모두 (~30초)
python etl/build_db.py

# 4) (선택) 분석 데이터 새로 만들기 — 기본은 이미 커밋되어 있음
python etl/analytics.py --skip-f2a    # KPI JSON만, 빠름
python etl/analytics.py               # f2a HTML 리포트까지

# 5) 웹앱 실행
cd webapp
cp .env.example .env.local    # 또는 직접 작성: DB_PATH=../db/lc.sqlite
npm install
npm run dev                   # http://localhost:3000
```

브라우저에서 http://localhost:3000 접속하면 끝.

---

## 어떤 페이지가 있나?

| 경로 | 설명 |
|---|---|
| `/` | 대시보드 — 총계 KPI · 일별 댓글 추이 · 상위 채널/방송 · 상위 단어/이모지 |
| `/categories` | 9개 카테고리 카드 (방송 수·댓글 수) |
| `/categories/[id]` | 카테고리별 방송 리스트, 정렬·페이지네이션, 일괄 ZIP 다운로드 |
| `/channels` | 채널 리스트 (정렬: 댓글합·방송수·이름) |
| `/channels/[id]` | 채널 상세 + 그 채널의 방송 |
| `/broadcasts/[id]` | **방송 상세** — 가상 스크롤 댓글 타임라인 (151K행도 60fps), 상품 패널, CSV/XLSX 다운로드 |
| `/analytics` | **분석** — 4탭(개요·시계열·텍스트·f2a 리포트) |
| `/search?q=…` | 방송·채널 통합 검색 (3자↑ trigram FTS5 / 2자↓ LIKE 폴백) |

## API & 다운로드

| 엔드포인트 | 동작 |
|---|---|
| `GET /api/comments?bid=…&cursor=…&limit=200` | 댓글 forward 페이지네이션 (커서 = comment_no) |
| `GET /api/search?q=…&kind=broadcast\|channel\|all` | FTS5 통합 검색 |
| `GET /api/download/broadcast/{id}.csv` | 단일 방송 댓글 CSV (UTF-8 BOM 스트리밍) |
| `GET /api/download/broadcast/{id}.xlsx` | 단일 방송 워크북 (방송·상품·댓글 3시트) |
| `GET /api/download/category/{id}.zip?with_comments=1&limit=N` | 카테고리 방송별 .xlsx ZIP (스트리밍) |
| `GET /api/download/all?with_comments=1&limit=N` | 전체 방송 ZIP (카테고리 폴더 분류, 스트리밍, ~수십 MB RAM) |

상세는 [`webapp/README.md`](webapp/README.md).

---

## 처음부터 다시 크롤링하기 (~수 시간)

> 데이터를 갱신하거나 새로 수집하고 싶을 때만 필요합니다.

```powershell
# 0) Playwright Chromium 다운로드 (~100 MB, 1회)
python -m playwright install chromium

# 1) 카테고리 + 전시 (~5초)
python stage1_categories.py

# 2) 카테고리별 방송 (Playwright 응답 가로채기, ~30분)
python stage2_broadcasts.py
#   • --cats dc:1 dc:2          특정 카테고리만
#   • --max-scrolls 50          빠른 테스트

# 3) 종영 방송 댓글 수집 (5,097 방송, ~3시간)
python stage3_comments.py --resume
#   • --resume                  data/_stage3_done.txt 사이드카로 중간 재개
#   • --id 1925166              단일 방송 테스트
#   • --limit 100               처음 N개만

# 4) ETL & 분석 재생성
python etl/build_db.py
python etl/analytics.py
```

진행 중인 통계 확인:
```powershell
python summary.py
```

---

## 프로젝트 구조

```
prj-lc/
├── stage1_categories.py        Stage 1 (정적 HTML, requests)
├── stage2_broadcasts.py        Stage 2 (Playwright)
├── stage3_comments.py          Stage 3 (직접 API, 페이지네이션, --resume)
├── stage2_capture_probe.py     Stage 2 응답 구조 탐색용 (1회성)
├── stage3_capture_probe.py     Stage 3 댓글 엔드포인트 탐색용 (1회성)
├── stage3_endpoint_probe.py    Stage 3 페이지네이션 파라미터 탐색용 (1회성)
├── run_all.py                  세 단계 일괄 실행
├── summary.py                  현재 데이터 통계 출력
│
├── etl/
│   ├── build_db.py             CSV → db/lc.sqlite (인덱스 + FTS5)
│   ├── analytics.py            KPI JSON + f2a HTML 리포트
│   └── split_comments.py       comments.csv ↔ 분할 청크 (git 친화)
│
├── data/                       Stage 1~3 산출물
│   ├── categories.csv          (committed)
│   ├── exhibitions.csv         (committed)
│   ├── broadcasts.csv          (committed, 10.8 MB)
│   ├── broadcast_products.csv  (committed, 1.7 MB)
│   ├── channels.csv            (committed, 0.8 MB)
│   ├── comments.csv            ⚠ 855 MB, NOT committed (split parts에서 재생성)
│   ├── comments.parts/         comments.part-{000..009}.csv (≤95 MB, committed)
│   └── _capture/               ⚠ 119 MB 디버그 캡처, NOT committed
│
├── db/
│   └── lc.sqlite               ⚠ 837 MB, NOT committed (etl/build_db.py 로 재생성)
│
├── utils/                      공용 헬퍼 (HTTP 세션, CSV I/O, NEXT_DATA 파서)
├── config.py                   경로·상수·encoding
└── webapp/                     Next.js 16 — 자세히는 webapp/README.md
    ├── src/app/                App Router 페이지/API
    ├── src/components/         UI 컴포넌트 (차트·타임라인)
    ├── src/lib/                DB·쿼리·내보내기·분석 로더
    └── public/analytics/       precomputed JSON + f2a HTML (committed)
```

---

## 자주 묻는 질문

**Q. `data/comments.csv` 가 없다고 합니다.**
A. `python etl/split_comments.py --merge` 실행. `data/comments.parts/comments.part-*.csv` 10개에서 단일 파일로 재조립합니다 (SHA256 검증 통과).

**Q. 웹앱이 `DB not found` 라고 합니다.**
A. `db/lc.sqlite` 가 없습니다. 위 Quick Start 의 3단계(`python etl/build_db.py`)를 실행. DB는 git에 포함되지 않습니다.

**Q. `npm run dev` 가 포트 3000이 점유돼 있다고 합니다.**
A. 다른 dev 서버가 떠 있거나 좀비 프로세스입니다. Windows에서:
```powershell
netstat -ano | findstr :3000
taskkill /F /PID <PID>
```

**Q. 한글이 깨져 보입니다 (Windows 콘솔).**
A. CSV 파일은 UTF-8-SIG 입니다. PowerShell/cmd 콘솔에서 한글 출력은 깨질 수 있지만 **저장된 파일과 웹앱에서는 정상**입니다. 콘솔에서 보려면 `python -X utf8 …` 로 실행.

**Q. Playwright 설치가 느립니다.**
A. Chromium 바이너리 ~110 MB 다운로드. `python -m playwright install chromium --with-deps` (Linux) 또는 일반 `--install chromium` (Windows/macOS) 한 번만 실행하면 됩니다.

**Q. Stage 3 가 도중에 멈췄습니다.**
A. `python stage3_comments.py --resume` 으로 재시작. `data/_stage3_done.txt` 사이드카에 완료된 방송이 누적되어 있어 중복 작업 없이 이어갑니다.

**Q. comments.csv 가 너무 커서 Excel에서 열리지 않습니다.**
A. 4.7 M 행이라 그렇습니다. 웹앱의 `/broadcasts/[id]` 페이지의 **CSV/XLSX 다운로드** 또는 `/api/download/category/{id}.zip` 으로 방송 단위로 분리해 받으세요.

---

## 발견된 API 엔드포인트 (역공학 메모)

- **Stage 2 — 카테고리 방송 목록**
  `GET https://apis.naver.com/selectiveweb/live_commerce_web/v1/category/gathering`
  쿼리: `categoryId=dc:N`, `sort=LATEST`, `size=10`, `next=<cursor>`
  무한스크롤로 `next` 따라가며 페이지네이션
- **Stage 3 — 종영 방송 댓글**
  `GET https://apis.naver.com/live_commerce_web/viewer_api_web/v1/broadcast/{id}/replays/comments`
  쿼리: `size=100`, `lastCommentNo=<cursor>`, `slSessionId=<uuid>`
  헤더: `x-external-service-id: shoppinglive`
  forward 페이지네이션 (오래된 → 새로운). `hasNext=false` 까지 반복

## 정중함·안전 장치

- Stage 3: 요청 사이 0.5–1.5초 jittered sleep
- Stage 2: 카테고리당 200 스크롤 한도, 3회 연속 신규 0이면 조기 종료
- Stage 3: 모든 쓰기 후 `fout.flush()` + `data/_stage3_done.txt` append → 중간 종료 안전
- CSV: `QUOTE_ALL` + escapechar + 제어문자 sanitize → 4.7M 행 무손실 보장
- DB: read-only 모드 + 200 MB cache + 256 MB mmap

## 라이선스 & 책임

수집 데이터는 모두 공개된 라이브 방송의 시청자 채팅입니다. 분석·연구·아카이브 목적의 사용을 가정하며, **재배포 시 네이버의 이용약관 및 개인정보 보호 규정을 따르세요.** 시청자 닉네임은 그대로 저장되어 있으므로 공유 시 익명화 처리가 필요할 수 있습니다.

---

이 저장소는 한 줄 명령으로 처음부터 끝까지 재현 가능하도록 설계되었습니다. 문제가 생기면 [Issues] 에 남겨주세요.
