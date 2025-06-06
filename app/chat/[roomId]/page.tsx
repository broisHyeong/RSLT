'use client';

import { useEffect, useState } from 'react';
import { ref, query, onValue, orderByKey, onChildAdded, startAfter, limitToLast, get, push, set } from 'firebase/database';
import { addDoc, collection } from 'firebase/firestore';
import { auth, database as db, firestore as fs } from '../../../lib/firebase';
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
  const [isTranslating, setIsTranslating] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  

 /* **********************************************************************
   * (1) 방 ID 확정
   * ******************************************************************** */
  useEffect(() => { params.then(({ roomId }) => setRoomId(roomId)); }, [params]);


  /* **********************************************************************
   * (2) 메시지 스트림(rooms/{roomId}/messages)
   * ******************************************************************** */
  useEffect(() => {
    if (!roomId) return;
    const msgRef = ref(db, `rooms/${roomId}/messages`);
    return onValue(msgRef, snap => {
      const arr = Object.entries<Message>(snap.val() ?? {}).map(([k,v])=>({ ...v, id:k }));
      setMessages(arr);
    });
  }, [roomId]);

  useEffect(() => {
    if (!roomId) return;
    const signRef = ref(db, `sign_translation/${roomId}`);
    const unsubscribe = onValue(signRef, (snapshot) => {
      const data = snapshot.val();
      const newState = data?.start === true;
      setIsTranslating(newState);
      if (newState) runCountdown();
    });
    return () => unsubscribe();
  }, [roomId]);

  useEffect(() => {
    if (!roomId) return;
    const resultRef = ref(db, `sign_translation/${roomId}/result`);
    const unsub = onValue(resultRef, (snapshot) => {
      const result = snapshot.val();
      if (result?.words && result.words.length > 0) {
        const sentence = result.words.join(' ');
        const sender = auth.currentUser?.email || '사용자';
        const messageRef = push(ref(db, `rooms/${roomId}/messages`));
        set(messageRef, {
          text: `${sender} 님이 수어로 "${sentence}" 라고 말했습니다`,
          sender,
          timestamp: Date.now(),
        });
      }
    });
    return () => unsub();
  }, [roomId]);

  useEffect(() => {
  if (!roomId) return;

  const listRef = ref(db, `sign_outputs/${roomId}/combined_urls`);
  const handled = new Set<string>();           // ← 중복 방지

  let unsubscribe = () => {};                  // cleanup holder

  (async () => {
    /* 1️⃣  맨 마지막 key 하나 가져오기 */
    const snap = await get(query(listRef, limitToLast(1)));
    let lastKey: string | null = null;

    snap.forEach(child => { lastKey = child.key; });

    /* 2️⃣  그 key 이후만 실시간 감시 */
    const listenRef =
      lastKey
        ? query(listRef, orderByKey(), startAfter(lastKey))
        : listRef;                             // 빈 컬렉션이면 그냥 전체 listen

    unsubscribe = onChildAdded(listenRef, child => {
      const { url } = child.val() || {};
      if (!url || handled.has(url)) return;

      handled.add(url);

      const sender = auth.currentUser?.email || '시스템';
      const mref   = push(ref(db, `rooms/${roomId}/messages`));
      set(mref, {
        text: `[수어 영상 도착 🎥]\n${url}`,
        sender,
        timestamp: Date.now(),
      });
    });
  })();

  return () => unsubscribe();
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

  const requestSignVideo = async () => {
  if (!roomId || !newMessage.trim()) return;
  const currentUser = auth.currentUser;
  if (!currentUser) return alert('로그인이 필요합니다.');

  /* 1️⃣ 채팅방에 “제작중” 안내 메시지 먼저 전송 */
  const pendingRef = push(ref(db, `rooms/${roomId}/messages`));
  set(pendingRef, {
    text: '🤟 수어 영상 제작중…(최대 30초) 잠시만 기다려 주세요!',
    sender: '시스템',
    timestamp: Date.now(),
  });

  /* 2️⃣ Firestore 에 user_inputs 문서 생성 → 백엔드 트리거 */
  await addDoc(collection(fs, 'user_inputs'), {
    sentence: newMessage.trim(),
    roomId,
    timestamp: Date.now(),
  });

  /* 3️⃣ 입력창 초기화 */
  setNewMessage('');
};

  const toggleSignTranslation = () => {
    if (!roomId) return;
    const newState = !isTranslating;
    const currentUser = auth.currentUser;
    const sender = currentUser?.email || currentUser?.uid || '사용자';
    set(ref(db, `sign_translation/${roomId}`), {
      start: newState,
      timestamp: Date.now(),
    });
    const messageRef = push(ref(db, `rooms/${roomId}/messages`));
    const messageText = newState
      ? `${sender} 님이 수어 번역을 시작했습니다 🤟`
      : `${sender} 님이 수어 번역을 종료했습니다 🛑`;
    set(messageRef, { text: messageText, sender, timestamp: Date.now() });
  };

  const runCountdown = () => {
    setCountdown(3);
    let count = 3;
    const interval = setInterval(() => {
      count -= 1;
      if (count <= 0) {
        clearInterval(interval);
        setCountdown(null);
      } else {
        setCountdown(count);
        if (navigator.vibrate) navigator.vibrate(100);
      }
    }, 1000);
  };

  return (
    <div className="flex flex-col h-screen">
      <div className="p-4 border-b flex gap-2">
        <button
          onClick={toggleSignTranslation}
          className={`${isTranslating ? 'bg-red-500' : 'bg-green-500'} text-white px-4 py-2 rounded hover:opacity-90`}
        >
          {isTranslating ? '🛑 수어 번역 그만하기' : '🤟 수어 번역 시작하기'}
        </button>
        <button
          onClick={requestSignVideo}
          className="bg-purple-500 text-white px-4 py-2 rounded hover:opacity-90"
          disabled={!newMessage.trim()}
        >
          🤟 수어 영상 요청하기
        </button>
      </div>

      {countdown !== null && (
        <div className="text-center text-xl text-gray-700 mt-2">
          {countdown}초 후 수어 번역이 시작됩니다...
        </div>
      )}

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
