import { NextResponse } from 'next/server';
import { ref, get } from 'firebase/database';
import { database } from '@/lib/firebase';

// Firebase에서 가져올 데이터 구조 정의
type User = {
  email: string;
  password: string;
};

export async function POST(request: Request) {
  try {
    const { email, password } = await request.json();

    // Firebase Realtime Database에서 사용자 조회
    const userRef = ref(database, `users`);
    const snapshot = await get(userRef);

    if (!snapshot.exists()) {
      return NextResponse.json({ error: '사용자를 찾을 수 없습니다.' }, { status: 401 });
    }

    const users: Record<string, User> = snapshot.val(); // Firebase 데이터 형식이 객체일 경우
    const user = Object.values(users).find((u) => u.email === email);

    if (!user || user.password !== password) {
      return NextResponse.json({ error: '이메일 또는 비밀번호가 일치하지 않습니다.' }, { status: 401 });
    }

    return NextResponse.json({ success: true, user });
  } catch (error) {
    console.error('로그인 에러:', error);
    return NextResponse.json({ error: '로그인 중 오류가 발생했습니다.' }, { status: 500 });
  }
}
