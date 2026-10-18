// 手書きマスに 書いているあいだ、画面に ついた 手のひらで ほかの ボタンが おされないようにする。
// window で いちばん先に（capture で）タッチを 見て、むしするものは React に とどく前に 止める。
//  1) マスに 書いている とちゅう（マスに ふれている 指・ペンが ある）と、書きおわって WRITE_HOLD ミリ秒は、
//     マスの 外への タッチを むしする（ふつうの タッチペンは 指と 見分けが つかないので、時間で 見分ける）
//  2) Apple Pencil など pointerType が pen の ときは、さいごに ペンを 使ってから PEN_HOLD ミリ秒、指の タッチを ぜんぶ むしする
const WRITE_HOLD = 700;
const PEN_HOLD = 1500;
const PAD = '[data-pad]';

let lastPen = 0;
let lastWrite = 0;
const padPointers = new Set<number>();
/** この時刻までは、pointerType の わからない click も むしする（直前の タッチを むししたとき） */
let swallowUntil = 0;

const now = () => Date.now();
const inPad = (e: Event) => e.target instanceof Element && !!e.target.closest(PAD);

/** この タッチを むしするか */
function reject(e: PointerEvent): boolean {
  if (e.pointerType === 'pen' || e.pointerType === 'mouse') return false;
  if (now() - lastPen < PEN_HOLD) return true;
  return !inPad(e) && (padPointers.size > 0 || now() - lastWrite < WRITE_HOLD);
}

function onPointerDown(e: PointerEvent) {
  if (e.pointerType === 'pen') lastPen = now();
  if (reject(e)) {
    swallowUntil = now() + 1000;
    e.preventDefault();
    e.stopPropagation();
    return;
  }
  if (e.pointerType === 'pen') swallowUntil = 0;
  if (inPad(e)) padPointers.add(e.pointerId);
}

function onPointerMove(e: PointerEvent) {
  if (e.pointerType === 'pen') lastPen = now();
  if (padPointers.has(e.pointerId)) lastWrite = now();
}

function onPointerEnd(e: PointerEvent) {
  if (e.pointerType === 'pen') lastPen = now();
  if (padPointers.delete(e.pointerId)) lastWrite = now();
}

function onClick(e: MouseEvent) {
  const type = (e as PointerEvent).pointerType;
  if (type === 'pen' || type === 'mouse') return;
  // click に pointerType が あれば タッチとして、なければ 直前の タッチを むししたかどうかで きめる
  const swallow = now() < swallowUntil;
  const busy = now() - lastPen < PEN_HOLD || padPointers.size > 0 || (now() - lastWrite < WRITE_HOLD && !inPad(e));
  if (type === 'touch' ? swallow || busy : swallow) {
    e.preventDefault();
    e.stopPropagation();
  }
}

let installed = false;
export function installPalmRejection() {
  if (installed || typeof window === 'undefined') return;
  installed = true;
  window.addEventListener('pointerdown', onPointerDown, { capture: true });
  window.addEventListener('pointermove', onPointerMove, { capture: true, passive: true });
  window.addEventListener('pointerup', onPointerEnd, { capture: true, passive: true });
  window.addEventListener('pointercancel', onPointerEnd, { capture: true, passive: true });
  window.addEventListener('click', onClick, { capture: true });
}
