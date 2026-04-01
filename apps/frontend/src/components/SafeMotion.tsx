'use client';

import React, { createContext, useContext, forwardRef, createElement } from 'react';
import { motion as fm, AnimatePresence as FramerAP } from 'framer-motion';

const MountedCtx = createContext(false);
export const MountedProvider = MountedCtx.Provider;

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

function makeSafe(tag: string) {
  return forwardRef((props: any, ref: any) => {
    const mounted = useContext(MountedCtx);
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
  const mounted = useContext(MountedCtx);
  if (mounted) return <FramerAP {...props}>{children}</FramerAP>;
  return <>{children}</>;
}
