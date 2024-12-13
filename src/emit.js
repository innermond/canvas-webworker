const allowed = {};

const eventExistOrOut = (target, key, ) => {
  const original = target[key];
  target[key] = function(...args) {
    const allready = args[0] in allowed;
    if (allready) return false;
    return original.apply(this, args);
  };
};

const emit = new class { 

  @eventExistOrOut
  register(name) {
    allowed[name] = true;
  }

  @eventExistOrOut
  unregister(name) {
    allowed[name] = false;
  }

  @eventExistOrOut
  send(name, detail, target) {
    const event = new CustomEvent(
      name, {
      bubbles: true,
      cancelable: true, 
      detail
    });

    const wasNotCanceled = (target ?? document).dispatchEvent(event);
    return wasNotCanceled;
  }

  @eventExistOrOut
  receive(name, fn, options, target) {
    (target ?? document).addEventListener(name, fn, options);
  }

  @eventExistOrOut
  unreceive(name, fn, options, target) {
    (target ?? document).removeEventListener(name, fn, options);
  }
};

export {emit};
