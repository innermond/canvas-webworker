function animation01(exitFn, animationFn, atMillisec=150) {
  let zero;
  requestAnimationFrame(start);
  function start(t) {
    zero = t;
    animate(t)
  }
  let applyInvert = true;
  async function animate(t) {
    if (exitFn()) {
      return;
    }

    const d = (t - zero) / atMillisec;
    if (d > 1) {
      animationFn(applyInvert);
      applyInvert = ! applyInvert;
      requestAnimationFrame(t => start(t));
    } else {
      requestAnimationFrame(t => animate(t));
    }
  };
}

export {animation01};
