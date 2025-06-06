'use client';

import { auth } from '../../lib/firebase';

interface Message {
  id: string;
  text?: string;
  sender?: string;      // 이메일 또는 시스템
  timestamp?: number;
}

interface ChatMessageProps {
  message: Message;
}

export default function ChatMessage({ message }: ChatMessageProps) {
  if (!message || !message.text) return null;        // text 가 없으면 렌더 생략

  /* -------------------------------------------------- */
  /* helper                                             */
  /* -------------------------------------------------- */
  const currentUserEmail = auth.currentUser?.email;
  const isMyMessage = message.sender === currentUserEmail;

  const timeLabel =
    message.timestamp !== undefined
      ? new Date(message.timestamp).toLocaleTimeString('ko-KR', {
          hour: '2-digit',
          minute: '2-digit',
        })
      : '';

  /* -------------------------------------------------- */
  /* 비디오 메시지 판별                                 */
  /* -------------------------------------------------- */
  const isVideo = message.text.startsWith('[수어 영상 도착');
  const url = message.text.match(/https?:\/\/[^\s]+/)?.[0];

  /* -------------------------------------------------- */
  /* UI                                                 */
  /* -------------------------------------------------- */
  return (
    <div className={`flex ${isMyMessage ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[70%] rounded-lg px-4 py-2 shadow whitespace-pre-wrap ${
          isMyMessage
            ? 'bg-blue-500 text-white rounded-br-none'
            : 'bg-gray-200 text-gray-800 rounded-bl-none'
        }`}
      >
        {/* 본문 */}
        {isVideo && url ? (
          <video
            src={url}
            controls
            className="rounded-lg w-full max-h-64 bg-black"
          />
        ) : (
          <p className="break-words">{message.text}</p>
        )}

        {/* 타임스탬프 */}
        {timeLabel && (
          <p
            className={`text-xs mt-1 ${
              isMyMessage ? 'text-blue-100' : 'text-gray-500'
            }`}
          >
            {timeLabel}
          </p>
        )}
      </div>
    </div>
  );
}
