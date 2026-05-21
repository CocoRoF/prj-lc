# webapp — Next.js 16 explorer

> 상위 [`README.md`](../README.md) 의 "빠른 시작" 5단계를 먼저 따라 `../db/lc.sqlite` 가 존재하는지 확인하세요.

## 실행

```bash
cp .env.example .env.local        # DB_PATH=../db/lc.sqlite
npm install
npm run dev                       # http://localhost:3000
```

프로덕션 빌드:
```bash
npm run build
npm start                         # 기본 3000 포트
```

`.env.local` 항목:
| 키 | 기본값 | 설명 |
|---|---|---|
| `DB_PATH` | `../db/lc.sqlite` | better-sqlite3 가 열 SQLite 파일 경로 (상대 경로면 `webapp/` 기준) |

## 페이지

| 경로 | 설명 |
|---|---|
| `/` | 대시보드 — 6개 KPI + 일별 차트 + 카테고리 분포 + 상위 채널·방송·단어·이모지 |
| `/categories` | 9개 카테고리 카드 |
| `/categories/[id]?sort=&page=&shortclips=include` | 카테고리별 방송 리스트 (50/page) |
| `/channels?sort=&page=` | 채널 리스트 (50/page) |
| `/channels/[id]?sort=` | 채널 상세 + 방송 |
| `/broadcasts/[id]` | 가상 스크롤 댓글 타임라인 + 상품 패널 + 다운로드 |
| `/analytics?tab=overview\|timeseries\|text\|reports` | 분석 4탭 |
| `/search?q=…` | 통합 검색 |

## API

| 메서드 + 경로 | 응답 |
|---|---|
| `GET /api/comments?bid=…&cursor=…&limit=200` | `{ items, nextCursor, total }` |
| `GET /api/search?q=…&kind=broadcast\|channel\|all&limit=30` | `{ broadcasts, channels }` |
| `GET /api/download/broadcast/{id}.csv` | UTF-8 BOM CSV 스트리밍 |
| `GET /api/download/broadcast/{id}.xlsx` | 3시트 xlsx (broadcast/products/comments) |
| `GET /api/download/category/{id}.zip?with_comments=1&limit=N` | 카테고리 .xlsx ZIP |
| `GET /api/download/all?with_comments=1&limit=N` | 전체 .xlsx ZIP (스트리밍, ≤수십 MB RAM) |

## 디렉토리

```
webapp/
├── src/app/
│   ├── layout.tsx                  공통 헤더 (네비 + 카테고리 목록)
│   ├── page.tsx                    /
│   ├── categories/page.tsx         /categories
│   ├── categories/[id]/page.tsx    /categories/:id
│   ├── channels/page.tsx
│   ├── channels/[id]/page.tsx
│   ├── broadcasts/[id]/page.tsx
│   ├── analytics/page.tsx          4탭 라우팅
│   ├── search/page.tsx
│   └── api/
│       ├── comments/route.ts
│       ├── search/route.ts
│       └── download/
│           ├── broadcast/[id]/route.ts    .csv | .xlsx
│           ├── category/[id]/route.ts     .zip (ZipArchive 스트리밍)
│           └── all/route.ts               전체 .zip 스트리밍
├── src/components/
│   ├── CommentTimeline.tsx         react-virtuoso 가상 스크롤
│   └── charts/
│       ├── DailyChart.tsx          Recharts AreaChart
│       ├── HBarChart.tsx           가로 막대
│       ├── VBarChart.tsx           세로 막대
│       └── Heatmap.tsx             요일×시간 (커스텀)
├── src/lib/
│   ├── db.ts                       better-sqlite3 singleton (read-only)
│   ├── queries.ts                  도메인 쿼리 모음
│   ├── analytics.ts                public/analytics/data/*.json 로더
│   ├── export.ts                   CSV 스트림 / xlsx 빌더
│   ├── types.ts                    공유 타입
│   └── format.ts                   숫자/날짜 포맷
└── public/analytics/
    ├── data/*.json                 precomputed KPIs (커밋됨)
    └── reports/{table}/index.html  f2a HTML (커밋됨)
```

## 기술 메모

- **better-sqlite3** read-only + WAL + 200 MB cache + 256 MB mmap (`src/lib/db.ts`).
  Next.js 16의 `serverExternalPackages` 자동 opt-out 목록에 포함되어 별도 설정 불필요.
- **FTS5 trigram tokenizer** 로 한글 부분일치. 2자 이하 쿼리는 `LIKE` 폴백 (`src/lib/queries.ts → searchBroadcasts`).
- **react-virtuoso** — 151K 댓글 broadcast 도 60 fps 유지. `endReached` 콜백으로 lazy load (`src/components/CommentTimeline.tsx`).
- **archiver 8.x ESM** — `new ZipArchive(...)` (예전 `archiver("zip")` 함수형 API 제거됨) + Node `PassThrough` → `ReadableStream` 으로 변환해 Next 의 `Response` 에 흘려보냄. 메모리 ≤ 수십 MB 로 4,219 방송 ZIP 가능.
- **URL 디코딩** — `dc:N` 같은 카테고리 ID의 `:` 가 URL에서 `%3A` 로 인코딩됨. 모든 동적 라우트에서 `decodeURIComponent(params.id)` 필수.
- **다운로드 파일명** — RFC 5987 `filename*=UTF-8''…` 로 한글·이모지 보존.

## 트러블슈팅

| 증상 | 원인/해결 |
|---|---|
| `DB not found` (500) | `db/lc.sqlite` 없음. `python etl/build_db.py` 실행 |
| `/analytics` 가 비어있음 | `webapp/public/analytics/data/*.json` 없음. `python etl/analytics.py --skip-f2a` |
| `/analytics?tab=reports` 클릭 시 404 | f2a HTML 미생성. `python etl/analytics.py` 실행 (skip-f2a 없이) |
| 포트 3000 점유 | `netstat -ano | grep :3000` → `taskkill /F /PID …` (Windows) |
| 검색 결과 0건 (한글) | curl 같은 도구가 EUC-KR 로 인코딩한 경우. 브라우저나 `encodeURIComponent` 로 UTF-8 인코딩 필요 |

상세 아키텍처는 상위 [`README.md`](../README.md) 의 "프로젝트 구조" 섹션.
