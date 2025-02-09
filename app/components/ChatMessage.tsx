'use client';

import { auth } from '../../lib/firebase';

interface Message {
  id: string;
  text: string;
  sender: string; // 메시지 보낸 사람 (이메일)
  timestamp: number;
}

interface ChatMessageProps {
  message: Message;
}

export default function ChatMessage({ message }: ChatMessageProps) {
  // 현재 사용자의 이메일
  const currentUserEmail = auth.currentUser?.email;

  // 본인의 메시지인지 확인
  const isMyMessage = message.sender === currentUserEmail;

  // 시간 포맷팅 함수
  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('ko-KR', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className={`flex ${isMyMessage ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[70%] rounded-lg px-4 py-2 ${
          isMyMessage
            ? 'bg-blue-500 text-white rounded-br-none'
            : 'bg-gray-200 text-gray-800 rounded-bl-none'
        }`}
      >
        <p className="break-words">{message.text}</p>
        <p
          className={`text-xs mt-1 ${
            isMyMessage ? 'text-blue-100' : 'text-gray-500'
          }`}
        >
          {formatTime(message.timestamp)}
        </p>
      </div>
    </div>
  );
}
