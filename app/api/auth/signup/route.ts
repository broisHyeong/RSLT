import { NextResponse } from 'next/server';
import { ref, set } from 'firebase/database';
import { database } from '@/lib/firebase';

export async function POST(request: Request) {
  try {
    const { email, password, name, phone } = await request.json();

    // Firebase Realtime Database에 사용자 추가
    const userId = Date.now().toString(); // 고유 ID 생성 (여기선 예제용으로 timestamp 사용)
    const userRef = ref(database, `users/${userId}`);
    await set(userRef, {
      email,
      password, // 실제 애플리케이션에서는 비밀번호를 암호화해야 함
      name,
      phone,
      createdAt: new Date().toISOString(),
    });

    return NextResponse.json({ success: true, userId });
  } catch (error) {
    console.error('회원가입 에러:', error);
    return NextResponse.json({ error: '회원가입 중 오류가 발생했습니다.' }, { status: 500 });
  }
}
