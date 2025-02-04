'use client';

import { useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';
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
  const [socket, setSocket] = useState<Socket | null>(null);

  useEffect(() => {
    params.then(({ roomId }) => setRoomId(roomId)); // Promise를 언래핑
  }, [params]);

  useEffect(() => {
    if (roomId) {
      const newSocket = io('http://localhost:3000');
      setSocket(newSocket);

      newSocket.emit('join', roomId);

      newSocket.on('message', (message: Message) => {
        setMessages((prev) => [...prev, message]);
      });

      return () => {
        newSocket.close();
      };
    }
  }, [roomId]);

  const sendMessage = () => {
    if (newMessage.trim() && socket) {
      const message: Message = {
        id: Date.now().toString(),
        text: newMessage,
        sender: 'user',
        timestamp: Date.now(),
      };
      socket.emit('message', message);
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
