import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import TeamTabs from './TeamTabs';
import SlotPanel from './SlotPanel';
import { usePicker } from '../../context/PickerContext';

const DISMISS_DRAG_PX = 80;

// Drag-down-to-dismiss on the handle row.
function useDismissDrag(onDismiss) {
  const [dragY, setDragY] = useState(0);
  const startY = useRef(null);
  return {
    dragY,
    handlers: {
      onPointerDown(e) {
        startY.current = e.clientY;
        e.currentTarget.setPointerCapture(e.pointerId);
      },
      onPointerMove(e) {
        if (startY.current !== null) setDragY(Math.max(0, e.clientY - startY.current));
      },
      onPointerUp() {
        if (dragY > DISMISS_DRAG_PX) onDismiss();
        setDragY(0);
        startY.current = null;
      },
    },
  };
}

// Prevents the page behind the sheet from scrolling.
function useBodyScrollLock(locked) {
  useEffect(() => {
    if (!locked) return;
    document.body.classList.add('modal-open');
    return () => document.body.classList.remove('modal-open');
  }, [locked]);
}

const stopDrag = (e) => e.stopPropagation();

export default function BottomSheet() {
  const { activeSlotIndex, subPicker, closeSlot, closeSubPicker } = usePicker();
  const isOpen = activeSlotIndex !== null;
  const { dragY, handlers } = useDismissDrag(closeSlot);
  useBodyScrollLock(isOpen);

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex flex-col justify-end">
      <div className="absolute inset-0 bg-black/60" onClick={closeSlot} style={{ opacity: Math.max(0.1, 1 - dragY / 300) }} />
      <div className="relative bg-gray-900 border-t-2 border-indigo-600 flex flex-col"
        style={{
          height: '92dvh',
          paddingBottom: 'env(safe-area-inset-bottom, 0px)',
          transform: `translateY(${dragY}px)`,
          transition: dragY === 0 ? 'transform 0.25s ease' : 'none',
        }}>
        <div className="flex items-center px-3 py-1.5 shrink-0 cursor-grab active:cursor-grabbing select-none touch-none" {...handlers}>
          <div className="w-12 shrink-0">
            {subPicker && (
              <button type="button" onPointerDown={stopDrag} onClick={closeSubPicker}
                className="text-xs text-indigo-400 hover:text-indigo-300 px-2 py-1 border border-indigo-800 cursor-pointer touch-auto">
                ← Back
              </button>
            )}
          </div>
          <div className="flex-1 flex justify-center"><div className="w-10 h-1 bg-gray-600 rounded-full" /></div>
          <div className="w-12 shrink-0 flex justify-end">
            <button type="button" onPointerDown={stopDrag} onClick={closeSlot}
              className="text-gray-500 hover:text-gray-300 text-xl leading-none cursor-pointer touch-auto">×</button>
          </div>
        </div>
        <TeamTabs />
        <SlotPanel />
      </div>
    </div>,
    document.body,
  );
}
