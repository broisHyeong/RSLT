'use client';

import { useEffect, useRef, useState } from 'react';
import Webcam from 'react-webcam';
import { BrowserMultiFormatReader } from '@zxing/library';

interface QRScannerProps {
  onQRCodeScanned: (userId: string) => void;
}

export default function QRScanner({ onQRCodeScanned }: QRScannerProps) {
  const webcamRef = useRef<Webcam>(null);
  const [isScanning, setIsScanning] = useState(true);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null); // setTimeout을 추적하는 변수

  useEffect(() => {
    if (!isScanning) return;

    const codeReader = new BrowserMultiFormatReader();

    const scanQRCode = async () => {
      try {
        const video = webcamRef.current?.video;
        if (!video) return; // 카메라가 없으면 실행 안 함

        const result = await codeReader.decodeFromVideoElement(video);
        if (result) {
          setIsScanning(false); // 카메라 종료
          onQRCodeScanned(result.getText()); // 채팅방으로 이동
        } else {
          timeoutRef.current = setTimeout(scanQRCode, 100); // 100ms 후 다시 시도
        }
      } catch {
        timeoutRef.current = setTimeout(scanQRCode, 100); // 에러 발생 시 100ms 후 다시 시도
      }
    };

    scanQRCode(); // QR 코드 스캔 시작

    return () => {
      // ✅ 페이지 이동 시 setTimeout 정리
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      codeReader.reset(); // 컴포넌트 언마운트 시 초기화
    };
  }, [onQRCodeScanned, isScanning]);

  return (
    <div className="relative">
      {isScanning ? (
        <>
          <Webcam
            ref={webcamRef}
            className="w-full rounded-lg"
            videoConstraints={{
              facingMode: 'environment'
            }}
          />
          <div className="absolute top-0 left-0 w-full h-full border-2 border-blue-500 rounded-lg" />
          <p className="absolute bottom-2 left-1/2 transform -translate-x-1/2 bg-black text-white px-3 py-1 rounded-lg text-sm">
            QR 코드를 스캔하세요
          </p>
        </>
      ) : (
        <p className="text-center text-lg text-gray-700">
          ✅ QR 코드가 스캔되었습니다!
        </p>
      )}
    </div>
  );
}
