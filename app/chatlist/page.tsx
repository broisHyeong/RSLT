'use client';

import { useEffect, useState } from 'react';
import { auth, database as db } from '../../lib/firebase';
import { ref, onValue } from 'firebase/database';
import Link from 'next/link';

interface Room {
  id: string; // 방 고유 ID
  name: string; // 방 이름
  timestamp: number; // 방 생성 또는 업데이트 타임스탬프
}

export default function ChatList() {
    const [rooms, setRooms] = useState<Room[]>([]);

    useEffect(() => {
        const currentUser = auth.currentUser;
        if (!currentUser) {
            alert('로그인이 필요합니다.');
        return;
    }

    // 현재 사용자의 대화방 가져오기
    const userRoomsRef = ref(db, `users/${currentUser.uid}/rooms`);
    onValue(userRoomsRef, (snapshot) => {
    const data = snapshot.val();

    if (data) {
        // 데이터를 Room 타입으로 변환
        const formattedRooms: Room[] = Object.entries(data).map(([key, value]) => {
        const room = value as Omit<Room, 'id'>; // id를 제외한 나머지 필드에 타입 지정
            return {
                id: key,
                ...room, // Room 타입에 맞게 변환
            };
        });
        setRooms(formattedRooms);
        }
    });
}, []);

    return (
    <div className="p-4">
        <h1 className="text-xl font-bold mb-4">대화방 목록</h1>
        {rooms.map((room) => (
        <Link key={room.id} href={`/chat/${room.id}`}>
        <div className="border p-4 mb-2 rounded hover:bg-gray-100">
            <p className="text-lg font-semibold">{room.name}</p>
            <p className="text-sm text-gray-500">
            마지막 업데이트: {new Date(room.timestamp).toLocaleString()}
            </p>
        </div>
        </Link>
        ))}
    </div>
    );
}
