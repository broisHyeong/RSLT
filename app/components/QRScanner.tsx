'use client';

import { useEffect, useRef, useState } from 'react';
import Webcam from 'react-webcam';
import { BrowserMultiFormatReader } from '@zxing/library';
import { auth, database as db } from '../../lib/firebase';
import { ref, set, get } from 'firebase/database';

interface QRScannerProps {
  onQRCodeScanned: (userId: string) => void;
}

// 대화방 생성 함수
const createRoom = async (scannedUserId: string) => {
  console.log('QR 코드 스캔 데이터:', scannedUserId); // QR 코드 데이터 확인
  const currentUser = auth.currentUser;
  if (!currentUser) {
    alert('로그인이 필요합니다.');
    return;
  }

  // 올바른 방 ID 생성
  const roomId =
    currentUser.uid < scannedUserId
      ? `${currentUser.uid}_${scannedUserId}`
      : `${scannedUserId}_${currentUser.uid}`;

  console.log('생성된 roomId:', roomId); // 생성된 방 ID 확인
  
  // 대화방 데이터 확인
  const roomRef = ref(db, `rooms/${roomId}`);
  const roomSnapshot = await get(roomRef); // ✅ 방 존재 여부 확인

  if (!roomSnapshot.exists()) {
    // 스캔된 사용자 이메일 가져오기
    const scannedUserRef = ref(db, `users/${scannedUserId}`);
    const scannedUserSnapshot = await get(scannedUserRef);
    const scannedUserData = scannedUserSnapshot.val();

    if (!scannedUserData || !scannedUserData.email) {
      alert('QR 코드로 사용자 정보를 가져올 수 없습니다.');
      return;
    }

    const scannedUserEmail = scannedUserData.email;

    // 대화방 생성
    await set(roomRef, {
      name: `${currentUser.email}과 ${scannedUserEmail}의 대화방`,
      timestamp: Date.now(),
    });

    // 사용자별 대화방 목록에 추가
    await set(ref(db, `users/${currentUser.uid}/rooms/${roomId}`), {
      name: `${scannedUserEmail}과의 대화`,
      timestamp: Date.now(),
    });

    await set(ref(db, `users/${scannedUserId}/rooms/${roomId}`), {
      name: `${currentUser.email}과의 대화`,
      timestamp: Date.now(),
    });
  }

  // ✅ 대화방 URL로 리다이렉트
  window.location.href = `/chat/${roomId}`;
};

// QRScanner 컴포넌트
export default function QRScanner({ onQRCodeScanned }: QRScannerProps) {
  const webcamRef = useRef<Webcam>(null);
  const [isScanning, setIsScanning] = useState(true);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!isScanning) return;

    const codeReader = new BrowserMultiFormatReader();

    const scanQRCode = async () => {
      try {
        const video = webcamRef.current?.video;
        if (!video) return;
    
        const result = await codeReader.decodeFromVideoElement(video);
        if (result) {
          const scannedData = result.getText();
          
          // ✅ QR 코드 데이터 검증 (올바른 ID 형식인지 확인)
          if (!scannedData || scannedData.length < 5) {
            alert('잘못된 QR 코드입니다.');
            setIsScanning(true); // 스캔 재시도
            return;
          }
    
          setIsScanning(false);
          await createRoom(scannedData); // 검증된 데이터로 대화방 생성
          onQRCodeScanned(scannedData);
        } else {
          timeoutRef.current = setTimeout(scanQRCode, 100);
        }
      } catch (error) {
        timeoutRef.current = setTimeout(scanQRCode, 100);
      }
    };

    scanQRCode();

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      codeReader.reset();
    };
  }, [isScanning]);

  return (
    <div className="relative">
      {isScanning ? (
        <>
          <Webcam
            ref={webcamRef}
            className="w-full rounded-lg"
            videoConstraints={{ facingMode: 'environment' }}
          />
          <div className="absolute top-0 left-0 w-full h-full border-2 border-blue-500 rounded-lg" />
          <p className="absolute bottom-2 left-1/2 transform -translate-x-1/2 bg-black text-white px-3 py-1 rounded-lg text-sm">
            QR 코드를 스캔하세요
          </p>
        </>
      ) : (
        <p className="text-center text-lg text-gray-700">✅ QR 코드가 스캔되었습니다!</p>
      )}
    </div>
  );
}
