'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { ref, query, onValue, orderByKey, onChildAdded, startAfter, limitToLast, get, push, set} from 'firebase/database';
import { addDoc, collection } from 'firebase/firestore';
import { auth, database as db, firestore as fs } from '../../../lib/firebase';
import ChatMessage from '@/app/components/ChatMessage';

interface Message {
  id: string;
  text: string;
  sender: string;
  timestamp: number;
}

interface TranslationResult {
  translated_sentence?: string;
  words?: string[];
  timestamp?: number;
  reused?: boolean;
}

export default function ChatRoom({ params }: { params: Promise<{ roomId: string }> }) {
  const [roomId, setRoomId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isTranslating, setIsTranslating] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [predictedWords, setPredictedWords] = useState<string[]>([]);
  
  // 테스트용 상태 추가
  const [testInput, setTestInput] = useState('');
  const [showTestPanel, setShowTestPanel] = useState(false);
  
  // 강화된 중복 방지 시스템
  const processedResultsRef = useRef<Map<string, number>>(new Map());
  const lastProcessedTimestampRef = useRef<number>(0);
  const isProcessingRef = useRef<boolean>(false);
  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null);
  
  // 수어 영상 URL 중복 방지를 위한 ref
  const handledUrlsRef = useRef<Set<string>>(new Set());
  
  // 수어 영상 요청 중복 방지를 위한 ref
  const requestingRef = useRef<boolean>(false);

  useEffect(() => { params.then(({ roomId }) => setRoomId(roomId)); }, [params]);

  // 메모리 정리 함수
  const cleanupProcessedResults = useCallback(() => {
    const now = Date.now();
    const fiveMinutesAgo = now - 5 * 60 * 1000;
    
    // 5분 이상 된 항목들 제거
    for (const [key, timestamp] of processedResultsRef.current.entries()) {
      if (timestamp < fiveMinutesAgo) {
        processedResultsRef.current.delete(key);
      }
    }
  }, []);

  // 방 입장 시 초기화
  useEffect(() => {
    if (!roomId) return;
    
    // 상태 완전 초기화
    set(ref(db, `sign_input_disabled/${roomId}/result`), null);
    processedResultsRef.current.clear();
    lastProcessedTimestampRef.current = 0;
    isProcessingRef.current = false;
    handledUrlsRef.current.clear(); // URL 중복 방지 초기화
    requestingRef.current = false; // 요청 중복 방지 초기화
    
    // 정기적으로 메모리 정리
    const cleanupInterval = setInterval(cleanupProcessedResults, 60000); // 1분마다
    
    return () => {
      clearInterval(cleanupInterval);
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
      }
    };
  }, [roomId, cleanupProcessedResults]);

  useEffect(() => {
    if (!roomId) return;
    const msgRef = ref(db, `rooms/${roomId}/messages`);
    return onValue(msgRef, snap => {
      const arr = Object.entries<Message>(snap.val() ?? {}).map(([k, v]) => ({ ...v, id: k }));
      setMessages(arr);
    });
  }, [roomId]);

  // 개선된 카운트다운 함수
  const runCountdown = useCallback(() => {
    // 기존 카운트다운 정리
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
    }
    
    setCountdown(3);
    let count = 3;
    
    countdownIntervalRef.current = setInterval(() => {
      count -= 1;
      if (count <= 0) {
        if (countdownIntervalRef.current) {
          clearInterval(countdownIntervalRef.current);
          countdownIntervalRef.current = null;
        }
        setCountdown(null);
      } else {
        setCountdown(count);
        if (navigator.vibrate) navigator.vibrate(100);
      }
    }, 1000);
  }, []);

  // 수어 번역 상태 감지
  useEffect(() => {
    if (!roomId) return;
    const signRef = ref(db, `sign_translation/${roomId}`);
    return onValue(signRef, (snapshot) => {
      const data = snapshot.val();
      const newState = data?.start === true;
      setIsTranslating(newState);
      if (newState) runCountdown();
    });
  }, [roomId, runCountdown]);

  // 예측된 단어들 실시간 감지 - 개선된 로직
  useEffect(() => {
    if (!roomId) return;
    
    const wordsRef = ref(db, `sign_input_disabled/${roomId}/extracted_words`);
    
    return onValue(wordsRef, (snapshot) => {
      const data = snapshot.val();
      if (data && typeof data === 'object') {
        // 타임스탬프가 있는 경우 최신 데이터만 처리
        if (data.timestamp && data.timestamp <= lastProcessedTimestampRef.current) {
          return; // 이미 처리된 데이터
        }
        
        const allWords = Object.values(data).filter(word => typeof word === 'string') as string[];
        
        if (allWords.length > 0) {
          setPredictedWords(allWords);
          console.log(`🔄 예측 단어 업데이트: ${allWords.length}개 - [${allWords.join(', ')}]`);
        }
      } else {
        setPredictedWords([]);
        console.log("🔄 예측 단어 초기화");
      }
    });
  }, [roomId]);

  // 강화된 번역 결과 처리
  const processTranslationResult = useCallback((result: TranslationResult) => {
    if (!roomId || !result || isProcessingRef.current) return;
    
    let sentence = null;
    const resultTimestamp = result.timestamp || Date.now();
    
    // 타임스탬프 기반 1차 필터링
    if (resultTimestamp <= lastProcessedTimestampRef.current) {
      console.log("⚠️ 이미 처리된 타임스탬프:", resultTimestamp);
      return;
    }
    
    // 문장 추출
    if (result.translated_sentence) {
      sentence = result.translated_sentence;
    } else if (result.words && result.words.length > 0) {
      sentence = result.words.join(' ');
    }
    
    if (!sentence || sentence.trim().length === 0) return;
    
    // 고유 키 생성 (문장 해시 + 타임스탬프)
    const sentenceHash = btoa(encodeURIComponent(sentence.trim())).slice(0, 16);
    const resultKey = `${sentenceHash}_${resultTimestamp}`;
    
    // 중복 확인
    if (processedResultsRef.current.has(resultKey)) {
      console.log("⚠️ 중복 결과 무시:", sentence);
      return;
    }
    
    // 처리 중 플래그 설정
    isProcessingRef.current = true;
    
    try {
      // 결과 저장
      processedResultsRef.current.set(resultKey, resultTimestamp);
      lastProcessedTimestampRef.current = resultTimestamp;
      
      const sender = auth.currentUser?.email || '사용자';
      const messageRef = push(ref(db, `rooms/${roomId}/messages`));
      set(messageRef, {
        text: `${sender} 님이 수어로 "${sentence}" 라고 말했습니다${result.reused ? ' (캐시됨)' : ''}`,
        sender,
        timestamp: Date.now(),
      });
      
      setIsTranslating(false);
      console.log("✅ 번역 결과 처리 완료:", sentence);
      
      // 결과 처리 후 안전하게 삭제
      setTimeout(() => {
        set(ref(db, `sign_input_disabled/${roomId}/result`), null);
      }, 3000);
      
    } catch (error) {
      console.error("❌ 번역 결과 처리 실패:", error);
    } finally {
      // 처리 완료 플래그 해제
      setTimeout(() => {
        isProcessingRef.current = false;
      }, 1000);
    }
  }, [roomId]);

  // 수어 번역 결과 감지 - 강화된 로직
  useEffect(() => {
    if (!roomId) return;
    
    const resultRef = ref(db, `sign_input_disabled/${roomId}/result`);
    
    return onValue(resultRef, (snapshot) => {
      const result = snapshot.val();
      console.log("번역 결과 감지:", result);
      
      if (result) {
        processTranslationResult(result);
      }
    });
  }, [roomId, processTranslationResult]);

  // 수어 영상 URL 감지 - 중복 방지 강화
  useEffect(() => {
    if (!roomId) return;
    
    const listRef = ref(db, `sign_outputs/${roomId}/combined_urls`);
    let unsubscribe = () => {};

    (async () => {
      try {
        const snap = await get(query(listRef, limitToLast(1)));
        let lastKey: string | null = null;
        snap.forEach(child => { 
          lastKey = child.key;
          // 기존 URL도 handled에 추가하여 중복 방지
          const existingUrl = child.val()?.url;
          if (existingUrl) {
            handledUrlsRef.current.add(existingUrl);
          }
        });

        const listenRef = lastKey
          ? query(listRef, orderByKey(), startAfter(lastKey))
          : listRef;

        unsubscribe = onChildAdded(listenRef, child => {
          const data = child.val();
          const { url, timestamp } = data || {};
          
          // URL 유효성 검사
          if (!url || typeof url !== 'string' || url.trim() === '') {
            console.log("❌ 유효하지 않은 URL:", url);
            return;
          }

          // 중복 URL 체크 (더 엄격한 검사)
          const cleanUrl = url.trim();
          if (handledUrlsRef.current.has(cleanUrl)) {
            console.log("⚠️ 이미 처리된 URL 무시:", cleanUrl);
            return;
          }

          // URL 처리 중복 방지
          handledUrlsRef.current.add(cleanUrl);
          
          console.log("✅ 새로운 수어 영상 URL 처리:", cleanUrl);

          const sender = auth.currentUser?.email || '시스템';
          const mref = push(ref(db, `rooms/${roomId}/messages`));
          
          set(mref, {
            text: `[수어 영상 도착 🎥]\n${cleanUrl}`,
            sender,
            timestamp: timestamp || Date.now(),
          }).catch(error => {
            console.error("메시지 저장 실패:", error);
            // 실패한 경우 handled에서 제거하여 재시도 가능하게 함
            handledUrlsRef.current.delete(cleanUrl);
          });
        });

      } catch (error) {
        console.error("수어 영상 URL 감지 초기화 실패:", error);
      }
    })();

    return () => {
      unsubscribe();
      // cleanup 시 handled URLs 초기화
      handledUrlsRef.current.clear();
    };
  }, [roomId]);

  // 수어 번역 시작 - 강화된 초기화
  const triggerSignTranslation = useCallback(() => {
    if (!roomId || isTranslating) return;
    
    setIsTranslating(true);
    
    // 상태 완전 초기화
    setPredictedWords([]);
    isProcessingRef.current = false;
    
    // 중복 방지 상태 업데이트 (완전 초기화 대신 현재 시간으로 기준점 설정)
    const now = Date.now();
    lastProcessedTimestampRef.current = now;
    
    // 기존 결과 초기화
    set(ref(db, `sign_input_disabled/${roomId}/result`), null);
    
    // 번역 시작 신호 전송
    setTimeout(() => {
      set(ref(db, `sign_translation/${roomId}`), {
        start: true,
        timestamp: now,
      });
    }, 200);
    
    runCountdown();
  }, [roomId, isTranslating, runCountdown]);

  // 테스트용 예측 단어 직접 설정 함수
  const setTestPredictedWords = useCallback(() => {
    if (!roomId || !testInput.trim()) {
      alert("예측할 단어들을 입력해주세요. (공백으로 구분)");
      return;
    }

    const words = testInput.trim().split(/\s+/);
    const testData = {
      ...words.reduce((acc, word, index) => {
        acc[index] = word;
        return acc;
      }, {} as { [key: number]: string }),
      timestamp: Date.now()
    };

    // Firebase에 직접 예측 단어 저장
    set(ref(db, `sign_input_disabled/${roomId}/extracted_words`), testData)
      .then(() => {
        console.log("✅ 테스트 예측 단어 설정 완료:", words);
        setTestInput('');
      })
      .catch((error) => {
        console.error("❌ 테스트 예측 단어 설정 실패:", error);
        alert("테스트 예측 단어 설정에 실패했습니다.");
      });
  }, [roomId, testInput]);

  // 테스트용 예측 단어 리셋 함수
  const resetTestPredictedWords = useCallback(() => {
    if (!roomId) return;

    // Firebase에서 예측 단어 데이터 삭제
    set(ref(db, `sign_input_disabled/${roomId}/extracted_words`), null)
      .then(() => {
        console.log("✅ 테스트 예측 단어 리셋 완료");
        setPredictedWords([]);
        setTestInput('');
      })
      .catch((error) => {
        console.error("❌ 테스트 예측 단어 리셋 실패:", error);
        alert("테스트 예측 단어 리셋에 실패했습니다.");
      });
  }, [roomId]);

  // 최종 번역 제출
  const handleSubmitPrediction = async () => {
    if (!roomId) {
      alert("roomId를 아직 불러오지 못했습니다.");
      return;
    }

    if (predictedWords.length === 0) {
      alert("아직 번역된 단어가 없습니다.");
      return;
    }

    try {
      // Firestore 저장
      await addDoc(collection(fs, 'predictions'), {
        roomId,
        words: predictedWords,
        timestamp: Date.now(),
      });

      // RTDB에 submit: true 설정
      await set(ref(db, `sign_translation/${roomId}/submit`), true);

      // 채팅방 메시지 전송
      const messageRef = push(ref(db, `rooms/${roomId}/messages`));
      await set(messageRef, {
        text: `📤 최종 번역 제출 완료: ${predictedWords.join(' ')}`,
        sender: auth.currentUser?.email || '사용자',
        timestamp: Date.now(),
      });

      // 상태 초기화
      setPredictedWords([]);
      
      alert("최종 번역이 성공적으로 제출되었습니다!");
      
    } catch (error) {
      console.error("최종 번역 제출 오류:", error);
      alert(`오류가 발생했습니다: ${error}`);
    }
  };

  // 일반 메시지 전송
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

  // 수어 영상 요청 - 중복 방지 강화
  const requestSignVideo = async () => {
    if (!roomId || !newMessage.trim()) return;
    const currentUser = auth.currentUser;
    if (!currentUser) return alert('로그인이 필요합니다.');

    // 중복 요청 방지
    if (requestingRef.current) {
      console.log("⚠️ 이미 수어 영상 요청 처리 중...");
      return;
    }

    try {
      requestingRef.current = true;
      
      const pendingRef = push(ref(db, `rooms/${roomId}/messages`));
      await set(pendingRef, {
        text: '[SYSTEM] 수어 영상 제작중…(최대 30초) 잠시만 기다려 주세요!',
        sender: '시스템',
        timestamp: Date.now(),
      });

      await addDoc(collection(fs, 'user_inputs'), {
        sentence: newMessage.trim(),
        roomId,
        timestamp: Date.now(),
        requestId: `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`, // 고유 요청 ID 추가
      });

      setNewMessage('');
      console.log("✅ 수어 영상 요청 완료");
      
    } catch (error) {
      console.error("❌ 수어 영상 요청 실패:", error);
      alert(`수어 영상 요청 중 오류가 발생했습니다: ${error}`);
    } finally {
      // 요청 완료 후 플래그 해제 (약간의 지연을 두어 중복 클릭 방지)
      setTimeout(() => {
        requestingRef.current = false;
      }, 1000);
    }
  };

  return (
    <div className="flex flex-col h-screen">
      <div className="p-4 border-b flex gap-2 flex-wrap">
        <button
          onClick={triggerSignTranslation}
          className={`bg-green-500 text-white px-4 py-2 rounded hover:opacity-90 disabled:opacity-50`}
          disabled={isTranslating}
        >
          🤟 수어 번역 시작
        </button>
        <button
          onClick={requestSignVideo}
          className="bg-purple-500 text-white px-4 py-2 rounded hover:opacity-90 disabled:opacity-50"
          disabled={!newMessage.trim() || requestingRef.current}
        >
          🤟 수어 영상 요청{requestingRef.current ? ' (처리중...)' : ''}
        </button>
        <button
          onClick={handleSubmitPrediction}
          className="bg-blue-700 text-white px-4 py-2 rounded hover:opacity-90 disabled:opacity-50"
          disabled={predictedWords.length === 0}
          title={predictedWords.length === 0 ? "번역된 단어가 없습니다" : `${predictedWords.length}개 단어 제출 준비`}
        >
          📤 최종 번역 요청 ({predictedWords.length})
        </button>
        
        {/* 테스트 패널 토글 버튼 */}
        <button
          onClick={() => setShowTestPanel(!showTestPanel)}
          className={`px-4 py-2 rounded border-2 ${
            showTestPanel 
              ? 'bg-red-100 border-red-300 text-red-700' 
              : 'bg-yellow-100 border-yellow-300 text-yellow-700'
          } hover:opacity-90`}
        >
          🧪 테스트 {showTestPanel ? '닫기' : '열기'}
        </button>
      </div>

      {/* 테스트 패널 - 예측 단어 설정만 남김 */}
      {showTestPanel && (
        <div className="p-4 bg-yellow-50 border-b border-yellow-200">
          <div className="text-sm font-medium text-yellow-800 mb-2">
            🧪 테스트 모드 - 예측 단어 시뮬레이션
          </div>
          <div className="flex gap-2 mb-2">
            <input
              type="text"
              value={testInput}
              onChange={(e) => setTestInput(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && setTestPredictedWords()}
              className="flex-1 p-2 border rounded text-sm"
              placeholder="예측 단어들을 공백으로 구분해서 입력하세요..."
            />
            <button
              onClick={setTestPredictedWords}
              className="bg-cyan-500 text-white px-3 py-2 rounded text-sm hover:bg-cyan-600"
              disabled={!testInput.trim()}
            >
              예측 단어 설정
            </button>
          </div>
          <div className="flex gap-2 mb-2">
            <button
              onClick={resetTestPredictedWords}
              className="bg-red-500 text-white px-3 py-2 rounded text-sm hover:bg-red-600"
            >
              🗑️ 예측 단어 리셋
            </button>
            {predictedWords.length > 0 && (
              <div className="flex-1 text-sm text-gray-600 flex items-center">
                현재 예측 단어: <span className="ml-1 font-medium text-blue-700">{predictedWords.join(', ')}</span>
              </div>
            )}
          </div>
          <div className="text-xs text-yellow-600">
            💡 실제 젯슨 없이도 예측 단어 기능을 테스트할 수 있습니다. 예측할 단어들을 공백으로 구분해서 입력하거나 리셋 버튼으로 초기화하세요.
          </div>
        </div>
      )}
      
      {/* 현재 예측된 단어들 표시 */}
      {predictedWords.length > 0 && (
        <div className="p-3 bg-blue-50 border-b">
          <div className="text-sm text-gray-600 mb-1">예측된 단어들:</div>
          <div className="font-medium text-blue-800">{predictedWords.join(' → ')}</div>
        </div>
      )}

      {countdown !== null && (
        <div className="text-center text-xl text-gray-700 mt-2 p-2">
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
          onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
          className="flex-1 p-2 border rounded"
          placeholder="메시지를 입력하세요..."
        />
        <button
          onClick={sendMessage}
          className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
        >
          전송
        </button>
      </div>
    </div>
  );
}