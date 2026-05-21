import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import "./globals.css";
import { listCategories } from "@/lib/queries";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "쇼핑라이브 댓글 아카이브",
  description: "Naver Shopping Live broadcast & comment explorer",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const categories = listCategories();
  return (
    <html
      lang="ko"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-slate-50 text-slate-900">
        <header className="sticky top-0 z-10 bg-white/90 backdrop-blur border-b border-slate-200">
          <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-4">
            <Link href="/" className="font-bold text-lg tracking-tight">
              쇼라 댓글 아카이브
            </Link>
            <nav className="hidden md:flex items-center gap-1 text-sm text-slate-600">
              <Link href="/" className="px-3 py-1.5 rounded hover:bg-slate-100">
                대시보드
              </Link>
              <Link
                href="/categories"
                className="px-3 py-1.5 rounded hover:bg-slate-100"
              >
                카테고리
              </Link>
              <Link
                href="/channels"
                className="px-3 py-1.5 rounded hover:bg-slate-100"
              >
                채널
              </Link>
              <Link
                href="/analytics"
                className="px-3 py-1.5 rounded hover:bg-slate-100"
              >
                분석
              </Link>
              <Link
                href="/search"
                className="px-3 py-1.5 rounded hover:bg-slate-100"
              >
                검색
              </Link>
            </nav>
            <div className="ml-auto flex items-center gap-1 text-xs text-slate-500 overflow-x-auto">
              {categories.map((c) => (
                <Link
                  key={c.category_id}
                  href={`/categories/${encodeURIComponent(c.category_id)}`}
                  className="whitespace-nowrap px-2 py-1 rounded hover:bg-slate-100 hover:text-slate-700"
                >
                  {c.name}
                </Link>
              ))}
            </div>
          </div>
        </header>
        <main className="flex-1">{children}</main>
        <footer className="border-t border-slate-200 py-4 text-center text-xs text-slate-500">
          built on Next.js · data archived from shoppinglive.naver.com
        </footer>
      </body>
    </html>
  );
}
