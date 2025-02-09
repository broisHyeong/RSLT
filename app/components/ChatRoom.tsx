'use client';

import { useEffect, useState } from 'react';
import { ref, onValue, push, set } from 'firebase/database';
import { database, auth } from '@/lib/firebase';

interface Message {
  id: string;
  text: string;
  sender: string;
  timestamp: number;
}

export default function ChatRoom({ roomId }: { roomId: string }) {
  const [messages, setMessages] = useState<Message[]>([]); // 메시지 상태 관리
  const [newMessage, setNewMessage] = useState(''); // 새 메시지 입력 상태 관리

  useEffect(() => {
    const messagesRef = ref(database, `rooms/${roomId}/messages`); 

    // Firebase Realtime Database에서 실시간으로 메시지 수신
    const unsubscribe = onValue(messagesRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        // 데이터를 배열 형태로 변환
        const messageList: Message[] = Object.entries(data).map(([key, value]) => {
          const message = value as Message; // 명시적으로 Message로 캐스팅
          return {
            id: key,
            text: message.text,
            sender: message.sender,
            timestamp: message.timestamp,
          };
        });
        setMessages(messageList);
      } else {
        setMessages([]); // 데이터가 없을 경우 빈 배열로 설정
      }
    });

    return () => unsubscribe(); // 컴포넌트 언마운트 시 리스너 제거
  }, [roomId]);

  const sendMessage = async () => {
    if (!newMessage.trim() || !auth.currentUser) return;

    const messagesRef = ref(database, `rooms/${roomId}/messages`);
    const newMessageRef = push(messagesRef);

    await set(newMessageRef, {
      text: newMessage,
      sender: auth.currentUser.uid,
      timestamp: Date.now(),
    });

    setNewMessage(''); // 입력 필드 초기화
  };

  return (
    <div className="flex flex-col h-screen">
      {/* 메시지 표시 */}
      <div className="flex-1 overflow-y-auto space-y-4 p-4">
        {messages.map((message) => (
          <div key={message.id} className="p-2 border-b">
            <div className="text-sm text-gray-500">{message.sender}</div>
            <div>{message.text}</div>
            <div className="text-xs text-gray-400">
              {new Date(message.timestamp).toLocaleTimeString()}
            </div>
          </div>
        ))}
      </div>

      {/* 입력 필드와 전송 버튼 */}
      <div className="flex gap-2 mt-4 p-4 border-t">
        <input
          type="text"
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          className="flex-1 p-2 border rounded"
          placeholder="메시지를 입력하세요..."
        />
        <button
          onClick={sendMessage}
          className="bg-blue-500 text-white px-4 py-2 rounded"
        >
          전송
        </button>
      </div>
    </div>
  );
}
