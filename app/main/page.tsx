'use client';

import { useState } from 'react';
import QRScanner from '../components/QRScanner';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function Home() {
  const [showScanner, setShowScanner] = useState(false);
  const router = useRouter();

  const handleQRCodeScanned = (userId: string) => {
    router.push(`/chat/${userId}`);
  };

  return (
    <main className="flex min-h-screen flex-col bg-white">
      {/* 헤더 */}
      <header className="flex justify-between items-center p-4">
        <Link href="/login">
          <h1 className="text-[#8BB6FF] text-2xl font-bold">RSLT</h1>
        </Link>
        <div className="flex gap-2">
          <button className="p-2">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <Link href="/mypage">
            <button className="p-2">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </button>
          </Link>
        </div>
      </header>

      {/* 메인 컨텐츠 */}
      <div className="flex-1 flex flex-col items-center justify-center p-4">
        {!showScanner ? (
          <button
            onClick={() => setShowScanner(true)}
            className="w-32 h-32 rounded-full bg-[#8BB6FF] text-white flex flex-col items-center justify-center hover:bg-[#7AA5FF] transition-colors"
          >
            <div className="mb-2">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </div>
            <span className="text-sm">새 대화 시작하기</span>
          </button>
        ) : (
          <div className="w-full max-w-md">
            <QRScanner onQRCodeScanned={handleQRCodeScanned} />
            <button
              onClick={() => setShowScanner(false)}
              className="mt-4 w-full bg-gray-500 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded"
            >
              취소
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
