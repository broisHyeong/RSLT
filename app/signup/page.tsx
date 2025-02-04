'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { auth, database } from '@/lib/firebase';
import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { ref, set } from 'firebase/database';

export default function Signup() {
  const router = useRouter();

  // 입력 값과 오류 상태 관리
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    passwordConfirm: '',
    name: '',
    phone: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 입력 값 변경 핸들러
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  // 입력 검증 함수
  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const phoneRegex = /^01([0|1|6|7|8|9])-?([0-9]{3,4})-?([0-9]{4})$/;

    if (!emailRegex.test(formData.email)) {
      newErrors.email = '올바른 이메일 형식이 아닙니다.';
    }
    if (formData.password.length < 8) {
      newErrors.password = '비밀번호는 8자 이상이어야 합니다.';
    }
    if (formData.password !== formData.passwordConfirm) {
      newErrors.passwordConfirm = '비밀번호가 일치하지 않습니다.';
    }
    if (formData.name.trim().length < 2) {
      newErrors.name = '이름은 2자 이상이어야 합니다.';
    }
    if (!phoneRegex.test(formData.phone)) {
      newErrors.phone = '올바른 전화번호 형식이 아닙니다.';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // 회원가입 처리 함수
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    setIsSubmitting(true);

    try {
      // Firebase Authentication으로 사용자 생성
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        formData.email,
        formData.password
      );

      // 사용자 프로필 업데이트
      await updateProfile(userCredential.user, {
        displayName: formData.name,
      });

      // Firebase Realtime Database에 추가 정보 저장
      await set(ref(database, `users/${userCredential.user.uid}`), {
        username: formData.name,
        email: formData.email,
        phone: formData.phone,
        createdAt: new Date().toISOString(),
      });

      // 회원가입 성공 시 로그인 페이지로 이동
      alert('회원가입이 완료되었습니다!');
      router.push('/login');
    } catch (error:unknown) {
      console.error('회원가입 에러:', error);

      if (error instanceof Error) {
      alert(error.message || '회원가입 중 오류가 발생했습니다.');
    } else {
      alert('회원가입 중 오류가 발생했습니다.');
    }
  }finally {
    setIsSubmitting(false);
  }
};


  return (
    <main className="flex min-h-screen flex-col items-center bg-white px-4 py-8">
      {/* 로고 섹션 */}
      <div className="mb-8 flex flex-col items-center">
        <div className="bg-[#E6F0FF] p-4 rounded-2xl mb-2">
          <Image
            src="/rslt-icon.png"
            alt="RSLT Logo"
            width={40}
            height={40}
          />
        </div>
        <h1 className="text-[#8BB6FF] text-2xl font-bold">회원가입</h1>
      </div>

      {/* 회원가입 폼 */}
      <form onSubmit={handleSubmit} className="w-full max-w-md space-y-4">
        {[
          { name: 'email', type: 'email', placeholder: '이메일' },
          { name: 'password', type: 'password', placeholder: '비밀번호 (8자 이상)' },
          { name: 'passwordConfirm', type: 'password', placeholder: '비밀번호 확인' },
          { name: 'name', type: 'text', placeholder: '이름' },
          { name: 'phone', type: 'tel', placeholder: '전화번호 (예: 010-1234-5678)' },
        ].map((input) => (
          <div key={input.name}>
            <input
              type={input.type}
              name={input.name}
              value={formData[input.name as keyof typeof formData]}
              onChange={handleChange}
              placeholder={input.placeholder}
              className="w-full p-4 bg-gray-50 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#8BB6FF]"
            />
            {errors[input.name] && (
              <p className="mt-1 text-sm text-red-500">{errors[input.name]}</p>
            )}
          </div>
        ))}

        <button
          type="submit"
          className={`w-full p-4 ${
            isSubmitting ? 'bg-gray-300' : 'bg-[#8BB6FF] hover:bg-[#7AA5FF]'
          } text-white rounded-lg font-medium transition-colors`}
          disabled={isSubmitting}
        >
          {isSubmitting ? '가입 중...' : '가입하기'}
        </button>
      </form>

      {/* 로그인 링크 */}
      <div className="mt-6 text-sm text-gray-600">
        이미 계정이 있으신가요?{' '}
        <Link href="/login" className="text-[#8BB6FF] hover:underline">
          로그인하기
        </Link>
      </div>
    </main>
  );
}
