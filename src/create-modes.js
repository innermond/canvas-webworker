import {emit} from '@/emit';

export default function createModes(labels) {
  const modes = labels.reduce((acc, v, inx) => {
    acc[v] = 1 << inx;
    return acc;
  }, {});
  const ALL_IS = ((1 << Object.keys(modes).length) - 1); // 1111...
  const NONE_IS = 0;
  // mode get/set a value - one of is
  const mode = (m) => {
    if (m === undefined) return mode.value;
    const mIsValid = (m & ALL_IS) === m && (m & (m - 1)) === 0;
    if (! mIsValid) throw new Error(`${m} is not a valid mode`);
    mode.value = m;
  };
  mode.value = NONE_IS; // no modes 0000...
  // sync is with modes's keys
  const is = {};
  Object.keys(modes).forEach(k => {
    Object.defineProperty(is, k, {
      get: () => mode.value === modes[k],
      set: v => v ? mode(modes[k]) : mode.value = 0,
      enumerable: true,
      configurable: true,
    });
    emit.register(k);
  });

  return {modes, mode, is};
}
