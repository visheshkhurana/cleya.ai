'use client';

import React, { useState, useEffect, forwardRef, createElement } from 'react';
import { motion as fm, AnimatePresence as FramerAP } from 'framer-motion';

const MOTION_KEYS = new Set([
  'initial', 'animate', 'exit', 'variants', 'transition',
  'whileHover', 'whileTap', 'whileInView', 'whileFocus',
  'layout', 'layoutId', 'onAnimationComplete', 'onAnimationStart',
  'custom', 'viewport', 'drag', 'dragConstraints', 'dragElastic',
  'whileDrag', 'dragSnapToOrigin',
]);

function stripMotionProps(props: Record<string, unknown>) {
  const clean: Record<string, unknown> = {};
  for (const k of Object.keys(props)) {
    if (!MOTION_KEYS.has(k)) clean[k] = props[k];
  }
  return clean;
}

let globalMounted = false;
const listeners = new Set<() => void>();

export function notifyMounted(value: boolean) {
  globalMounted = value;
  listeners.forEach((fn) => fn());
}

function useGlobalMounted() {
  const [mounted, setMounted] = useState(globalMounted);
  useEffect(() => {
    const handler = () => setMounted(globalMounted);
    listeners.add(handler);
    handler();
    return () => { listeners.delete(handler); };
  }, []);
  return mounted;
}

function makeSafe(tag: string) {
  return forwardRef((props: any, ref: any) => {
    const mounted = useGlobalMounted();
    if (mounted) {
      const Comp = (fm as any)[tag];
      return <Comp {...props} ref={ref} />;
    }
    return createElement(tag, { ...stripMotionProps(props), ref });
  });
}

export const motion = {
  div: makeSafe('div'),
  span: makeSafe('span'),
  h1: makeSafe('h1'),
  h2: makeSafe('h2'),
  p: makeSafe('p'),
  button: makeSafe('button'),
  a: makeSafe('a'),
  section: makeSafe('section'),
  nav: makeSafe('nav'),
  img: makeSafe('img'),
  ul: makeSafe('ul'),
  li: makeSafe('li'),
};

export function SafeAnimatePresence({ children, ...props }: any) {
  const mounted = useGlobalMounted();
  if (mounted) return <FramerAP {...props}>{children}</FramerAP>;
  return <>{children}</>;
}
