'use client';

import { useEffect, useState } from 'react';
import { auth, database as db } from '../../lib/firebase';
import { ref, onValue } from 'firebase/database';
import Link from 'next/link';

interface Room {
    id: string;
    name: string;
    timestamp: number;
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
            const formattedRooms = Object.entries(data).map(([key, value]: any) => ({
            id: key,
            ...value,
        }));
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