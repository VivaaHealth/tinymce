import { Attr } from '@ephox/sugar';

const grab = function (element, bool) {
  Attr.set(element, 'aria-grabbed', bool);
};

// http://www.w3.org/TR/wai-aria/states_and_properties#aria-dropeffect
const effect = function (element, operation) {
  Attr.set(element, 'aria-dropeffect', operation);
};

export default <any> {
  grab,
  effect
};
