'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { auth } from '@/lib/firebase';
import { signInWithEmailAndPassword } from 'firebase/auth';

export default function Login() {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });
  const [error, setError] = useState('');
  const router = useRouter();

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      // Firebase Authentication으로 로그인
      await signInWithEmailAndPassword(auth, formData.email, formData.password);
      // 로그인 성공 시 메인 페이지로 이동
      router.push('/main');
    } catch (error: unknown) {
      if (error instanceof Error) {
      console.error('로그인 에러:', error);}
      setError('로그인에 실패했습니다. 이메일과 비밀번호를 확인해주세요!');
    }
  };

  return (
    <main className="flex min-h-screen flex-col items-center bg-white px-4">
      {/* 로고 섹션 */}
      <div className="mt-12 mb-8 flex flex-col items-center">
        <div className="bg-[#E6F0FF] p-4 rounded-2xl mb-2">
          <Image
            src="/rslt-icon.png"
            alt="RSLT Logo"
            width={60}
            height={60}
          />
        </div>
        <h1 className="text-[#8BB6FF] text-2xl font-bold">RSLT</h1>
      </div>

      {/* 로그인 폼 */}
      <form onSubmit={handleSubmit} className="w-full max-w-md space-y-4">
        <input
          type="email"
          name="email"
          value={formData.email}
          onChange={handleChange}
          placeholder="이메일"
          className="w-full p-4 bg-gray-50 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#8BB6FF]"
        />
        <input
          type="password"
          name="password"
          value={formData.password}
          onChange={handleChange}
          placeholder="비밀번호"
          className="w-full p-4 bg-gray-50 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#8BB6FF]"
        />
        {error && <p className="text-sm text-red-500">{error}</p>}
        <button
          type="submit"
          className="w-full p-4 bg-[#8BB6FF] text-white rounded-lg font-medium hover:bg-[#7AA5FF] transition-colors"
        >
          로그인
        </button>
      </form>

      {/* 회원가입 링크 */}
      <div className="mt-4 flex gap-4 text-sm text-gray-600">
        <Link href="/signup" className="hover:underline">
          아이디 찾기
        </Link>
        <span>|</span>
        <Link href="/signup" className="hover:underline">
          비밀번호 찾기
        </Link>
        <span>|</span>
        <Link href="/signup" className="hover:underline">
          회원가입
        </Link>
      </div>

      {/* 소셜 로그인 섹션 */}
      <div className="mt-12 w-full max-w-md">
        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-200"></div>
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="px-2 bg-white text-gray-500">또는</span>
          </div>
        </div>

        <div className="mt-6 flex justify-center gap-4">
          {/* 카카오톡 로그인 */}
          <button className="p-2 rounded-full">
            <Image
              src="/kakao_logo.png"
              alt="kakao Logo"
              width={60}
              height={60}
            />
          </button>

          {/* 네이버 로그인 */}
          <button className="p-2 rounded-full">
            <Image
              src="/naver_logo.png"
              alt="naver Logo"
              width={60}
              height={60}
            />
          </button>

          {/* 구글 로그인 */}
          <button className="p-2 rounded-full">
            <Image
              src="/google_logo.png"
              alt="google Logo"
              width={60}
              height={60}
            />
          </button>
        </div>
      </div>
    </main>
  );
}
