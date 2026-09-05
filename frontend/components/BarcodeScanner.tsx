'use client';

import { useZxing } from 'react-zxing';
import { useRef, useEffect } from 'react';

interface BarcodeScannerProps {
  onScan: (barcode: string) => void;
  onError?: (error: string) => void;
  active: boolean;
}

export default function BarcodeScanner({ onScan, onError, active }: BarcodeScannerProps) {
  const scannedRef = useRef(false);

  // Reset the scanned flag whenever the scanner becomes active again
  useEffect(() => {
    if (active) {
      scannedRef.current = false;
    }
  }, [active]);

  const { ref } = useZxing({
    paused: !active,
    constraints: { video: { facingMode: "environment" } },
    onDecodeResult(result) {
      if (!active || scannedRef.current) return;
      scannedRef.current = true;

      try {
        // Play a short success "beep"
        const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
        const osc = ctx.createOscillator();
        const gainNode = ctx.createGain();
        osc.connect(gainNode);
        gainNode.connect(ctx.destination);
        osc.type = "sine";
        osc.frequency.setValueAtTime(880, ctx.currentTime); // A5
        gainNode.gain.setValueAtTime(0.1, ctx.currentTime);
        osc.start();
        osc.stop(ctx.currentTime + 0.1);
      } catch (e) {
        // Ignore audio errors
      }

      onScan(result.rawValue);
    },
    onError(error) {
      // react-zxing throws errors continuously when no barcode is in frame,
      // so we typically don't want to propagate these up as fatal UI errors.
      // We only pass initialization errors (which usually happen immediately).
      if (
        error.message && 
        (error.message.includes("Permission") || error.message.includes("NotAllowedError") || error.message.includes("Requested device not found"))
      ) {
         if (onError) onError(error.message);
      }
    }
  });

  return (
    <div style={{ display: active ? 'block' : 'none', width: '100%' }}>
      <video
        ref={ref}
        className="w-full max-w-sm mx-auto aspect-video object-cover rounded-lg overflow-hidden"
      />
    </div>
  );
}
