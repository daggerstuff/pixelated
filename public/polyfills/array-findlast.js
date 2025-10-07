// Array.prototype.findLast polyfill
if (!Array.prototype.findLast) {
  Array.prototype.findLast = function(callback, thisArg) {
    if (this == null) {
      throw new TypeError('Array.prototype.findLast called on null or undefined');
    }
    if (typeof callback !== 'function') {
      throw new TypeError('callback must be a function');
    }

    const array = Object(this);
    const len = array.length >>> 0;

    for (let i = len - 1; i >= 0; i--) {
      const value = array[i];
      if (callback.call(thisArg, value, i, array)) {
        return value;
      }
    }

    return undefined;
  };
}
