'use client';

import React, { useState, useEffect, forwardRef, createElement } from 'react';
import { getGlobalMounted, addMountListener } from '@/lib/mountState';

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

function useGlobalMounted() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    if (getGlobalMounted()) setMounted(true);
    const unsub = addMountListener(() => setMounted(getGlobalMounted()));
    return unsub;
  }, []);
  return mounted;
}

let framerMotion: any = null;
let framerAP: any = null;
let loadPromise: Promise<void> | null = null;

function loadFramerMotion() {
  if (!loadPromise) {
    loadPromise = import('framer-motion').then((mod) => {
      framerMotion = mod.motion;
      framerAP = mod.AnimatePresence;
    }).catch(() => {});
  }
  return loadPromise;
}

function makeSafe(tag: string) {
  return forwardRef((props: any, ref: any) => {
    const mounted = useGlobalMounted();
    const [fmLoaded, setFmLoaded] = useState(!!framerMotion);

    useEffect(() => {
      if (!framerMotion) {
        loadFramerMotion().then(() => setFmLoaded(!!framerMotion));
      }
    }, []);

    if (mounted && fmLoaded && framerMotion) {
      const Comp = framerMotion[tag];
      if (Comp) return <Comp {...props} ref={ref} />;
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
  const [fmLoaded, setFmLoaded] = useState(!!framerAP);

  useEffect(() => {
    if (!framerAP) {
      loadFramerMotion().then(() => setFmLoaded(!!framerAP));
    }
  }, []);

  if (mounted && fmLoaded && framerAP) {
    const AP = framerAP;
    return <AP {...props}>{children}</AP>;
  }
  return <>{children}</>;
}

export { notifyMounted } from '@/lib/mountState';
