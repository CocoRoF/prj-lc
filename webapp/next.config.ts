import type { NextConfig } from "next";

// Standalone 으로 실행할 때는 NEXT_PUBLIC_BASE_PATH 를 비워 두고,
// 외부 호스트(hr_blog2.0) 의 /embed/prj-lc 아래에 마운트될 때만 prefix 를 적용한다.
// Next.js 의 basePath/assetPrefix 는 build/start 시점에 평가되므로 env 가 미설정이면
// 기존 동작(루트 마운트) 이 그대로 유지된다.
const basePath = process.env.NEXT_PUBLIC_BASE_PATH?.trim() || "";

const nextConfig: NextConfig = {
  serverExternalPackages: ["archiver", "exceljs"],
  ...(basePath ? { basePath, assetPrefix: basePath } : {}),
};

export default nextConfig;
