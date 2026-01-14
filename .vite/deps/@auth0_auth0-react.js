import {
  require_react
} from "./chunk-DNGPJKJX.js";
import {
  __toESM
} from "./chunk-5WRI5ZAA.js";

// node_modules/.pnpm/@auth0+auth0-react@2.11.0_react-dom@19.2.3_react@19.2.3__react@19.2.3/node_modules/@auth0/auth0-react/dist/auth0-react.esm.js
var import_react = __toESM(require_react());
var extendStatics = function(d2, b2) {
  extendStatics = Object.setPrototypeOf || { __proto__: [] } instanceof Array && function(d3, b3) {
    d3.__proto__ = b3;
  } || function(d3, b3) {
    for (var p2 in b3) if (Object.prototype.hasOwnProperty.call(b3, p2)) d3[p2] = b3[p2];
  };
  return extendStatics(d2, b2);
};
function __extends(d2, b2) {
  if (typeof b2 !== "function" && b2 !== null)
    throw new TypeError("Class extends value " + String(b2) + " is not a constructor or null");
  extendStatics(d2, b2);
  function __() {
    this.constructor = d2;
  }
  d2.prototype = b2 === null ? Object.create(b2) : (__.prototype = b2.prototype, new __());
}
var __assign = function() {
  __assign = Object.assign || function __assign2(t2) {
    for (var s2, i2 = 1, n2 = arguments.length; i2 < n2; i2++) {
      s2 = arguments[i2];
      for (var p2 in s2) if (Object.prototype.hasOwnProperty.call(s2, p2)) t2[p2] = s2[p2];
    }
    return t2;
  };
  return __assign.apply(this, arguments);
};
function __rest(s2, e2) {
  var t2 = {};
  for (var p2 in s2) if (Object.prototype.hasOwnProperty.call(s2, p2) && e2.indexOf(p2) < 0)
    t2[p2] = s2[p2];
  if (s2 != null && typeof Object.getOwnPropertySymbols === "function")
    for (var i2 = 0, p2 = Object.getOwnPropertySymbols(s2); i2 < p2.length; i2++) {
      if (e2.indexOf(p2[i2]) < 0 && Object.prototype.propertyIsEnumerable.call(s2, p2[i2]))
        t2[p2[i2]] = s2[p2[i2]];
    }
  return t2;
}
function __awaiter(thisArg, _arguments, P2, generator) {
  function adopt(value) {
    return value instanceof P2 ? value : new P2(function(resolve) {
      resolve(value);
    });
  }
  return new (P2 || (P2 = Promise))(function(resolve, reject) {
    function fulfilled(value) {
      try {
        step(generator.next(value));
      } catch (e2) {
        reject(e2);
      }
    }
    function rejected(value) {
      try {
        step(generator["throw"](value));
      } catch (e2) {
        reject(e2);
      }
    }
    function step(result) {
      result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected);
    }
    step((generator = generator.apply(thisArg, _arguments || [])).next());
  });
}
function __generator(thisArg, body) {
  var _2 = { label: 0, sent: function() {
    if (t2[0] & 1) throw t2[1];
    return t2[1];
  }, trys: [], ops: [] }, f2, y2, t2, g2 = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
  return g2.next = verb(0), g2["throw"] = verb(1), g2["return"] = verb(2), typeof Symbol === "function" && (g2[Symbol.iterator] = function() {
    return this;
  }), g2;
  function verb(n2) {
    return function(v2) {
      return step([n2, v2]);
    };
  }
  function step(op) {
    if (f2) throw new TypeError("Generator is already executing.");
    while (g2 && (g2 = 0, op[0] && (_2 = 0)), _2) try {
      if (f2 = 1, y2 && (t2 = op[0] & 2 ? y2["return"] : op[0] ? y2["throw"] || ((t2 = y2["return"]) && t2.call(y2), 0) : y2.next) && !(t2 = t2.call(y2, op[1])).done) return t2;
      if (y2 = 0, t2) op = [op[0] & 2, t2.value];
      switch (op[0]) {
        case 0:
        case 1:
          t2 = op;
          break;
        case 4:
          _2.label++;
          return { value: op[1], done: false };
        case 5:
          _2.label++;
          y2 = op[1];
          op = [0];
          continue;
        case 7:
          op = _2.ops.pop();
          _2.trys.pop();
          continue;
        default:
          if (!(t2 = _2.trys, t2 = t2.length > 0 && t2[t2.length - 1]) && (op[0] === 6 || op[0] === 2)) {
            _2 = 0;
            continue;
          }
          if (op[0] === 3 && (!t2 || op[1] > t2[0] && op[1] < t2[3])) {
            _2.label = op[1];
            break;
          }
          if (op[0] === 6 && _2.label < t2[1]) {
            _2.label = t2[1];
            t2 = op;
            break;
          }
          if (t2 && _2.label < t2[2]) {
            _2.label = t2[2];
            _2.ops.push(op);
            break;
          }
          if (t2[2]) _2.ops.pop();
          _2.trys.pop();
          continue;
      }
      op = body.call(thisArg, _2);
    } catch (e2) {
      op = [6, e2];
      y2 = 0;
    } finally {
      f2 = t2 = 0;
    }
    if (op[0] & 5) throw op[1];
    return { value: op[0] ? op[1] : void 0, done: true };
  }
}
function __spreadArray(to, from, pack) {
  if (pack || arguments.length === 2) for (var i2 = 0, l2 = from.length, ar; i2 < l2; i2++) {
    if (ar || !(i2 in from)) {
      if (!ar) ar = Array.prototype.slice.call(from, 0, i2);
      ar[i2] = from[i2];
    }
  }
  return to.concat(ar || Array.prototype.slice.call(from));
}
function e(e2, t2) {
  var o2 = {};
  for (var n2 in e2) Object.prototype.hasOwnProperty.call(e2, n2) && t2.indexOf(n2) < 0 && (o2[n2] = e2[n2]);
  if (null != e2 && "function" == typeof Object.getOwnPropertySymbols) {
    var i2 = 0;
    for (n2 = Object.getOwnPropertySymbols(e2); i2 < n2.length; i2++) t2.indexOf(n2[i2]) < 0 && Object.prototype.propertyIsEnumerable.call(e2, n2[i2]) && (o2[n2[i2]] = e2[n2[i2]]);
  }
  return o2;
}
var t = "undefined" != typeof globalThis ? globalThis : "undefined" != typeof window ? window : "undefined" != typeof global ? global : "undefined" != typeof self ? self : {};
function o(e2) {
  return e2 && e2.__esModule && Object.prototype.hasOwnProperty.call(e2, "default") ? e2.default : e2;
}
function n(e2, t2) {
  return e2(t2 = { exports: {} }, t2.exports), t2.exports;
}
var i = n((function(e2, t2) {
  Object.defineProperty(t2, "__esModule", { value: true });
  var o2 = (function() {
    function e3() {
      var e4 = this;
      this.locked = /* @__PURE__ */ new Map(), this.addToLocked = function(t3, o3) {
        var n2 = e4.locked.get(t3);
        void 0 === n2 ? void 0 === o3 ? e4.locked.set(t3, []) : e4.locked.set(t3, [o3]) : void 0 !== o3 && (n2.unshift(o3), e4.locked.set(t3, n2));
      }, this.isLocked = function(t3) {
        return e4.locked.has(t3);
      }, this.lock = function(t3) {
        return new Promise((function(o3, n2) {
          e4.isLocked(t3) ? e4.addToLocked(t3, o3) : (e4.addToLocked(t3), o3());
        }));
      }, this.unlock = function(t3) {
        var o3 = e4.locked.get(t3);
        if (void 0 !== o3 && 0 !== o3.length) {
          var n2 = o3.pop();
          e4.locked.set(t3, o3), void 0 !== n2 && setTimeout(n2, 0);
        } else e4.locked.delete(t3);
      };
    }
    return e3.getInstance = function() {
      return void 0 === e3.instance && (e3.instance = new e3()), e3.instance;
    }, e3;
  })();
  t2.default = function() {
    return o2.getInstance();
  };
}));
o(i);
var r = o(n((function(e2, o2) {
  var n2 = t && t.__awaiter || function(e3, t2, o3, n3) {
    return new (o3 || (o3 = Promise))((function(i2, r3) {
      function s3(e4) {
        try {
          c3(n3.next(e4));
        } catch (e5) {
          r3(e5);
        }
      }
      function a3(e4) {
        try {
          c3(n3.throw(e4));
        } catch (e5) {
          r3(e5);
        }
      }
      function c3(e4) {
        e4.done ? i2(e4.value) : new o3((function(t3) {
          t3(e4.value);
        })).then(s3, a3);
      }
      c3((n3 = n3.apply(e3, t2 || [])).next());
    }));
  }, r2 = t && t.__generator || function(e3, t2) {
    var o3, n3, i2, r3, s3 = { label: 0, sent: function() {
      if (1 & i2[0]) throw i2[1];
      return i2[1];
    }, trys: [], ops: [] };
    return r3 = { next: a3(0), throw: a3(1), return: a3(2) }, "function" == typeof Symbol && (r3[Symbol.iterator] = function() {
      return this;
    }), r3;
    function a3(r4) {
      return function(a4) {
        return (function(r5) {
          if (o3) throw new TypeError("Generator is already executing.");
          for (; s3; ) try {
            if (o3 = 1, n3 && (i2 = 2 & r5[0] ? n3.return : r5[0] ? n3.throw || ((i2 = n3.return) && i2.call(n3), 0) : n3.next) && !(i2 = i2.call(n3, r5[1])).done) return i2;
            switch (n3 = 0, i2 && (r5 = [2 & r5[0], i2.value]), r5[0]) {
              case 0:
              case 1:
                i2 = r5;
                break;
              case 4:
                return s3.label++, { value: r5[1], done: false };
              case 5:
                s3.label++, n3 = r5[1], r5 = [0];
                continue;
              case 7:
                r5 = s3.ops.pop(), s3.trys.pop();
                continue;
              default:
                if (!(i2 = s3.trys, (i2 = i2.length > 0 && i2[i2.length - 1]) || 6 !== r5[0] && 2 !== r5[0])) {
                  s3 = 0;
                  continue;
                }
                if (3 === r5[0] && (!i2 || r5[1] > i2[0] && r5[1] < i2[3])) {
                  s3.label = r5[1];
                  break;
                }
                if (6 === r5[0] && s3.label < i2[1]) {
                  s3.label = i2[1], i2 = r5;
                  break;
                }
                if (i2 && s3.label < i2[2]) {
                  s3.label = i2[2], s3.ops.push(r5);
                  break;
                }
                i2[2] && s3.ops.pop(), s3.trys.pop();
                continue;
            }
            r5 = t2.call(e3, s3);
          } catch (e4) {
            r5 = [6, e4], n3 = 0;
          } finally {
            o3 = i2 = 0;
          }
          if (5 & r5[0]) throw r5[1];
          return { value: r5[0] ? r5[1] : void 0, done: true };
        })([r4, a4]);
      };
    }
  }, s2 = t;
  Object.defineProperty(o2, "__esModule", { value: true });
  var a2 = "browser-tabs-lock-key", c2 = { key: function(e3) {
    return n2(s2, void 0, void 0, (function() {
      return r2(this, (function(e4) {
        throw new Error("Unsupported");
      }));
    }));
  }, getItem: function(e3) {
    return n2(s2, void 0, void 0, (function() {
      return r2(this, (function(e4) {
        throw new Error("Unsupported");
      }));
    }));
  }, clear: function() {
    return n2(s2, void 0, void 0, (function() {
      return r2(this, (function(e3) {
        return [2, window.localStorage.clear()];
      }));
    }));
  }, removeItem: function(e3) {
    return n2(s2, void 0, void 0, (function() {
      return r2(this, (function(e4) {
        throw new Error("Unsupported");
      }));
    }));
  }, setItem: function(e3, t2) {
    return n2(s2, void 0, void 0, (function() {
      return r2(this, (function(e4) {
        throw new Error("Unsupported");
      }));
    }));
  }, keySync: function(e3) {
    return window.localStorage.key(e3);
  }, getItemSync: function(e3) {
    return window.localStorage.getItem(e3);
  }, clearSync: function() {
    return window.localStorage.clear();
  }, removeItemSync: function(e3) {
    return window.localStorage.removeItem(e3);
  }, setItemSync: function(e3, t2) {
    return window.localStorage.setItem(e3, t2);
  } };
  function u2(e3) {
    return new Promise((function(t2) {
      return setTimeout(t2, e3);
    }));
  }
  function d2(e3) {
    for (var t2 = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXTZabcdefghiklmnopqrstuvwxyz", o3 = "", n3 = 0; n3 < e3; n3++) {
      o3 += t2[Math.floor(Math.random() * t2.length)];
    }
    return o3;
  }
  var h2 = (function() {
    function e3(t2) {
      this.acquiredIatSet = /* @__PURE__ */ new Set(), this.storageHandler = void 0, this.id = Date.now().toString() + d2(15), this.acquireLock = this.acquireLock.bind(this), this.releaseLock = this.releaseLock.bind(this), this.releaseLock__private__ = this.releaseLock__private__.bind(this), this.waitForSomethingToChange = this.waitForSomethingToChange.bind(this), this.refreshLockWhileAcquired = this.refreshLockWhileAcquired.bind(this), this.storageHandler = t2, void 0 === e3.waiters && (e3.waiters = []);
    }
    return e3.prototype.acquireLock = function(t2, o3) {
      return void 0 === o3 && (o3 = 5e3), n2(this, void 0, void 0, (function() {
        var n3, i2, s3, h3, l2, p2, m2;
        return r2(this, (function(r3) {
          switch (r3.label) {
            case 0:
              n3 = Date.now() + d2(4), i2 = Date.now() + o3, s3 = a2 + "-" + t2, h3 = void 0 === this.storageHandler ? c2 : this.storageHandler, r3.label = 1;
            case 1:
              return Date.now() < i2 ? [4, u2(30)] : [3, 8];
            case 2:
              return r3.sent(), null !== h3.getItemSync(s3) ? [3, 5] : (l2 = this.id + "-" + t2 + "-" + n3, [4, u2(Math.floor(25 * Math.random()))]);
            case 3:
              return r3.sent(), h3.setItemSync(s3, JSON.stringify({ id: this.id, iat: n3, timeoutKey: l2, timeAcquired: Date.now(), timeRefreshed: Date.now() })), [4, u2(30)];
            case 4:
              return r3.sent(), null !== (p2 = h3.getItemSync(s3)) && (m2 = JSON.parse(p2)).id === this.id && m2.iat === n3 ? (this.acquiredIatSet.add(n3), this.refreshLockWhileAcquired(s3, n3), [2, true]) : [3, 7];
            case 5:
              return e3.lockCorrector(void 0 === this.storageHandler ? c2 : this.storageHandler), [4, this.waitForSomethingToChange(i2)];
            case 6:
              r3.sent(), r3.label = 7;
            case 7:
              return n3 = Date.now() + d2(4), [3, 1];
            case 8:
              return [2, false];
          }
        }));
      }));
    }, e3.prototype.refreshLockWhileAcquired = function(e4, t2) {
      return n2(this, void 0, void 0, (function() {
        var o3 = this;
        return r2(this, (function(s3) {
          return setTimeout((function() {
            return n2(o3, void 0, void 0, (function() {
              var o4, n3, s4;
              return r2(this, (function(r3) {
                switch (r3.label) {
                  case 0:
                    return [4, i.default().lock(t2)];
                  case 1:
                    return r3.sent(), this.acquiredIatSet.has(t2) ? (o4 = void 0 === this.storageHandler ? c2 : this.storageHandler, null === (n3 = o4.getItemSync(e4)) ? (i.default().unlock(t2), [2]) : ((s4 = JSON.parse(n3)).timeRefreshed = Date.now(), o4.setItemSync(e4, JSON.stringify(s4)), i.default().unlock(t2), this.refreshLockWhileAcquired(e4, t2), [2])) : (i.default().unlock(t2), [2]);
                }
              }));
            }));
          }), 1e3), [2];
        }));
      }));
    }, e3.prototype.waitForSomethingToChange = function(t2) {
      return n2(this, void 0, void 0, (function() {
        return r2(this, (function(o3) {
          switch (o3.label) {
            case 0:
              return [4, new Promise((function(o4) {
                var n3 = false, i2 = Date.now(), r3 = false;
                function s3() {
                  if (r3 || (window.removeEventListener("storage", s3), e3.removeFromWaiting(s3), clearTimeout(a3), r3 = true), !n3) {
                    n3 = true;
                    var t3 = 50 - (Date.now() - i2);
                    t3 > 0 ? setTimeout(o4, t3) : o4(null);
                  }
                }
                window.addEventListener("storage", s3), e3.addToWaiting(s3);
                var a3 = setTimeout(s3, Math.max(0, t2 - Date.now()));
              }))];
            case 1:
              return o3.sent(), [2];
          }
        }));
      }));
    }, e3.addToWaiting = function(t2) {
      this.removeFromWaiting(t2), void 0 !== e3.waiters && e3.waiters.push(t2);
    }, e3.removeFromWaiting = function(t2) {
      void 0 !== e3.waiters && (e3.waiters = e3.waiters.filter((function(e4) {
        return e4 !== t2;
      })));
    }, e3.notifyWaiters = function() {
      void 0 !== e3.waiters && e3.waiters.slice().forEach((function(e4) {
        return e4();
      }));
    }, e3.prototype.releaseLock = function(e4) {
      return n2(this, void 0, void 0, (function() {
        return r2(this, (function(t2) {
          switch (t2.label) {
            case 0:
              return [4, this.releaseLock__private__(e4)];
            case 1:
              return [2, t2.sent()];
          }
        }));
      }));
    }, e3.prototype.releaseLock__private__ = function(t2) {
      return n2(this, void 0, void 0, (function() {
        var o3, n3, s3, u3;
        return r2(this, (function(r3) {
          switch (r3.label) {
            case 0:
              return o3 = void 0 === this.storageHandler ? c2 : this.storageHandler, n3 = a2 + "-" + t2, null === (s3 = o3.getItemSync(n3)) ? [2] : (u3 = JSON.parse(s3)).id !== this.id ? [3, 2] : [4, i.default().lock(u3.iat)];
            case 1:
              r3.sent(), this.acquiredIatSet.delete(u3.iat), o3.removeItemSync(n3), i.default().unlock(u3.iat), e3.notifyWaiters(), r3.label = 2;
            case 2:
              return [2];
          }
        }));
      }));
    }, e3.lockCorrector = function(t2) {
      for (var o3 = Date.now() - 5e3, n3 = t2, i2 = [], r3 = 0; ; ) {
        var s3 = n3.keySync(r3);
        if (null === s3) break;
        i2.push(s3), r3++;
      }
      for (var c3 = false, u3 = 0; u3 < i2.length; u3++) {
        var d3 = i2[u3];
        if (d3.includes(a2)) {
          var h3 = n3.getItemSync(d3);
          if (null !== h3) {
            var l2 = JSON.parse(h3);
            (void 0 === l2.timeRefreshed && l2.timeAcquired < o3 || void 0 !== l2.timeRefreshed && l2.timeRefreshed < o3) && (n3.removeItemSync(d3), c3 = true);
          }
        }
      }
      c3 && e3.notifyWaiters();
    }, e3.waiters = void 0, e3;
  })();
  o2.default = h2;
})));
var s = { timeoutInSeconds: 60 };
var a = { name: "auth0-spa-js", version: "2.11.0" };
var c = () => Date.now();
var u = class _u extends Error {
  constructor(e2, t2) {
    super(t2), this.error = e2, this.error_description = t2, Object.setPrototypeOf(this, _u.prototype);
  }
  static fromPayload({ error: e2, error_description: t2 }) {
    return new _u(e2, t2);
  }
};
var d = class _d extends u {
  constructor(e2, t2, o2, n2 = null) {
    super(e2, t2), this.state = o2, this.appState = n2, Object.setPrototypeOf(this, _d.prototype);
  }
};
var h = class _h extends u {
  constructor(e2, t2, o2, n2, i2 = null) {
    super(e2, t2), this.connection = o2, this.state = n2, this.appState = i2, Object.setPrototypeOf(this, _h.prototype);
  }
};
var l = class _l extends u {
  constructor() {
    super("timeout", "Timeout"), Object.setPrototypeOf(this, _l.prototype);
  }
};
var p = class _p extends l {
  constructor(e2) {
    super(), this.popup = e2, Object.setPrototypeOf(this, _p.prototype);
  }
};
var m = class _m extends u {
  constructor(e2) {
    super("cancelled", "Popup closed"), this.popup = e2, Object.setPrototypeOf(this, _m.prototype);
  }
};
var f = class _f extends u {
  constructor() {
    super("popup_open", "Unable to open a popup for loginWithPopup - window.open returned `null`"), Object.setPrototypeOf(this, _f.prototype);
  }
};
var g = class _g extends u {
  constructor(e2, t2, o2) {
    super(e2, t2), this.mfa_token = o2, Object.setPrototypeOf(this, _g.prototype);
  }
};
var y = class _y extends u {
  constructor(e2, t2) {
    super("missing_refresh_token", `Missing Refresh Token (audience: '${k(e2, ["default"])}', scope: '${k(t2)}')`), this.audience = e2, this.scope = t2, Object.setPrototypeOf(this, _y.prototype);
  }
};
var w = class _w extends u {
  constructor(e2, t2) {
    super("missing_scopes", `Missing requested scopes after refresh (audience: '${k(e2, ["default"])}', missing scope: '${k(t2)}')`), this.audience = e2, this.scope = t2, Object.setPrototypeOf(this, _w.prototype);
  }
};
var b = class _b extends u {
  constructor(e2) {
    super("use_dpop_nonce", "Server rejected DPoP proof: wrong nonce"), this.newDpopNonce = e2, Object.setPrototypeOf(this, _b.prototype);
  }
};
function k(e2, t2 = []) {
  return e2 && !t2.includes(e2) ? e2 : "";
}
var v = () => window.crypto;
var _ = () => {
  const e2 = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz-_~.";
  let t2 = "";
  return Array.from(v().getRandomValues(new Uint8Array(43))).forEach(((o2) => t2 += e2[o2 % e2.length])), t2;
};
var S = (e2) => btoa(e2);
var I = [{ key: "name", type: ["string"] }, { key: "version", type: ["string", "number"] }, { key: "env", type: ["object"] }];
var P = (e2) => Object.keys(e2).reduce(((t2, o2) => {
  const n2 = I.find(((e3) => e3.key === o2));
  return n2 && n2.type.includes(typeof e2[o2]) && (t2[o2] = e2[o2]), t2;
}), {});
var T = (t2) => {
  var { clientId: o2 } = t2, n2 = e(t2, ["clientId"]);
  return new URLSearchParams(((e2) => Object.keys(e2).filter(((t3) => void 0 !== e2[t3])).reduce(((t3, o3) => Object.assign(Object.assign({}, t3), { [o3]: e2[o3] })), {}))(Object.assign({ client_id: o2 }, n2))).toString();
};
var O = async (e2) => {
  const t2 = v().subtle.digest({ name: "SHA-256" }, new TextEncoder().encode(e2));
  return await t2;
};
var j = (e2) => ((e3) => decodeURIComponent(atob(e3).split("").map(((e4) => "%" + ("00" + e4.charCodeAt(0).toString(16)).slice(-2))).join("")))(e2.replace(/_/g, "/").replace(/-/g, "+"));
var C = (e2) => {
  const t2 = new Uint8Array(e2);
  return ((e3) => {
    const t3 = { "+": "-", "/": "_", "=": "" };
    return e3.replace(/[+/=]/g, ((e4) => t3[e4]));
  })(window.btoa(String.fromCharCode(...Array.from(t2))));
};
var K = new TextEncoder();
var x = new TextDecoder();
function z(e2) {
  return "string" == typeof e2 ? K.encode(e2) : x.decode(e2);
}
function E(e2) {
  if ("number" != typeof e2.modulusLength || e2.modulusLength < 2048) throw new U(`${e2.name} modulusLength must be at least 2048 bits`);
}
async function N(e2, t2, o2) {
  if (false === o2.usages.includes("sign")) throw new TypeError('private CryptoKey instances used for signing assertions must include "sign" in their "usages"');
  const n2 = `${D(z(JSON.stringify(e2)))}.${D(z(JSON.stringify(t2)))}`;
  return `${n2}.${D(await crypto.subtle.sign((function(e3) {
    switch (e3.algorithm.name) {
      case "ECDSA":
        return { name: e3.algorithm.name, hash: "SHA-256" };
      case "RSA-PSS":
        return E(e3.algorithm), { name: e3.algorithm.name, saltLength: 32 };
      case "RSASSA-PKCS1-v1_5":
        return E(e3.algorithm), { name: e3.algorithm.name };
      case "Ed25519":
        return { name: e3.algorithm.name };
    }
    throw new A();
  })(o2), o2, z(n2)))}`;
}
var R;
if (Uint8Array.prototype.toBase64) R = (e2) => (e2 instanceof ArrayBuffer && (e2 = new Uint8Array(e2)), e2.toBase64({ alphabet: "base64url", omitPadding: true }));
else {
  const e2 = 32768;
  R = (t2) => {
    t2 instanceof ArrayBuffer && (t2 = new Uint8Array(t2));
    const o2 = [];
    for (let n2 = 0; n2 < t2.byteLength; n2 += e2) o2.push(String.fromCharCode.apply(null, t2.subarray(n2, n2 + e2)));
    return btoa(o2.join("")).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
  };
}
function D(e2) {
  return R(e2);
}
var A = class extends Error {
  constructor(e2) {
    var t2;
    super(null != e2 ? e2 : "operation not supported"), this.name = this.constructor.name, null === (t2 = Error.captureStackTrace) || void 0 === t2 || t2.call(Error, this, this.constructor);
  }
};
var U = class extends Error {
  constructor(e2) {
    var t2;
    super(e2), this.name = this.constructor.name, null === (t2 = Error.captureStackTrace) || void 0 === t2 || t2.call(Error, this, this.constructor);
  }
};
function L(e2) {
  switch (e2.algorithm.name) {
    case "RSA-PSS":
      return (function(e3) {
        if ("SHA-256" === e3.algorithm.hash.name) return "PS256";
        throw new A("unsupported RsaHashedKeyAlgorithm hash name");
      })(e2);
    case "RSASSA-PKCS1-v1_5":
      return (function(e3) {
        if ("SHA-256" === e3.algorithm.hash.name) return "RS256";
        throw new A("unsupported RsaHashedKeyAlgorithm hash name");
      })(e2);
    case "ECDSA":
      return (function(e3) {
        if ("P-256" === e3.algorithm.namedCurve) return "ES256";
        throw new A("unsupported EcKeyAlgorithm namedCurve");
      })(e2);
    case "Ed25519":
      return "Ed25519";
    default:
      throw new A("unsupported CryptoKey algorithm name");
  }
}
function Z(e2) {
  return e2 instanceof CryptoKey;
}
function H(e2) {
  return Z(e2) && "public" === e2.type;
}
async function W(e2, t2, o2, n2, i2, r2) {
  const s2 = null == e2 ? void 0 : e2.privateKey, a2 = null == e2 ? void 0 : e2.publicKey;
  if (!Z(c2 = s2) || "private" !== c2.type) throw new TypeError('"keypair.privateKey" must be a private CryptoKey');
  var c2;
  if (!H(a2)) throw new TypeError('"keypair.publicKey" must be a public CryptoKey');
  if (true !== a2.extractable) throw new TypeError('"keypair.publicKey.extractable" must be true');
  if ("string" != typeof t2) throw new TypeError('"htu" must be a string');
  if ("string" != typeof o2) throw new TypeError('"htm" must be a string');
  if (void 0 !== n2 && "string" != typeof n2) throw new TypeError('"nonce" must be a string or undefined');
  if (void 0 !== i2 && "string" != typeof i2) throw new TypeError('"accessToken" must be a string or undefined');
  if (void 0 !== r2 && ("object" != typeof r2 || null === r2 || Array.isArray(r2))) throw new TypeError('"additional" must be an object');
  return N({ alg: L(s2), typ: "dpop+jwt", jwk: await J(a2) }, Object.assign(Object.assign({}, r2), { iat: Math.floor(Date.now() / 1e3), jti: crypto.randomUUID(), htm: o2, nonce: n2, htu: t2, ath: i2 ? D(await crypto.subtle.digest("SHA-256", z(i2))) : void 0 }), s2);
}
async function J(e2) {
  const { kty: t2, e: o2, n: n2, x: i2, y: r2, crv: s2 } = await crypto.subtle.exportKey("jwk", e2);
  return { kty: t2, crv: s2, e: o2, n: n2, x: i2, y: r2 };
}
var X = ["authorization_code", "refresh_token", "urn:ietf:params:oauth:grant-type:token-exchange"];
function V() {
  return (async function(e2, t2) {
    var o2;
    let n2;
    if ("string" != typeof e2 || 0 === e2.length) throw new TypeError('"alg" must be a non-empty string');
    switch (e2) {
      case "PS256":
        n2 = { name: "RSA-PSS", hash: "SHA-256", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]) };
        break;
      case "RS256":
        n2 = { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]) };
        break;
      case "ES256":
        n2 = { name: "ECDSA", namedCurve: "P-256" };
        break;
      case "Ed25519":
        n2 = { name: "Ed25519" };
        break;
      default:
        throw new A();
    }
    return crypto.subtle.generateKey(n2, null !== (o2 = null == t2 ? void 0 : t2.extractable) && void 0 !== o2 && o2, ["sign", "verify"]);
  })("ES256", { extractable: false });
}
function F(e2) {
  return (async function(e3) {
    if (!H(e3)) throw new TypeError('"publicKey" must be a public CryptoKey');
    if (true !== e3.extractable) throw new TypeError('"publicKey.extractable" must be true');
    const t2 = await J(e3);
    let o2;
    switch (t2.kty) {
      case "EC":
        o2 = { crv: t2.crv, kty: t2.kty, x: t2.x, y: t2.y };
        break;
      case "OKP":
        o2 = { crv: t2.crv, kty: t2.kty, x: t2.x };
        break;
      case "RSA":
        o2 = { e: t2.e, kty: t2.kty, n: t2.n };
        break;
      default:
        throw new A("unsupported JWK kty");
    }
    return D(await crypto.subtle.digest({ name: "SHA-256" }, z(JSON.stringify(o2))));
  })(e2.publicKey);
}
function G({ keyPair: e2, url: t2, method: o2, nonce: n2, accessToken: i2 }) {
  const r2 = (function(e3) {
    const t3 = new URL(e3);
    return t3.search = "", t3.hash = "", t3.href;
  })(t2);
  return W(e2, r2, o2, n2, i2);
}
var M = async (e2, t2) => {
  const o2 = await fetch(e2, t2);
  return { ok: o2.ok, json: await o2.json(), headers: (n2 = o2.headers, [...n2].reduce(((e3, [t3, o3]) => (e3[t3] = o3, e3)), {})) };
  var n2;
};
var Y = async (e2, t2, o2) => {
  const n2 = new AbortController();
  let i2;
  return t2.signal = n2.signal, Promise.race([M(e2, t2), new Promise(((e3, t3) => {
    i2 = setTimeout((() => {
      n2.abort(), t3(new Error("Timeout when executing 'fetch'"));
    }), o2);
  }))]).finally((() => {
    clearTimeout(i2);
  }));
};
var $ = async (e2, t2, o2, n2, i2, r2, s2, a2) => {
  return c2 = { auth: { audience: t2, scope: o2 }, timeout: i2, fetchUrl: e2, fetchOptions: n2, useFormData: s2, useMrrt: a2 }, u2 = r2, new Promise((function(e3, t3) {
    const o3 = new MessageChannel();
    o3.port1.onmessage = function(n3) {
      n3.data.error ? t3(new Error(n3.data.error)) : e3(n3.data), o3.port1.close();
    }, u2.postMessage(c2, [o3.port2]);
  }));
  var c2, u2;
};
var B = async (e2, t2, o2, n2, i2, r2, s2 = 1e4, a2) => i2 ? $(e2, t2, o2, n2, s2, i2, r2, a2) : Y(e2, n2, s2);
async function q(t2, o2, n2, i2, r2, s2, a2, c2, d2, h2) {
  if (d2) {
    const e2 = await d2.generateProof({ url: t2, method: r2.method || "GET", nonce: await d2.getNonce() });
    r2.headers = Object.assign(Object.assign({}, r2.headers), { dpop: e2 });
  }
  let l2, p2 = null;
  for (let e2 = 0; e2 < 3; e2++) try {
    l2 = await B(t2, n2, i2, r2, s2, a2, o2, c2), p2 = null;
    break;
  } catch (e3) {
    p2 = e3;
  }
  if (p2) throw p2;
  const m2 = l2.json, { error: f2, error_description: w2 } = m2, k2 = e(m2, ["error", "error_description"]), { headers: v2, ok: _2 } = l2;
  let S2;
  if (d2 && (S2 = v2["dpop-nonce"], S2 && await d2.setNonce(S2)), !_2) {
    const e2 = w2 || `HTTP error. Unable to fetch ${t2}`;
    if ("mfa_required" === f2) throw new g(f2, e2, k2.mfa_token);
    if ("missing_refresh_token" === f2) throw new y(n2, i2);
    if ("use_dpop_nonce" === f2) {
      if (!d2 || !S2 || h2) throw new b(S2);
      return q(t2, o2, n2, i2, r2, s2, a2, c2, d2, true);
    }
    throw new u(f2 || "request_error", e2);
  }
  return k2;
}
async function Q(t2, o2) {
  var { baseUrl: n2, timeout: i2, audience: r2, scope: s2, auth0Client: c2, useFormData: u2, useMrrt: d2, dpop: h2 } = t2, l2 = e(t2, ["baseUrl", "timeout", "audience", "scope", "auth0Client", "useFormData", "useMrrt", "dpop"]);
  const p2 = "urn:ietf:params:oauth:grant-type:token-exchange" === l2.grant_type, m2 = "refresh_token" === l2.grant_type && d2, f2 = Object.assign(Object.assign(Object.assign(Object.assign({}, l2), p2 && r2 && { audience: r2 }), p2 && s2 && { scope: s2 }), m2 && { audience: r2, scope: s2 }), g2 = u2 ? T(f2) : JSON.stringify(f2), y2 = (w2 = l2.grant_type, X.includes(w2));
  var w2;
  return await q(`${n2}/oauth/token`, i2, r2 || "default", s2, { method: "POST", body: g2, headers: { "Content-Type": u2 ? "application/x-www-form-urlencoded" : "application/json", "Auth0-Client": btoa(JSON.stringify(P(c2 || a))) } }, o2, u2, d2, y2 ? h2 : void 0);
}
var ee = (...e2) => {
  return (t2 = e2.filter(Boolean).join(" ").trim().split(/\s+/), Array.from(new Set(t2))).join(" ");
  var t2;
};
var te = (e2, t2, o2) => {
  let n2;
  return o2 && (n2 = e2[o2]), n2 || (n2 = e2.default), ee(n2, t2);
};
var oe = class _oe {
  constructor(e2, t2 = "@@auth0spajs@@", o2) {
    this.prefix = t2, this.suffix = o2, this.clientId = e2.clientId, this.scope = e2.scope, this.audience = e2.audience;
  }
  toKey() {
    return [this.prefix, this.clientId, this.audience, this.scope, this.suffix].filter(Boolean).join("::");
  }
  static fromKey(e2) {
    const [t2, o2, n2, i2] = e2.split("::");
    return new _oe({ clientId: o2, scope: i2, audience: n2 }, t2);
  }
  static fromCacheEntry(e2) {
    const { scope: t2, audience: o2, client_id: n2 } = e2;
    return new _oe({ scope: t2, audience: o2, clientId: n2 });
  }
};
var ne = class {
  set(e2, t2) {
    localStorage.setItem(e2, JSON.stringify(t2));
  }
  get(e2) {
    const t2 = window.localStorage.getItem(e2);
    if (t2) try {
      return JSON.parse(t2);
    } catch (e3) {
      return;
    }
  }
  remove(e2) {
    localStorage.removeItem(e2);
  }
  allKeys() {
    return Object.keys(window.localStorage).filter(((e2) => e2.startsWith("@@auth0spajs@@")));
  }
};
var ie = class {
  constructor() {
    this.enclosedCache = /* @__PURE__ */ (function() {
      let e2 = {};
      return { set(t2, o2) {
        e2[t2] = o2;
      }, get(t2) {
        const o2 = e2[t2];
        if (o2) return o2;
      }, remove(t2) {
        delete e2[t2];
      }, allKeys: () => Object.keys(e2) };
    })();
  }
};
var re = class {
  constructor(e2, t2, o2) {
    this.cache = e2, this.keyManifest = t2, this.nowProvider = o2 || c;
  }
  async setIdToken(e2, t2, o2) {
    var n2;
    const i2 = this.getIdTokenCacheKey(e2);
    await this.cache.set(i2, { id_token: t2, decodedToken: o2 }), await (null === (n2 = this.keyManifest) || void 0 === n2 ? void 0 : n2.add(i2));
  }
  async getIdToken(e2) {
    const t2 = await this.cache.get(this.getIdTokenCacheKey(e2.clientId));
    if (!t2 && e2.scope && e2.audience) {
      const t3 = await this.get(e2);
      if (!t3) return;
      if (!t3.id_token || !t3.decodedToken) return;
      return { id_token: t3.id_token, decodedToken: t3.decodedToken };
    }
    if (t2) return { id_token: t2.id_token, decodedToken: t2.decodedToken };
  }
  async get(e2, t2 = 0, o2 = false, n2) {
    var i2;
    let r2 = await this.cache.get(e2.toKey());
    if (!r2) {
      const t3 = await this.getCacheKeys();
      if (!t3) return;
      const i3 = this.matchExistingCacheKey(e2, t3);
      if (i3 && (r2 = await this.cache.get(i3)), !i3 && o2 && "cache-only" !== n2) return this.getEntryWithRefreshToken(e2, t3);
    }
    if (!r2) return;
    const s2 = await this.nowProvider(), a2 = Math.floor(s2 / 1e3);
    return r2.expiresAt - t2 < a2 ? r2.body.refresh_token ? this.modifiedCachedEntry(r2, e2) : (await this.cache.remove(e2.toKey()), void await (null === (i2 = this.keyManifest) || void 0 === i2 ? void 0 : i2.remove(e2.toKey()))) : r2.body;
  }
  async modifiedCachedEntry(e2, t2) {
    return e2.body = { refresh_token: e2.body.refresh_token, audience: e2.body.audience, scope: e2.body.scope }, await this.cache.set(t2.toKey(), e2), { refresh_token: e2.body.refresh_token, audience: e2.body.audience, scope: e2.body.scope };
  }
  async set(e2) {
    var t2;
    const o2 = new oe({ clientId: e2.client_id, scope: e2.scope, audience: e2.audience }), n2 = await this.wrapCacheEntry(e2);
    await this.cache.set(o2.toKey(), n2), await (null === (t2 = this.keyManifest) || void 0 === t2 ? void 0 : t2.add(o2.toKey()));
  }
  async remove(e2, t2, o2) {
    const n2 = new oe({ clientId: e2, scope: o2, audience: t2 });
    await this.cache.remove(n2.toKey());
  }
  async clear(e2) {
    var t2;
    const o2 = await this.getCacheKeys();
    o2 && (await o2.filter(((t3) => !e2 || t3.includes(e2))).reduce((async (e3, t3) => {
      await e3, await this.cache.remove(t3);
    }), Promise.resolve()), await (null === (t2 = this.keyManifest) || void 0 === t2 ? void 0 : t2.clear()));
  }
  async wrapCacheEntry(e2) {
    const t2 = await this.nowProvider();
    return { body: e2, expiresAt: Math.floor(t2 / 1e3) + e2.expires_in };
  }
  async getCacheKeys() {
    var e2;
    return this.keyManifest ? null === (e2 = await this.keyManifest.get()) || void 0 === e2 ? void 0 : e2.keys : this.cache.allKeys ? this.cache.allKeys() : void 0;
  }
  getIdTokenCacheKey(e2) {
    return new oe({ clientId: e2 }, "@@auth0spajs@@", "@@user@@").toKey();
  }
  matchExistingCacheKey(e2, t2) {
    return t2.filter(((t3) => {
      var o2;
      const n2 = oe.fromKey(t3), i2 = new Set(n2.scope && n2.scope.split(" ")), r2 = (null === (o2 = e2.scope) || void 0 === o2 ? void 0 : o2.split(" ")) || [], s2 = n2.scope && r2.reduce(((e3, t4) => e3 && i2.has(t4)), true);
      return "@@auth0spajs@@" === n2.prefix && n2.clientId === e2.clientId && n2.audience === e2.audience && s2;
    }))[0];
  }
  async getEntryWithRefreshToken(e2, t2) {
    var o2;
    for (const n2 of t2) {
      const t3 = oe.fromKey(n2);
      if ("@@auth0spajs@@" === t3.prefix && t3.clientId === e2.clientId) {
        const t4 = await this.cache.get(n2);
        if (null === (o2 = null == t4 ? void 0 : t4.body) || void 0 === o2 ? void 0 : o2.refresh_token) return this.modifiedCachedEntry(t4, e2);
      }
    }
  }
  async updateEntry(e2, t2) {
    var o2;
    const n2 = await this.getCacheKeys();
    if (n2) for (const i2 of n2) {
      const n3 = await this.cache.get(i2);
      if ((null === (o2 = null == n3 ? void 0 : n3.body) || void 0 === o2 ? void 0 : o2.refresh_token) === e2) {
        const e3 = Object.assign(Object.assign({}, n3.body), { refresh_token: t2 });
        await this.set(e3);
      }
    }
  }
};
var se = class {
  constructor(e2, t2, o2) {
    this.storage = e2, this.clientId = t2, this.cookieDomain = o2, this.storageKey = `a0.spajs.txs.${this.clientId}`;
  }
  create(e2) {
    this.storage.save(this.storageKey, e2, { daysUntilExpire: 1, cookieDomain: this.cookieDomain });
  }
  get() {
    return this.storage.get(this.storageKey);
  }
  remove() {
    this.storage.remove(this.storageKey, { cookieDomain: this.cookieDomain });
  }
};
var ae = (e2) => "number" == typeof e2;
var ce = ["iss", "aud", "exp", "nbf", "iat", "jti", "azp", "nonce", "auth_time", "at_hash", "c_hash", "acr", "amr", "sub_jwk", "cnf", "sip_from_tag", "sip_date", "sip_callid", "sip_cseq_num", "sip_via_branch", "orig", "dest", "mky", "events", "toe", "txn", "rph", "sid", "vot", "vtm"];
var ue = (e2) => {
  if (!e2.id_token) throw new Error("ID token is required but missing");
  const t2 = ((e3) => {
    const t3 = e3.split("."), [o3, n3, i3] = t3;
    if (3 !== t3.length || !o3 || !n3 || !i3) throw new Error("ID token could not be decoded");
    const r2 = JSON.parse(j(n3)), s2 = { __raw: e3 }, a2 = {};
    return Object.keys(r2).forEach(((e4) => {
      s2[e4] = r2[e4], ce.includes(e4) || (a2[e4] = r2[e4]);
    })), { encoded: { header: o3, payload: n3, signature: i3 }, header: JSON.parse(j(o3)), claims: s2, user: a2 };
  })(e2.id_token);
  if (!t2.claims.iss) throw new Error("Issuer (iss) claim must be a string present in the ID token");
  if (t2.claims.iss !== e2.iss) throw new Error(`Issuer (iss) claim mismatch in the ID token; expected "${e2.iss}", found "${t2.claims.iss}"`);
  if (!t2.user.sub) throw new Error("Subject (sub) claim must be a string present in the ID token");
  if ("RS256" !== t2.header.alg) throw new Error(`Signature algorithm of "${t2.header.alg}" is not supported. Expected the ID token to be signed with "RS256".`);
  if (!t2.claims.aud || "string" != typeof t2.claims.aud && !Array.isArray(t2.claims.aud)) throw new Error("Audience (aud) claim must be a string or array of strings present in the ID token");
  if (Array.isArray(t2.claims.aud)) {
    if (!t2.claims.aud.includes(e2.aud)) throw new Error(`Audience (aud) claim mismatch in the ID token; expected "${e2.aud}" but was not one of "${t2.claims.aud.join(", ")}"`);
    if (t2.claims.aud.length > 1) {
      if (!t2.claims.azp) throw new Error("Authorized Party (azp) claim must be a string present in the ID token when Audience (aud) claim has multiple values");
      if (t2.claims.azp !== e2.aud) throw new Error(`Authorized Party (azp) claim mismatch in the ID token; expected "${e2.aud}", found "${t2.claims.azp}"`);
    }
  } else if (t2.claims.aud !== e2.aud) throw new Error(`Audience (aud) claim mismatch in the ID token; expected "${e2.aud}" but found "${t2.claims.aud}"`);
  if (e2.nonce) {
    if (!t2.claims.nonce) throw new Error("Nonce (nonce) claim must be a string present in the ID token");
    if (t2.claims.nonce !== e2.nonce) throw new Error(`Nonce (nonce) claim mismatch in the ID token; expected "${e2.nonce}", found "${t2.claims.nonce}"`);
  }
  if (e2.max_age && !ae(t2.claims.auth_time)) throw new Error("Authentication Time (auth_time) claim must be a number present in the ID token when Max Age (max_age) is specified");
  if (null == t2.claims.exp || !ae(t2.claims.exp)) throw new Error("Expiration Time (exp) claim must be a number present in the ID token");
  if (!ae(t2.claims.iat)) throw new Error("Issued At (iat) claim must be a number present in the ID token");
  const o2 = e2.leeway || 60, n2 = new Date(e2.now || Date.now()), i2 = /* @__PURE__ */ new Date(0);
  if (i2.setUTCSeconds(t2.claims.exp + o2), n2 > i2) throw new Error(`Expiration Time (exp) claim error in the ID token; current time (${n2}) is after expiration time (${i2})`);
  if (null != t2.claims.nbf && ae(t2.claims.nbf)) {
    const e3 = /* @__PURE__ */ new Date(0);
    if (e3.setUTCSeconds(t2.claims.nbf - o2), n2 < e3) throw new Error(`Not Before time (nbf) claim in the ID token indicates that this token can't be used just yet. Current time (${n2}) is before ${e3}`);
  }
  if (null != t2.claims.auth_time && ae(t2.claims.auth_time)) {
    const i3 = /* @__PURE__ */ new Date(0);
    if (i3.setUTCSeconds(parseInt(t2.claims.auth_time) + e2.max_age + o2), n2 > i3) throw new Error(`Authentication Time (auth_time) claim in the ID token indicates that too much time has passed since the last end-user authentication. Current time (${n2}) is after last auth at ${i3}`);
  }
  if (e2.organization) {
    const o3 = e2.organization.trim();
    if (o3.startsWith("org_")) {
      const e3 = o3;
      if (!t2.claims.org_id) throw new Error("Organization ID (org_id) claim must be a string present in the ID token");
      if (e3 !== t2.claims.org_id) throw new Error(`Organization ID (org_id) claim mismatch in the ID token; expected "${e3}", found "${t2.claims.org_id}"`);
    } else {
      const e3 = o3.toLowerCase();
      if (!t2.claims.org_name) throw new Error("Organization Name (org_name) claim must be a string present in the ID token");
      if (e3 !== t2.claims.org_name) throw new Error(`Organization Name (org_name) claim mismatch in the ID token; expected "${e3}", found "${t2.claims.org_name}"`);
    }
  }
  return t2;
};
var de = n((function(e2, o2) {
  var n2 = t && t.__assign || function() {
    return n2 = Object.assign || function(e3) {
      for (var t2, o3 = 1, n3 = arguments.length; o3 < n3; o3++) for (var i3 in t2 = arguments[o3]) Object.prototype.hasOwnProperty.call(t2, i3) && (e3[i3] = t2[i3]);
      return e3;
    }, n2.apply(this, arguments);
  };
  function i2(e3, t2) {
    if (!t2) return "";
    var o3 = "; " + e3;
    return true === t2 ? o3 : o3 + "=" + t2;
  }
  function r2(e3, t2, o3) {
    return encodeURIComponent(e3).replace(/%(23|24|26|2B|5E|60|7C)/g, decodeURIComponent).replace(/\(/g, "%28").replace(/\)/g, "%29") + "=" + encodeURIComponent(t2).replace(/%(23|24|26|2B|3A|3C|3E|3D|2F|3F|40|5B|5D|5E|60|7B|7D|7C)/g, decodeURIComponent) + (function(e4) {
      if ("number" == typeof e4.expires) {
        var t3 = /* @__PURE__ */ new Date();
        t3.setMilliseconds(t3.getMilliseconds() + 864e5 * e4.expires), e4.expires = t3;
      }
      return i2("Expires", e4.expires ? e4.expires.toUTCString() : "") + i2("Domain", e4.domain) + i2("Path", e4.path) + i2("Secure", e4.secure) + i2("SameSite", e4.sameSite);
    })(o3);
  }
  function s2(e3) {
    for (var t2 = {}, o3 = e3 ? e3.split("; ") : [], n3 = /(%[\dA-F]{2})+/gi, i3 = 0; i3 < o3.length; i3++) {
      var r3 = o3[i3].split("="), s3 = r3.slice(1).join("=");
      '"' === s3.charAt(0) && (s3 = s3.slice(1, -1));
      try {
        t2[r3[0].replace(n3, decodeURIComponent)] = s3.replace(n3, decodeURIComponent);
      } catch (e4) {
      }
    }
    return t2;
  }
  function a2() {
    return s2(document.cookie);
  }
  function c2(e3, t2, o3) {
    document.cookie = r2(e3, t2, n2({ path: "/" }, o3));
  }
  o2.__esModule = true, o2.encode = r2, o2.parse = s2, o2.getAll = a2, o2.get = function(e3) {
    return a2()[e3];
  }, o2.set = c2, o2.remove = function(e3, t2) {
    c2(e3, "", n2(n2({}, t2), { expires: -1 }));
  };
}));
o(de), de.encode, de.parse, de.getAll;
var he = de.get;
var le = de.set;
var pe = de.remove;
var me = { get(e2) {
  const t2 = he(e2);
  if (void 0 !== t2) return JSON.parse(t2);
}, save(e2, t2, o2) {
  let n2 = {};
  "https:" === window.location.protocol && (n2 = { secure: true, sameSite: "none" }), (null == o2 ? void 0 : o2.daysUntilExpire) && (n2.expires = o2.daysUntilExpire), (null == o2 ? void 0 : o2.cookieDomain) && (n2.domain = o2.cookieDomain), le(e2, JSON.stringify(t2), n2);
}, remove(e2, t2) {
  let o2 = {};
  (null == t2 ? void 0 : t2.cookieDomain) && (o2.domain = t2.cookieDomain), pe(e2, o2);
} };
var fe = { get(e2) {
  const t2 = me.get(e2);
  return t2 || me.get(`_legacy_${e2}`);
}, save(e2, t2, o2) {
  let n2 = {};
  "https:" === window.location.protocol && (n2 = { secure: true }), (null == o2 ? void 0 : o2.daysUntilExpire) && (n2.expires = o2.daysUntilExpire), (null == o2 ? void 0 : o2.cookieDomain) && (n2.domain = o2.cookieDomain), le(`_legacy_${e2}`, JSON.stringify(t2), n2), me.save(e2, t2, o2);
}, remove(e2, t2) {
  let o2 = {};
  (null == t2 ? void 0 : t2.cookieDomain) && (o2.domain = t2.cookieDomain), pe(e2, o2), me.remove(e2, t2), me.remove(`_legacy_${e2}`, t2);
} };
var ge = { get(e2) {
  if ("undefined" == typeof sessionStorage) return;
  const t2 = sessionStorage.getItem(e2);
  return null != t2 ? JSON.parse(t2) : void 0;
}, save(e2, t2) {
  sessionStorage.setItem(e2, JSON.stringify(t2));
}, remove(e2) {
  sessionStorage.removeItem(e2);
} };
var ye;
!(function(e2) {
  e2.Code = "code", e2.ConnectCode = "connect_code";
})(ye || (ye = {}));
var we = class {
};
function be(e2, t2, o2) {
  var n2 = void 0 === t2 ? null : t2, i2 = (function(e3, t3) {
    var o3 = atob(e3);
    if (t3) {
      for (var n3 = new Uint8Array(o3.length), i3 = 0, r3 = o3.length; i3 < r3; ++i3) n3[i3] = o3.charCodeAt(i3);
      return String.fromCharCode.apply(null, new Uint16Array(n3.buffer));
    }
    return o3;
  })(e2, void 0 !== o2 && o2), r2 = i2.indexOf("\n", 10) + 1, s2 = i2.substring(r2) + (n2 ? "//# sourceMappingURL=" + n2 : ""), a2 = new Blob([s2], { type: "application/javascript" });
  return URL.createObjectURL(a2);
}
var ke;
var ve;
var _e;
var Se;
var Ie = (ke = "Lyogcm9sbHVwLXBsdWdpbi13ZWItd29ya2VyLWxvYWRlciAqLwohZnVuY3Rpb24oKXsidXNlIHN0cmljdCI7Y2xhc3MgZSBleHRlbmRzIEVycm9ye2NvbnN0cnVjdG9yKHQscil7c3VwZXIociksdGhpcy5lcnJvcj10LHRoaXMuZXJyb3JfZGVzY3JpcHRpb249cixPYmplY3Quc2V0UHJvdG90eXBlT2YodGhpcyxlLnByb3RvdHlwZSl9c3RhdGljIGZyb21QYXlsb2FkKHtlcnJvcjp0LGVycm9yX2Rlc2NyaXB0aW9uOnJ9KXtyZXR1cm4gbmV3IGUodCxyKX19Y2xhc3MgdCBleHRlbmRzIGV7Y29uc3RydWN0b3IoZSxzKXtzdXBlcigibWlzc2luZ19yZWZyZXNoX3Rva2VuIixgTWlzc2luZyBSZWZyZXNoIFRva2VuIChhdWRpZW5jZTogJyR7cihlLFsiZGVmYXVsdCJdKX0nLCBzY29wZTogJyR7cihzKX0nKWApLHRoaXMuYXVkaWVuY2U9ZSx0aGlzLnNjb3BlPXMsT2JqZWN0LnNldFByb3RvdHlwZU9mKHRoaXMsdC5wcm90b3R5cGUpfX1mdW5jdGlvbiByKGUsdD1bXSl7cmV0dXJuIGUmJiF0LmluY2x1ZGVzKGUpP2U6IiJ9ImZ1bmN0aW9uIj09dHlwZW9mIFN1cHByZXNzZWRFcnJvciYmU3VwcHJlc3NlZEVycm9yO2NvbnN0IHM9ZT0+e3ZhcntjbGllbnRJZDp0fT1lLHI9ZnVuY3Rpb24oZSx0KXt2YXIgcj17fTtmb3IodmFyIHMgaW4gZSlPYmplY3QucHJvdG90eXBlLmhhc093blByb3BlcnR5LmNhbGwoZSxzKSYmdC5pbmRleE9mKHMpPDAmJihyW3NdPWVbc10pO2lmKG51bGwhPWUmJiJmdW5jdGlvbiI9PXR5cGVvZiBPYmplY3QuZ2V0T3duUHJvcGVydHlTeW1ib2xzKXt2YXIgbz0wO2ZvcihzPU9iamVjdC5nZXRPd25Qcm9wZXJ0eVN5bWJvbHMoZSk7bzxzLmxlbmd0aDtvKyspdC5pbmRleE9mKHNbb10pPDAmJk9iamVjdC5wcm90b3R5cGUucHJvcGVydHlJc0VudW1lcmFibGUuY2FsbChlLHNbb10pJiYocltzW29dXT1lW3Nbb11dKX1yZXR1cm4gcn0oZSxbImNsaWVudElkIl0pO3JldHVybiBuZXcgVVJMU2VhcmNoUGFyYW1zKChlPT5PYmplY3Qua2V5cyhlKS5maWx0ZXIoKHQ9PnZvaWQgMCE9PWVbdF0pKS5yZWR1Y2UoKCh0LHIpPT5PYmplY3QuYXNzaWduKE9iamVjdC5hc3NpZ24oe30sdCkse1tyXTplW3JdfSkpLHt9KSkoT2JqZWN0LmFzc2lnbih7Y2xpZW50X2lkOnR9LHIpKSkudG9TdHJpbmcoKX07bGV0IG89e307Y29uc3Qgbj0oZSx0KT0+YCR7ZX18JHt0fWA7YWRkRXZlbnRMaXN0ZW5lcigibWVzc2FnZSIsKGFzeW5jKHtkYXRhOnt0aW1lb3V0OmUsYXV0aDpyLGZldGNoVXJsOmksZmV0Y2hPcHRpb25zOmMsdXNlRm9ybURhdGE6YSx1c2VNcnJ0OmZ9LHBvcnRzOltwXX0pPT57bGV0IGgsdSxsPXt9O2NvbnN0e2F1ZGllbmNlOmQsc2NvcGU6eX09cnx8e307dHJ5e2NvbnN0IHI9YT8oZT0+e2NvbnN0IHQ9bmV3IFVSTFNlYXJjaFBhcmFtcyhlKSxyPXt9O3JldHVybiB0LmZvckVhY2goKChlLHQpPT57clt0XT1lfSkpLHJ9KShjLmJvZHkpOkpTT04ucGFyc2UoYy5ib2R5KTtpZighci5yZWZyZXNoX3Rva2VuJiYicmVmcmVzaF90b2tlbiI9PT1yLmdyYW50X3R5cGUpe2lmKHU9KChlLHQpPT5vW24oZSx0KV0pKGQseSksIXUmJmYpe2NvbnN0IGU9by5sYXRlc3RfcmVmcmVzaF90b2tlbix0PSgoZSx0KT0+e2NvbnN0IHI9T2JqZWN0LmtleXMobykuZmluZCgocj0+e2lmKCJsYXRlc3RfcmVmcmVzaF90b2tlbiIhPT1yKXtjb25zdCBzPSgoZSx0KT0+dC5zdGFydHNXaXRoKGAke2V9fGApKSh0LHIpLG89ci5zcGxpdCgifCIpWzFdLnNwbGl0KCIgIiksbj1lLnNwbGl0KCIgIikuZXZlcnkoKGU9Pm8uaW5jbHVkZXMoZSkpKTtyZXR1cm4gcyYmbn19KSk7cmV0dXJuISFyfSkoeSxkKTtlJiYhdCYmKHU9ZSl9aWYoIXUpdGhyb3cgbmV3IHQoZCx5KTtjLmJvZHk9YT9zKE9iamVjdC5hc3NpZ24oT2JqZWN0LmFzc2lnbih7fSxyKSx7cmVmcmVzaF90b2tlbjp1fSkpOkpTT04uc3RyaW5naWZ5KE9iamVjdC5hc3NpZ24oT2JqZWN0LmFzc2lnbih7fSxyKSx7cmVmcmVzaF90b2tlbjp1fSkpfWxldCBqLGs7ImZ1bmN0aW9uIj09dHlwZW9mIEFib3J0Q29udHJvbGxlciYmKGo9bmV3IEFib3J0Q29udHJvbGxlcixjLnNpZ25hbD1qLnNpZ25hbCk7dHJ5e2s9YXdhaXQgUHJvbWlzZS5yYWNlKFsoXz1lLG5ldyBQcm9taXNlKChlPT5zZXRUaW1lb3V0KGUsXykpKSksZmV0Y2goaSxPYmplY3QuYXNzaWduKHt9LGMpKV0pfWNhdGNoKGUpe3JldHVybiB2b2lkIHAucG9zdE1lc3NhZ2Uoe2Vycm9yOmUubWVzc2FnZX0pfWlmKCFrKXJldHVybiBqJiZqLmFib3J0KCksdm9pZCBwLnBvc3RNZXNzYWdlKHtlcnJvcjoiVGltZW91dCB3aGVuIGV4ZWN1dGluZyAnZmV0Y2gnIn0pO2c9ay5oZWFkZXJzLGw9Wy4uLmddLnJlZHVjZSgoKGUsW3Qscl0pPT4oZVt0XT1yLGUpKSx7fSksaD1hd2FpdCBrLmpzb24oKSxoLnJlZnJlc2hfdG9rZW4/KGYmJihvLmxhdGVzdF9yZWZyZXNoX3Rva2VuPWgucmVmcmVzaF90b2tlbixPPXUsYj1oLnJlZnJlc2hfdG9rZW4sT2JqZWN0LmVudHJpZXMobykuZm9yRWFjaCgoKFtlLHRdKT0+e3Q9PT1PJiYob1tlXT1iKX0pKSksKChlLHQscik9PntvW24odCxyKV09ZX0pKGgucmVmcmVzaF90b2tlbixkLHkpLGRlbGV0ZSBoLnJlZnJlc2hfdG9rZW4pOigoZSx0KT0+e2RlbGV0ZSBvW24oZSx0KV19KShkLHkpLHAucG9zdE1lc3NhZ2Uoe29rOmsub2ssanNvbjpoLGhlYWRlcnM6bH0pfWNhdGNoKGUpe3AucG9zdE1lc3NhZ2Uoe29rOiExLGpzb246e2Vycm9yOmUuZXJyb3IsZXJyb3JfZGVzY3JpcHRpb246ZS5tZXNzYWdlfSxoZWFkZXJzOmx9KX12YXIgTyxiLGcsX30pKX0oKTsKCg==", ve = null, _e = false, function(e2) {
  return Se = Se || be(ke, ve, _e), new Worker(Se, e2);
});
var Pe = {};
var Te = class {
  constructor(e2, t2) {
    this.cache = e2, this.clientId = t2, this.manifestKey = this.createManifestKeyFrom(this.clientId);
  }
  async add(e2) {
    var t2;
    const o2 = new Set((null === (t2 = await this.cache.get(this.manifestKey)) || void 0 === t2 ? void 0 : t2.keys) || []);
    o2.add(e2), await this.cache.set(this.manifestKey, { keys: [...o2] });
  }
  async remove(e2) {
    const t2 = await this.cache.get(this.manifestKey);
    if (t2) {
      const o2 = new Set(t2.keys);
      return o2.delete(e2), o2.size > 0 ? await this.cache.set(this.manifestKey, { keys: [...o2] }) : await this.cache.remove(this.manifestKey);
    }
  }
  get() {
    return this.cache.get(this.manifestKey);
  }
  clear() {
    return this.cache.remove(this.manifestKey);
  }
  createManifestKeyFrom(e2) {
    return `@@auth0spajs@@::${e2}`;
  }
};
var Oe = { memory: () => new ie().enclosedCache, localstorage: () => new ne() };
var je = (e2) => Oe[e2];
var Ce = (t2) => {
  const { openUrl: o2, onRedirect: n2 } = t2, i2 = e(t2, ["openUrl", "onRedirect"]);
  return Object.assign(Object.assign({}, i2), { openUrl: false === o2 || o2 ? o2 : n2 });
};
var Ke = (e2, t2) => {
  const o2 = (null == t2 ? void 0 : t2.split(" ")) || [];
  return ((null == e2 ? void 0 : e2.split(" ")) || []).every(((e3) => o2.includes(e3)));
};
var xe = { NONCE: "nonce", KEYPAIR: "keypair" };
var ze = class {
  constructor(e2) {
    this.clientId = e2;
  }
  getVersion() {
    return 1;
  }
  createDbHandle() {
    const e2 = window.indexedDB.open("auth0-spa-js", this.getVersion());
    return new Promise(((t2, o2) => {
      e2.onupgradeneeded = () => Object.values(xe).forEach(((t3) => e2.result.createObjectStore(t3))), e2.onerror = () => o2(e2.error), e2.onsuccess = () => t2(e2.result);
    }));
  }
  async getDbHandle() {
    return this.dbHandle || (this.dbHandle = await this.createDbHandle()), this.dbHandle;
  }
  async executeDbRequest(e2, t2, o2) {
    const n2 = o2((await this.getDbHandle()).transaction(e2, t2).objectStore(e2));
    return new Promise(((e3, t3) => {
      n2.onsuccess = () => e3(n2.result), n2.onerror = () => t3(n2.error);
    }));
  }
  buildKey(e2) {
    const t2 = e2 ? `_${e2}` : "auth0";
    return `${this.clientId}::${t2}`;
  }
  setNonce(e2, t2) {
    return this.save(xe.NONCE, this.buildKey(t2), e2);
  }
  setKeyPair(e2) {
    return this.save(xe.KEYPAIR, this.buildKey(), e2);
  }
  async save(e2, t2, o2) {
    await this.executeDbRequest(e2, "readwrite", ((e3) => e3.put(o2, t2)));
  }
  findNonce(e2) {
    return this.find(xe.NONCE, this.buildKey(e2));
  }
  findKeyPair() {
    return this.find(xe.KEYPAIR, this.buildKey());
  }
  find(e2, t2) {
    return this.executeDbRequest(e2, "readonly", ((e3) => e3.get(t2)));
  }
  async deleteBy(e2, t2) {
    const o2 = await this.executeDbRequest(e2, "readonly", ((e3) => e3.getAllKeys()));
    null == o2 || o2.filter(t2).map(((t3) => this.executeDbRequest(e2, "readwrite", ((e3) => e3.delete(t3)))));
  }
  deleteByClientId(e2, t2) {
    return this.deleteBy(e2, ((e3) => "string" == typeof e3 && e3.startsWith(`${t2}::`)));
  }
  clearNonces() {
    return this.deleteByClientId(xe.NONCE, this.clientId);
  }
  clearKeyPairs() {
    return this.deleteByClientId(xe.KEYPAIR, this.clientId);
  }
};
var Ee = class {
  constructor(e2) {
    this.storage = new ze(e2);
  }
  getNonce(e2) {
    return this.storage.findNonce(e2);
  }
  setNonce(e2, t2) {
    return this.storage.setNonce(e2, t2);
  }
  async getOrGenerateKeyPair() {
    let e2 = await this.storage.findKeyPair();
    return e2 || (e2 = await V(), await this.storage.setKeyPair(e2)), e2;
  }
  async generateProof(e2) {
    const t2 = await this.getOrGenerateKeyPair();
    return G(Object.assign({ keyPair: t2 }, e2));
  }
  async calculateThumbprint() {
    return F(await this.getOrGenerateKeyPair());
  }
  async clear() {
    await Promise.all([this.storage.clearNonces(), this.storage.clearKeyPairs()]);
  }
};
var Ne;
!(function(e2) {
  e2.Bearer = "Bearer", e2.DPoP = "DPoP";
})(Ne || (Ne = {}));
var Re = class {
  constructor(e2, t2) {
    this.hooks = t2, this.config = Object.assign(Object.assign({}, e2), { fetch: e2.fetch || ("undefined" == typeof window ? fetch : window.fetch.bind(window)) });
  }
  isAbsoluteUrl(e2) {
    return /^(https?:)?\/\//i.test(e2);
  }
  buildUrl(e2, t2) {
    if (t2) {
      if (this.isAbsoluteUrl(t2)) return t2;
      if (e2) return `${e2.replace(/\/?\/$/, "")}/${t2.replace(/^\/+/, "")}`;
    }
    throw new TypeError("`url` must be absolute or `baseUrl` non-empty.");
  }
  getAccessToken(e2) {
    return this.config.getAccessToken ? this.config.getAccessToken(e2) : this.hooks.getAccessToken(e2);
  }
  extractUrl(e2) {
    return "string" == typeof e2 ? e2 : e2 instanceof URL ? e2.href : e2.url;
  }
  buildBaseRequest(e2, t2) {
    if (!this.config.baseUrl) return new Request(e2, t2);
    const o2 = this.buildUrl(this.config.baseUrl, this.extractUrl(e2)), n2 = e2 instanceof Request ? new Request(o2, e2) : o2;
    return new Request(n2, t2);
  }
  setAuthorizationHeader(e2, t2, o2 = Ne.Bearer) {
    e2.headers.set("authorization", `${o2} ${t2}`);
  }
  async setDpopProofHeader(e2, t2) {
    if (!this.config.dpopNonceId) return;
    const o2 = await this.hooks.getDpopNonce(), n2 = await this.hooks.generateDpopProof({ accessToken: t2, method: e2.method, nonce: o2, url: e2.url });
    e2.headers.set("dpop", n2);
  }
  async prepareRequest(e2, t2) {
    const o2 = await this.getAccessToken(t2);
    let n2, i2;
    "string" == typeof o2 ? (n2 = this.config.dpopNonceId ? Ne.DPoP : Ne.Bearer, i2 = o2) : (n2 = o2.token_type, i2 = o2.access_token), this.setAuthorizationHeader(e2, i2, n2), n2 === Ne.DPoP && await this.setDpopProofHeader(e2, i2);
  }
  getHeader(e2, t2) {
    return Array.isArray(e2) ? new Headers(e2).get(t2) || "" : "function" == typeof e2.get ? e2.get(t2) || "" : e2[t2] || "";
  }
  hasUseDpopNonceError(e2) {
    if (401 !== e2.status) return false;
    const t2 = this.getHeader(e2.headers, "www-authenticate");
    return t2.includes("invalid_dpop_nonce") || t2.includes("use_dpop_nonce");
  }
  async handleResponse(e2, t2) {
    const o2 = this.getHeader(e2.headers, "dpop-nonce");
    if (o2 && await this.hooks.setDpopNonce(o2), !this.hasUseDpopNonceError(e2)) return e2;
    if (!o2 || !t2.onUseDpopNonceError) throw new b(o2);
    return t2.onUseDpopNonceError();
  }
  async internalFetchWithAuth(e2, t2, o2, n2) {
    const i2 = this.buildBaseRequest(e2, t2);
    await this.prepareRequest(i2, n2);
    const r2 = await this.config.fetch(i2);
    return this.handleResponse(r2, o2);
  }
  fetchWithAuth(e2, t2, o2) {
    const n2 = { onUseDpopNonceError: () => this.internalFetchWithAuth(e2, t2, Object.assign(Object.assign({}, n2), { onUseDpopNonceError: void 0 }), o2) };
    return this.internalFetchWithAuth(e2, t2, n2, o2);
  }
};
var De = class {
  constructor(e2, t2) {
    this.myAccountFetcher = e2, this.apiBase = t2;
  }
  async connectAccount(e2) {
    const t2 = await this.myAccountFetcher.fetchWithAuth(`${this.apiBase}v1/connected-accounts/connect`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(e2) });
    return this._handleResponse(t2);
  }
  async completeAccount(e2) {
    const t2 = await this.myAccountFetcher.fetchWithAuth(`${this.apiBase}v1/connected-accounts/complete`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(e2) });
    return this._handleResponse(t2);
  }
  async _handleResponse(e2) {
    let t2;
    try {
      t2 = await e2.text(), t2 = JSON.parse(t2);
    } catch (o2) {
      throw new Ae({ type: "invalid_json", status: e2.status, title: "Invalid JSON response", detail: t2 || String(o2) });
    }
    if (e2.ok) return t2;
    throw new Ae(t2);
  }
};
var Ae = class _Ae extends Error {
  constructor({ type: e2, status: t2, title: o2, detail: n2, validation_errors: i2 }) {
    super(n2), this.name = "MyAccountApiError", this.type = e2, this.status = t2, this.title = o2, this.detail = n2, this.validation_errors = i2, Object.setPrototypeOf(this, _Ae.prototype);
  }
};
var Ue = new r();
var Le = class {
  constructor(e2) {
    let t2, o2;
    if (this.userCache = new ie().enclosedCache, this.activeLockKeys = /* @__PURE__ */ new Set(), this.defaultOptions = { authorizationParams: { scope: "openid profile email" }, useRefreshTokensFallback: false, useFormData: true }, this._releaseLockOnPageHide = async () => {
      const e3 = Array.from(this.activeLockKeys);
      for (const t3 of e3) await Ue.releaseLock(t3);
      this.activeLockKeys.clear(), window.removeEventListener("pagehide", this._releaseLockOnPageHide);
    }, this.options = Object.assign(Object.assign(Object.assign({}, this.defaultOptions), e2), { authorizationParams: Object.assign(Object.assign({}, this.defaultOptions.authorizationParams), e2.authorizationParams) }), "undefined" != typeof window && (() => {
      if (!v()) throw new Error("For security reasons, `window.crypto` is required to run `auth0-spa-js`.");
      if (void 0 === v().subtle) throw new Error("\n      auth0-spa-js must run on a secure origin. See https://github.com/auth0/auth0-spa-js/blob/main/FAQ.md#why-do-i-get-auth0-spa-js-must-run-on-a-secure-origin for more information.\n    ");
    })(), e2.cache && e2.cacheLocation && console.warn("Both `cache` and `cacheLocation` options have been specified in the Auth0Client configuration; ignoring `cacheLocation` and using `cache`."), e2.cache) o2 = e2.cache;
    else {
      if (t2 = e2.cacheLocation || "memory", !je(t2)) throw new Error(`Invalid cache location "${t2}"`);
      o2 = je(t2)();
    }
    this.httpTimeoutMs = e2.httpTimeoutInSeconds ? 1e3 * e2.httpTimeoutInSeconds : 1e4, this.cookieStorage = false === e2.legacySameSiteCookie ? me : fe, this.orgHintCookieName = `auth0.${this.options.clientId}.organization_hint`, this.isAuthenticatedCookieName = ((e3) => `auth0.${e3}.is.authenticated`)(this.options.clientId), this.sessionCheckExpiryDays = e2.sessionCheckExpiryDays || 1;
    const n2 = e2.useCookiesForTransactions ? this.cookieStorage : ge;
    var i2;
    this.scope = ((e3, t3, ...o3) => {
      if ("object" != typeof e3) return { default: ee(t3, e3, ...o3) };
      let n3 = { default: ee(t3, ...o3) };
      return Object.keys(e3).forEach(((i3) => {
        const r3 = e3[i3];
        n3[i3] = ee(t3, r3, ...o3);
      })), n3;
    })(this.options.authorizationParams.scope, "openid", this.options.useRefreshTokens ? "offline_access" : ""), this.transactionManager = new se(n2, this.options.clientId, this.options.cookieDomain), this.nowProvider = this.options.nowProvider || c, this.cacheManager = new re(o2, o2.allKeys ? void 0 : new Te(o2, this.options.clientId), this.nowProvider), this.dpop = this.options.useDpop ? new Ee(this.options.clientId) : void 0, this.domainUrl = (i2 = this.options.domain, /^https?:\/\//.test(i2) ? i2 : `https://${i2}`), this.tokenIssuer = ((e3, t3) => e3 ? e3.startsWith("https://") ? e3 : `https://${e3}/` : `${t3}/`)(this.options.issuer, this.domainUrl);
    const r2 = `${this.domainUrl}/me/`, s2 = this.createFetcher(Object.assign(Object.assign({}, this.options.useDpop && { dpopNonceId: "__auth0_my_account_api__" }), { getAccessToken: () => this.getTokenSilently({ authorizationParams: { scope: "create:me:connected_accounts", audience: r2 }, detailedResponse: true }) }));
    this.myAccountApi = new De(s2, r2), "undefined" != typeof window && window.Worker && this.options.useRefreshTokens && "memory" === t2 && (this.options.workerUrl ? this.worker = new Worker(this.options.workerUrl) : this.worker = new Ie());
  }
  _url(e2) {
    const t2 = encodeURIComponent(btoa(JSON.stringify(this.options.auth0Client || a)));
    return `${this.domainUrl}${e2}&auth0Client=${t2}`;
  }
  _authorizeUrl(e2) {
    return this._url(`/authorize?${T(e2)}`);
  }
  async _verifyIdToken(e2, t2, o2) {
    const n2 = await this.nowProvider();
    return ue({ iss: this.tokenIssuer, aud: this.options.clientId, id_token: e2, nonce: t2, organization: o2, leeway: this.options.leeway, max_age: (i2 = this.options.authorizationParams.max_age, "string" != typeof i2 ? i2 : parseInt(i2, 10) || void 0), now: n2 });
    var i2;
  }
  _processOrgHint(e2) {
    e2 ? this.cookieStorage.save(this.orgHintCookieName, e2, { daysUntilExpire: this.sessionCheckExpiryDays, cookieDomain: this.options.cookieDomain }) : this.cookieStorage.remove(this.orgHintCookieName, { cookieDomain: this.options.cookieDomain });
  }
  async _prepareAuthorizeUrl(e2, t2, o2) {
    var n2;
    const i2 = S(_()), r2 = S(_()), s2 = _(), a2 = await O(s2), c2 = C(a2), u2 = await (null === (n2 = this.dpop) || void 0 === n2 ? void 0 : n2.calculateThumbprint()), d2 = ((e3, t3, o3, n3, i3, r3, s3, a3, c3) => Object.assign(Object.assign(Object.assign({ client_id: e3.clientId }, e3.authorizationParams), o3), { scope: te(t3, o3.scope, o3.audience), response_type: "code", response_mode: a3 || "query", state: n3, nonce: i3, redirect_uri: s3 || e3.authorizationParams.redirect_uri, code_challenge: r3, code_challenge_method: "S256", dpop_jkt: c3 }))(this.options, this.scope, e2, i2, r2, c2, e2.redirect_uri || this.options.authorizationParams.redirect_uri || o2, null == t2 ? void 0 : t2.response_mode, u2), h2 = this._authorizeUrl(d2);
    return { nonce: r2, code_verifier: s2, scope: d2.scope, audience: d2.audience || "default", redirect_uri: d2.redirect_uri, state: i2, url: h2 };
  }
  async loginWithPopup(e2, t2) {
    var o2;
    if (e2 = e2 || {}, !(t2 = t2 || {}).popup && (t2.popup = ((e3) => {
      const t3 = window.screenX + (window.innerWidth - 400) / 2, o3 = window.screenY + (window.innerHeight - 600) / 2;
      return window.open(e3, "auth0:authorize:popup", `left=${t3},top=${o3},width=400,height=600,resizable,scrollbars=yes,status=1`);
    })(""), !t2.popup)) throw new f();
    const n2 = await this._prepareAuthorizeUrl(e2.authorizationParams || {}, { response_mode: "web_message" }, window.location.origin);
    t2.popup.location.href = n2.url;
    const i2 = await ((e3) => new Promise(((t3, o3) => {
      let n3;
      const i3 = setInterval((() => {
        e3.popup && e3.popup.closed && (clearInterval(i3), clearTimeout(r3), window.removeEventListener("message", n3, false), o3(new m(e3.popup)));
      }), 1e3), r3 = setTimeout((() => {
        clearInterval(i3), o3(new p(e3.popup)), window.removeEventListener("message", n3, false);
      }), 1e3 * (e3.timeoutInSeconds || 60));
      n3 = function(s2) {
        if (s2.data && "authorization_response" === s2.data.type) {
          if (clearTimeout(r3), clearInterval(i3), window.removeEventListener("message", n3, false), e3.popup.close(), s2.data.response.error) return o3(u.fromPayload(s2.data.response));
          t3(s2.data.response);
        }
      }, window.addEventListener("message", n3);
    })))(Object.assign(Object.assign({}, t2), { timeoutInSeconds: t2.timeoutInSeconds || this.options.authorizeTimeoutInSeconds || 60 }));
    if (n2.state !== i2.state) throw new u("state_mismatch", "Invalid state");
    const r2 = (null === (o2 = e2.authorizationParams) || void 0 === o2 ? void 0 : o2.organization) || this.options.authorizationParams.organization;
    await this._requestToken({ audience: n2.audience, scope: n2.scope, code_verifier: n2.code_verifier, grant_type: "authorization_code", code: i2.code, redirect_uri: n2.redirect_uri }, { nonceIn: n2.nonce, organization: r2 });
  }
  async getUser() {
    var e2;
    const t2 = await this._getIdTokenFromCache();
    return null === (e2 = null == t2 ? void 0 : t2.decodedToken) || void 0 === e2 ? void 0 : e2.user;
  }
  async getIdTokenClaims() {
    var e2;
    const t2 = await this._getIdTokenFromCache();
    return null === (e2 = null == t2 ? void 0 : t2.decodedToken) || void 0 === e2 ? void 0 : e2.claims;
  }
  async loginWithRedirect(t2 = {}) {
    var o2;
    const n2 = Ce(t2), { openUrl: i2, fragment: r2, appState: s2 } = n2, a2 = e(n2, ["openUrl", "fragment", "appState"]), c2 = (null === (o2 = a2.authorizationParams) || void 0 === o2 ? void 0 : o2.organization) || this.options.authorizationParams.organization, u2 = await this._prepareAuthorizeUrl(a2.authorizationParams || {}), { url: d2 } = u2, h2 = e(u2, ["url"]);
    this.transactionManager.create(Object.assign(Object.assign(Object.assign({}, h2), { appState: s2, response_type: ye.Code }), c2 && { organization: c2 }));
    const l2 = r2 ? `${d2}#${r2}` : d2;
    i2 ? await i2(l2) : window.location.assign(l2);
  }
  async handleRedirectCallback(e2 = window.location.href) {
    const t2 = e2.split("?").slice(1);
    if (0 === t2.length) throw new Error("There are no query params available for parsing.");
    const o2 = this.transactionManager.get();
    if (!o2) throw new u("missing_transaction", "Invalid state");
    this.transactionManager.remove();
    const n2 = ((e3) => {
      e3.indexOf("#") > -1 && (e3 = e3.substring(0, e3.indexOf("#")));
      const t3 = new URLSearchParams(e3);
      return { state: t3.get("state"), code: t3.get("code") || void 0, connect_code: t3.get("connect_code") || void 0, error: t3.get("error") || void 0, error_description: t3.get("error_description") || void 0 };
    })(t2.join(""));
    return o2.response_type === ye.ConnectCode ? this._handleConnectAccountRedirectCallback(n2, o2) : this._handleLoginRedirectCallback(n2, o2);
  }
  async _handleLoginRedirectCallback(e2, t2) {
    const { code: o2, state: n2, error: i2, error_description: r2 } = e2;
    if (i2) throw new d(i2, r2 || i2, n2, t2.appState);
    if (!t2.code_verifier || t2.state && t2.state !== n2) throw new u("state_mismatch", "Invalid state");
    const s2 = t2.organization, a2 = t2.nonce, c2 = t2.redirect_uri;
    return await this._requestToken(Object.assign({ audience: t2.audience, scope: t2.scope, code_verifier: t2.code_verifier, grant_type: "authorization_code", code: o2 }, c2 ? { redirect_uri: c2 } : {}), { nonceIn: a2, organization: s2 }), { appState: t2.appState, response_type: ye.Code };
  }
  async _handleConnectAccountRedirectCallback(e2, t2) {
    const { connect_code: o2, state: n2, error: i2, error_description: r2 } = e2;
    if (i2) throw new h(i2, r2 || i2, t2.connection, n2, t2.appState);
    if (!o2) throw new u("missing_connect_code", "Missing connect code");
    if (!(t2.code_verifier && t2.state && t2.auth_session && t2.redirect_uri && t2.state === n2)) throw new u("state_mismatch", "Invalid state");
    const s2 = await this.myAccountApi.completeAccount({ auth_session: t2.auth_session, connect_code: o2, redirect_uri: t2.redirect_uri, code_verifier: t2.code_verifier });
    return Object.assign(Object.assign({}, s2), { appState: t2.appState, response_type: ye.ConnectCode });
  }
  async checkSession(e2) {
    if (!this.cookieStorage.get(this.isAuthenticatedCookieName)) {
      if (!this.cookieStorage.get("auth0.is.authenticated")) return;
      this.cookieStorage.save(this.isAuthenticatedCookieName, true, { daysUntilExpire: this.sessionCheckExpiryDays, cookieDomain: this.options.cookieDomain }), this.cookieStorage.remove("auth0.is.authenticated");
    }
    try {
      await this.getTokenSilently(e2);
    } catch (e3) {
    }
  }
  async getTokenSilently(e2 = {}) {
    var t2, o2;
    const n2 = Object.assign(Object.assign({ cacheMode: "on" }, e2), { authorizationParams: Object.assign(Object.assign(Object.assign({}, this.options.authorizationParams), e2.authorizationParams), { scope: te(this.scope, null === (t2 = e2.authorizationParams) || void 0 === t2 ? void 0 : t2.scope, (null === (o2 = e2.authorizationParams) || void 0 === o2 ? void 0 : o2.audience) || this.options.authorizationParams.audience) }) }), i2 = await ((e3, t3) => {
      let o3 = Pe[t3];
      return o3 || (o3 = e3().finally((() => {
        delete Pe[t3], o3 = null;
      })), Pe[t3] = o3), o3;
    })((() => this._getTokenSilently(n2)), `${this.options.clientId}::${n2.authorizationParams.audience}::${n2.authorizationParams.scope}`);
    return e2.detailedResponse ? i2 : null == i2 ? void 0 : i2.access_token;
  }
  async _getTokenSilently(t2) {
    const { cacheMode: o2 } = t2, n2 = e(t2, ["cacheMode"]);
    if ("off" !== o2) {
      const e2 = await this._getEntryFromCache({ scope: n2.authorizationParams.scope, audience: n2.authorizationParams.audience || "default", clientId: this.options.clientId, cacheMode: o2 });
      if (e2) return e2;
    }
    if ("cache-only" === o2) return;
    const i2 = (r2 = this.options.clientId, s2 = n2.authorizationParams.audience || "default", `auth0.lock.getTokenSilently.${r2}.${s2}`);
    var r2, s2;
    if (!await (async (e2, t3 = 3) => {
      for (let o3 = 0; o3 < t3; o3++) if (await e2()) return true;
      return false;
    })((() => Ue.acquireLock(i2, 5e3)), 10)) throw new l();
    this.activeLockKeys.add(i2), 1 === this.activeLockKeys.size && window.addEventListener("pagehide", this._releaseLockOnPageHide);
    try {
      if ("off" !== o2) {
        const e3 = await this._getEntryFromCache({ scope: n2.authorizationParams.scope, audience: n2.authorizationParams.audience || "default", clientId: this.options.clientId });
        if (e3) return e3;
      }
      const e2 = this.options.useRefreshTokens ? await this._getTokenUsingRefreshToken(n2) : await this._getTokenFromIFrame(n2), { id_token: t3, token_type: r3, access_token: s3, oauthTokenScope: a2, expires_in: c2 } = e2;
      return Object.assign(Object.assign({ id_token: t3, token_type: r3, access_token: s3 }, a2 ? { scope: a2 } : null), { expires_in: c2 });
    } finally {
      await Ue.releaseLock(i2), this.activeLockKeys.delete(i2), 0 === this.activeLockKeys.size && window.removeEventListener("pagehide", this._releaseLockOnPageHide);
    }
  }
  async getTokenWithPopup(e2 = {}, t2 = {}) {
    var o2, n2;
    const i2 = Object.assign(Object.assign({}, e2), { authorizationParams: Object.assign(Object.assign(Object.assign({}, this.options.authorizationParams), e2.authorizationParams), { scope: te(this.scope, null === (o2 = e2.authorizationParams) || void 0 === o2 ? void 0 : o2.scope, (null === (n2 = e2.authorizationParams) || void 0 === n2 ? void 0 : n2.audience) || this.options.authorizationParams.audience) }) });
    t2 = Object.assign(Object.assign({}, s), t2), await this.loginWithPopup(i2, t2);
    return (await this.cacheManager.get(new oe({ scope: i2.authorizationParams.scope, audience: i2.authorizationParams.audience || "default", clientId: this.options.clientId }), void 0, this.options.useMrrt)).access_token;
  }
  async isAuthenticated() {
    return !!await this.getUser();
  }
  _buildLogoutUrl(t2) {
    null !== t2.clientId ? t2.clientId = t2.clientId || this.options.clientId : delete t2.clientId;
    const o2 = t2.logoutParams || {}, { federated: n2 } = o2, i2 = e(o2, ["federated"]), r2 = n2 ? "&federated" : "";
    return this._url(`/v2/logout?${T(Object.assign({ clientId: t2.clientId }, i2))}`) + r2;
  }
  async logout(t2 = {}) {
    var o2;
    const n2 = Ce(t2), { openUrl: i2 } = n2, r2 = e(n2, ["openUrl"]);
    null === t2.clientId ? await this.cacheManager.clear() : await this.cacheManager.clear(t2.clientId || this.options.clientId), this.cookieStorage.remove(this.orgHintCookieName, { cookieDomain: this.options.cookieDomain }), this.cookieStorage.remove(this.isAuthenticatedCookieName, { cookieDomain: this.options.cookieDomain }), this.userCache.remove("@@user@@"), await (null === (o2 = this.dpop) || void 0 === o2 ? void 0 : o2.clear());
    const s2 = this._buildLogoutUrl(r2);
    i2 ? await i2(s2) : false !== i2 && window.location.assign(s2);
  }
  async _getTokenFromIFrame(e2) {
    const t2 = Object.assign(Object.assign({}, e2.authorizationParams), { prompt: "none" }), o2 = this.cookieStorage.get(this.orgHintCookieName);
    o2 && !t2.organization && (t2.organization = o2);
    const { url: n2, state: i2, nonce: r2, code_verifier: s2, redirect_uri: a2, scope: c2, audience: d2 } = await this._prepareAuthorizeUrl(t2, { response_mode: "web_message" }, window.location.origin);
    try {
      if (window.crossOriginIsolated) throw new u("login_required", "The application is running in a Cross-Origin Isolated context, silently retrieving a token without refresh token is not possible.");
      const o3 = e2.timeoutInSeconds || this.options.authorizeTimeoutInSeconds;
      let h2;
      try {
        h2 = new URL(this.domainUrl).origin;
      } catch (e3) {
        h2 = this.domainUrl;
      }
      const p2 = await ((e3, t3, o4 = 60) => new Promise(((n3, i3) => {
        const r3 = window.document.createElement("iframe");
        r3.setAttribute("width", "0"), r3.setAttribute("height", "0"), r3.style.display = "none";
        const s3 = () => {
          window.document.body.contains(r3) && (window.document.body.removeChild(r3), window.removeEventListener("message", a3, false));
        };
        let a3;
        const c3 = setTimeout((() => {
          i3(new l()), s3();
        }), 1e3 * o4);
        a3 = function(e4) {
          if (e4.origin != t3) return;
          if (!e4.data || "authorization_response" !== e4.data.type) return;
          const o5 = e4.source;
          o5 && o5.close(), e4.data.response.error ? i3(u.fromPayload(e4.data.response)) : n3(e4.data.response), clearTimeout(c3), window.removeEventListener("message", a3, false), setTimeout(s3, 2e3);
        }, window.addEventListener("message", a3, false), window.document.body.appendChild(r3), r3.setAttribute("src", e3);
      })))(n2, h2, o3);
      if (i2 !== p2.state) throw new u("state_mismatch", "Invalid state");
      const m2 = await this._requestToken(Object.assign(Object.assign({}, e2.authorizationParams), { code_verifier: s2, code: p2.code, grant_type: "authorization_code", redirect_uri: a2, timeout: e2.authorizationParams.timeout || this.httpTimeoutMs }), { nonceIn: r2, organization: t2.organization });
      return Object.assign(Object.assign({}, m2), { scope: c2, oauthTokenScope: m2.scope, audience: d2 });
    } catch (e3) {
      throw "login_required" === e3.error && this.logout({ openUrl: false }), e3;
    }
  }
  async _getTokenUsingRefreshToken(e2) {
    const t2 = await this.cacheManager.get(new oe({ scope: e2.authorizationParams.scope, audience: e2.authorizationParams.audience || "default", clientId: this.options.clientId }), void 0, this.options.useMrrt);
    if (!(t2 && t2.refresh_token || this.worker)) {
      if (this.options.useRefreshTokensFallback) return await this._getTokenFromIFrame(e2);
      throw new y(e2.authorizationParams.audience || "default", e2.authorizationParams.scope);
    }
    const o2 = e2.authorizationParams.redirect_uri || this.options.authorizationParams.redirect_uri || window.location.origin, n2 = "number" == typeof e2.timeoutInSeconds ? 1e3 * e2.timeoutInSeconds : null, i2 = ((e3, t3, o3, n3) => {
      var i3;
      if (e3 && o3 && n3) {
        if (t3.audience !== o3) return t3.scope;
        const e4 = n3.split(" "), r3 = (null === (i3 = t3.scope) || void 0 === i3 ? void 0 : i3.split(" ")) || [], s3 = r3.every(((t4) => e4.includes(t4)));
        return e4.length >= r3.length && s3 ? n3 : t3.scope;
      }
      return t3.scope;
    })(this.options.useMrrt, e2.authorizationParams, null == t2 ? void 0 : t2.audience, null == t2 ? void 0 : t2.scope);
    try {
      const u2 = await this._requestToken(Object.assign(Object.assign(Object.assign({}, e2.authorizationParams), { grant_type: "refresh_token", refresh_token: t2 && t2.refresh_token, redirect_uri: o2 }), n2 && { timeout: n2 }), { scopesToRequest: i2 });
      if (u2.refresh_token && this.options.useMrrt && (null == t2 ? void 0 : t2.refresh_token) && await this.cacheManager.updateEntry(t2.refresh_token, u2.refresh_token), this.options.useMrrt) {
        if (r2 = null == t2 ? void 0 : t2.audience, s2 = null == t2 ? void 0 : t2.scope, a2 = e2.authorizationParams.audience, c2 = e2.authorizationParams.scope, r2 !== a2 || !Ke(c2, s2)) {
          if (!Ke(i2, u2.scope)) {
            if (this.options.useRefreshTokensFallback) return await this._getTokenFromIFrame(e2);
            await this.cacheManager.remove(this.options.clientId, e2.authorizationParams.audience, e2.authorizationParams.scope);
            const t3 = ((e3, t4) => {
              const o3 = (null == e3 ? void 0 : e3.split(" ")) || [], n3 = (null == t4 ? void 0 : t4.split(" ")) || [];
              return o3.filter(((e4) => -1 == n3.indexOf(e4))).join(",");
            })(i2, u2.scope);
            throw new w(e2.authorizationParams.audience || "default", t3);
          }
        }
      }
      return Object.assign(Object.assign({}, u2), { scope: e2.authorizationParams.scope, oauthTokenScope: u2.scope, audience: e2.authorizationParams.audience || "default" });
    } catch (t3) {
      if ((t3.message.indexOf("Missing Refresh Token") > -1 || t3.message && t3.message.indexOf("invalid refresh token") > -1) && this.options.useRefreshTokensFallback) return await this._getTokenFromIFrame(e2);
      throw t3;
    }
    var r2, s2, a2, c2;
  }
  async _saveEntryInCache(t2) {
    const { id_token: o2, decodedToken: n2 } = t2, i2 = e(t2, ["id_token", "decodedToken"]);
    this.userCache.set("@@user@@", { id_token: o2, decodedToken: n2 }), await this.cacheManager.setIdToken(this.options.clientId, t2.id_token, t2.decodedToken), await this.cacheManager.set(i2);
  }
  async _getIdTokenFromCache() {
    const e2 = this.options.authorizationParams.audience || "default", t2 = this.scope[e2], o2 = await this.cacheManager.getIdToken(new oe({ clientId: this.options.clientId, audience: e2, scope: t2 })), n2 = this.userCache.get("@@user@@");
    return o2 && o2.id_token === (null == n2 ? void 0 : n2.id_token) ? n2 : (this.userCache.set("@@user@@", o2), o2);
  }
  async _getEntryFromCache({ scope: e2, audience: t2, clientId: o2, cacheMode: n2 }) {
    const i2 = await this.cacheManager.get(new oe({ scope: e2, audience: t2, clientId: o2 }), 60, this.options.useMrrt, n2);
    if (i2 && i2.access_token) {
      const { token_type: e3, access_token: t3, oauthTokenScope: o3, expires_in: n3 } = i2, r2 = await this._getIdTokenFromCache();
      return r2 && Object.assign(Object.assign({ id_token: r2.id_token, token_type: e3 || "Bearer", access_token: t3 }, o3 ? { scope: o3 } : null), { expires_in: n3 });
    }
  }
  async _requestToken(e2, t2) {
    const { nonceIn: o2, organization: n2, scopesToRequest: i2 } = t2 || {}, r2 = await Q(Object.assign(Object.assign({ baseUrl: this.domainUrl, client_id: this.options.clientId, auth0Client: this.options.auth0Client, useFormData: this.options.useFormData, timeout: this.httpTimeoutMs, useMrrt: this.options.useMrrt, dpop: this.dpop }, e2), { scope: i2 || e2.scope }), this.worker), s2 = await this._verifyIdToken(r2.id_token, o2, n2);
    return await this._saveEntryInCache(Object.assign(Object.assign(Object.assign(Object.assign({}, r2), { decodedToken: s2, scope: e2.scope, audience: e2.audience || "default" }), r2.scope ? { oauthTokenScope: r2.scope } : null), { client_id: this.options.clientId })), this.cookieStorage.save(this.isAuthenticatedCookieName, true, { daysUntilExpire: this.sessionCheckExpiryDays, cookieDomain: this.options.cookieDomain }), this._processOrgHint(n2 || s2.claims.org_id), Object.assign(Object.assign({}, r2), { decodedToken: s2 });
  }
  async exchangeToken(e2) {
    return this._requestToken({ grant_type: "urn:ietf:params:oauth:grant-type:token-exchange", subject_token: e2.subject_token, subject_token_type: e2.subject_token_type, scope: te(this.scope, e2.scope, e2.audience || this.options.authorizationParams.audience), audience: e2.audience || this.options.authorizationParams.audience, organization: e2.organization || this.options.authorizationParams.organization });
  }
  _assertDpop(e2) {
    if (!e2) throw new Error("`useDpop` option must be enabled before using DPoP.");
  }
  getDpopNonce(e2) {
    return this._assertDpop(this.dpop), this.dpop.getNonce(e2);
  }
  setDpopNonce(e2, t2) {
    return this._assertDpop(this.dpop), this.dpop.setNonce(e2, t2);
  }
  generateDpopProof(e2) {
    return this._assertDpop(this.dpop), this.dpop.generateProof(e2);
  }
  createFetcher(e2 = {}) {
    return new Re(e2, { isDpopEnabled: () => !!this.options.useDpop, getAccessToken: (e3) => {
      var t2;
      return this.getTokenSilently({ authorizationParams: { scope: null === (t2 = null == e3 ? void 0 : e3.scope) || void 0 === t2 ? void 0 : t2.join(" "), audience: null == e3 ? void 0 : e3.audience }, detailedResponse: true });
    }, getDpopNonce: () => this.getDpopNonce(e2.dpopNonceId), setDpopNonce: (t2) => this.setDpopNonce(t2, e2.dpopNonceId), generateDpopProof: (e3) => this.generateDpopProof(e3) });
  }
  async connectAccountWithRedirect(e2) {
    const { openUrl: t2, appState: o2, connection: n2, scopes: i2, authorization_params: r2, redirectUri: s2 = this.options.authorizationParams.redirect_uri || window.location.origin } = e2;
    if (!n2) throw new Error("connection is required");
    const a2 = S(_()), c2 = _(), u2 = await O(c2), d2 = C(u2), { connect_uri: h2, connect_params: l2, auth_session: p2 } = await this.myAccountApi.connectAccount({ connection: n2, scopes: i2, redirect_uri: s2, state: a2, code_challenge: d2, code_challenge_method: "S256", authorization_params: r2 });
    this.transactionManager.create({ state: a2, code_verifier: c2, auth_session: p2, redirect_uri: s2, appState: o2, connection: n2, response_type: ye.ConnectCode });
    const m2 = new URL(h2);
    m2.searchParams.set("ticket", l2.ticket), t2 ? await t2(m2.toString()) : window.location.assign(m2);
  }
};
var initialAuthState = {
  isAuthenticated: false,
  isLoading: true,
  error: void 0,
  user: void 0
};
var stub = function() {
  throw new Error("You forgot to wrap your component in <Auth0Provider>.");
};
var initialContext = __assign(__assign({}, initialAuthState), { buildAuthorizeUrl: stub, buildLogoutUrl: stub, getAccessTokenSilently: stub, getAccessTokenWithPopup: stub, getIdTokenClaims: stub, exchangeToken: stub, loginWithRedirect: stub, loginWithPopup: stub, connectAccountWithRedirect: stub, logout: stub, handleRedirectCallback: stub, getDpopNonce: stub, setDpopNonce: stub, generateDpopProof: stub, createFetcher: stub });
var Auth0Context = (0, import_react.createContext)(initialContext);
var OAuthError = (
  /** @class */
  (function(_super) {
    __extends(OAuthError2, _super);
    function OAuthError2(error, error_description) {
      var _this = _super.call(this, error_description !== null && error_description !== void 0 ? error_description : error) || this;
      _this.error = error;
      _this.error_description = error_description;
      Object.setPrototypeOf(_this, OAuthError2.prototype);
      return _this;
    }
    return OAuthError2;
  })(Error)
);
var CODE_RE = /[?&](?:connect_)?code=[^&]+/;
var STATE_RE = /[?&]state=[^&]+/;
var ERROR_RE = /[?&]error=[^&]+/;
var hasAuthParams = function(searchParams) {
  if (searchParams === void 0) {
    searchParams = window.location.search;
  }
  return (CODE_RE.test(searchParams) || ERROR_RE.test(searchParams)) && STATE_RE.test(searchParams);
};
var normalizeErrorFn = function(fallbackMessage) {
  return function(error) {
    if (error instanceof Error) {
      return error;
    }
    if (error !== null && typeof error === "object" && "error" in error && typeof error.error === "string") {
      if ("error_description" in error && typeof error.error_description === "string") {
        var e_1 = error;
        return new OAuthError(e_1.error, e_1.error_description);
      }
      var e2 = error;
      return new OAuthError(e2.error);
    }
    return new Error(fallbackMessage);
  };
};
var loginError = normalizeErrorFn("Login failed");
var tokenError = normalizeErrorFn("Get access token failed");
var deprecateRedirectUri = function(options) {
  var _a, _b;
  if (options === null || options === void 0 ? void 0 : options.redirectUri) {
    console.warn("Using `redirectUri` has been deprecated, please use `authorizationParams.redirect_uri` instead as `redirectUri` will be no longer supported in a future version");
    options.authorizationParams = (_a = options.authorizationParams) !== null && _a !== void 0 ? _a : {};
    options.authorizationParams.redirect_uri = options.redirectUri;
    delete options.redirectUri;
  }
  if ((_b = options === null || options === void 0 ? void 0 : options.authorizationParams) === null || _b === void 0 ? void 0 : _b.redirectUri) {
    console.warn("Using `authorizationParams.redirectUri` has been deprecated, please use `authorizationParams.redirect_uri` instead as `authorizationParams.redirectUri` will be removed in a future version");
    options.authorizationParams.redirect_uri = options.authorizationParams.redirectUri;
    delete options.authorizationParams.redirectUri;
  }
};
var reducer = function(state, action) {
  switch (action.type) {
    case "LOGIN_POPUP_STARTED":
      return __assign(__assign({}, state), { isLoading: true });
    case "LOGIN_POPUP_COMPLETE":
    case "INITIALISED":
      return __assign(__assign({}, state), { isAuthenticated: !!action.user, user: action.user, isLoading: false, error: void 0 });
    case "HANDLE_REDIRECT_COMPLETE":
    case "GET_ACCESS_TOKEN_COMPLETE":
      if (state.user === action.user) {
        return state;
      }
      return __assign(__assign({}, state), { isAuthenticated: !!action.user, user: action.user });
    case "LOGOUT":
      return __assign(__assign({}, state), { isAuthenticated: false, user: void 0 });
    case "ERROR":
      return __assign(__assign({}, state), { isLoading: false, error: action.error });
  }
};
var toAuth0ClientOptions = function(opts) {
  deprecateRedirectUri(opts);
  return __assign(__assign({}, opts), { auth0Client: {
    name: "auth0-react",
    version: "2.11.0"
  } });
};
var defaultOnRedirectCallback = function(appState) {
  var _a;
  window.history.replaceState({}, document.title, (_a = appState.returnTo) !== null && _a !== void 0 ? _a : window.location.pathname);
};
var Auth0Provider = function(opts) {
  var children = opts.children, skipRedirectCallback = opts.skipRedirectCallback, _a = opts.onRedirectCallback, onRedirectCallback = _a === void 0 ? defaultOnRedirectCallback : _a, _b = opts.context, context = _b === void 0 ? Auth0Context : _b, clientOpts = __rest(opts, ["children", "skipRedirectCallback", "onRedirectCallback", "context"]);
  var client = (0, import_react.useState)(function() {
    return new Le(toAuth0ClientOptions(clientOpts));
  })[0];
  var _c = (0, import_react.useReducer)(reducer, initialAuthState), state = _c[0], dispatch = _c[1];
  var didInitialise = (0, import_react.useRef)(false);
  var handleError = (0, import_react.useCallback)(function(error) {
    dispatch({ type: "ERROR", error });
    return error;
  }, []);
  (0, import_react.useEffect)(function() {
    if (didInitialise.current) {
      return;
    }
    didInitialise.current = true;
    (function() {
      return __awaiter(void 0, void 0, void 0, function() {
        var user, _a2, _b2, appState, response_type, result, error_1;
        return __generator(this, function(_c2) {
          switch (_c2.label) {
            case 0:
              _c2.trys.push([0, 7, , 8]);
              user = void 0;
              if (!(hasAuthParams() && !skipRedirectCallback)) return [3, 3];
              return [4, client.handleRedirectCallback()];
            case 1:
              _a2 = _c2.sent(), _b2 = _a2.appState, appState = _b2 === void 0 ? {} : _b2, response_type = _a2.response_type, result = __rest(_a2, ["appState", "response_type"]);
              return [4, client.getUser()];
            case 2:
              user = _c2.sent();
              appState.response_type = response_type;
              if (response_type === ye.ConnectCode) {
                appState.connectedAccount = result;
              }
              onRedirectCallback(appState, user);
              return [3, 6];
            case 3:
              return [4, client.checkSession()];
            case 4:
              _c2.sent();
              return [4, client.getUser()];
            case 5:
              user = _c2.sent();
              _c2.label = 6;
            case 6:
              dispatch({ type: "INITIALISED", user });
              return [3, 8];
            case 7:
              error_1 = _c2.sent();
              handleError(loginError(error_1));
              return [3, 8];
            case 8:
              return [
                2
                /*return*/
              ];
          }
        });
      });
    })();
  }, [client, onRedirectCallback, skipRedirectCallback, handleError]);
  var loginWithRedirect = (0, import_react.useCallback)(function(opts2) {
    deprecateRedirectUri(opts2);
    return client.loginWithRedirect(opts2);
  }, [client]);
  var loginWithPopup = (0, import_react.useCallback)(function(options, config) {
    return __awaiter(void 0, void 0, void 0, function() {
      var error_2, user;
      return __generator(this, function(_a2) {
        switch (_a2.label) {
          case 0:
            dispatch({ type: "LOGIN_POPUP_STARTED" });
            _a2.label = 1;
          case 1:
            _a2.trys.push([1, 3, , 4]);
            return [4, client.loginWithPopup(options, config)];
          case 2:
            _a2.sent();
            return [3, 4];
          case 3:
            error_2 = _a2.sent();
            handleError(loginError(error_2));
            return [
              2
              /*return*/
            ];
          case 4:
            return [4, client.getUser()];
          case 5:
            user = _a2.sent();
            dispatch({ type: "LOGIN_POPUP_COMPLETE", user });
            return [
              2
              /*return*/
            ];
        }
      });
    });
  }, [client, handleError]);
  var logout = (0, import_react.useCallback)(function() {
    var args_1 = [];
    for (var _i = 0; _i < arguments.length; _i++) {
      args_1[_i] = arguments[_i];
    }
    return __awaiter(void 0, __spreadArray([], args_1, true), void 0, function(opts2) {
      if (opts2 === void 0) {
        opts2 = {};
      }
      return __generator(this, function(_a2) {
        switch (_a2.label) {
          case 0:
            return [4, client.logout(opts2)];
          case 1:
            _a2.sent();
            if (opts2.openUrl || opts2.openUrl === false) {
              dispatch({ type: "LOGOUT" });
            }
            return [
              2
              /*return*/
            ];
        }
      });
    });
  }, [client]);
  var getAccessTokenSilently = (0, import_react.useCallback)(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    function(opts2) {
      return __awaiter(void 0, void 0, void 0, function() {
        var token, error_3, _a2;
        var _b2;
        return __generator(this, function(_c2) {
          switch (_c2.label) {
            case 0:
              _c2.trys.push([0, 2, 3, 5]);
              return [4, client.getTokenSilently(opts2)];
            case 1:
              token = _c2.sent();
              return [3, 5];
            case 2:
              error_3 = _c2.sent();
              throw tokenError(error_3);
            case 3:
              _a2 = dispatch;
              _b2 = {
                type: "GET_ACCESS_TOKEN_COMPLETE"
              };
              return [4, client.getUser()];
            case 4:
              _a2.apply(void 0, [(_b2.user = _c2.sent(), _b2)]);
              return [
                7
                /*endfinally*/
              ];
            case 5:
              return [2, token];
          }
        });
      });
    },
    [client]
  );
  var getAccessTokenWithPopup = (0, import_react.useCallback)(function(opts2, config) {
    return __awaiter(void 0, void 0, void 0, function() {
      var token, error_4, _a2;
      var _b2;
      return __generator(this, function(_c2) {
        switch (_c2.label) {
          case 0:
            _c2.trys.push([0, 2, 3, 5]);
            return [4, client.getTokenWithPopup(opts2, config)];
          case 1:
            token = _c2.sent();
            return [3, 5];
          case 2:
            error_4 = _c2.sent();
            throw tokenError(error_4);
          case 3:
            _a2 = dispatch;
            _b2 = {
              type: "GET_ACCESS_TOKEN_COMPLETE"
            };
            return [4, client.getUser()];
          case 4:
            _a2.apply(void 0, [(_b2.user = _c2.sent(), _b2)]);
            return [
              7
              /*endfinally*/
            ];
          case 5:
            return [2, token];
        }
      });
    });
  }, [client]);
  var connectAccountWithRedirect = (0, import_react.useCallback)(function(options) {
    return client.connectAccountWithRedirect(options);
  }, [client]);
  var getIdTokenClaims = (0, import_react.useCallback)(function() {
    return client.getIdTokenClaims();
  }, [client]);
  var exchangeToken = (0, import_react.useCallback)(function(options) {
    return __awaiter(void 0, void 0, void 0, function() {
      var tokenResponse, error_5, _a2;
      var _b2;
      return __generator(this, function(_c2) {
        switch (_c2.label) {
          case 0:
            _c2.trys.push([0, 2, 3, 5]);
            return [4, client.exchangeToken(options)];
          case 1:
            tokenResponse = _c2.sent();
            return [3, 5];
          case 2:
            error_5 = _c2.sent();
            throw tokenError(error_5);
          case 3:
            _a2 = dispatch;
            _b2 = {
              type: "GET_ACCESS_TOKEN_COMPLETE"
            };
            return [4, client.getUser()];
          case 4:
            _a2.apply(void 0, [(_b2.user = _c2.sent(), _b2)]);
            return [
              7
              /*endfinally*/
            ];
          case 5:
            return [2, tokenResponse];
        }
      });
    });
  }, [client]);
  var handleRedirectCallback = (0, import_react.useCallback)(function(url) {
    return __awaiter(void 0, void 0, void 0, function() {
      var error_6, _a2;
      var _b2;
      return __generator(this, function(_c2) {
        switch (_c2.label) {
          case 0:
            _c2.trys.push([0, 2, 3, 5]);
            return [4, client.handleRedirectCallback(url)];
          case 1:
            return [2, _c2.sent()];
          case 2:
            error_6 = _c2.sent();
            throw tokenError(error_6);
          case 3:
            _a2 = dispatch;
            _b2 = {
              type: "HANDLE_REDIRECT_COMPLETE"
            };
            return [4, client.getUser()];
          case 4:
            _a2.apply(void 0, [(_b2.user = _c2.sent(), _b2)]);
            return [
              7
              /*endfinally*/
            ];
          case 5:
            return [
              2
              /*return*/
            ];
        }
      });
    });
  }, [client]);
  var getDpopNonce = (0, import_react.useCallback)(function(id) {
    return client.getDpopNonce(id);
  }, [client]);
  var setDpopNonce = (0, import_react.useCallback)(function(nonce, id) {
    return client.setDpopNonce(nonce, id);
  }, [client]);
  var generateDpopProof = (0, import_react.useCallback)(function(params) {
    return client.generateDpopProof(params);
  }, [client]);
  var createFetcher = (0, import_react.useCallback)(function(config) {
    return client.createFetcher(config);
  }, [client]);
  var contextValue = (0, import_react.useMemo)(function() {
    return __assign(__assign({}, state), { getAccessTokenSilently, getAccessTokenWithPopup, getIdTokenClaims, exchangeToken, loginWithRedirect, loginWithPopup, connectAccountWithRedirect, logout, handleRedirectCallback, getDpopNonce, setDpopNonce, generateDpopProof, createFetcher });
  }, [
    state,
    getAccessTokenSilently,
    getAccessTokenWithPopup,
    getIdTokenClaims,
    exchangeToken,
    loginWithRedirect,
    loginWithPopup,
    connectAccountWithRedirect,
    logout,
    handleRedirectCallback,
    getDpopNonce,
    setDpopNonce,
    generateDpopProof,
    createFetcher
  ]);
  return import_react.default.createElement(context.Provider, { value: contextValue }, children);
};
var useAuth0 = function(context) {
  if (context === void 0) {
    context = Auth0Context;
  }
  return (0, import_react.useContext)(context);
};
var withAuth0 = function(Component, context) {
  if (context === void 0) {
    context = Auth0Context;
  }
  return function WithAuth(props) {
    return import_react.default.createElement(context.Consumer, null, function(auth) {
      return import_react.default.createElement(Component, __assign({}, props, { auth0: auth }));
    });
  };
};
var defaultOnRedirecting = function() {
  return import_react.default.createElement(import_react.default.Fragment, null);
};
var defaultOnBeforeAuthentication = function() {
  return __awaiter(void 0, void 0, void 0, function() {
    return __generator(this, function(_a) {
      return [
        2
        /*return*/
      ];
    });
  });
};
var defaultReturnTo = function() {
  return "".concat(window.location.pathname).concat(window.location.search);
};
var withAuthenticationRequired = function(Component, options) {
  if (options === void 0) {
    options = {};
  }
  return function WithAuthenticationRequired(props) {
    var _this = this;
    var _a = options.returnTo, returnTo = _a === void 0 ? defaultReturnTo : _a, _b = options.onRedirecting, onRedirecting = _b === void 0 ? defaultOnRedirecting : _b, _c = options.onBeforeAuthentication, onBeforeAuthentication = _c === void 0 ? defaultOnBeforeAuthentication : _c, loginOptions = options.loginOptions, _d = options.context, context = _d === void 0 ? Auth0Context : _d;
    var _e2 = useAuth0(context), isAuthenticated = _e2.isAuthenticated, isLoading = _e2.isLoading, loginWithRedirect = _e2.loginWithRedirect;
    (0, import_react.useEffect)(function() {
      if (isLoading || isAuthenticated) {
        return;
      }
      var opts = __assign(__assign({}, loginOptions), { appState: __assign(__assign({}, loginOptions === null || loginOptions === void 0 ? void 0 : loginOptions.appState), { returnTo: typeof returnTo === "function" ? returnTo() : returnTo }) });
      void (function() {
        return __awaiter(_this, void 0, void 0, function() {
          return __generator(this, function(_a2) {
            switch (_a2.label) {
              case 0:
                return [4, onBeforeAuthentication()];
              case 1:
                _a2.sent();
                return [4, loginWithRedirect(opts)];
              case 2:
                _a2.sent();
                return [
                  2
                  /*return*/
                ];
            }
          });
        });
      })();
    }, [
      isLoading,
      isAuthenticated,
      loginWithRedirect,
      onBeforeAuthentication,
      loginOptions,
      returnTo
    ]);
    return isAuthenticated ? import_react.default.createElement(Component, __assign({}, props)) : onRedirecting();
  };
};
export {
  Auth0Context,
  Auth0Provider,
  d as AuthenticationError,
  h as ConnectError,
  u as GenericError,
  ie as InMemoryCache,
  ne as LocalStorageCache,
  g as MfaRequiredError,
  y as MissingRefreshTokenError,
  OAuthError,
  m as PopupCancelledError,
  p as PopupTimeoutError,
  ye as ResponseType,
  l as TimeoutError,
  b as UseDpopNonceError,
  we as User,
  initialContext,
  useAuth0,
  withAuth0,
  withAuthenticationRequired
};
//# sourceMappingURL=@auth0_auth0-react.js.map
