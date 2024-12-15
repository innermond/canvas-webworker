import {is, modes} from '@/modes';
import {doPhases, doPhasesReversed} from '@/vars';

//function doSelect() {
//  is.select = !is.select;
//  document.getElementById('doSelect').classList.toggle('inactive');
//}
// Create functions like the one above for any do...modes's key
// and bind them to their coresponding DOM buttons


for (let k in modes) {
  const name = 'do' + k.charAt(0).toUpperCase() + k.slice(1);
  const fn = () => {
    is[k] = !is[k];
    // Add inactive class to all do...modes's key DOM elements
    document.querySelectorAll('[id^=do]')?.forEach(x => {
      let name = x.id.slice(2);
      name = name.charAt(0).toLowerCase() + name.slice(1);
      if (Object.keys(modes).includes(name) === false) return;;
      // replace 'active' to 'inactive'
      x.classList.replace(...doPhasesReversed);
    })
    // toggle active class to pressed button
    const fromto = is[k] ? doPhases : doPhasesReversed;
    document.getElementById(name)?.classList.replace(...fromto);
  }
  Object.defineProperty(fn, 'name', {value: name});
  document.getElementById(name)?.addEventListener('click', fn);
  globalThis[name] = fn;
}
