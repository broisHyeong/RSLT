'use client';

import { useEffect, useState } from 'react';
import { auth} from '@/lib/firebase';
import { QRCodeSVG } from 'qrcode.react';  // QR코드 생성을 위한 패키지
import Link from 'next/link';

export default function MyPage() {
  const [userQRCode, setUserQRCode] = useState('');

  useEffect(() => {
    // 현재 로그인한 사용자의 UID를 QR코드 값으로 사용
    const userId = auth.currentUser?.uid;
    if (userId) {
      setUserQRCode(userId);
    }
  }, []);

  return (
    <main className="flex flex-col min-h-screen bg-white">
      {/* 헤더 */}
      <header className="flex items-center p-4 border-b">
        <Link href="/main" className="p-2">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
        <h1 className="flex-1 text-center text-lg font-medium">마이 페이지</h1>
      </header>

      {/* QR 코드 섹션 */}
      <div className="flex flex-col items-center p-6 border-b">
        <div className="bg-white p-4 rounded-lg shadow-md">
          <QRCodeSVG value={userQRCode} size={200} />
        </div>
        <p className="mt-2 text-gray-600">나의 QR코드</p>
      </div>

      {/* 설정 목록 */}
      <div className="flex flex-col">
        <div className="p-4 border-b">
          <h2 className="text-sm text-gray-500">계정 및 설정</h2>
        </div>
        
        <Link href="#" className="flex items-center justify-between p-4 hover:bg-gray-50">
          <span>계정 정보</span>
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-400" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
          </svg>
        </Link>

        <div className="flex items-center justify-between p-4 hover:bg-gray-50">
          <span>다크모드</span>
          <div className="relative inline-block w-10 mr-2 align-middle select-none">
            <input type="checkbox" className="toggle-checkbox absolute block w-6 h-6 rounded-full bg-white border-4 appearance-none cursor-pointer"/>
            <label className="toggle-label block overflow-hidden h-6 rounded-full bg-gray-300 cursor-pointer"></label>
          </div>
        </div>

        <Link href="#" className="flex items-center justify-between p-4 hover:bg-gray-50">
          <span>차단한 사용자</span>
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-400" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
          </svg>
        </Link>

        <div className="p-4 border-b border-t mt-4">
          <h2 className="text-sm text-gray-500">더보기</h2>
        </div>

        <Link href="#" className="flex items-center justify-between p-4 hover:bg-gray-50">
          <span>정보</span>
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-400" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
          </svg>
        </Link>

        <Link href="login" className="flex items-center justify-between p-4 hover:bg-gray-50">
          <span>로그아웃</span>
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-400" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
          </svg>
        </Link>
      </div>
    </main>
  );
}