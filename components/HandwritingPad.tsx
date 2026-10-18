'use client';
// 手書きマス。Pointer Events（指・Apple Pencil）、touch-action:none、線幅はマス幅/28（最小6px）、devicePixelRatio 対応
import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef } from 'react';
import type { Stroke } from '@/lib/recognize';

export type PadHandle = { clear: () => void; strokes: () => Stroke[]; isEmpty: () => boolean };

type Props = {
  className?: string;
  style?: React.CSSProperties;
  guide?: boolean;
  /** 書いた・消したときに呼ばれる */
  onChange?: (empty: boolean) => void;
  disabled?: boolean;
};

export const HandwritingPad = forwardRef<PadHandle, Props>(function HandwritingPad({ className, style, guide = true, onChange, disabled }, ref) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const strokes = useRef<Stroke[]>([]);
  const drawing = useRef<number | null>(null);

  const redraw = useCallback(() => {
    const el = canvas.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const d = window.devicePixelRatio || 1;
    if (el.width !== Math.round(r.width * d) || el.height !== Math.round(r.height * d)) {
      el.width = Math.round(r.width * d);
      el.height = Math.round(r.height * d);
    }
    const c = el.getContext('2d')!;
    c.setTransform(d, 0, 0, d, 0, 0);
    c.clearRect(0, 0, r.width, r.height);
    c.lineCap = 'round';
    c.lineJoin = 'round';
    c.strokeStyle = '#3a2614';
    c.fillStyle = '#3a2614';
    c.lineWidth = Math.max(6, r.width / 28);
    for (const s of strokes.current) {
      if (s.length === 1) {
        c.beginPath();
        c.arc(s[0].x, s[0].y, c.lineWidth / 2, 0, Math.PI * 2);
        c.fill();
        continue;
      }
      c.beginPath();
      c.moveTo(s[0].x, s[0].y);
      for (let i = 1; i < s.length; i++) c.lineTo(s[i].x, s[i].y);
      c.stroke();
    }
  }, []);

  useEffect(() => {
    redraw();
    const ro = new ResizeObserver(() => {
      // 大きさが変わったら、比率を保って描き直す
      redraw();
    });
    if (canvas.current) ro.observe(canvas.current);
    return () => ro.disconnect();
  }, [redraw]);

  useImperativeHandle(ref, () => ({
    clear: () => { strokes.current = []; redraw(); onChange?.(true); },
    strokes: () => strokes.current.map((s) => [...s]),
    isEmpty: () => strokes.current.length === 0,
  }), [redraw, onChange]);

  const pt = (e: React.PointerEvent) => {
    const r = canvas.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  return (
    <div data-pad className={`relative overflow-hidden ${className ?? ''}`} style={style}>
      {guide && <div className="cell-guide" />}
      <canvas
        ref={canvas}
        className="absolute inset-0 h-full w-full"
        style={{ touchAction: 'none' }}
        onPointerDown={(e) => {
          if (disabled || drawing.current !== null) return;
          e.preventDefault();
          drawing.current = e.pointerId;
          try { canvas.current!.setPointerCapture(e.pointerId); } catch { /* キャプチャできなくても書ける */ }
          strokes.current.push([pt(e)]);
          redraw();
        }}
        onPointerMove={(e) => {
          if (drawing.current !== e.pointerId) return;
          const coalesced = e.nativeEvent.getCoalescedEvents?.() ?? [];
          const events = coalesced.length ? coalesced : [e.nativeEvent];
          const r = canvas.current!.getBoundingClientRect();
          const s = strokes.current[strokes.current.length - 1];
          for (const ev of events) s.push({ x: ev.clientX - r.left, y: ev.clientY - r.top });
          redraw();
        }}
        onPointerUp={(e) => {
          if (drawing.current !== e.pointerId) return;
          drawing.current = null;
          onChange?.(false);
        }}
        onPointerCancel={() => { drawing.current = null; onChange?.(strokes.current.length === 0); }}
      />
    </div>
  );
});
