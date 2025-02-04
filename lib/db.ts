import { database } from '@/lib/firebase';
import { ref, get, set, update, remove } from 'firebase/database';

// 데이터 읽기
export const getData = async <T>(path: string): Promise<T | null> => {
  const dataRef = ref(database, path);
  const snapshot = await get(dataRef);
  if (snapshot.exists()) {
    return snapshot.val() as T;
  }
  return null;
};

// 데이터 쓰기
export const setData = async <T>(path: string, data: T): Promise<void> => {
  const dataRef = ref(database, path);
  await set(dataRef, data);
};

// 데이터 업데이트
export const updateData = async <T>(path: string, data: Partial<T>): Promise<void> => {
  const dataRef = ref(database, path);
  await update(dataRef, data);
};

// 데이터 삭제
export const deleteData = async (path: string): Promise<void> => {
  const dataRef = ref(database, path);
  await remove(dataRef);
};
