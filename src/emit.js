const allowed = {};

//const eventExistOrOut = (target, key) => {
//  const original = target[key];
//  target[key] = function (...args) {
//    console.log(args[0], allowed);
//    const allready = args[0] in allowed;
//    if (allready) return false;
//    return original.apply(this, args);
//  };
//};

const emit = new (class {
  register(name) {
    allowed[name] = true;
  }

  //@eventExistOrOut
  unregister(name) {
    if (!allowed.hasOwnProperty(name)) return;
    allowed[name] = false;
  }

  //@eventExistOrOut
  send(name, detail, target) {
    if (!allowed.hasOwnProperty(name)) return;
    console.log(allowed);
    const event = new CustomEvent(name, {
      bubbles: true,
      cancelable: true,
      detail,
    });

    const wasNotCanceled = (target ?? document).dispatchEvent(event);
    return wasNotCanceled;
  }

  //@eventExistOrOut
  receive(name, fn, options, target) {
    if (!allowed.hasOwnProperty(name)) return;
    (target ?? document).addEventListener(name, fn, options);
  }

  //@eventExistOrOut
  unreceive(name, fn, options, target) {
    if (!allowed.hasOwnProperty(name)) return;
    (target ?? document).removeEventListener(name, fn, options);
  }
})();

export { emit };
