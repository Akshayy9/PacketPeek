'use client';

import { useEffect, useRef, useCallback } from 'react';

interface BarcodeScannerProps {
  onScan: (barcode: string) => void;
  onError?: (error: string) => void;
  active: boolean;
}

/**
 * BarcodeScanner — wraps html5-qrcode in a React component.
 *
 * Dynamically imported so it only runs client-side (html5-qrcode accesses
 * navigator.mediaDevices which is unavailable in SSR/Node).
 *
 * Props:
 *   onScan  — called once with the decoded barcode string; scanner pauses after first hit.
 *   onError — optional callback for camera/init errors.
 *   active  — when false the scanner won't start (e.g. while showing results).
 */
export default function BarcodeScanner({ onScan, onError, active }: BarcodeScannerProps) {
  const scannerRef = useRef<import('html5-qrcode').Html5QrcodeScanner | null>(null);
  const mountedRef = useRef(false);
  const scannerDivId = 'qr-reader';

  const handleScan = useCallback(
    (decodedText: string) => {
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

      // Stop the scanner as soon as we get a result to avoid multiple triggers
      scannerRef.current?.pause(true);
      onScan(decodedText);
    },
    [onScan]
  );

  useEffect(() => {
    if (!active || mountedRef.current) return;
    mountedRef.current = true;

    let isCancelled = false;

    async function initScanner() {
      try {
        const { Html5QrcodeScanner, Html5QrcodeScanType, Html5QrcodeSupportedFormats } = await import('html5-qrcode');

        if (isCancelled) return;

        const scanner = new Html5QrcodeScanner(
          scannerDivId,
          {
            fps: 10,
            qrbox: { width: 250, height: 150 },
            supportedScanTypes: [Html5QrcodeScanType.SCAN_TYPE_CAMERA],
            formatsToSupport: [
              Html5QrcodeSupportedFormats.EAN_13,
              Html5QrcodeSupportedFormats.EAN_8,
              Html5QrcodeSupportedFormats.UPC_A,
              Html5QrcodeSupportedFormats.UPC_E
            ],
            rememberLastUsedCamera: true,
            // Force high resolution
            videoConstraints: {
              facingMode: 'environment',
              width: { ideal: 1920 },
              height: { ideal: 1080 }
            }
          },
          /* verbose= */ false
        );

        scannerRef.current = scanner;

        scanner.render(
          (decodedText) => handleScan(decodedText),
          (errorMessage) => {
            // These fire continuously while scanning — only surface real errors
            if (
              !errorMessage.includes('No MultiFormat Readers') &&
              !errorMessage.includes('QR code parse error')
            ) {
              console.warn('[Scanner]', errorMessage);
            }
          }
        );
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Failed to initialise camera scanner';
        console.error('[Scanner] init error:', err);
        onError?.(msg);
      }
    }

    initScanner();

    return () => {
      isCancelled = true;
      mountedRef.current = false;
      if (scannerRef.current) {
        scannerRef.current.clear().catch(() => {
          // Suppress cleanup errors (scanner may not have fully started)
        });
        scannerRef.current = null;
      }
    };
  }, [active, handleScan, onError]);

  return (
    <div
      id={scannerDivId}
      style={{
        width: '100%',
        maxWidth: 480,
        margin: '0 auto',
        borderRadius: 8,
        overflow: 'hidden',
        border: '2px solid #2563eb',
      }}
    />
  );
}
