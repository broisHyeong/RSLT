import { database } from '@/lib/firebase';
import { ref, get } from 'firebase/database';
import type { User } from '@/types';

export async function getUserData(userId: string): Promise<User | null> {
  const userRef = ref(database, `users/${userId}`);
  const snapshot = await get(userRef);
  
  if (snapshot.exists()) {
    return snapshot.val() as User;
  }
  
  return null;
}

export async function createChatRoom(participants: string[]) {
  // 채팅방 생성 로직
}