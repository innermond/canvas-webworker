import {expect, it} from 'vitest';
import createModes from '@/create-modes';

it('autoexclude', () => {
  const labels = ['one', 'two', 'three'];
  const {is} = createModes(labels, true);

  labels.forEach( v => expect(is[v]).equal(false));
  
  is.one = true;
  is.two = true;
  is.three = true;
  expect(is.one).equal(false);
  expect(is.two).equal(false);
  expect(is.three).equal(true);

  expect(is['four']).equal(undefined);
  expect(is.one).equal(false);

  is.autoexclude(false);
  labels.forEach( k => (is[k] = true));
  labels.forEach( k => expect(is[k]).equal(true));
  is.autoexclude(true);

});
