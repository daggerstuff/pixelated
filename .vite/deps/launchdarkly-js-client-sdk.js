import "./chunk-PLDDJCW6.js";

// node_modules/.pnpm/launchdarkly-js-client-sdk@3.9.0/node_modules/launchdarkly-js-client-sdk/dist/ldclient.es.js
function e(e4) {
  function t2(e5, t3) {
    Error.captureStackTrace && Error.captureStackTrace(this, this.constructor), this.message = e5, this.code = t3;
  }
  return t2.prototype = new Error(), t2.prototype.name = e4, t2.prototype.constructor = t2, t2;
}
var t = e("LaunchDarklyUnexpectedResponseError");
var n = e("LaunchDarklyInvalidEnvironmentIdError");
var r = e("LaunchDarklyInvalidUserError");
var o = e("LaunchDarklyInvalidEventKeyError");
var i = e("LaunchDarklyInvalidArgumentError");
var a = e("LaunchDarklyFlagFetchError");
for (s = { LDUnexpectedResponseError: t, LDInvalidEnvironmentIdError: n, LDInvalidUserError: r, LDInvalidEventKeyError: o, LDInvalidArgumentError: i, LDInvalidDataError: e("LaunchDarklyInvalidDataError"), LDFlagFetchError: a, LDTimeoutError: e("LaunchDarklyTimeoutError"), isHttpErrorRecoverable: function(e4) {
  return !(e4 >= 400 && e4 < 500) || (400 === e4 || 408 === e4 || 429 === e4);
} }, c = function(e4) {
  var t2 = m(e4), n2 = t2[0], r2 = t2[1];
  return 3 * (n2 + r2) / 4 - r2;
}, u = function(e4) {
  var t2, n2, r2 = m(e4), o2 = r2[0], i2 = r2[1], a2 = new g((function(e5, t3, n3) {
    return 3 * (t3 + n3) / 4 - n3;
  })(0, o2, i2)), s2 = 0, c2 = i2 > 0 ? o2 - 4 : o2;
  for (n2 = 0; n2 < c2; n2 += 4) t2 = f[e4.charCodeAt(n2)] << 18 | f[e4.charCodeAt(n2 + 1)] << 12 | f[e4.charCodeAt(n2 + 2)] << 6 | f[e4.charCodeAt(n2 + 3)], a2[s2++] = t2 >> 16 & 255, a2[s2++] = t2 >> 8 & 255, a2[s2++] = 255 & t2;
  2 === i2 && (t2 = f[e4.charCodeAt(n2)] << 2 | f[e4.charCodeAt(n2 + 1)] >> 4, a2[s2++] = 255 & t2);
  1 === i2 && (t2 = f[e4.charCodeAt(n2)] << 10 | f[e4.charCodeAt(n2 + 1)] << 4 | f[e4.charCodeAt(n2 + 2)] >> 2, a2[s2++] = t2 >> 8 & 255, a2[s2++] = 255 & t2);
  return a2;
}, l = function(e4) {
  for (var t2, n2 = e4.length, r2 = n2 % 3, o2 = [], i2 = 16383, a2 = 0, s2 = n2 - r2; a2 < s2; a2 += i2) o2.push(y(e4, a2, a2 + i2 > s2 ? s2 : a2 + i2));
  1 === r2 ? (t2 = e4[n2 - 1], o2.push(d[t2 >> 2] + d[t2 << 4 & 63] + "==")) : 2 === r2 && (t2 = (e4[n2 - 2] << 8) + e4[n2 - 1], o2.push(d[t2 >> 10] + d[t2 >> 4 & 63] + d[t2 << 2 & 63] + "="));
  return o2.join("");
}, d = [], f = [], g = "undefined" != typeof Uint8Array ? Uint8Array : Array, v = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/", p = 0; p < 64; ++p) d[p] = v[p], f[v.charCodeAt(p)] = p;
var s;
var c;
var u;
var l;
var d;
var f;
var g;
var v;
var p;
function m(e4) {
  var t2 = e4.length;
  if (t2 % 4 > 0) throw new Error("Invalid string. Length must be a multiple of 4");
  var n2 = e4.indexOf("=");
  return -1 === n2 && (n2 = t2), [n2, n2 === t2 ? 0 : 4 - n2 % 4];
}
function h(e4) {
  return d[e4 >> 18 & 63] + d[e4 >> 12 & 63] + d[e4 >> 6 & 63] + d[63 & e4];
}
function y(e4, t2, n2) {
  for (var r2, o2 = [], i2 = t2; i2 < n2; i2 += 3) r2 = (e4[i2] << 16 & 16711680) + (e4[i2 + 1] << 8 & 65280) + (255 & e4[i2 + 2]), o2.push(h(r2));
  return o2.join("");
}
f["-".charCodeAt(0)] = 62, f["_".charCodeAt(0)] = 63;
var w = { byteLength: c, toByteArray: u, fromByteArray: l };
var b = Array.isArray;
var k = Object.keys;
var E = Object.prototype.hasOwnProperty;
var D = function e2(t2, n2) {
  if (t2 === n2) return true;
  if (t2 && n2 && "object" == typeof t2 && "object" == typeof n2) {
    var r2, o2, i2, a2 = b(t2), s = b(n2);
    if (a2 && s) {
      if ((o2 = t2.length) != n2.length) return false;
      for (r2 = o2; 0 !== r2--; ) if (!e2(t2[r2], n2[r2])) return false;
      return true;
    }
    if (a2 != s) return false;
    var c = t2 instanceof Date, u = n2 instanceof Date;
    if (c != u) return false;
    if (c && u) return t2.getTime() == n2.getTime();
    var l = t2 instanceof RegExp, d = n2 instanceof RegExp;
    if (l != d) return false;
    if (l && d) return t2.toString() == n2.toString();
    var f = k(t2);
    if ((o2 = f.length) !== k(n2).length) return false;
    for (r2 = o2; 0 !== r2--; ) if (!E.call(n2, f[r2])) return false;
    for (r2 = o2; 0 !== r2--; ) if (!e2(t2[i2 = f[r2]], n2[i2])) return false;
    return true;
  }
  return t2 != t2 && n2 != n2;
};
var x = ["key", "ip", "country", "email", "firstName", "lastName", "avatar", "name"];
function O(e4) {
  const t2 = unescape(encodeURIComponent(e4));
  return w.fromByteArray((function(e5) {
    const t3 = [];
    for (let n2 = 0; n2 < e5.length; n2++) t3.push(e5.charCodeAt(n2));
    return t3;
  })(t2));
}
function C(e4, t2) {
  return Object.prototype.hasOwnProperty.call(e4, t2);
}
var P;
var S = { appendUrlPath: function(e4, t2) {
  return (e4.endsWith("/") ? e4.substring(0, e4.length - 1) : e4) + (t2.startsWith("/") ? "" : "/") + t2;
}, base64URLEncode: function(e4) {
  return O(e4).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}, btoa: O, clone: function(e4) {
  return JSON.parse(JSON.stringify(e4));
}, deepEquals: function(e4, t2) {
  return D(e4, t2);
}, extend: function(...e4) {
  return e4.reduce((e5, t2) => ({ ...e5, ...t2 }), {});
}, getLDUserAgentString: function(e4) {
  const t2 = e4.version || "?";
  return e4.userAgent + "/" + t2;
}, objectHasOwnProperty: C, onNextTick: function(e4) {
  setTimeout(e4, 0);
}, sanitizeContext: function(e4) {
  if (!e4) return e4;
  let t2;
  return null !== e4.kind && void 0 !== e4.kind || x.forEach((n2) => {
    const r2 = e4[n2];
    void 0 !== r2 && "string" != typeof r2 && (t2 = t2 || { ...e4 }, t2[n2] = String(r2));
  }), t2 || e4;
}, transformValuesToVersionedValues: function(e4) {
  const t2 = {};
  for (const n2 in e4) C(e4, n2) && (t2[n2] = { value: e4[n2], version: 0 });
  return t2;
}, transformVersionedValuesToValues: function(e4) {
  const t2 = {};
  for (const n2 in e4) C(e4, n2) && (t2[n2] = e4[n2].value);
  return t2;
}, wrapPromiseCallback: function(e4, t2) {
  const n2 = e4.then((e5) => (t2 && setTimeout(() => {
    t2(null, e5);
  }, 0), e5), (e5) => {
    if (!t2) return Promise.reject(e5);
    setTimeout(() => {
      t2(e5, null);
    }, 0);
  });
  return t2 ? void 0 : n2;
}, once: function(e4) {
  let t2, n2 = false;
  return function(...r2) {
    return n2 || (n2 = true, t2 = e4.apply(this, r2)), t2;
  };
} };
var I = new Uint8Array(16);
function T() {
  if (!P && !(P = "undefined" != typeof crypto && crypto.getRandomValues && crypto.getRandomValues.bind(crypto) || "undefined" != typeof msCrypto && "function" == typeof msCrypto.getRandomValues && msCrypto.getRandomValues.bind(msCrypto))) throw new Error("crypto.getRandomValues() not supported. See https://github.com/uuidjs/uuid#getrandomvalues-not-supported");
  return P(I);
}
var F = /^(?:[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}|00000000-0000-0000-0000-000000000000)$/i;
function L(e4) {
  return "string" == typeof e4 && F.test(e4);
}
for (j = [], R = 0; R < 256; ++R) j.push((R + 256).toString(16).substr(1));
var U;
var A;
var j;
var R;
function N(e4) {
  var t2 = arguments.length > 1 && void 0 !== arguments[1] ? arguments[1] : 0, n2 = (j[e4[t2 + 0]] + j[e4[t2 + 1]] + j[e4[t2 + 2]] + j[e4[t2 + 3]] + "-" + j[e4[t2 + 4]] + j[e4[t2 + 5]] + "-" + j[e4[t2 + 6]] + j[e4[t2 + 7]] + "-" + j[e4[t2 + 8]] + j[e4[t2 + 9]] + "-" + j[e4[t2 + 10]] + j[e4[t2 + 11]] + j[e4[t2 + 12]] + j[e4[t2 + 13]] + j[e4[t2 + 14]] + j[e4[t2 + 15]]).toLowerCase();
  if (!L(n2)) throw TypeError("Stringified UUID is invalid");
  return n2;
}
var $ = 0;
var V = 0;
function H(e4) {
  if (!L(e4)) throw TypeError("Invalid UUID");
  var t2, n2 = new Uint8Array(16);
  return n2[0] = (t2 = parseInt(e4.slice(0, 8), 16)) >>> 24, n2[1] = t2 >>> 16 & 255, n2[2] = t2 >>> 8 & 255, n2[3] = 255 & t2, n2[4] = (t2 = parseInt(e4.slice(9, 13), 16)) >>> 8, n2[5] = 255 & t2, n2[6] = (t2 = parseInt(e4.slice(14, 18), 16)) >>> 8, n2[7] = 255 & t2, n2[8] = (t2 = parseInt(e4.slice(19, 23), 16)) >>> 8, n2[9] = 255 & t2, n2[10] = (t2 = parseInt(e4.slice(24, 36), 16)) / 1099511627776 & 255, n2[11] = t2 / 4294967296 & 255, n2[12] = t2 >>> 24 & 255, n2[13] = t2 >>> 16 & 255, n2[14] = t2 >>> 8 & 255, n2[15] = 255 & t2, n2;
}
function M(e4, t2, n2) {
  function r2(e5, r3, o2, i2) {
    if ("string" == typeof e5 && (e5 = (function(e6) {
      e6 = unescape(encodeURIComponent(e6));
      for (var t3 = [], n3 = 0; n3 < e6.length; ++n3) t3.push(e6.charCodeAt(n3));
      return t3;
    })(e5)), "string" == typeof r3 && (r3 = H(r3)), 16 !== r3.length) throw TypeError("Namespace must be array-like (16 iterable integer values, 0-255)");
    var a2 = new Uint8Array(16 + e5.length);
    if (a2.set(r3), a2.set(e5, r3.length), (a2 = n2(a2))[6] = 15 & a2[6] | t2, a2[8] = 63 & a2[8] | 128, o2) {
      i2 = i2 || 0;
      for (var s = 0; s < 16; ++s) o2[i2 + s] = a2[s];
      return o2;
    }
    return N(a2);
  }
  try {
    r2.name = e4;
  } catch (e5) {
  }
  return r2.DNS = "6ba7b810-9dad-11d1-80b4-00c04fd430c8", r2.URL = "6ba7b811-9dad-11d1-80b4-00c04fd430c8", r2;
}
function q(e4) {
  return 14 + (e4 + 64 >>> 9 << 4) + 1;
}
function z(e4, t2) {
  var n2 = (65535 & e4) + (65535 & t2);
  return (e4 >> 16) + (t2 >> 16) + (n2 >> 16) << 16 | 65535 & n2;
}
function K(e4, t2, n2, r2, o2, i2) {
  return z((a2 = z(z(t2, e4), z(r2, i2))) << (s = o2) | a2 >>> 32 - s, n2);
  var a2, s;
}
function _(e4, t2, n2, r2, o2, i2, a2) {
  return K(t2 & n2 | ~t2 & r2, e4, t2, o2, i2, a2);
}
function J(e4, t2, n2, r2, o2, i2, a2) {
  return K(t2 & r2 | n2 & ~r2, e4, t2, o2, i2, a2);
}
function B(e4, t2, n2, r2, o2, i2, a2) {
  return K(t2 ^ n2 ^ r2, e4, t2, o2, i2, a2);
}
function W(e4, t2, n2, r2, o2, i2, a2) {
  return K(n2 ^ (t2 | ~r2), e4, t2, o2, i2, a2);
}
var G = M("v3", 48, function(e4) {
  if ("string" == typeof e4) {
    var t2 = unescape(encodeURIComponent(e4));
    e4 = new Uint8Array(t2.length);
    for (var n2 = 0; n2 < t2.length; ++n2) e4[n2] = t2.charCodeAt(n2);
  }
  return (function(e5) {
    for (var t3 = [], n3 = 32 * e5.length, r2 = "0123456789abcdef", o2 = 0; o2 < n3; o2 += 8) {
      var i2 = e5[o2 >> 5] >>> o2 % 32 & 255, a2 = parseInt(r2.charAt(i2 >>> 4 & 15) + r2.charAt(15 & i2), 16);
      t3.push(a2);
    }
    return t3;
  })((function(e5, t3) {
    e5[t3 >> 5] |= 128 << t3 % 32, e5[q(t3) - 1] = t3;
    for (var n3 = 1732584193, r2 = -271733879, o2 = -1732584194, i2 = 271733878, a2 = 0; a2 < e5.length; a2 += 16) {
      var s = n3, c = r2, u = o2, l = i2;
      n3 = _(n3, r2, o2, i2, e5[a2], 7, -680876936), i2 = _(i2, n3, r2, o2, e5[a2 + 1], 12, -389564586), o2 = _(o2, i2, n3, r2, e5[a2 + 2], 17, 606105819), r2 = _(r2, o2, i2, n3, e5[a2 + 3], 22, -1044525330), n3 = _(n3, r2, o2, i2, e5[a2 + 4], 7, -176418897), i2 = _(i2, n3, r2, o2, e5[a2 + 5], 12, 1200080426), o2 = _(o2, i2, n3, r2, e5[a2 + 6], 17, -1473231341), r2 = _(r2, o2, i2, n3, e5[a2 + 7], 22, -45705983), n3 = _(n3, r2, o2, i2, e5[a2 + 8], 7, 1770035416), i2 = _(i2, n3, r2, o2, e5[a2 + 9], 12, -1958414417), o2 = _(o2, i2, n3, r2, e5[a2 + 10], 17, -42063), r2 = _(r2, o2, i2, n3, e5[a2 + 11], 22, -1990404162), n3 = _(n3, r2, o2, i2, e5[a2 + 12], 7, 1804603682), i2 = _(i2, n3, r2, o2, e5[a2 + 13], 12, -40341101), o2 = _(o2, i2, n3, r2, e5[a2 + 14], 17, -1502002290), n3 = J(n3, r2 = _(r2, o2, i2, n3, e5[a2 + 15], 22, 1236535329), o2, i2, e5[a2 + 1], 5, -165796510), i2 = J(i2, n3, r2, o2, e5[a2 + 6], 9, -1069501632), o2 = J(o2, i2, n3, r2, e5[a2 + 11], 14, 643717713), r2 = J(r2, o2, i2, n3, e5[a2], 20, -373897302), n3 = J(n3, r2, o2, i2, e5[a2 + 5], 5, -701558691), i2 = J(i2, n3, r2, o2, e5[a2 + 10], 9, 38016083), o2 = J(o2, i2, n3, r2, e5[a2 + 15], 14, -660478335), r2 = J(r2, o2, i2, n3, e5[a2 + 4], 20, -405537848), n3 = J(n3, r2, o2, i2, e5[a2 + 9], 5, 568446438), i2 = J(i2, n3, r2, o2, e5[a2 + 14], 9, -1019803690), o2 = J(o2, i2, n3, r2, e5[a2 + 3], 14, -187363961), r2 = J(r2, o2, i2, n3, e5[a2 + 8], 20, 1163531501), n3 = J(n3, r2, o2, i2, e5[a2 + 13], 5, -1444681467), i2 = J(i2, n3, r2, o2, e5[a2 + 2], 9, -51403784), o2 = J(o2, i2, n3, r2, e5[a2 + 7], 14, 1735328473), n3 = B(n3, r2 = J(r2, o2, i2, n3, e5[a2 + 12], 20, -1926607734), o2, i2, e5[a2 + 5], 4, -378558), i2 = B(i2, n3, r2, o2, e5[a2 + 8], 11, -2022574463), o2 = B(o2, i2, n3, r2, e5[a2 + 11], 16, 1839030562), r2 = B(r2, o2, i2, n3, e5[a2 + 14], 23, -35309556), n3 = B(n3, r2, o2, i2, e5[a2 + 1], 4, -1530992060), i2 = B(i2, n3, r2, o2, e5[a2 + 4], 11, 1272893353), o2 = B(o2, i2, n3, r2, e5[a2 + 7], 16, -155497632), r2 = B(r2, o2, i2, n3, e5[a2 + 10], 23, -1094730640), n3 = B(n3, r2, o2, i2, e5[a2 + 13], 4, 681279174), i2 = B(i2, n3, r2, o2, e5[a2], 11, -358537222), o2 = B(o2, i2, n3, r2, e5[a2 + 3], 16, -722521979), r2 = B(r2, o2, i2, n3, e5[a2 + 6], 23, 76029189), n3 = B(n3, r2, o2, i2, e5[a2 + 9], 4, -640364487), i2 = B(i2, n3, r2, o2, e5[a2 + 12], 11, -421815835), o2 = B(o2, i2, n3, r2, e5[a2 + 15], 16, 530742520), n3 = W(n3, r2 = B(r2, o2, i2, n3, e5[a2 + 2], 23, -995338651), o2, i2, e5[a2], 6, -198630844), i2 = W(i2, n3, r2, o2, e5[a2 + 7], 10, 1126891415), o2 = W(o2, i2, n3, r2, e5[a2 + 14], 15, -1416354905), r2 = W(r2, o2, i2, n3, e5[a2 + 5], 21, -57434055), n3 = W(n3, r2, o2, i2, e5[a2 + 12], 6, 1700485571), i2 = W(i2, n3, r2, o2, e5[a2 + 3], 10, -1894986606), o2 = W(o2, i2, n3, r2, e5[a2 + 10], 15, -1051523), r2 = W(r2, o2, i2, n3, e5[a2 + 1], 21, -2054922799), n3 = W(n3, r2, o2, i2, e5[a2 + 8], 6, 1873313359), i2 = W(i2, n3, r2, o2, e5[a2 + 15], 10, -30611744), o2 = W(o2, i2, n3, r2, e5[a2 + 6], 15, -1560198380), r2 = W(r2, o2, i2, n3, e5[a2 + 13], 21, 1309151649), n3 = W(n3, r2, o2, i2, e5[a2 + 4], 6, -145523070), i2 = W(i2, n3, r2, o2, e5[a2 + 11], 10, -1120210379), o2 = W(o2, i2, n3, r2, e5[a2 + 2], 15, 718787259), r2 = W(r2, o2, i2, n3, e5[a2 + 9], 21, -343485551), n3 = z(n3, s), r2 = z(r2, c), o2 = z(o2, u), i2 = z(i2, l);
    }
    return [n3, r2, o2, i2];
  })((function(e5) {
    if (0 === e5.length) return [];
    for (var t3 = 8 * e5.length, n3 = new Uint32Array(q(t3)), r2 = 0; r2 < t3; r2 += 8) n3[r2 >> 5] |= (255 & e5[r2 / 8]) << r2 % 32;
    return n3;
  })(e4), 8 * e4.length));
});
var X = G;
function Q(e4, t2, n2, r2) {
  switch (e4) {
    case 0:
      return t2 & n2 ^ ~t2 & r2;
    case 1:
    case 3:
      return t2 ^ n2 ^ r2;
    case 2:
      return t2 & n2 ^ t2 & r2 ^ n2 & r2;
  }
}
function Y(e4, t2) {
  return e4 << t2 | e4 >>> 32 - t2;
}
var Z = M("v5", 80, function(e4) {
  var t2 = [1518500249, 1859775393, 2400959708, 3395469782], n2 = [1732584193, 4023233417, 2562383102, 271733878, 3285377520];
  if ("string" == typeof e4) {
    var r2 = unescape(encodeURIComponent(e4));
    e4 = [];
    for (var o2 = 0; o2 < r2.length; ++o2) e4.push(r2.charCodeAt(o2));
  } else Array.isArray(e4) || (e4 = Array.prototype.slice.call(e4));
  e4.push(128);
  for (var i2 = e4.length / 4 + 2, a2 = Math.ceil(i2 / 16), s = new Array(a2), c = 0; c < a2; ++c) {
    for (var u = new Uint32Array(16), l = 0; l < 16; ++l) u[l] = e4[64 * c + 4 * l] << 24 | e4[64 * c + 4 * l + 1] << 16 | e4[64 * c + 4 * l + 2] << 8 | e4[64 * c + 4 * l + 3];
    s[c] = u;
  }
  s[a2 - 1][14] = 8 * (e4.length - 1) / Math.pow(2, 32), s[a2 - 1][14] = Math.floor(s[a2 - 1][14]), s[a2 - 1][15] = 8 * (e4.length - 1) & 4294967295;
  for (var d = 0; d < a2; ++d) {
    for (var f = new Uint32Array(80), g = 0; g < 16; ++g) f[g] = s[d][g];
    for (var v = 16; v < 80; ++v) f[v] = Y(f[v - 3] ^ f[v - 8] ^ f[v - 14] ^ f[v - 16], 1);
    for (var p = n2[0], m2 = n2[1], h2 = n2[2], y2 = n2[3], w2 = n2[4], b2 = 0; b2 < 80; ++b2) {
      var k2 = Math.floor(b2 / 20), E2 = Y(p, 5) + Q(k2, m2, h2, y2) + w2 + t2[k2] + f[b2] >>> 0;
      w2 = y2, y2 = h2, h2 = Y(m2, 30) >>> 0, m2 = p, p = E2;
    }
    n2[0] = n2[0] + p >>> 0, n2[1] = n2[1] + m2 >>> 0, n2[2] = n2[2] + h2 >>> 0, n2[3] = n2[3] + y2 >>> 0, n2[4] = n2[4] + w2 >>> 0;
  }
  return [n2[0] >> 24 & 255, n2[0] >> 16 & 255, n2[0] >> 8 & 255, 255 & n2[0], n2[1] >> 24 & 255, n2[1] >> 16 & 255, n2[1] >> 8 & 255, 255 & n2[1], n2[2] >> 24 & 255, n2[2] >> 16 & 255, n2[2] >> 8 & 255, 255 & n2[2], n2[3] >> 24 & 255, n2[3] >> 16 & 255, n2[3] >> 8 & 255, 255 & n2[3], n2[4] >> 24 & 255, n2[4] >> 16 & 255, n2[4] >> 8 & 255, 255 & n2[4]];
});
var ee = Z;
var te = Object.freeze({ __proto__: null, v1: function(e4, t2, n2) {
  var r2 = t2 && n2 || 0, o2 = t2 || new Array(16), i2 = (e4 = e4 || {}).node || U, a2 = void 0 !== e4.clockseq ? e4.clockseq : A;
  if (null == i2 || null == a2) {
    var s = e4.random || (e4.rng || T)();
    null == i2 && (i2 = U = [1 | s[0], s[1], s[2], s[3], s[4], s[5]]), null == a2 && (a2 = A = 16383 & (s[6] << 8 | s[7]));
  }
  var c = void 0 !== e4.msecs ? e4.msecs : Date.now(), u = void 0 !== e4.nsecs ? e4.nsecs : V + 1, l = c - $ + (u - V) / 1e4;
  if (l < 0 && void 0 === e4.clockseq && (a2 = a2 + 1 & 16383), (l < 0 || c > $) && void 0 === e4.nsecs && (u = 0), u >= 1e4) throw new Error("uuid.v1(): Can't create more than 10M uuids/sec");
  $ = c, V = u, A = a2;
  var d = (1e4 * (268435455 & (c += 122192928e5)) + u) % 4294967296;
  o2[r2++] = d >>> 24 & 255, o2[r2++] = d >>> 16 & 255, o2[r2++] = d >>> 8 & 255, o2[r2++] = 255 & d;
  var f = c / 4294967296 * 1e4 & 268435455;
  o2[r2++] = f >>> 8 & 255, o2[r2++] = 255 & f, o2[r2++] = f >>> 24 & 15 | 16, o2[r2++] = f >>> 16 & 255, o2[r2++] = a2 >>> 8 | 128, o2[r2++] = 255 & a2;
  for (var g = 0; g < 6; ++g) o2[r2 + g] = i2[g];
  return t2 || N(o2);
}, v3: X, v4: function(e4, t2, n2) {
  var r2 = (e4 = e4 || {}).random || (e4.rng || T)();
  if (r2[6] = 15 & r2[6] | 64, r2[8] = 63 & r2[8] | 128, t2) {
    n2 = n2 || 0;
    for (var o2 = 0; o2 < 16; ++o2) t2[n2 + o2] = r2[o2];
    return t2;
  }
  return N(r2);
}, v5: ee, NIL: "00000000-0000-0000-0000-000000000000", version: function(e4) {
  if (!L(e4)) throw TypeError("Invalid UUID");
  return parseInt(e4.substr(14, 1), 16);
}, validate: L, stringify: N, parse: H });
var ne = ["debug", "info", "warn", "error", "none"];
var re = { commonBasicLogger: function(e4, t2) {
  if (e4 && e4.destination && "function" != typeof e4.destination) throw new Error("destination for basicLogger was set to a non-function");
  function n2(e5) {
    return function(t3) {
      console && console[e5] && console[e5].call(console, t3);
    };
  }
  const r2 = e4 && e4.destination ? [e4.destination, e4.destination, e4.destination, e4.destination] : [n2("log"), n2("info"), n2("warn"), n2("error")], o2 = !(!e4 || !e4.destination), i2 = e4 && void 0 !== e4.prefix && null !== e4.prefix ? e4.prefix : "[LaunchDarkly] ";
  let a2 = 1;
  if (e4 && e4.level) for (let t3 = 0; t3 < ne.length; t3++) ne[t3] === e4.level && (a2 = t3);
  function s(e5, n3, a3) {
    if (a3.length < 1) return;
    let s2;
    const c2 = o2 ? n3 + ": " + i2 : i2;
    if (1 !== a3.length && t2) {
      const e6 = [...a3];
      e6[0] = c2 + e6[0], s2 = t2(...e6);
    } else s2 = c2 + a3[0];
    try {
      r2[e5](s2);
    } catch (e6) {
      console && console.log && console.log("[LaunchDarkly] Configured logger's " + n3 + " method threw an exception: " + e6);
    }
  }
  const c = {};
  for (let e5 = 0; e5 < ne.length; e5++) {
    const t3 = ne[e5];
    if ("none" !== t3) if (e5 < a2) c[t3] = () => {
    };
    else {
      const n3 = e5;
      c[t3] = function() {
        s(n3, t3, arguments);
      };
    }
  }
  return c;
}, validateLogger: function(e4) {
  ne.forEach((t2) => {
    if ("none" !== t2 && (!e4[t2] || "function" != typeof e4[t2])) throw new Error("Provided logger instance must support logger." + t2 + "(...) method");
  });
} };
function oe(e4) {
  return e4 && e4.message ? e4.message : "string" == typeof e4 || e4 instanceof String ? e4 : JSON.stringify(e4);
}
var ie = " Please see https://docs.launchdarkly.com/sdk/client-side/javascript#initialize-the-client for instructions on SDK initialization.";
var ae = { bootstrapInvalid: function() {
  return "LaunchDarkly bootstrap data is not available because the back end could not read the flags.";
}, bootstrapOldFormat: function() {
  return "LaunchDarkly client was initialized with bootstrap data that did not include flag metadata. Events may not be sent correctly." + ie;
}, clientInitialized: function() {
  return "LaunchDarkly client initialized";
}, clientNotReady: function() {
  return "LaunchDarkly client is not ready";
}, debugEnqueueingEvent: function(e4) {
  return 'enqueueing "' + e4 + '" event';
}, debugPostingDiagnosticEvent: function(e4) {
  return "sending diagnostic event (" + e4.kind + ")";
}, debugPostingEvents: function(e4) {
  return "sending " + e4 + " events";
}, debugStreamDelete: function(e4) {
  return 'received streaming deletion for flag "' + e4 + '"';
}, debugStreamDeleteIgnored: function(e4) {
  return 'received streaming deletion for flag "' + e4 + '" but ignored due to version check';
}, debugStreamPatch: function(e4) {
  return 'received streaming update for flag "' + e4 + '"';
}, debugStreamPatchIgnored: function(e4) {
  return 'received streaming update for flag "' + e4 + '" but ignored due to version check';
}, debugStreamPing: function() {
  return "received ping message from stream";
}, debugPolling: function(e4) {
  return "polling for feature flags at " + e4;
}, debugStreamPut: function() {
  return "received streaming update for all flags";
}, deprecated: function(e4, t2) {
  return t2 ? '"' + e4 + '" is deprecated, please use "' + t2 + '"' : '"' + e4 + '" is deprecated';
}, environmentNotFound: function() {
  return "Environment not found. Double check that you specified a valid environment/client-side ID." + ie;
}, environmentNotSpecified: function() {
  return "No environment/client-side ID was specified." + ie;
}, errorFetchingFlags: function(e4) {
  return "Error fetching flag settings: " + oe(e4);
}, eventCapacityExceeded: function() {
  return "Exceeded event queue capacity. Increase capacity to avoid dropping events.";
}, eventWithoutContext: function() {
  return "Be sure to call `identify` in the LaunchDarkly client: https://docs.launchdarkly.com/sdk/features/identify#javascript";
}, httpErrorMessage: function(e4, t2, n2) {
  return "Received error " + e4 + (401 === e4 ? " (invalid SDK key)" : "") + " for " + t2 + " - " + (s.isHttpErrorRecoverable(e4) ? n2 : "giving up permanently");
}, httpUnavailable: function() {
  return "Cannot make HTTP requests in this environment." + ie;
}, identifyDisabled: function() {
  return "identify() has no effect here; it must be called on the main client instance";
}, inspectorMethodError: (e4, t2) => `an inspector: "${t2}" of type: "${e4}" generated an exception`, invalidContentType: function(e4) {
  return 'Expected application/json content type but got "' + e4 + '"';
}, invalidData: function() {
  return "Invalid data received from LaunchDarkly; connection may have been interrupted";
}, invalidInspector: (e4, t2) => `an inspector: "${t2}" of an invalid type (${e4}) was configured`, invalidKey: function() {
  return "Event key must be a string";
}, invalidMetricValue: (e4) => `The track function was called with a non-numeric "metricValue" (${e4}), only numeric metric values are supported.`, invalidContext: function() {
  return "Invalid context specified." + ie;
}, invalidTagValue: (e4) => `Config option "${e4}" must only contain letters, numbers, ., _ or -.`, localStorageUnavailable: function(e4) {
  return "local storage is unavailable: " + oe(e4);
}, networkError: (e4) => "network error" + (e4 ? " (" + e4 + ")" : ""), optionBelowMinimum: (e4, t2, n2) => 'Config option "' + e4 + '" was set to ' + t2 + ", changing to minimum value of " + n2, streamClosing: function() {
  return "Closing stream connection";
}, streamConnecting: function(e4) {
  return "Opening stream connection to " + e4;
}, streamError: function(e4, t2) {
  return "Error on stream connection: " + oe(e4) + ", will continue retrying after " + t2 + " milliseconds.";
}, tagValueTooLong: (e4) => `Value of "${e4}" was longer than 64 characters and was discarded.`, unknownCustomEventKey: function(e4) {
  return 'Custom event "' + e4 + '" does not exist';
}, unknownOption: (e4) => 'Ignoring unknown config option "' + e4 + '"', contextNotSpecified: function() {
  return "No context specified." + ie;
}, unrecoverableStreamError: (e4) => `Error on stream connection ${oe(e4)}, giving up permanently`, wrongOptionType: (e4, t2, n2) => 'Config option "' + e4 + '" should be of type ' + t2 + ", got " + n2 + ", using default value", wrongOptionTypeBoolean: (e4, t2) => 'Config option "' + e4 + '" should be a boolean, got ' + t2 + ", converting to boolean" };
var { validateLogger: se } = re;
var ce = { baseUrl: { default: "https://app.launchdarkly.com" }, streamUrl: { default: "https://clientstream.launchdarkly.com" }, eventsUrl: { default: "https://events.launchdarkly.com" }, sendEvents: { default: true }, streaming: { type: "boolean" }, sendLDHeaders: { default: true }, requestHeaderTransform: { type: "function" }, sendEventsOnlyForVariation: { default: false }, useReport: { default: false }, evaluationReasons: { default: false }, eventCapacity: { default: 100, minimum: 1 }, flushInterval: { default: 2e3, minimum: 2e3 }, samplingInterval: { default: 0, minimum: 0 }, streamReconnectDelay: { default: 1e3, minimum: 0 }, allAttributesPrivate: { default: false }, privateAttributes: { default: [] }, bootstrap: { type: "string|object" }, diagnosticRecordingInterval: { default: 9e5, minimum: 2e3 }, diagnosticOptOut: { default: false }, wrapperName: { type: "string" }, wrapperVersion: { type: "string" }, stateProvider: { type: "object" }, application: { validator: function(e4, t2, n2) {
  const r2 = {};
  t2.id && (r2.id = de(`${e4}.id`, t2.id, n2));
  t2.version && (r2.version = de(`${e4}.version`, t2.version, n2));
  return r2;
} }, inspectors: { default: [] }, hooks: { default: [] }, plugins: { default: [] } };
var ue = /^(\w|\.|-)+$/;
function le(e4) {
  return e4 && e4.replace(/\/+$/, "");
}
function de(e4, t2, n2) {
  if ("string" == typeof t2 && t2.match(ue)) {
    if (!(t2.length > 64)) return t2;
    n2.warn(ae.tagValueTooLong(e4));
  } else n2.warn(ae.invalidTagValue(e4));
}
var fe = { baseOptionDefs: ce, validate: function(e4, t2, n2, r2) {
  const o2 = S.extend({ logger: { default: r2 } }, ce, n2), i2 = {};
  function a2(e5) {
    S.onNextTick(() => {
      t2 && t2.maybeReportError(new s.LDInvalidArgumentError(e5));
    });
  }
  let c = S.extend({}, e4 || {});
  return (function(e5) {
    const t3 = e5;
    Object.keys(i2).forEach((e6) => {
      if (void 0 !== t3[e6]) {
        const n3 = i2[e6];
        r2 && r2.warn(ae.deprecated(e6, n3)), n3 && (void 0 === t3[n3] && (t3[n3] = t3[e6]), delete t3[e6]);
      }
    });
  })(c), c = (function(e5) {
    const t3 = S.extend({}, e5);
    return Object.keys(o2).forEach((e6) => {
      void 0 !== t3[e6] && null !== t3[e6] || (t3[e6] = o2[e6] && o2[e6].default);
    }), t3;
  })(c), c = (function(e5) {
    const t3 = S.extend({}, e5), n3 = (e6) => {
      if (null === e6) return "any";
      if (void 0 === e6) return;
      if (Array.isArray(e6)) return "array";
      const t4 = typeof e6;
      return "boolean" === t4 || "string" === t4 || "number" === t4 || "function" === t4 ? t4 : "object";
    };
    return Object.keys(e5).forEach((i3) => {
      const s = e5[i3];
      if (null != s) {
        const c2 = o2[i3];
        if (void 0 === c2) a2(ae.unknownOption(i3));
        else {
          const o3 = c2.type || n3(c2.default), u = c2.validator;
          if (u) {
            const n4 = u(i3, e5[i3], r2);
            void 0 !== n4 ? t3[i3] = n4 : delete t3[i3];
          } else if ("any" !== o3) {
            const e6 = o3.split("|"), r3 = n3(s);
            e6.indexOf(r3) < 0 ? "boolean" === o3 ? (t3[i3] = !!s, a2(ae.wrongOptionTypeBoolean(i3, r3))) : (a2(ae.wrongOptionType(i3, o3, r3)), t3[i3] = c2.default) : "number" === r3 && void 0 !== c2.minimum && s < c2.minimum && (a2(ae.optionBelowMinimum(i3, s, c2.minimum)), t3[i3] = c2.minimum);
          }
        }
      }
    }), t3.baseUrl = le(t3.baseUrl), t3.streamUrl = le(t3.streamUrl), t3.eventsUrl = le(t3.eventsUrl), t3;
  })(c), se(c.logger), c;
}, getTags: function(e4) {
  const t2 = {};
  return e4 && (e4.application && void 0 !== e4.application.id && null !== e4.application.id && (t2["application-id"] = [e4.application.id]), e4.application && void 0 !== e4.application.version && null !== e4.application.id && (t2["application-version"] = [e4.application.version])), t2;
} };
var { getLDUserAgentString: ge } = S;
var ve = { getLDHeaders: function(e4, t2) {
  if (t2 && !t2.sendLDHeaders) return {};
  const n2 = {};
  n2[e4.userAgentHeaderName || "User-Agent"] = ge(e4), t2 && t2.wrapperName && (n2["X-LaunchDarkly-Wrapper"] = t2.wrapperVersion ? t2.wrapperName + "/" + t2.wrapperVersion : t2.wrapperName);
  const r2 = fe.getTags(t2), o2 = Object.keys(r2);
  return o2.length && (n2["x-launchdarkly-tags"] = o2.sort().map((e5) => Array.isArray(r2[e5]) ? r2[e5].sort().map((t3) => `${e5}/${t3}`) : [`${e5}/${r2[e5]}`]).reduce((e5, t3) => e5.concat(t3), []).join(" ")), n2;
}, transformHeaders: function(e4, t2) {
  return t2 && t2.requestHeaderTransform ? t2.requestHeaderTransform({ ...e4 }) : e4;
} };
var { v1: pe } = te;
var { getLDHeaders: me, transformHeaders: he } = ve;
var ye = function(e4, t2, n2) {
  const r2 = S.extend({ "Content-Type": "application/json" }, me(e4, n2)), o2 = {};
  return o2.sendEvents = (t3, o3, i2) => {
    if (!e4.httpRequest) return Promise.resolve();
    const a2 = JSON.stringify(t3), c = i2 ? null : pe();
    return (function t4(u) {
      const l = i2 ? r2 : S.extend({}, r2, { "X-LaunchDarkly-Event-Schema": "4", "X-LaunchDarkly-Payload-ID": c });
      return e4.httpRequest("POST", o3, he(l, n2), a2).promise.then((e5) => {
        if (e5) return e5.status >= 400 && s.isHttpErrorRecoverable(e5.status) && u ? t4(false) : (function(e6) {
          const t5 = { status: e6.status }, n3 = e6.header("date");
          if (n3) {
            const e7 = Date.parse(n3);
            e7 && (t5.serverTime = e7);
          }
          return t5;
        })(e5);
      }).catch(() => u ? t4(false) : Promise.reject());
    })(true).catch(() => {
    });
  }, o2;
};
var we = function e3(t2, n2 = []) {
  if (null === t2 || "object" != typeof t2) return JSON.stringify(t2);
  if (n2.includes(t2)) throw new Error("Cycle detected");
  if (Array.isArray(t2)) {
    return `[${t2.map((r2) => e3(r2, [...n2, t2])).map((e4) => void 0 === e4 ? "null" : e4).join(",")}]`;
  }
  return `{${Object.keys(t2).sort().map((r2) => {
    const o2 = e3(t2[r2], [...n2, t2]);
    if (void 0 !== o2) return `${JSON.stringify(r2)}:${o2}`;
  }).filter((e4) => void 0 !== e4).join(",")}}`;
};
var { commonBasicLogger: be } = re;
function ke(e4) {
  return "string" == typeof e4 && "kind" !== e4 && e4.match(/^(\w|\.|-)+$/);
}
function Ee(e4) {
  return e4.includes("%") || e4.includes(":") ? e4.replace(/%/g, "%25").replace(/:/g, "%3A") : e4;
}
var De = { checkContext: function(e4, t2) {
  if (e4) {
    if (t2 && (void 0 === e4.kind || null === e4.kind)) return void 0 !== e4.key && null !== e4.key;
    const n2 = e4.key, r2 = void 0 === e4.kind ? "user" : e4.kind, o2 = ke(r2), i2 = "multi" === r2 || null != n2 && "" !== n2;
    if ("multi" === r2) {
      const t3 = Object.keys(e4).filter((e5) => "kind" !== e5);
      return i2 && t3.every((e5) => ke(e5)) && t3.every((t4) => {
        const n3 = e4[t4].key;
        return null != n3 && "" !== n3;
      });
    }
    return i2 && o2;
  }
  return false;
}, getContextKeys: function(e4, t2 = be()) {
  if (!e4) return;
  const n2 = {}, { kind: r2, key: o2 } = e4;
  switch (r2) {
    case void 0:
      n2.user = `${o2}`;
      break;
    case "multi":
      Object.entries(e4).filter(([e5]) => "kind" !== e5).forEach(([e5, t3]) => {
        t3 && t3.key && (n2[e5] = t3.key);
      });
      break;
    case null:
      t2.warn(`null is not a valid context kind: ${e4}`);
      break;
    case "":
      t2.warn(`'' is not a valid context kind: ${e4}`);
      break;
    default:
      n2[r2] = `${o2}`;
  }
  return n2;
}, getContextKinds: function(e4) {
  return e4 ? null === e4.kind || void 0 === e4.kind ? ["user"] : "multi" !== e4.kind ? [e4.kind] : Object.keys(e4).filter((e5) => "kind" !== e5) : [];
}, getCanonicalKey: function(e4) {
  if (e4) {
    if ((void 0 === e4.kind || null === e4.kind || "user" === e4.kind) && e4.key) return e4.key;
    if ("multi" !== e4.kind && e4.key) return `${e4.kind}:${Ee(e4.key)}`;
    if ("multi" === e4.kind) return Object.keys(e4).sort().filter((e5) => "kind" !== e5).map((t2) => `${t2}:${Ee(e4[t2].key)}`).join(":");
  }
} };
var { getContextKinds: xe } = De;
var Oe = function() {
  const e4 = {};
  let t2 = 0, n2 = 0, r2 = {}, o2 = {};
  return e4.summarizeEvent = (e5) => {
    if ("feature" === e5.kind) {
      const i2 = e5.key + ":" + (null !== e5.variation && void 0 !== e5.variation ? e5.variation : "") + ":" + (null !== e5.version && void 0 !== e5.version ? e5.version : ""), a2 = r2[i2];
      let s = o2[e5.key];
      s || (s = /* @__PURE__ */ new Set(), o2[e5.key] = s), (function(e6) {
        return e6.context ? xe(e6.context) : e6.contextKeys ? Object.keys(e6.contextKeys) : [];
      })(e5).forEach((e6) => s.add(e6)), a2 ? a2.count = a2.count + 1 : r2[i2] = { count: 1, key: e5.key, version: e5.version, variation: e5.variation, value: e5.value, default: e5.default }, (0 === t2 || e5.creationDate < t2) && (t2 = e5.creationDate), e5.creationDate > n2 && (n2 = e5.creationDate);
    }
  }, e4.getSummary = () => {
    const e5 = {};
    let i2 = true;
    for (const t3 of Object.values(r2)) {
      let n3 = e5[t3.key];
      n3 || (n3 = { default: t3.default, counters: [], contextKinds: [...o2[t3.key]] }, e5[t3.key] = n3);
      const r3 = { value: t3.value, count: t3.count };
      void 0 !== t3.variation && null !== t3.variation && (r3.variation = t3.variation), void 0 !== t3.version && null !== t3.version ? r3.version = t3.version : r3.unknown = true, n3.counters.push(r3), i2 = false;
    }
    return i2 ? null : { startDate: t2, endDate: n2, features: e5, kind: "summary" };
  }, e4.clearSummary = () => {
    t2 = 0, n2 = 0, r2 = {}, o2 = {};
  }, e4;
};
var Ce = function(e4) {
  let t2 = {}, n2 = {};
  return { summarizeEvent: function(e5) {
    if ("feature" === e5.kind) {
      const r2 = we(e5.context);
      if (!r2) return;
      let o2 = t2[r2];
      o2 || (t2[r2] = Oe(), o2 = t2[r2], n2[r2] = e5.context), o2.summarizeEvent(e5);
    }
  }, getSummaries: function() {
    const r2 = t2, o2 = n2;
    return t2 = {}, n2 = {}, Object.entries(r2).map(([t3, n3]) => {
      const r3 = n3.getSummary();
      return r3.context = e4.filter(o2[t3]), r3;
    });
  } };
};
function Pe(e4) {
  return e4.replace(/~/g, "~0").replace(/\//g, "~1");
}
function Se(e4) {
  return (e4.startsWith("/") ? e4.substring(1) : e4).split("/").map((e5) => e5.indexOf("~") >= 0 ? e5.replace(/~1/g, "/").replace(/~0/g, "~") : e5);
}
function Ie(e4) {
  return !e4.startsWith("/");
}
function Te(e4, t2) {
  const n2 = Ie(e4), r2 = Ie(t2);
  if (n2 && r2) return e4 === t2;
  if (n2) {
    const n3 = Se(t2);
    return 1 === n3.length && e4 === n3[0];
  }
  if (r2) {
    const n3 = Se(e4);
    return 1 === n3.length && t2 === n3[0];
  }
  return e4 === t2;
}
function Fe(e4) {
  return `/${Pe(e4)}`;
}
var Le = { cloneExcluding: function(e4, t2) {
  const n2 = [], r2 = {}, o2 = [];
  for (n2.push(...Object.keys(e4).map((t3) => ({ key: t3, ptr: Fe(t3), source: e4, parent: r2, visited: [e4] }))); n2.length; ) {
    const e5 = n2.pop();
    if (t2.some((t3) => Te(t3, e5.ptr))) o2.push(e5.ptr);
    else {
      const t3 = e5.source[e5.key];
      if (null === t3) e5.parent[e5.key] = t3;
      else if (Array.isArray(t3)) e5.parent[e5.key] = [...t3];
      else if ("object" == typeof t3) {
        if (e5.visited.includes(t3)) continue;
        e5.parent[e5.key] = {}, n2.push(...Object.keys(t3).map((n3) => {
          return { key: n3, ptr: (r3 = e5.ptr, o3 = Pe(n3), `${r3}/${o3}`), source: t3, parent: e5.parent[e5.key], visited: [...e5.visited, t3] };
          var r3, o3;
        }));
      } else e5.parent[e5.key] = t3;
    }
  }
  return { cloned: r2, excluded: o2.sort() };
}, compare: Te, literalToReference: Fe };
var Ue = function(e4) {
  const t2 = {}, n2 = e4.allAttributesPrivate, r2 = e4.privateAttributes || [], o2 = ["key", "kind", "_meta", "anonymous"], i2 = ["name", "ip", "firstName", "lastName", "email", "avatar", "country"], a2 = (e5, t3) => {
    if ("object" != typeof e5 || null === e5 || Array.isArray(e5)) return;
    const { cloned: i3, excluded: a3 } = Le.cloneExcluding(e5, ((e6, t4) => (n2 || t4 && e6.anonymous ? Object.keys(e6) : [...r2, ...e6._meta && e6._meta.privateAttributes || []]).filter((e7) => !o2.some((t5) => Le.compare(e7, t5))))(e5, t3));
    return i3.key = String(i3.key), a3.length && (i3._meta || (i3._meta = {}), i3._meta.redactedAttributes = a3), i3._meta && (delete i3._meta.privateAttributes, 0 === Object.keys(i3._meta).length && delete i3._meta), void 0 !== i3.anonymous && (i3.anonymous = !!i3.anonymous), i3;
  };
  return t2.filter = (e5, t3 = false) => void 0 === e5.kind || null === e5.kind ? a2(((e6) => {
    const t4 = { ...e6.custom || {}, kind: "user", key: e6.key };
    void 0 !== e6.anonymous && (t4.anonymous = !!e6.anonymous);
    for (const n3 of i2) delete t4[n3], void 0 !== e6[n3] && null !== e6[n3] && (t4[n3] = String(e6[n3]));
    return void 0 !== e6.privateAttributeNames && null !== e6.privateAttributeNames && (t4._meta = t4._meta || {}, t4._meta.privateAttributes = e6.privateAttributeNames.map((e7) => e7.startsWith("/") ? Le.literalToReference(e7) : e7)), t4;
  })(e5), t3) : "multi" === e5.kind ? ((e6, t4) => {
    const n3 = { kind: e6.kind }, r3 = Object.keys(e6);
    for (const o3 of r3) if ("kind" !== o3) {
      const r4 = a2(e6[o3], t4);
      r4 && (n3[o3] = r4);
    }
    return n3;
  })(e5, t3) : a2(e5, t3), t2;
};
var { getContextKeys: Ae } = De;
var je = function(e4, t2, n2, r2 = null, o2 = null, i2 = null) {
  const a2 = {}, c = i2 || ye(e4, n2, t2), u = S.appendUrlPath(t2.eventsUrl, "/events/bulk/" + n2), l = Ue(t2), d = Ce(l), f = t2.samplingInterval, g = t2.eventCapacity, v = t2.flushInterval, p = t2.logger;
  let m2, h2 = [], y2 = 0, w2 = false, b2 = false;
  function k2() {
    return 0 === f || 0 === Math.floor(Math.random() * f);
  }
  function E2(e5) {
    const t3 = S.extend({}, e5);
    return "identify" === e5.kind || "feature" === e5.kind || "custom" === e5.kind ? t3.context = l.filter(e5.context) : (t3.contextKeys = Ae(e5.context, p), delete t3.context), "feature" === e5.kind && (delete t3.trackEvents, delete t3.debugEventsUntilDate), t3;
  }
  function D2(e5) {
    h2.length < g ? (h2.push(e5), b2 = false) : (b2 || (b2 = true, p.warn(ae.eventCapacityExceeded())), r2 && r2.incrementDroppedEvents());
  }
  return a2.enqueue = function(e5) {
    if (w2) return;
    let t3 = false, n3 = false;
    var r3;
    if (d.summarizeEvent(e5), "feature" === e5.kind ? k2() && (t3 = !!e5.trackEvents, n3 = !!(r3 = e5).debugEventsUntilDate && r3.debugEventsUntilDate > y2 && r3.debugEventsUntilDate > (/* @__PURE__ */ new Date()).getTime()) : t3 = k2(), t3 && D2(E2(e5)), n3) {
      const t4 = S.extend({}, e5, { kind: "debug" });
      t4.context = l.filter(t4.context), delete t4.trackEvents, delete t4.debugEventsUntilDate, D2(t4);
    }
  }, a2.flush = async function() {
    if (w2) return Promise.resolve();
    const e5 = h2;
    return d.getSummaries().forEach((t3) => {
      Object.keys(t3.features).length && e5.push(t3);
    }), r2 && r2.setEventsInLastBatch(e5.length), 0 === e5.length ? Promise.resolve() : (h2 = [], p.debug(ae.debugPostingEvents(e5.length)), c.sendEvents(e5, u).then((e6) => {
      e6 && (e6.serverTime && (y2 = e6.serverTime), s.isHttpErrorRecoverable(e6.status) || (w2 = true), e6.status >= 400 && S.onNextTick(() => {
        o2.maybeReportError(new s.LDUnexpectedResponseError(ae.httpErrorMessage(e6.status, "event posting", "some events were dropped")));
      }));
    }));
  }, a2.start = function() {
    const e5 = () => {
      a2.flush(), m2 = setTimeout(e5, v);
    };
    m2 = setTimeout(e5, v);
  }, a2.stop = function() {
    clearTimeout(m2);
  }, a2;
};
var Re = function(e4) {
  const t2 = {}, n2 = {};
  return t2.on = function(e5, t3, r2) {
    n2[e5] = n2[e5] || [], n2[e5] = n2[e5].concat({ handler: t3, context: r2 });
  }, t2.off = function(e5, t3, r2) {
    if (n2[e5]) for (let o2 = 0; o2 < n2[e5].length; o2++) n2[e5][o2].handler === t3 && n2[e5][o2].context === r2 && (n2[e5] = n2[e5].slice(0, o2).concat(n2[e5].slice(o2 + 1)));
  }, t2.emit = function(e5) {
    if (!n2[e5]) return;
    const t3 = n2[e5].slice(0);
    for (let e6 = 0; e6 < t3.length; e6++) t3[e6].handler.apply(t3[e6].context, Array.prototype.slice.call(arguments, 1));
  }, t2.getEvents = function() {
    return Object.keys(n2);
  }, t2.getEventListenerCount = function(e5) {
    return n2[e5] ? n2[e5].length : 0;
  }, t2.maybeReportError = function(t3) {
    t3 && (n2["error"] ? this.emit("error", t3) : (e4 || console).error(t3.message));
  }, t2;
};
var Ne = "ready";
var $e = "initialized";
var Ve = "failed";
var He = function(e4) {
  let t2 = false, n2 = false, r2 = null, o2 = null;
  const i2 = new Promise((t3) => {
    const n3 = () => {
      e4.off(Ne, n3), t3();
    };
    e4.on(Ne, n3);
  }).catch(() => {
  });
  return { getInitializationPromise: () => o2 || (t2 ? Promise.resolve() : n2 ? Promise.reject(r2) : (o2 = new Promise((t3, n3) => {
    const r3 = () => {
      e4.off($e, r3), t3();
    }, o3 = (t4) => {
      e4.off(Ve, o3), n3(t4);
    };
    e4.on($e, r3), e4.on(Ve, o3);
  }), o2)), getReadyPromise: () => i2, signalSuccess: () => {
    t2 || n2 || (t2 = true, e4.emit($e), e4.emit(Ne));
  }, signalFailure: (o3) => {
    t2 || n2 || (n2 = true, r2 = o3, e4.emit(Ve, o3), e4.emit(Ne)), e4.maybeReportError(o3);
  } };
};
var Me = function(e4, t2, n2, r2) {
  const o2 = {};
  function i2() {
    let e5 = "";
    const o3 = r2.getContext();
    return o3 && (e5 = n2 || S.btoa(JSON.stringify(o3))), "ld:" + t2 + ":" + e5;
  }
  return o2.loadFlags = () => e4.get(i2()).then((e5) => {
    if (null == e5) return null;
    try {
      let t3 = JSON.parse(e5);
      if (t3) {
        const e6 = t3.$schema;
        void 0 === e6 || e6 < 1 ? t3 = S.transformValuesToVersionedValues(t3) : delete t3.$schema;
      }
      return t3;
    } catch (e6) {
      return o2.clearFlags().then(() => null);
    }
  }), o2.saveFlags = (t3) => {
    const n3 = S.extend({}, t3, { $schema: 1 });
    return e4.set(i2(), JSON.stringify(n3));
  }, o2.clearFlags = () => e4.clear(i2()), o2;
};
var qe = function(e4, t2) {
  const n2 = {};
  let r2 = false;
  const o2 = (e5) => {
    r2 || (r2 = true, t2.warn(ae.localStorageUnavailable(e5)));
  };
  return n2.isEnabled = () => !!e4, n2.get = (t3) => new Promise((n3) => {
    e4 ? e4.get(t3).then(n3).catch((e5) => {
      o2(e5), n3(void 0);
    }) : n3(void 0);
  }), n2.set = (t3, n3) => new Promise((r3) => {
    e4 ? e4.set(t3, n3).then(() => r3(true)).catch((e5) => {
      o2(e5), r3(false);
    }) : r3(false);
  }), n2.clear = (t3) => new Promise((n3) => {
    e4 ? e4.clear(t3).then(() => n3(true)).catch((e5) => {
      o2(e5), n3(false);
    }) : n3(false);
  }), n2;
};
var { appendUrlPath: ze, base64URLEncode: Ke, objectHasOwnProperty: _e } = S;
var { getLDHeaders: Je, transformHeaders: Be } = ve;
var { isHttpErrorRecoverable: We } = s;
var Ge = function(e4, t2, n2, r2) {
  const o2 = t2.streamUrl, i2 = t2.logger, a2 = {}, s = ze(o2, "/eval/" + n2), c = t2.useReport, u = t2.evaluationReasons, l = t2.streamReconnectDelay, d = Je(e4, t2);
  let f, g = false, v = null, p = null, m2 = null, h2 = null, y2 = null, w2 = 0;
  function b2() {
    const e5 = (t3 = (function() {
      const e6 = l * Math.pow(2, w2);
      return e6 > 3e4 ? 3e4 : e6;
    })(), t3 - Math.trunc(0.5 * Math.random() * t3));
    var t3;
    return w2 += 1, e5;
  }
  function k2(e5) {
    if (e5.status && "number" == typeof e5.status && !We(e5.status)) return x2(), i2.error(ae.unrecoverableStreamError(e5)), void (p && (clearTimeout(p), p = null));
    const t3 = b2();
    g || (i2.warn(ae.streamError(e5, t3)), g = true), O2(false), x2(), E2(t3);
  }
  function E2(e5) {
    p || (e5 ? p = setTimeout(D2, e5) : D2());
  }
  function D2() {
    let r3;
    p = null;
    let a3 = "";
    const l2 = { headers: d, readTimeoutMillis: 3e5 };
    if (e4.eventSourceFactory) {
      null != h2 && (a3 = "h=" + h2), c ? e4.eventSourceAllowsReport ? (r3 = s, l2.method = "REPORT", l2.headers["Content-Type"] = "application/json", l2.body = JSON.stringify(m2)) : (r3 = ze(o2, "/ping/" + n2), a3 = "") : r3 = s + "/" + Ke(JSON.stringify(m2)), l2.headers = Be(l2.headers, t2), u && (a3 = a3 + (a3 ? "&" : "") + "withReasons=true"), r3 = r3 + (a3 ? "?" : "") + a3, x2(), i2.info(ae.streamConnecting(r3)), f = (/* @__PURE__ */ new Date()).getTime(), v = e4.eventSourceFactory(r3, l2);
      for (const e5 in y2) _e(y2, e5) && v.addEventListener(e5, y2[e5]);
      v.onerror = k2, v.onopen = () => {
        w2 = 0;
      };
    }
  }
  function x2() {
    v && (i2.info(ae.streamClosing()), v.close(), v = null);
  }
  function O2(e5) {
    f && r2 && r2.recordStreamInit(f, !e5, (/* @__PURE__ */ new Date()).getTime() - f), f = null;
  }
  return a2.connect = function(e5, t3, n3) {
    m2 = e5, h2 = t3, y2 = {};
    for (const e6 in n3 || {}) y2[e6] = function(t4) {
      g = false, O2(true), n3[e6] && n3[e6](t4);
    };
    E2();
  }, a2.disconnect = function() {
    clearTimeout(p), p = null, x2();
  }, a2.isConnected = function() {
    return !!(v && e4.eventSourceIsActive && e4.eventSourceIsActive(v));
  }, a2;
};
var Xe = function(e4) {
  let t2, n2, r2, o2;
  const i2 = { addPromise: (i3, a2) => {
    t2 = i3, n2 && n2(), n2 = a2, i3.then((n3) => {
      t2 === i3 && (r2(n3), e4 && e4());
    }, (n3) => {
      t2 === i3 && (o2(n3), e4 && e4());
    });
  } };
  return i2.resultPromise = new Promise((e5, t3) => {
    r2 = e5, o2 = t3;
  }), i2;
};
var { transformHeaders: Qe, getLDHeaders: Ye } = ve;
var Ze = "application/json";
var et = function(e4, t2, n2) {
  const r2 = t2.baseUrl, o2 = t2.useReport, i2 = t2.evaluationReasons, a2 = t2.logger, c = {}, u = {};
  function l(n3, r3) {
    if (!e4.httpRequest) return new Promise((e5, t3) => {
      t3(new s.LDFlagFetchError(ae.httpUnavailable()));
    });
    const o3 = r3 ? "REPORT" : "GET", i3 = Ye(e4, t2);
    r3 && (i3["Content-Type"] = Ze);
    let a3 = u[n3];
    a3 || (a3 = Xe(() => {
      delete u[n3];
    }), u[n3] = a3);
    const c2 = e4.httpRequest(o3, n3, Qe(i3, t2), r3), l2 = c2.promise.then((e5) => {
      if (200 === e5.status) {
        if (e5.header("content-type") && e5.header("content-type").substring(0, 16) === Ze) return JSON.parse(e5.body);
        {
          const t3 = ae.invalidContentType(e5.header("content-type") || "");
          return Promise.reject(new s.LDFlagFetchError(t3));
        }
      }
      return Promise.reject((function(e6) {
        return 404 === e6.status ? new s.LDInvalidEnvironmentIdError(ae.environmentNotFound()) : new s.LDFlagFetchError(ae.errorFetchingFlags(e6.statusText || String(e6.status)));
      })(e5));
    }, (e5) => Promise.reject(new s.LDFlagFetchError(ae.networkError(e5))));
    return a3.addPromise(l2, () => {
      c2.cancel && c2.cancel();
    }), a3.resultPromise;
  }
  return c.fetchJSON = function(e5) {
    return l(S.appendUrlPath(r2, e5), null);
  }, c.fetchFlagSettings = function(e5, t3) {
    let s, c2, u2, d = "";
    return o2 ? (c2 = [r2, "/sdk/evalx/", n2, "/context"].join(""), u2 = JSON.stringify(e5)) : (s = S.base64URLEncode(JSON.stringify(e5)), c2 = [r2, "/sdk/evalx/", n2, "/contexts/", s].join("")), t3 && (d = "h=" + t3), i2 && (d = d + (d ? "&" : "") + "withReasons=true"), c2 = c2 + (d ? "?" : "") + d, a2.debug(ae.debugPolling(c2)), l(c2, u2);
  }, c;
};
var tt = function(e4, t2) {
  const n2 = {};
  let r2;
  return n2.setContext = function(e5) {
    r2 = S.sanitizeContext(e5), r2 && t2 && t2(S.clone(r2));
  }, n2.getContext = function() {
    return r2 ? S.clone(r2) : null;
  }, e4 && n2.setContext(e4), n2;
};
var { v1: nt } = te;
var { getContextKinds: rt } = De;
var ot = function(e4) {
  function t2(e5) {
    return null == e5 || "user" === e5 ? "ld:$anonUserId" : `ld:$contextKey:${e5}`;
  }
  function n2(n3, r2) {
    return null !== r2.key && void 0 !== r2.key ? (r2.key = r2.key.toString(), Promise.resolve(r2)) : r2.anonymous ? (function(n4) {
      return e4.get(t2(n4));
    })(n3).then((o2) => {
      if (o2) return r2.key = o2, r2;
      {
        const o3 = nt();
        return r2.key = o3, (function(n4, r3) {
          return e4.set(t2(r3), n4);
        })(o3, n3).then(() => r2);
      }
    }) : Promise.reject(new s.LDInvalidUserError(ae.invalidContext()));
  }
  this.processContext = (e5) => {
    if (!e5) return Promise.reject(new s.LDInvalidUserError(ae.contextNotSpecified()));
    const t3 = S.clone(e5);
    if ("multi" === e5.kind) {
      const e6 = rt(t3);
      return Promise.all(e6.map((e7) => n2(e7, t3[e7]))).then(() => t3);
    }
    return n2(e5.kind, t3);
  };
};
var { v1: it } = te;
var { baseOptionDefs: at } = fe;
var { appendUrlPath: st } = S;
var ct = { DiagnosticId: function(e4) {
  const t2 = { diagnosticId: it() };
  return e4 && (t2.sdkKeySuffix = e4.length > 6 ? e4.substring(e4.length - 6) : e4), t2;
}, DiagnosticsAccumulator: function(e4) {
  let t2, n2, r2, o2;
  function i2(e5) {
    t2 = e5, n2 = 0, r2 = 0, o2 = [];
  }
  return i2(e4), { getProps: () => ({ dataSinceDate: t2, droppedEvents: n2, eventsInLastBatch: r2, streamInits: o2 }), setProps: (e5) => {
    t2 = e5.dataSinceDate, n2 = e5.droppedEvents || 0, r2 = e5.eventsInLastBatch || 0, o2 = e5.streamInits || [];
  }, incrementDroppedEvents: () => {
    n2++;
  }, setEventsInLastBatch: (e5) => {
    r2 = e5;
  }, recordStreamInit: (e5, t3, n3) => {
    const r3 = { timestamp: e5, failed: t3, durationMillis: n3 };
    o2.push(r3);
  }, reset: i2 };
}, DiagnosticsManager: function(e4, t2, n2, r2, o2, i2, a2) {
  const s = !!e4.diagnosticUseCombinedEvent, c = "ld:" + o2 + ":$diagnostics", u = st(i2.eventsUrl, "/events/diagnostic/" + o2), l = i2.diagnosticRecordingInterval, d = n2;
  let f, g, v = !!i2.streaming;
  const p = {};
  function m2() {
    return { sdk: w2(), configuration: b2(), platform: e4.diagnosticPlatformData };
  }
  function h2(e5) {
    i2.logger && i2.logger.debug(ae.debugPostingDiagnosticEvent(e5)), r2.sendEvents(e5, u, true).then(() => {
    }).catch(() => {
    });
  }
  function y2() {
    h2((function() {
      const e5 = (/* @__PURE__ */ new Date()).getTime();
      let t3 = { kind: s ? "diagnostic-combined" : "diagnostic", id: a2, creationDate: e5, ...d.getProps() };
      return s && (t3 = { ...t3, ...m2() }), d.reset(e5), t3;
    })()), g = setTimeout(y2, l), f = (/* @__PURE__ */ new Date()).getTime(), s && (function() {
      if (t2.isEnabled()) {
        const e5 = { ...d.getProps() };
        t2.set(c, JSON.stringify(e5));
      }
    })();
  }
  function w2() {
    const t3 = { ...e4.diagnosticSdkData };
    return i2.wrapperName && (t3.wrapperName = i2.wrapperName), i2.wrapperVersion && (t3.wrapperVersion = i2.wrapperVersion), t3;
  }
  function b2() {
    return { customBaseURI: i2.baseUrl !== at.baseUrl.default, customStreamURI: i2.streamUrl !== at.streamUrl.default, customEventsURI: i2.eventsUrl !== at.eventsUrl.default, eventsCapacity: i2.eventCapacity, eventsFlushIntervalMillis: i2.flushInterval, reconnectTimeMillis: i2.streamReconnectDelay, streamingDisabled: !v, allAttributesPrivate: !!i2.allAttributesPrivate, diagnosticRecordingIntervalMillis: i2.diagnosticRecordingInterval, usingSecureMode: !!i2.hash, bootstrapMode: !!i2.bootstrap, fetchGoalsDisabled: !i2.fetchGoals, sendEventsOnlyForVariation: !!i2.sendEventsOnlyForVariation };
  }
  return p.start = () => {
    s ? (function(e5) {
      if (!t2.isEnabled()) return e5(false);
      t2.get(c).then((t3) => {
        if (t3) try {
          const e6 = JSON.parse(t3);
          d.setProps(e6), f = e6.dataSinceDate;
        } catch (e6) {
        }
        e5(true);
      }).catch(() => {
        e5(false);
      });
    })((e5) => {
      if (e5) {
        const e6 = (f || 0) + l, t3 = (/* @__PURE__ */ new Date()).getTime();
        t3 >= e6 ? y2() : g = setTimeout(y2, e6 - t3);
      } else 0 === Math.floor(4 * Math.random()) ? y2() : g = setTimeout(y2, l);
    }) : (h2({ kind: "diagnostic-init", id: a2, creationDate: d.getProps().dataSinceDate, ...m2() }), g = setTimeout(y2, l));
  }, p.stop = () => {
    g && clearTimeout(g);
  }, p.setStreaming = (e5) => {
    v = e5;
  }, p;
} };
var ut = function(e4, t2) {
  let n2 = false;
  const r2 = { type: e4.type, name: e4.name, synchronous: e4.synchronous, method: (...o2) => {
    try {
      e4.method(...o2);
    } catch {
      n2 || (n2 = true, t2.warn(ae.inspectorMethodError(r2.type, r2.name)));
    }
  } };
  return r2;
};
var { onNextTick: lt } = S;
var dt = { flagUsed: "flag-used", flagDetailsChanged: "flag-details-changed", flagDetailChanged: "flag-detail-changed", clientIdentityChanged: "client-identity-changed" };
Object.freeze(dt);
var ft = { InspectorTypes: dt, InspectorManager: function(e4, t2) {
  const n2 = {}, r2 = { [dt.flagUsed]: [], [dt.flagDetailsChanged]: [], [dt.flagDetailChanged]: [], [dt.clientIdentityChanged]: [] }, o2 = { [dt.flagUsed]: [], [dt.flagDetailsChanged]: [], [dt.flagDetailChanged]: [], [dt.clientIdentityChanged]: [] }, i2 = e4 && e4.map((e5) => ut(e5, t2));
  return i2 && i2.forEach((e5) => {
    Object.prototype.hasOwnProperty.call(r2, e5.type) && !e5.synchronous ? r2[e5.type].push(e5) : Object.prototype.hasOwnProperty.call(o2, e5.type) && e5.synchronous ? o2[e5.type].push(e5) : t2.warn(ae.invalidInspector(e5.type, e5.name));
  }), n2.hasListeners = (e5) => r2[e5] && r2[e5].length || o2[e5] && o2[e5].length, n2.onFlagUsed = (e5, t3, n3) => {
    const i3 = dt.flagUsed;
    o2[i3].length && o2[i3].forEach((r3) => r3.method(e5, t3, n3)), r2[i3].length && lt(() => {
      r2[i3].forEach((r3) => r3.method(e5, t3, n3));
    });
  }, n2.onFlags = (e5) => {
    const t3 = dt.flagDetailsChanged;
    o2[t3].length && o2[t3].forEach((t4) => t4.method(e5)), r2[t3].length && lt(() => {
      r2[t3].forEach((t4) => t4.method(e5));
    });
  }, n2.onFlagChanged = (e5, t3) => {
    const n3 = dt.flagDetailChanged;
    o2[n3].length && o2[n3].forEach((n4) => n4.method(e5, t3)), r2[n3].length && lt(() => {
      r2[n3].forEach((n4) => n4.method(e5, t3));
    });
  }, n2.onIdentityChanged = (e5) => {
    const t3 = dt.clientIdentityChanged;
    o2[t3].length && o2[t3].forEach((t4) => t4.method(e5)), r2[t3].length && lt(() => {
      r2[t3].forEach((t4) => t4.method(e5));
    });
  }, n2;
} };
var { LDTimeoutError: gt } = s;
var vt = function(e4, t2) {
  return new Promise((n2, r2) => {
    setTimeout(() => {
      r2(new gt(`${t2} timed out after ${e4} seconds.`));
    }, 1e3 * e4);
  });
};
var pt = "unknown hook";
function mt(e4, t2, n2, r2, o2) {
  try {
    return r2();
  } catch (r3) {
    return e4?.error(`An error was encountered in "${t2}" of the "${n2}" hook: ${r3}`), o2;
  }
}
function ht(e4, t2) {
  try {
    return t2.getMetadata().name || pt;
  } catch {
    return e4.error("Exception thrown getting metadata for hook. Unable to get hook name."), pt;
  }
}
var yt = function(e4, t2) {
  const n2 = t2 ? [...t2] : [];
  return { withEvaluation: function(t3, r2, o2, i2) {
    if (0 === n2.length) return i2();
    const a2 = [...n2], s = { flagKey: t3, context: r2, defaultValue: o2 }, c = (function(e5, t4, n3) {
      return t4.map((t5) => mt(e5, "beforeEvaluation", ht(e5, t5), () => t5?.beforeEvaluation?.(n3, {}) ?? {}, {}));
    })(e4, a2, s), u = i2();
    return (function(e5, t4, n3, r3, o3) {
      for (let i3 = t4.length - 1; i3 >= 0; i3 -= 1) {
        const a3 = t4[i3], s2 = r3[i3];
        mt(e5, "afterEvaluation", ht(e5, a3), () => a3?.afterEvaluation?.(n3, s2, o3) ?? {}, {});
      }
    })(e4, a2, s, c, u), u;
  }, identify: function(t3, r2) {
    const o2 = [...n2], i2 = { context: t3, timeout: r2 }, a2 = (function(e5, t4, n3) {
      return t4.map((t5) => mt(e5, "beforeIdentify", ht(e5, t5), () => t5?.beforeIdentify?.(n3, {}) ?? {}, {}));
    })(e4, o2, i2);
    return (t4) => {
      !(function(e5, t5, n3, r3, o3) {
        for (let i3 = t5.length - 1; i3 >= 0; i3 -= 1) {
          const a3 = t5[i3], s = r3[i3];
          mt(e5, "afterIdentify", ht(e5, a3), () => a3?.afterIdentify?.(n3, s, o3) ?? {}, {});
        }
      })(e4, o2, i2, a2, t4);
    };
  }, addHook: function(e5) {
    n2.push(e5);
  }, afterTrack: function(t3) {
    if (0 === n2.length) return;
    const r2 = [...n2];
    !(function(e5, t4, n3) {
      for (let r3 = t4.length - 1; r3 >= 0; r3 -= 1) {
        const o2 = t4[r3];
        mt(e5, "afterTrack", ht(e5, o2), () => o2?.afterTrack?.(n3), void 0);
      }
    })(e4, r2, t3);
  } };
};
var wt = function() {
  let e4, t2 = {};
  function n2(n3) {
    return e4 && S.objectHasOwnProperty(e4, n3) && e4[n3] ? e4[n3] : t2 && S.objectHasOwnProperty(t2, n3) && t2[n3] && !t2[n3].deleted ? t2[n3] : null;
  }
  return { clearAllOverrides: function() {
    if (!e4) return {};
    const t3 = { ...e4 };
    return e4 = void 0, t3;
  }, get: n2, getFlagOverrides: function() {
    return e4 || {};
  }, getFlags: function() {
    return t2;
  }, getFlagsWithOverrides: function() {
    const r2 = {};
    for (const e5 in t2) {
      const t3 = n2(e5);
      t3 && (r2[e5] = t3);
    }
    if (e4) for (const t3 in e4) {
      const e5 = n2(t3);
      e5 && (r2[t3] = e5);
    }
    return r2;
  }, removeOverride: function(t3) {
    e4 && e4[t3] && (delete e4[t3], 0 === Object.keys(e4).length && (e4 = void 0));
  }, setFlags: function(e5) {
    t2 = { ...e5 };
  }, setOverride: function(t3, n3) {
    e4 || (e4 = {}), e4[t3] = { value: n3 };
  } };
};
var bt = "unknown plugin";
function kt(e4, t2) {
  try {
    return t2.getMetadata().name || bt;
  } catch (t3) {
    return e4.error("Exception thrown getting metadata for plugin. Unable to get plugin name."), bt;
  }
}
var Et = { getPluginHooks: function(e4, t2, n2) {
  const r2 = [];
  return n2.forEach((n3) => {
    try {
      const o2 = n3.getHooks?.(t2);
      void 0 === o2 ? e4.error(`Plugin ${kt(e4, n3)} returned undefined from getHooks.`) : o2 && o2.length > 0 && r2.push(...o2);
    } catch (t3) {
      e4.error(`Exception thrown getting hooks for plugin ${kt(e4, n3)}. Unable to get hooks.`);
    }
  }), r2;
}, registerPlugins: function(e4, t2, n2, r2) {
  r2.forEach((r3) => {
    try {
      r3.register(n2, t2);
    } catch (t3) {
      e4.error(`Exception thrown registering plugin ${kt(e4, r3)}.`);
    }
  });
}, registerPluginsForDebugOverride: function(e4, t2, n2) {
  n2.forEach((n3) => {
    try {
      n3.registerDebug?.(t2);
    } catch (t3) {
      e4.error(`Exception thrown registering debug override with plugin ${kt(e4, n3)}.`);
    }
  });
}, createPluginEnvironment: function(e4, t2, n2) {
  const r2 = {};
  e4.userAgent && (r2.name = e4.userAgent), e4.version && (r2.version = e4.version), n2.wrapperName && (r2.wrapperName = n2.wrapperName), n2.wrapperVersion && (r2.wrapperVersion = n2.wrapperVersion);
  const o2 = {};
  n2.application && (n2.application.name && (o2.name = n2.application.name), n2.application.version && (o2.version = n2.application.version));
  const i2 = { sdk: r2, clientSideId: t2 };
  return Object.keys(o2).length > 0 && (i2.application = o2), i2;
} };
var { commonBasicLogger: Dt } = re;
var { checkContext: xt, getContextKeys: Ot } = De;
var { InspectorTypes: Ct, InspectorManager: Pt } = ft;
var { getPluginHooks: St, registerPlugins: It, registerPluginsForDebugOverride: Tt, createPluginEnvironment: Ft } = Et;
var Lt = "change";
var Ut = "internal-change";
var At = { initialize: function(e4, t2, n2, r2, o2) {
  const i2 = (function() {
    if (n2 && n2.logger) return n2.logger;
    return o2 && o2.logger && o2.logger.default || Dt("warn");
  })(), a2 = Re(i2), c = He(a2), u = fe.validate(n2, a2, o2, i2), l = Pt(u.inspectors, i2), d = u.sendEvents;
  let f = e4, g = u.hash;
  const v = [...u.plugins], p = Ft(r2, e4, u), m2 = St(i2, p, v), h2 = yt(i2, [...u.hooks, ...m2]), y2 = qe(r2.localStorage, i2), w2 = ye(r2, f, u), b2 = u.sendEvents && !u.diagnosticOptOut, k2 = b2 ? ct.DiagnosticId(f) : null, E2 = b2 ? ct.DiagnosticsAccumulator((/* @__PURE__ */ new Date()).getTime()) : null, D2 = b2 ? ct.DiagnosticsManager(r2, y2, E2, w2, f, u, k2) : null, x2 = Ge(r2, u, f, E2), O2 = u.eventProcessor || je(r2, u, f, E2, a2, w2), C2 = et(r2, u, f), P2 = wt();
  let I2, T2, F2, L2 = u.streaming, U = false, A = false, j = true;
  const R = u.stateProvider, N2 = tt(null, function(e5) {
    (function(e6) {
      if (R) return;
      e6 && H2({ kind: "identify", context: e6, creationDate: (/* @__PURE__ */ new Date()).getTime() });
    })(e5), l.hasListeners(Ct.clientIdentityChanged) && l.onIdentityChanged(N2.getContext());
  }), $2 = new ot(y2), V2 = y2.isEnabled() ? Me(y2, f, g, N2) : null;
  function H2(e5) {
    f && (R && R.enqueueEvent && R.enqueueEvent(e5) || (e5.context ? (j = false, !d || A || r2.isDoNotTrack() || (i2.debug(ae.debugEnqueueingEvent(e5.kind)), O2.enqueue(e5))) : j && (i2.warn(ae.eventWithoutContext()), j = false)));
  }
  function M2(e5, t3) {
    l.hasListeners(Ct.flagDetailChanged) && l.onFlagChanged(e5.key, J2(t3));
  }
  function q2() {
    l.hasListeners(Ct.flagDetailsChanged) && l.onFlags(Object.entries(P2.getFlagsWithOverrides()).map(([e5, t3]) => ({ key: e5, detail: J2(t3) })).reduce((e5, t3) => (e5[t3.key] = t3.detail, e5), {}));
  }
  function z2(e5, t3, n3, r3) {
    const o3 = N2.getContext(), i3 = /* @__PURE__ */ new Date(), a3 = { kind: "feature", key: e5, context: o3, value: t3 ? t3.value : null, variation: t3 ? t3.variationIndex : null, default: n3, creationDate: i3.getTime() }, s = P2.getFlags()[e5];
    s && (a3.version = s.flagVersion ? s.flagVersion : s.version, a3.trackEvents = s.trackEvents, a3.debugEventsUntilDate = s.debugEventsUntilDate), (r3 || s && s.trackReason) && t3 && (a3.reason = t3.reason), H2(a3);
  }
  function K2(e5) {
    return xt(e5, false) ? Promise.resolve(e5) : Promise.reject(new s.LDInvalidUserError(ae.invalidContext()));
  }
  function _2(e5, t3, n3, r3, o3, i3) {
    let a3;
    const s = P2.get(e5);
    return s ? (a3 = J2(s), null !== s.value && void 0 !== s.value || (a3.value = t3)) : a3 = { value: t3, variationIndex: null, reason: { kind: "ERROR", errorKind: "FLAG_NOT_FOUND" } }, n3 && (o3 || s?.prerequisites?.forEach((e6) => {
      _2(e6, void 0, n3, false, false, false);
    }), z2(e5, a3, t3, r3)), !o3 && i3 && (function(e6, t4) {
      l.hasListeners(Ct.flagUsed) && l.onFlagUsed(e6, t4, N2.getContext());
    })(e5, a3), a3;
  }
  function J2(e5) {
    return { value: e5.value, variationIndex: void 0 === e5.variation ? null : e5.variation, reason: e5.reason || null };
  }
  function B2() {
    if (T2 = true, !N2.getContext()) return;
    const e5 = (e6) => {
      try {
        return JSON.parse(e6);
      } catch (e7) {
        return void a2.maybeReportError(new s.LDInvalidDataError(ae.invalidData()));
      }
    };
    x2.connect(N2.getContext(), g, { ping: function() {
      i2.debug(ae.debugStreamPing());
      const e6 = N2.getContext();
      C2.fetchFlagSettings(e6, g).then((t3) => {
        S.deepEquals(e6, N2.getContext()) && G2(t3 || {});
      }).catch((e7) => {
        a2.maybeReportError(new s.LDFlagFetchError(ae.errorFetchingFlags(e7)));
      });
    }, put: function(t3) {
      const n3 = e5(t3.data);
      n3 && (i2.debug(ae.debugStreamPut()), G2(n3));
    }, patch: function(t3) {
      const n3 = e5(t3.data);
      if (!n3) return;
      const r3 = P2.getFlags(), o3 = r3[n3.key];
      if (!o3 || !o3.version || !n3.version || o3.version < n3.version) {
        i2.debug(ae.debugStreamPatch(n3.key));
        const e6 = {}, t4 = S.extend({}, n3);
        delete t4.key, r3[n3.key] = t4, P2.setFlags(r3);
        const a3 = J2(t4);
        e6[n3.key] = o3 ? { previous: o3.value, current: a3 } : { current: a3 }, M2(n3, t4), X2(e6);
      } else i2.debug(ae.debugStreamPatchIgnored(n3.key));
    }, delete: function(t3) {
      const n3 = e5(t3.data);
      if (!n3) return;
      const r3 = P2.getFlags();
      if (!r3[n3.key] || r3[n3.key].version < n3.version) {
        i2.debug(ae.debugStreamDelete(n3.key));
        const e6 = {};
        r3[n3.key] && !r3[n3.key].deleted && (e6[n3.key] = { previous: r3[n3.key].value }), r3[n3.key] = { version: n3.version, deleted: true }, P2.setFlags(r3), M2(n3, r3[n3.key]), X2(e6);
      } else i2.debug(ae.debugStreamDeleteIgnored(n3.key));
    } });
  }
  function W2() {
    T2 && (x2.disconnect(), T2 = false);
  }
  function G2(e5) {
    const t3 = {};
    if (!e5) return Promise.resolve();
    const n3 = P2.getFlags();
    for (const r3 in n3) S.objectHasOwnProperty(n3, r3) && n3[r3] && (e5[r3] && !S.deepEquals(e5[r3].value, n3[r3].value) ? t3[r3] = { previous: n3[r3].value, current: J2(e5[r3]) } : e5[r3] && !e5[r3].deleted || (t3[r3] = { previous: n3[r3].value }));
    for (const r3 in e5) S.objectHasOwnProperty(e5, r3) && e5[r3] && (!n3[r3] || n3[r3].deleted) && (t3[r3] = { current: J2(e5[r3]) });
    return P2.setFlags({ ...e5 }), q2(), X2(t3).catch(() => {
    });
  }
  function X2(e5) {
    const t3 = Object.keys(e5);
    if (t3.length > 0) {
      const n3 = {};
      t3.forEach((t4) => {
        const r3 = e5[t4].current, o3 = r3 ? r3.value : void 0, i3 = e5[t4].previous;
        a2.emit(Lt + ":" + t4, o3, i3), n3[t4] = r3 ? { current: o3, previous: i3 } : { previous: i3 };
      }), a2.emit(Lt, n3), a2.emit(Ut, P2.getFlagsWithOverrides()), u.sendEventsOnlyForVariation || R || t3.forEach((t4) => {
        z2(t4, e5[t4].current);
      });
    }
    return I2 && V2 ? V2.saveFlags(P2.getFlags()) : Promise.resolve();
  }
  function Q2() {
    const e5 = L2 || F2 && void 0 === L2;
    e5 && !T2 ? B2() : !e5 && T2 && W2(), D2 && D2.setStreaming(e5);
  }
  function Y2(e5) {
    return e5 === Lt || e5.substr(0, 7) === Lt + ":";
  }
  if ("string" == typeof u.bootstrap && "LOCALSTORAGE" === u.bootstrap.toUpperCase() && (V2 ? I2 = true : i2.warn(ae.localStorageUnavailable())), "object" == typeof u.bootstrap && P2.setFlags((function(e5) {
    const t3 = Object.keys(e5), n3 = "$flagsState", r3 = "$valid", o3 = e5[n3];
    !o3 && t3.length && i2.warn(ae.bootstrapOldFormat()), false === e5[r3] && i2.warn(ae.bootstrapInvalid());
    const a3 = {};
    return t3.forEach((t4) => {
      if (t4 !== n3 && t4 !== r3) {
        let n4 = { value: e5[t4] };
        o3 && o3[t4] ? n4 = S.extend(n4, o3[t4]) : n4.version = 0, a3[t4] = n4;
      }
    }), a3;
  })(u.bootstrap)), R) {
    const e5 = R.getInitialState();
    e5 ? Z2(e5) : R.on("init", Z2), R.on("update", function(e6) {
      e6.context && N2.setContext(e6.context);
      e6.flags && G2(e6.flags);
    });
  } else (function() {
    if (!e4) return Promise.reject(new s.LDInvalidEnvironmentIdError(ae.environmentNotSpecified()));
    let n3;
    return $2.processContext(t2).then(K2).then((e5) => (n3 = S.once(h2.identify(e5, void 0)), e5)).then((e5) => (n3?.({ status: "completed" }), N2.setContext(e5), "object" == typeof u.bootstrap ? ee2() : I2 ? V2.loadFlags().then((e6) => null == e6 ? (P2.setFlags({}), C2.fetchFlagSettings(N2.getContext(), g).then((e7) => G2(e7 || {})).then(ee2).catch((e7) => {
      te2(new s.LDFlagFetchError(ae.errorFetchingFlags(e7)));
    })) : (P2.setFlags(e6), S.onNextTick(ee2), C2.fetchFlagSettings(N2.getContext(), g).then((e7) => G2(e7)).catch((e7) => a2.maybeReportError(e7)))) : C2.fetchFlagSettings(N2.getContext(), g).then((e6) => {
      P2.setFlags(e6 || {}), q2(), ee2();
    }).catch((e6) => {
      P2.setFlags({}), te2(e6);
    }))).catch((e5) => {
      throw n3?.({ status: "error" }), e5;
    });
  })().catch(te2);
  function Z2(e5) {
    f = e5.environment, N2.setContext(e5.context), P2.setFlags({ ...e5.flags }), S.onNextTick(ee2);
  }
  function ee2() {
    i2.info(ae.clientInitialized()), U = true, Q2(), c.signalSuccess();
  }
  function te2(e5) {
    c.signalFailure(e5);
  }
  const ne2 = { waitForInitialization: function(e5 = void 0) {
    if (null != e5) {
      if ("number" == typeof e5) return (function(e6) {
        e6 > 5 && i2.warn("The waitForInitialization function was called with a timeout greater than 5 seconds. We recommend a timeout of 5 seconds or less.");
        const t3 = c.getInitializationPromise(), n3 = vt(e6, "waitForInitialization");
        return Promise.race([n3, t3]).catch((e7) => {
          throw e7 instanceof s.LDTimeoutError && i2.error(`waitForInitialization error: ${e7}`), e7;
        });
      })(e5);
      i2.warn("The waitForInitialization method was provided with a non-numeric timeout.");
    }
    return i2.warn("The waitForInitialization function was called without a timeout specified. In a future version a default timeout will be applied."), c.getInitializationPromise();
  }, waitUntilReady: () => c.getReadyPromise(), identify: function(e5, t3, n3) {
    if (A) return S.wrapPromiseCallback(Promise.resolve({}), n3);
    if (R) return i2.warn(ae.identifyDisabled()), S.wrapPromiseCallback(Promise.resolve(S.transformVersionedValuesToValues(P2.getFlagsWithOverrides())), n3);
    let r3;
    const o3 = I2 && V2 ? V2.clearFlags() : Promise.resolve();
    return S.wrapPromiseCallback(o3.then(() => $2.processContext(e5)).then(K2).then((e6) => (r3 = S.once(h2.identify(e6, void 0)), e6)).then((e6) => C2.fetchFlagSettings(e6, t3).then((n4) => {
      const r4 = S.transformVersionedValuesToValues(n4);
      return N2.setContext(e6), g = t3, n4 ? G2(n4).then(() => r4) : r4;
    })).then((e6) => (r3?.({ status: "completed" }), T2 && B2(), e6)).catch((e6) => (r3?.({ status: "error" }), a2.maybeReportError(e6), Promise.reject(e6))), n3);
  }, getContext: function() {
    return N2.getContext();
  }, variation: function(e5, t3) {
    const { value: n3 } = h2.withEvaluation(e5, N2.getContext(), t3, () => _2(e5, t3, true, false, false, true));
    return n3;
  }, variationDetail: function(e5, t3) {
    return h2.withEvaluation(e5, N2.getContext(), t3, () => _2(e5, t3, true, true, false, true));
  }, track: function(e5, t3, n3) {
    if ("string" != typeof e5) return void a2.maybeReportError(new s.LDInvalidEventKeyError(ae.unknownCustomEventKey(e5)));
    void 0 !== n3 && "number" != typeof n3 && i2.warn(ae.invalidMetricValue(typeof n3)), r2.customEventFilter && !r2.customEventFilter(e5) && i2.warn(ae.unknownCustomEventKey(e5));
    const o3 = N2.getContext(), c2 = { kind: "custom", key: e5, context: o3, url: r2.getCurrentUrl(), creationDate: (/* @__PURE__ */ new Date()).getTime() };
    o3 && o3.anonymous && (c2.contextKind = o3.anonymous ? "anonymousUser" : "user"), null != t3 && (c2.data = t3), null != n3 && (c2.metricValue = n3), H2(c2), h2.afterTrack({ context: o3, key: e5, data: t3, metricValue: n3 });
  }, on: function(e5, t3, n3) {
    Y2(e5) ? (F2 = true, U && Q2(), a2.on(e5, t3, n3)) : a2.on(...arguments);
  }, off: function(e5) {
    if (a2.off(...arguments), Y2(e5)) {
      let e6 = false;
      a2.getEvents().forEach((t3) => {
        Y2(t3) && a2.getEventListenerCount(t3) > 0 && (e6 = true);
      }), e6 || (F2 = false, T2 && void 0 === L2 && W2());
    }
  }, setStreaming: function(e5) {
    const t3 = null === e5 ? void 0 : e5;
    t3 !== L2 && (L2 = t3, Q2());
  }, flush: function(e5) {
    return S.wrapPromiseCallback(d ? O2.flush() : Promise.resolve(), e5);
  }, allFlags: function() {
    const e5 = {}, t3 = P2.getFlagsWithOverrides();
    if (!t3) return e5;
    for (const n3 in t3) e5[n3] = _2(n3, null, !u.sendEventsOnlyForVariation, false, true, false).value;
    return e5;
  }, close: function(e5) {
    if (A) return S.wrapPromiseCallback(Promise.resolve(), e5);
    const t3 = () => {
      A = true, P2.setFlags({});
    }, n3 = Promise.resolve().then(() => {
      if (W2(), D2 && D2.stop(), d) return O2.stop(), O2.flush();
    }).then(t3).catch(t3);
    return S.wrapPromiseCallback(n3, e5);
  }, addHook: function(e5) {
    h2.addHook(e5);
  } };
  It(i2, p, ne2, v);
  const re2 = { setOverride: function(e5, t3) {
    const n3 = {}, r3 = P2.get(e5), o3 = r3 ? r3.value : null;
    if (o3 === t3) return void i2.debug(`setOverride: No change needed for ${e5}, value already ${t3}`);
    P2.setOverride(e5, t3);
    const a3 = P2.get(e5), s = J2(a3);
    n3[e5] = { previous: o3, current: s }, M2({ key: e5 }, a3), X2(n3);
  }, removeOverride: function(e5) {
    const t3 = P2.getFlagOverrides();
    if (!t3[e5]) return;
    const n3 = {}, r3 = t3[e5], o3 = P2.getFlags()[e5];
    n3[e5] = { previous: r3.value, current: o3 ? J2(o3) : void 0 }, P2.removeOverride(e5), M2({ key: e5 }, o3), X2(n3);
  }, clearAllOverrides: function() {
    const e5 = P2.getFlagOverrides();
    if (0 === Object.keys(e5).length) return;
    const t3 = {}, n3 = P2.getFlags();
    Object.keys(e5).forEach((r3) => {
      const o3 = e5[r3], i3 = n3[r3];
      t3[r3] = { previous: o3.value, current: i3 ? J2(i3) : void 0 };
    }), P2.clearAllOverrides(), Object.keys(t3).length > 0 && X2(t3);
  }, getAllOverrides: function() {
    const e5 = P2.getFlagOverrides();
    if (!e5) return {};
    const t3 = {};
    return Object.keys(e5).forEach((n3) => {
      const r3 = e5[n3];
      r3 && (t3[n3] = r3.value);
    }), t3;
  } };
  return Tt(i2, re2, v), { client: ne2, options: u, emitter: a2, ident: N2, logger: i2, requestor: C2, start: function() {
    d && (D2 && D2.start(), O2.start());
  }, enqueueEvent: H2, getFlagsInternal: function() {
    return P2.getFlagsWithOverrides();
  }, getEnvironmentId: () => f, internalChangeEventName: Ut };
}, commonBasicLogger: Dt, errors: s, messages: ae, utils: S, getContextKeys: Ot };
var jt = At.initialize;
var Rt = At.errors;
var Nt = At.messages;
function $t(e4, t2, n2) {
  return (t2 = (function(e5) {
    var t3 = (function(e6, t4) {
      if ("object" != typeof e6 || !e6) return e6;
      var n3 = e6[Symbol.toPrimitive];
      if (void 0 !== n3) {
        var r2 = n3.call(e6, t4 || "default");
        if ("object" != typeof r2) return r2;
        throw new TypeError("@@toPrimitive must return a primitive value.");
      }
      return ("string" === t4 ? String : Number)(e6);
    })(e5, "string");
    return "symbol" == typeof t3 ? t3 : t3 + "";
  })(t2)) in e4 ? Object.defineProperty(e4, t2, { value: n2, enumerable: true, configurable: true, writable: true }) : e4[t2] = n2, e4;
}
function Vt(e4, t2) {
  var n2 = Object.keys(e4);
  if (Object.getOwnPropertySymbols) {
    var r2 = Object.getOwnPropertySymbols(e4);
    t2 && (r2 = r2.filter(function(t3) {
      return Object.getOwnPropertyDescriptor(e4, t3).enumerable;
    })), n2.push.apply(n2, r2);
  }
  return n2;
}
function Ht(e4) {
  for (var t2 = 1; t2 < arguments.length; t2++) {
    var n2 = null != arguments[t2] ? arguments[t2] : {};
    t2 % 2 ? Vt(Object(n2), true).forEach(function(t3) {
      $t(e4, t3, n2[t3]);
    }) : Object.getOwnPropertyDescriptors ? Object.defineProperties(e4, Object.getOwnPropertyDescriptors(n2)) : Vt(Object(n2)).forEach(function(t3) {
      Object.defineProperty(e4, t3, Object.getOwnPropertyDescriptor(n2, t3));
    });
  }
  return e4;
}
var Mt = At.commonBasicLogger;
var qt = function(e4) {
  return Mt(Ht({ destination: console.log }, e4));
};
var zt = { promise: Promise.resolve({ status: 200, header: function() {
  return null;
}, body: null }) };
function Kt(e4, t2, n2, r2, o2) {
  if (o2 && !(function() {
    var e5 = window.navigator && window.navigator.userAgent;
    if (e5) {
      var t3 = e5.match(/Chrom(e|ium)\/([0-9]+)\./);
      if (t3) return parseInt(t3[2], 10) < 73;
    }
    return true;
  })()) return zt;
  var i2 = new window.XMLHttpRequest();
  for (var a2 in i2.open(e4, t2, !o2), n2 || {}) Object.prototype.hasOwnProperty.call(n2, a2) && i2.setRequestHeader(a2, n2[a2]);
  if (o2) {
    try {
      i2.send(r2);
    } catch (e5) {
    }
    return zt;
  }
  var s, c = new Promise(function(e5, t3) {
    i2.addEventListener("load", function() {
      s || e5({ status: i2.status, header: function(e6) {
        return i2.getResponseHeader(e6);
      }, body: i2.responseText });
    }), i2.addEventListener("error", function() {
      s || t3(new Error());
    }), i2.send(r2);
  });
  return { promise: c, cancel: function() {
    s = true, i2.abort();
  } };
}
var _t = (e4) => {
  if ("string" != typeof e4) throw new TypeError("Expected a string");
  return e4.replace(/[|\\{}()[\]^$+*?.]/g, "\\$&").replace(/-/g, "\\x2d");
};
function Jt(e4, t2, n2, r2) {
  var o2, i2, a2 = (("substring" === e4.kind || "regex" === e4.kind) && r2.includes("/") ? t2 : t2.replace(r2, "")).replace(n2, "");
  switch (e4.kind) {
    case "exact":
      i2 = t2, o2 = new RegExp("^" + _t(e4.url) + "/?$");
      break;
    case "canonical":
      i2 = a2, o2 = new RegExp("^" + _t(e4.url) + "/?$");
      break;
    case "substring":
      i2 = a2, o2 = new RegExp(".*" + _t(e4.substring) + ".*$");
      break;
    case "regex":
      i2 = a2, o2 = new RegExp(e4.pattern);
      break;
    default:
      return false;
  }
  return o2.test(i2);
}
function Bt(e4, t2) {
  for (var n2 = {}, r2 = null, o2 = [], i2 = 0; i2 < e4.length; i2++) for (var a2 = e4[i2], s = a2.urls || [], c = 0; c < s.length; c++) if (Jt(s[c], window.location.href, window.location.search, window.location.hash)) {
    "pageview" === a2.kind ? t2("pageview", a2) : (o2.push(a2), t2("click_pageview", a2));
    break;
  }
  return o2.length > 0 && (r2 = function(e5) {
    for (var n3 = (function(e6, t3) {
      for (var n4 = [], r4 = 0; r4 < t3.length; r4++) for (var o3 = e6.target, i3 = t3[r4], a3 = i3.selector, s2 = document.querySelectorAll(a3); o3 && s2.length > 0; ) {
        for (var c2 = 0; c2 < s2.length; c2++) o3 === s2[c2] && n4.push(i3);
        o3 = o3.parentNode;
      }
      return n4;
    })(e5, o2), r3 = 0; r3 < n3.length; r3++) t2("click", n3[r3]);
  }, document.addEventListener("click", r2)), n2.dispose = function() {
    document.removeEventListener("click", r2);
  }, n2;
}
function Wt(e4, t2) {
  var n2, r2;
  function o2() {
    r2 && r2.dispose(), n2 && n2.length && (r2 = Bt(n2, i2));
  }
  function i2(t3, n3) {
    var r3 = e4.ident.getContext(), o3 = { kind: t3, key: n3.key, data: null, url: window.location.href, creationDate: (/* @__PURE__ */ new Date()).getTime(), context: r3 };
    return "click" === t3 && (o3.selector = n3.selector), e4.enqueueEvent(o3);
  }
  return e4.requestor.fetchJSON("/sdk/goals/" + e4.getEnvironmentId()).then(function(e5) {
    e5 && e5.length > 0 && (r2 = Bt(n2 = e5, i2), (function(e6, t3) {
      var n3, r3 = window.location.href;
      function o3() {
        (n3 = window.location.href) !== r3 && (r3 = n3, t3());
      }
      !(function e7(t4, n4) {
        t4(), setTimeout(function() {
          e7(t4, n4);
        }, n4);
      })(o3, e6), window.history && window.history.pushState ? window.addEventListener("popstate", o3) : window.addEventListener("hashchange", o3);
    })(300, o2)), t2();
  }).catch(function(n3) {
    e4.emitter.maybeReportError(new Rt.LDUnexpectedResponseError((n3 && n3.message, n3.message))), t2();
  }), {};
}
var Gt = "goalsReady";
var Xt = { fetchGoals: { default: true }, hash: { type: "string" }, eventProcessor: { type: "object" }, eventUrlTransformer: { type: "function" }, disableSyncEventPost: { default: false } };
function Qt(e4, t2) {
  var n2 = arguments.length > 2 && void 0 !== arguments[2] ? arguments[2] : {}, r2 = (function(e5) {
    var t3, n3 = { userAgentHeaderName: "X-LaunchDarkly-User-Agent", synchronousFlush: false };
    if (window.XMLHttpRequest) {
      var r3 = e5 && e5.disableSyncEventPost;
      n3.httpRequest = function(e6, t4, o4, i4) {
        var a4 = n3.synchronousFlush & !r3;
        return n3.synchronousFlush = false, Kt(e6, t4, o4, i4, a4);
      };
    }
    n3.httpAllowsPost = function() {
      return void 0 === t3 && (t3 = !!window.XMLHttpRequest && "withCredentials" in new window.XMLHttpRequest()), t3;
    }, n3.httpFallbackPing = function(e6) {
      new window.Image().src = e6;
    };
    var o3, i3 = e5 && e5.eventUrlTransformer;
    n3.getCurrentUrl = function() {
      return i3 ? i3(window.location.href) : window.location.href;
    }, n3.isDoNotTrack = function() {
      var e6;
      return 1 === (e6 = window.navigator && void 0 !== window.navigator.doNotTrack ? window.navigator.doNotTrack : window.navigator && void 0 !== window.navigator.msDoNotTrack ? window.navigator.msDoNotTrack : window.doNotTrack) || true === e6 || "1" === e6 || "yes" === e6;
    };
    try {
      window.localStorage && (n3.localStorage = { get: function(e6) {
        return new Promise(function(t4) {
          t4(window.localStorage.getItem(e6));
        });
      }, set: function(e6, t4) {
        return new Promise(function(n4) {
          window.localStorage.setItem(e6, t4), n4();
        });
      }, clear: function(e6) {
        return new Promise(function(t4) {
          window.localStorage.removeItem(e6), t4();
        });
      } });
    } catch (e6) {
      n3.localStorage = null;
    }
    if (e5 && e5.useReport && "function" == typeof window.EventSourcePolyfill && window.EventSourcePolyfill.supportedOptions && window.EventSourcePolyfill.supportedOptions.method ? (n3.eventSourceAllowsReport = true, o3 = window.EventSourcePolyfill) : (n3.eventSourceAllowsReport = false, o3 = window.EventSource), window.EventSource) {
      var a3 = 3e5;
      n3.eventSourceFactory = function(e6, t4) {
        var n4 = Ht(Ht({}, { heartbeatTimeout: a3, silentTimeout: a3, skipDefaultHeaders: true }), t4);
        return new o3(e6, n4);
      }, n3.eventSourceIsActive = function(e6) {
        return e6.readyState === window.EventSource.OPEN || e6.readyState === window.EventSource.CONNECTING;
      };
    }
    return n3.userAgent = "JSClient", n3.version = "3.9.0", n3.diagnosticSdkData = { name: "js-client-sdk", version: "3.9.0" }, n3.diagnosticPlatformData = { name: "JS" }, n3.diagnosticUseCombinedEvent = true, n3;
  })(n2), o2 = jt(e4, t2, n2, r2, Xt), i2 = o2.client, a2 = o2.options, s = o2.emitter, c = new Promise(function(e5) {
    var t3 = s.on(Gt, function() {
      s.off(Gt, t3), e5();
    });
  });
  i2.waitUntilGoalsReady = function() {
    return c;
  }, a2.fetchGoals ? Wt(o2, function() {
    return s.emit(Gt);
  }) : s.emit(Gt), "complete" !== document.readyState ? window.addEventListener("load", o2.start) : o2.start();
  var u = function() {
    r2.synchronousFlush = true, i2.flush().catch(function() {
    }), r2.synchronousFlush = false;
  };
  return document.addEventListener("visibilitychange", function() {
    "hidden" === document.visibilityState && u();
  }), window.addEventListener("pagehide", u), i2;
}
var Yt = qt;
var Zt = void 0;
var en = "3.9.0";
var tn = { initialize: function(e4, t2) {
  var n2 = arguments.length > 2 && void 0 !== arguments[2] ? arguments[2] : {};
  return console && console.warn && console.warn(Nt.deprecated("default export", "named LDClient export")), Qt(e4, t2, n2);
}, version: en };
export {
  Yt as basicLogger,
  Zt as createConsoleLogger,
  tn as default,
  Qt as initialize,
  en as version
};
//# sourceMappingURL=launchdarkly-js-client-sdk.js.map
