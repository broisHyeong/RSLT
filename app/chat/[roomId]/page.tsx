'use client';

import { useEffect, useState } from 'react';
import { ref, onValue, push, set } from 'firebase/database';
import { auth, database as db } from '../../../lib/firebase'; // firebase.ts에서 import
import ChatMessage from '@/app/components/ChatMessage';

interface Message {
  id: string;
  text: string;
  sender: string;
  timestamp: number;
}

export default function ChatRoom({ params }: { params: Promise<{ roomId: string }> }) {
  const [roomId, setRoomId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');

  useEffect(() => {
    // params가 Promise이므로 값을 추출
    params.then(({ roomId }) => setRoomId(roomId));
  }, [params]);

  useEffect(() => {
    if (!roomId) return;

    const messagesRef = ref(db, `rooms/${roomId}/messages`);
    onValue(messagesRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const formattedMessages = Object.entries(data).map(([key, value]) => ({
          ...(value as Message),
          id: key,
        }));
        setMessages(formattedMessages);
      }
    });
  }, [roomId]);

  const sendMessage = () => {
    if (newMessage.trim()) {
      const currentUser = auth.currentUser;
      if (!currentUser) {
        alert('로그인이 필요합니다.');
        return;
      }
      const messageRef = push(ref(db, `rooms/${roomId}/messages`));
      set(messageRef, {
        text: newMessage,
        sender: currentUser.email || currentUser.uid,
        timestamp: Date.now(),
      });
      setNewMessage('');
    }
  };

  return (
    <div className="flex flex-col h-screen">
      <div className="flex-1 overflow-y-auto space-y-4 p-4">
        {messages.map((message) => (
          <ChatMessage key={message.id} message={message} />
        ))}
      </div>
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
