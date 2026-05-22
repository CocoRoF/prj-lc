// next/link 의 <Link> 와 useRouter 만 NEXT_PUBLIC_BASE_PATH 를 자동 prefix 한다.
// raw <a href=…>, <img src=…>, fetch(…) 등은 자동 처리되지 않으므로 origin-relative
// URL 을 직접 만드는 경우 이 helper 를 통해 basePath 를 붙여야 한다.
//
// process.env.NEXT_PUBLIC_BASE_PATH 는 build 시점에 string 으로 inline 되므로
// runtime cost 0 — 그대로 사용해도 안전.
const BASE = (process.env.NEXT_PUBLIC_BASE_PATH ?? "").replace(/\/$/, "");

export function withBasePath(path: string): string {
  if (!path.startsWith("/")) return path;
  return BASE + path;
}
