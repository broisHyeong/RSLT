'use client';

import { useEffect, useRef, useState } from 'react';
import { remove } from 'firebase/database';
import Webcam from 'react-webcam';
import { BrowserMultiFormatReader } from '@zxing/library';
import { auth, database as db } from '../../lib/firebase';
import { ref, get, update } from 'firebase/database';

// ✅ 대화방 생성 함수
const createRoom = async (scannedUserId: string) => {
  console.log('QR 코드 스캔 데이터:', scannedUserId);
  const currentUser = auth.currentUser;
  if (!currentUser) {
    alert('로그인이 필요합니다.');
    return;
  }

  console.log('현재 로그인된 사용자:', currentUser.uid);

  // ✅ 방 ID 생성
  const roomId =
    currentUser.uid < scannedUserId
      ? `${currentUser.uid}_${scannedUserId}`
      : `${scannedUserId}_${currentUser.uid}`;

  console.log('생성된 roomId:', roomId);

  if (scannedUserId === roomId || currentUser.uid === scannedUserId) {
    console.warn('잘못된 방이 생성될 가능성 감지. 생성 중단.');
    return;
  }

  try {
    const [userSnapshot, roomSnapshot, scannedUserSnapshot, invalidRoomSnapshot] = await Promise.all([
      get(ref(db, `users/${scannedUserId}`)),
      get(ref(db, `rooms/${roomId}`)),
      get(ref(db, `users/${scannedUserId}/email`)),
      get(ref(db, `rooms/${scannedUserId}`))
    ]);

    if (!userSnapshot.exists()) {
      alert('QR 코드의 사용자가 Firebase에 존재하지 않습니다.');
      return;
    }

    let scannedUserEmail: string | null = null;

    if (scannedUserSnapshot.exists()) {
      scannedUserEmail = scannedUserSnapshot.val();
      console.log('Scanned user email:', scannedUserEmail);
    } else {
      console.log('User email does not exist in database.');
      alert('QR 코드로 사용자 정보를 가져올 수 없습니다.');
      return;
    }

    if (invalidRoomSnapshot.exists()) {
      console.warn('잘못된 단독 방을 삭제합니다:', scannedUserId);
      await remove(ref(db, `rooms/${scannedUserId}`));
    }

    if (roomSnapshot.exists()) {
      console.log('대화방이 이미 존재합니다:', roomId);
      alert('✅ 대화방이 이미 존재합니다! 대화방 목록에서 확인해주세요.');
      return;
    }

    const updates: Record<string, unknown> = {};

    updates[`rooms/${roomId}`] = {
      name: `${currentUser.email}과 ${scannedUserEmail}의 대화방`,
      timestamp: Date.now(),
      participants: {
        [currentUser.uid]: true,
        [scannedUserId]: true
      }
    };

    updates[`users/${currentUser.uid}/rooms/${roomId}`] = {
      name: `${scannedUserEmail}과의 대화`,
      timestamp: Date.now()
    };

    updates[`users/${scannedUserId}/rooms/${roomId}`] = {
      name: `${currentUser.email}과의 대화`,
      timestamp: Date.now()
    };

    await update(ref(db), updates);

    console.log('대화방 생성 완료:', roomId);
    alert('✅ 대화방 생성이 완료되었습니다! 대화방 목록에 들어가 확인해주세요.');
  } catch (error) {
    console.error('대화방 생성 중 오류 발생:', error);
    alert('대화방 생성 중 오류가 발생했습니다.');
  }
};

// ✅ `QRScanner` 컴포넌트
export default function QRScanner() {
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

          // ✅ QR 코드 데이터 검증
          if (!scannedData || scannedData.length < 5) {
            alert('잘못된 QR 코드입니다.');
            return;
          }

          console.log('스캔된 사용자 ID:', scannedData);
          setIsScanning(false);
          await createRoom(scannedData);
        } else {
          timeoutRef.current = setTimeout(scanQRCode, 100);
        }
      } catch (error) {
        console.error('QR 코드 스캔 중 에러 발생:', error);
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
