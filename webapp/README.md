# webapp — Naver Shopping Live 댓글 아카이브 (Next.js 16)

> 데이터 출처는 상위 디렉토리(`../data/*.csv`)에서 ETL로 만들어진 `../db/lc.sqlite` (single SQLite file with FTS5).

## 실행
```bash
# 1) DB 빌드 (1회)
cd ..
python etl/build_db.py    # data/*.csv  ->  db/lc.sqlite  (~837MB)

# 2) 웹앱 실행
cd webapp
npm install               # 1회
npm run dev               # http://localhost:3000
```

`.env.local`의 `DB_PATH=../db/lc.sqlite`로 DB 위치 지정.

## 페이지

| 경로 | 설명 |
|---|---|
| `/` | 대시보드 — 총계, 카테고리별 분포, 상위 채널·방송, 전체 ZIP 다운로드 |
| `/categories` | 9개 카테고리 카드 (방송수·댓글수) |
| `/categories/[id]` | 카테고리별 방송 리스트, 정렬·페이지네이션, 카테고리 일괄 ZIP |
| `/channels` | 채널 리스트 (정렬: 댓글합·방송수·이름) |
| `/channels/[id]` | 채널 상세 + 방송 리스트 |
| `/broadcasts/[id]` | 방송 상세, **react-virtuoso 가상 스크롤 댓글 타임라인**, 상품 패널, CSV/XLSX 다운로드 |
| `/search?q=...` | 방송·채널 통합 검색 (3자 이상 trigram FTS5 / 2자 이하 LIKE 폴백) |

## API 라우트

| 메서드 + 경로 | 동작 |
|---|---|
| `GET /api/comments?bid=...&cursor=...&limit=200` | 방송 댓글 forward 페이지네이션 (커서 = comment_no) |
| `GET /api/search?q=...&kind=broadcast\|channel\|all&limit=30` | 방송 제목/설명 + 채널명 검색 |
| `GET /api/download/broadcast/[id].csv` | 단일 방송 댓글 CSV (UTF-8 BOM 스트리밍) |
| `GET /api/download/broadcast/[id].xlsx` | 단일 방송 워크북 (시트: broadcast / products / comments) |
| `GET /api/download/category/[id].zip?with_comments=1&limit=N` | 카테고리 내 방송별 xlsx ZIP (스트리밍) |
| `GET /api/download/all?with_comments=1&limit=N` | 전체 방송 xlsx ZIP (카테고리 폴더 분류, 스트리밍) |

## 핵심 기술

- **better-sqlite3** read-only + WAL + 200MB cache + 256MB mmap
- **FTS5 trigram tokenizer**로 한글 부분일치 검색
- **react-virtuoso**로 151K 행 댓글도 60fps 유지
- ZIP 다운로드는 **archiver 8.x ESM** `new ZipArchive(...)` + Node `PassThrough` → `ReadableStream` (메모리 ≤ 수십 MB로 4,219개 방송 처리 가능)

## 메모

- `dc:N` 카테고리 ID의 `:`는 URL에서 `%3A`로 인코딩 → 페이지에서 `decodeURIComponent` 필수
- 다운로드 파일명은 RFC 5987 `filename*=UTF-8''…`로 한글·이모지 보존
