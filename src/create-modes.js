export default function createModes(labels) {
  const modes = labels.reduce((acc, v, inx) => {
    acc[v] = 1 << inx;
    return acc;
  }, {});

  const ALL_IS = (1 << Object.keys(modes).length) - 1; // 1111...
  const NONE_IS = 0;
  
  // mode get/set a value - one of is
  const mode = (m) => {
    if (m === undefined) throw new Error(`value provided is not defined`);
    const mIsValid = (m & ALL_IS) === m && (m & (m - 1)) === 0;
    if (!mIsValid) throw new Error(`${m} is not a valid mode`);
    value = m;
  };
  
  let value = NONE_IS; // no modes 0000...
  let exclude = true;
  
  // sync is with modes's keys
  const is = {
    autoexclude: (v) => {
      if (v === undefined) {
        return exclude;
      }

      exclude = v;
    },
  };
  Object.keys(modes).forEach((k) => {
    Object.defineProperty(is, k, {
      get: () => exclude ? value === modes[k] : 0 !== (value & modes[k]),
      set: (v) => {
        if (exclude) {
          v ? mode(modes[k]) : (value = 0);
        } else {
          v ? value |= modes[k] : value &= ~modes[k];
        }
      },
      enumerable: true,
      configurable: true,
    });
  });

  return { modes, mode, is };
}
