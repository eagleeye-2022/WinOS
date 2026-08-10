"use client";

import { useRef } from "react";
import type { MouseEvent as ReactMouseEvent, RefObject } from "react";

/**
 * Enables click-and-drag horizontal scrolling on a container (e.g. a
 * horizontally-scrollable row of columns). Pairs with a `cursor-grab`
 * class — without this hook that cursor is just decoration, since
 * `overflow-x-auto` alone only responds to a horizontal wheel/trackpad
 * gesture, not a left-click drag.
 *
 * Takes the container ref rather than creating/returning one, since a
 * ref returned from a custom hook can't be assigned straight to a JSX
 * `ref` prop.
 */
export function useDragScroll<T extends HTMLElement>(ref: RefObject<T | null>) {
  const state = useRef({ isDown: false, startX: 0, scrollLeft: 0, moved: false });

  const onMouseDown = (e: ReactMouseEvent<T>) => {
    const el = ref.current;
    if (!el) return;
    state.current = { isDown: true, startX: e.pageX, scrollLeft: el.scrollLeft, moved: false };
  };

  const endDrag = () => {
    state.current.isDown = false;
  };

  const onMouseMove = (e: ReactMouseEvent<T>) => {
    const el = ref.current;
    if (!el || !state.current.isDown) return;
    e.preventDefault();
    const dx = e.pageX - state.current.startX;
    if (Math.abs(dx) > 3) state.current.moved = true;
    el.scrollLeft = state.current.scrollLeft - dx;
  };

  // Suppress the click that follows a drag (e.g. a card's Link) so
  // dragging past a card doesn't also navigate to it.
  const onClickCapture = (e: ReactMouseEvent<T>) => {
    if (state.current.moved) {
      e.preventDefault();
      e.stopPropagation();
    }
  };

  return {
    onMouseDown,
    onMouseMove,
    onMouseUp: endDrag,
    onMouseLeave: endDrag,
    onClickCapture,
  };
}
