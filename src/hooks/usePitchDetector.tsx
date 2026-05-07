import { useEffect, useRef, useState } from "react";
import { PitchDetector } from "pitchy";

interface WindowWithWebkitAudioContext extends Window {
  webkitAudioContext?: typeof AudioContext;
}

export function usePitchDetector(minClarity: number = 0.95, enabled = true) {
  const [pitch, setPitch] = useState<string | null>(null);
  const [clarity, setClarity] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const audioContextRef = useRef<AudioContext | null>(null);
  const rafIdRef = useRef<number | null>(null);
  const pitchDetectorRef = useRef<ReturnType<
    typeof PitchDetector.forFloat32Array
  > | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    if (!enabled) {
      setPitch(null);
      setClarity(null);
      setError(null);
      return;
    }

    let analyser: AnalyserNode;
    let buffer: Float32Array;
    let cancelled = false;

    const initAudio = async () => {
      try {
        setError(null);
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
        });
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        mediaStreamRef.current = stream;

        const AudioContextClass =
          window.AudioContext ||
          (window as WindowWithWebkitAudioContext).webkitAudioContext;
        if (!AudioContextClass) {
          throw new Error("Web Audio API is not supported in this browser.");
        }

        const audioContext = new AudioContextClass();
        audioContextRef.current = audioContext;

        analyser = audioContext.createAnalyser();
        analyser.fftSize = 2048;
        const mediaStreamSource = audioContext.createMediaStreamSource(stream);
        mediaStreamSource.connect(analyser);

        buffer = new Float32Array(analyser.fftSize);
        pitchDetectorRef.current = PitchDetector.forFloat32Array(buffer.length);

        const updatePitch = async () => {
          if (cancelled) return;

          if (audioContext.state === "suspended") {
            await audioContext.resume();
          }

          analyser.getFloatTimeDomainData(buffer);
          const [detectedPitch, detectedClarity] =
            pitchDetectorRef.current!.findPitch(
              buffer,
              audioContext.sampleRate
            );

          if (detectedClarity > minClarity) {
            setPitch(detectedPitch.toFixed(0));
            setClarity(detectedClarity.toFixed(2));
          } else {
            setPitch(null);
            setClarity(null);
          }

          rafIdRef.current = requestAnimationFrame(updatePitch);
        };

        updatePitch();
      } catch (error) {
        console.error("Error accessing microphone:", error);
        setError(
          error instanceof Error
            ? error.message
            : "Unable to access the microphone."
        );
        setPitch(null);
        setClarity(null);
      }
    };

    initAudio();

    return () => {
      cancelled = true;
      if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);
      audioContextRef.current?.close();
      mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
      audioContextRef.current = null;
      mediaStreamRef.current = null;
      rafIdRef.current = null;
    };
  }, [minClarity, enabled]);
  return { pitch, clarity, error };
}
