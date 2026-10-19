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
  /** いま 書いている 指・ペン（pointerId と 種類） */
  const drawing = useRef<{ id: number; type: string } | null>(null);

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

  // アプリの 切りかえなどで 指を はなした 知らせが とどかなくても、書いている とちゅうの まま のこらないように
  useEffect(() => {
    const reset = () => { drawing.current = null; };
    const onVis = () => { if (document.hidden) reset(); };
    window.addEventListener('blur', reset);
    document.addEventListener('visibilitychange', onVis);
    return () => { window.removeEventListener('blur', reset); document.removeEventListener('visibilitychange', onVis); };
  }, []);

  // ペンの 動きは 1秒に 何百回も くるので、かきなおしは 画面の 更新 1回に 1度に まとめる
  const frame = useRef(0);
  const scheduleRedraw = useCallback(() => {
    if (frame.current) return;
    frame.current = requestAnimationFrame(() => { frame.current = 0; redraw(); });
  }, [redraw]);
  useEffect(() => () => cancelAnimationFrame(frame.current), []);

  // iPad の Safari は touch-action:none でも、Apple Pencil の 線を スクリブル（手書き入力）や ジェスチャーに
  // 横取りして とちゅうで pointercancel に することが ある。タッチ自体を 止めて、さいごまで マスに 書けるように する
  // （React の onTouchStart は passive なので preventDefault が きかない）
  useEffect(() => {
    const el = canvas.current;
    if (!el) return;
    const stop = (e: TouchEvent) => { if (e.cancelable) e.preventDefault(); };
    el.addEventListener('touchstart', stop, { passive: false });
    el.addEventListener('touchmove', stop, { passive: false });
    return () => { el.removeEventListener('touchstart', stop); el.removeEventListener('touchmove', stop); };
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
          if (disabled) return;
          const cur = drawing.current;
          if (cur) {
            // ペンは いつでも 書きはじめられる。先に ふれていた 手のひら・指の 線は すてる
            // （ペンが 書いている とちゅうに 2本目の ペンは こないので、前の ペンは 知らせが とどかずに おわったもの）
            if (e.pointerType !== 'pen') return;
            if (cur.type !== 'pen') strokes.current.pop();
          }
          e.preventDefault();
          drawing.current = { id: e.pointerId, type: e.pointerType };
          try { canvas.current!.setPointerCapture(e.pointerId); } catch { /* キャプチャできなくても書ける */ }
          strokes.current.push([pt(e)]);
          redraw();
        }}
        onPointerMove={(e) => {
          if (drawing.current?.id !== e.pointerId) return;
          const coalesced = e.nativeEvent.getCoalescedEvents?.() ?? [];
          const events = coalesced.length ? coalesced : [e.nativeEvent];
          const r = canvas.current!.getBoundingClientRect();
          const s = strokes.current[strokes.current.length - 1];
          for (const ev of events) s.push({ x: ev.clientX - r.left, y: ev.clientY - r.top });
          scheduleRedraw();
        }}
        onPointerUp={(e) => {
          if (drawing.current?.id !== e.pointerId) return;
          drawing.current = null;
          redraw();
          onChange?.(false);
        }}
        onPointerCancel={(e) => {
          if (drawing.current?.id !== e.pointerId) return;
          drawing.current = null;
          onChange?.(strokes.current.length === 0);
        }}
        // キャプチャが 外れたのに pointerup が こないことが あるので、ここでも 書きおわりに する
        onLostPointerCapture={(e) => {
          if (drawing.current?.id !== e.pointerId) return;
          drawing.current = null;
          onChange?.(strokes.current.length === 0);
        }}
      />
    </div>
  );
});
