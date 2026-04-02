let globalMounted = false;
const listeners = new Set<() => void>();

export function notifyMounted(value: boolean) {
  globalMounted = value;
  listeners.forEach((fn) => fn());
}

export function getGlobalMounted() {
  return globalMounted;
}

export function addMountListener(fn: () => void) {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}
