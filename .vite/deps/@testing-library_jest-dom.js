import {
  require_lib
} from "./chunk-POWAADKC.js";
import {
  __commonJS,
  __toESM
} from "./chunk-PLDDJCW6.js";

// node_modules/.pnpm/min-indent@1.0.1/node_modules/min-indent/index.js
var require_min_indent = __commonJS({
  "node_modules/.pnpm/min-indent@1.0.1/node_modules/min-indent/index.js"(exports, module) {
    "use strict";
    module.exports = (string) => {
      const match = string.match(/^[ \t]*(?=\S)/gm);
      if (!match) {
        return 0;
      }
      return match.reduce((r2, a) => Math.min(r2, a.length), Infinity);
    };
  }
});

// node_modules/.pnpm/strip-indent@3.0.0/node_modules/strip-indent/index.js
var require_strip_indent = __commonJS({
  "node_modules/.pnpm/strip-indent@3.0.0/node_modules/strip-indent/index.js"(exports, module) {
    "use strict";
    var minIndent = require_min_indent();
    module.exports = (string) => {
      const indent = minIndent(string);
      if (indent === 0) {
        return string;
      }
      const regex = new RegExp(`^[ \\t]{${indent}}`, "gm");
      return string.replace(regex, "");
    };
  }
});

// node_modules/.pnpm/indent-string@4.0.0/node_modules/indent-string/index.js
var require_indent_string = __commonJS({
  "node_modules/.pnpm/indent-string@4.0.0/node_modules/indent-string/index.js"(exports, module) {
    "use strict";
    module.exports = (string, count = 1, options) => {
      options = {
        indent: " ",
        includeEmptyLines: false,
        ...options
      };
      if (typeof string !== "string") {
        throw new TypeError(
          `Expected \`input\` to be a \`string\`, got \`${typeof string}\``
        );
      }
      if (typeof count !== "number") {
        throw new TypeError(
          `Expected \`count\` to be a \`number\`, got \`${typeof count}\``
        );
      }
      if (typeof options.indent !== "string") {
        throw new TypeError(
          `Expected \`options.indent\` to be a \`string\`, got \`${typeof options.indent}\``
        );
      }
      if (count === 0) {
        return string;
      }
      const regex = options.includeEmptyLines ? /^/gm : /^(?!\s*$)/gm;
      return string.replace(regex, options.indent.repeat(count));
    };
  }
});

// node_modules/.pnpm/redent@3.0.0/node_modules/redent/index.js
var require_redent = __commonJS({
  "node_modules/.pnpm/redent@3.0.0/node_modules/redent/index.js"(exports, module) {
    "use strict";
    var stripIndent = require_strip_indent();
    var indentString = require_indent_string();
    module.exports = (string, count = 0, options) => indentString(stripIndent(string), count, options);
  }
});

// node_modules/.pnpm/picocolors@1.1.1/node_modules/picocolors/picocolors.js
var require_picocolors = __commonJS({
  "node_modules/.pnpm/picocolors@1.1.1/node_modules/picocolors/picocolors.js"(exports, module) {
    var p = process || {};
    var argv = p.argv || [];
    var env = p.env || {};
    var isColorSupported = !(!!env.NO_COLOR || argv.includes("--no-color")) && (!!env.FORCE_COLOR || argv.includes("--color") || p.platform === "win32" || (p.stdout || {}).isTTY && env.TERM !== "dumb" || !!env.CI);
    var formatter = (open, close, replace = open) => (input) => {
      let string = "" + input, index = string.indexOf(close, open.length);
      return ~index ? open + replaceClose(string, close, replace, index) + close : open + string + close;
    };
    var replaceClose = (string, close, replace, index) => {
      let result = "", cursor = 0;
      do {
        result += string.substring(cursor, index) + replace;
        cursor = index + close.length;
        index = string.indexOf(close, cursor);
      } while (~index);
      return result + string.substring(cursor);
    };
    var createColors = (enabled = isColorSupported) => {
      let f = enabled ? formatter : () => String;
      return {
        isColorSupported: enabled,
        reset: f("\x1B[0m", "\x1B[0m"),
        bold: f("\x1B[1m", "\x1B[22m", "\x1B[22m\x1B[1m"),
        dim: f("\x1B[2m", "\x1B[22m", "\x1B[22m\x1B[2m"),
        italic: f("\x1B[3m", "\x1B[23m"),
        underline: f("\x1B[4m", "\x1B[24m"),
        inverse: f("\x1B[7m", "\x1B[27m"),
        hidden: f("\x1B[8m", "\x1B[28m"),
        strikethrough: f("\x1B[9m", "\x1B[29m"),
        black: f("\x1B[30m", "\x1B[39m"),
        red: f("\x1B[31m", "\x1B[39m"),
        green: f("\x1B[32m", "\x1B[39m"),
        yellow: f("\x1B[33m", "\x1B[39m"),
        blue: f("\x1B[34m", "\x1B[39m"),
        magenta: f("\x1B[35m", "\x1B[39m"),
        cyan: f("\x1B[36m", "\x1B[39m"),
        white: f("\x1B[37m", "\x1B[39m"),
        gray: f("\x1B[90m", "\x1B[39m"),
        bgBlack: f("\x1B[40m", "\x1B[49m"),
        bgRed: f("\x1B[41m", "\x1B[49m"),
        bgGreen: f("\x1B[42m", "\x1B[49m"),
        bgYellow: f("\x1B[43m", "\x1B[49m"),
        bgBlue: f("\x1B[44m", "\x1B[49m"),
        bgMagenta: f("\x1B[45m", "\x1B[49m"),
        bgCyan: f("\x1B[46m", "\x1B[49m"),
        bgWhite: f("\x1B[47m", "\x1B[49m"),
        blackBright: f("\x1B[90m", "\x1B[39m"),
        redBright: f("\x1B[91m", "\x1B[39m"),
        greenBright: f("\x1B[92m", "\x1B[39m"),
        yellowBright: f("\x1B[93m", "\x1B[39m"),
        blueBright: f("\x1B[94m", "\x1B[39m"),
        magentaBright: f("\x1B[95m", "\x1B[39m"),
        cyanBright: f("\x1B[96m", "\x1B[39m"),
        whiteBright: f("\x1B[97m", "\x1B[39m"),
        bgBlackBright: f("\x1B[100m", "\x1B[49m"),
        bgRedBright: f("\x1B[101m", "\x1B[49m"),
        bgGreenBright: f("\x1B[102m", "\x1B[49m"),
        bgYellowBright: f("\x1B[103m", "\x1B[49m"),
        bgBlueBright: f("\x1B[104m", "\x1B[49m"),
        bgMagentaBright: f("\x1B[105m", "\x1B[49m"),
        bgCyanBright: f("\x1B[106m", "\x1B[49m"),
        bgWhiteBright: f("\x1B[107m", "\x1B[49m")
      };
    };
    module.exports = createColors();
    module.exports.createColors = createColors;
  }
});

// node_modules/.pnpm/css.escape@1.5.1/node_modules/css.escape/css.escape.js
var require_css_escape = __commonJS({
  "node_modules/.pnpm/css.escape@1.5.1/node_modules/css.escape/css.escape.js"(exports, module) {
    (function(root, factory) {
      if (typeof exports == "object") {
        module.exports = factory(root);
      } else if (typeof define == "function" && define.amd) {
        define([], factory.bind(root, root));
      } else {
        factory(root);
      }
    })(typeof global != "undefined" ? global : exports, function(root) {
      if (root.CSS && root.CSS.escape) {
        return root.CSS.escape;
      }
      var cssEscape = function(value) {
        if (arguments.length == 0) {
          throw new TypeError("`CSS.escape` requires an argument.");
        }
        var string = String(value);
        var length = string.length;
        var index = -1;
        var codeUnit;
        var result = "";
        var firstCodeUnit = string.charCodeAt(0);
        while (++index < length) {
          codeUnit = string.charCodeAt(index);
          if (codeUnit == 0) {
            result += "�";
            continue;
          }
          if (
            // If the character is in the range [\1-\1F] (U+0001 to U+001F) or is
            // U+007F, […]
            codeUnit >= 1 && codeUnit <= 31 || codeUnit == 127 || // If the character is the first character and is in the range [0-9]
            // (U+0030 to U+0039), […]
            index == 0 && codeUnit >= 48 && codeUnit <= 57 || // If the character is the second character and is in the range [0-9]
            // (U+0030 to U+0039) and the first character is a `-` (U+002D), […]
            index == 1 && codeUnit >= 48 && codeUnit <= 57 && firstCodeUnit == 45
          ) {
            result += "\\" + codeUnit.toString(16) + " ";
            continue;
          }
          if (
            // If the character is the first character and is a `-` (U+002D), and
            // there is no second character, […]
            index == 0 && length == 1 && codeUnit == 45
          ) {
            result += "\\" + string.charAt(index);
            continue;
          }
          if (codeUnit >= 128 || codeUnit == 45 || codeUnit == 95 || codeUnit >= 48 && codeUnit <= 57 || codeUnit >= 65 && codeUnit <= 90 || codeUnit >= 97 && codeUnit <= 122) {
            result += string.charAt(index);
            continue;
          }
          result += "\\" + string.charAt(index);
        }
        return result;
      };
      if (!root.CSS) {
        root.CSS = {};
      }
      root.CSS.escape = cssEscape;
      return cssEscape;
    });
  }
});

// node_modules/.pnpm/@testing-library+jest-dom@6.9.1/node_modules/@testing-library/jest-dom/dist/matchers-35e4d3bd.mjs
var import_redent = __toESM(require_redent(), 1);

// node_modules/.pnpm/@adobe+css-tools@4.4.4/node_modules/@adobe/css-tools/dist/esm/adobe-css-tools.mjs
var t = class extends Error {
  reason;
  filename;
  line;
  column;
  source;
  constructor(t2, e2, i2, s2, n2) {
    super(`${t2}:${i2}:${s2}: ${e2}`), this.reason = e2, this.filename = t2, this.line = i2, this.column = s2, this.source = n2;
  }
};
var e = class {
  start;
  end;
  source;
  constructor(t2, e2, i2) {
    this.start = t2, this.end = e2, this.source = i2;
  }
};
var i;
!(function(t2) {
  t2.stylesheet = "stylesheet", t2.rule = "rule", t2.declaration = "declaration", t2.comment = "comment", t2.container = "container", t2.charset = "charset", t2.document = "document", t2.customMedia = "custom-media", t2.fontFace = "font-face", t2.host = "host", t2.import = "import", t2.keyframes = "keyframes", t2.keyframe = "keyframe", t2.layer = "layer", t2.media = "media", t2.namespace = "namespace", t2.page = "page", t2.startingStyle = "starting-style", t2.supports = "supports";
})(i || (i = {}));
var s = (t2, e2, i2) => {
  let s2 = i2, n2 = 1e4;
  do {
    const i3 = e2.map((e3) => t2.indexOf(e3, s2));
    i3.push(t2.indexOf("\\", s2));
    const r2 = i3.filter((t3) => -1 !== t3);
    if (0 === r2.length) return -1;
    const o2 = Math.min(...r2);
    if ("\\" !== t2[o2]) return o2;
    s2 = o2 + 2, n2--;
  } while (n2 > 0);
  throw new Error("Too many escaping");
};
var n = (t2, e2, i2) => {
  let r2 = i2, o2 = 1e4;
  do {
    const i3 = e2.map((e3) => t2.indexOf(e3, r2));
    i3.push(t2.indexOf("(", r2)), i3.push(t2.indexOf('"', r2)), i3.push(t2.indexOf("'", r2)), i3.push(t2.indexOf("\\", r2));
    const c2 = i3.filter((t3) => -1 !== t3);
    if (0 === c2.length) return -1;
    const a = Math.min(...c2);
    switch (t2[a]) {
      case "\\":
        r2 = a + 2;
        break;
      case "(":
        {
          const e3 = n(t2, [")"], a + 1);
          if (-1 === e3) return -1;
          r2 = e3 + 1;
        }
        break;
      case '"':
        {
          const e3 = s(t2, ['"'], a + 1);
          if (-1 === e3) return -1;
          r2 = e3 + 1;
        }
        break;
      case "'":
        {
          const e3 = s(t2, ["'"], a + 1);
          if (-1 === e3) return -1;
          r2 = e3 + 1;
        }
        break;
      default:
        return a;
    }
    o2--;
  } while (o2 > 0);
  throw new Error("Too many escaping");
};
var r = /\/\*[^]*?(?:\*\/|$)/g;
function o(t2) {
  return t2 ? t2.trim() : "";
}
function c(t2, e2) {
  const i2 = t2 && "string" == typeof t2.type, s2 = i2 ? t2 : e2;
  for (const e3 in t2) {
    const i3 = t2[e3];
    Array.isArray(i3) ? i3.forEach((t3) => {
      c(t3, s2);
    }) : i3 && "object" == typeof i3 && c(i3, s2);
  }
  return i2 && Object.defineProperty(t2, "parent", { configurable: true, writable: true, enumerable: false, value: e2 || null }), t2;
}
var m = (s2, a) => {
  a = a || {};
  let m2 = 1, h = 1;
  function u() {
    const t2 = { line: m2, column: h };
    return (i2) => (i2.position = new e(t2, { line: m2, column: h }, a?.source || ""), $(), i2);
  }
  const p = [];
  function l(e2) {
    const i2 = new t(a?.source || "", e2, m2, h, s2);
    if (!a?.silent) throw i2;
    p.push(i2);
  }
  function f() {
    const t2 = /^{\s*/.exec(s2);
    return !!t2 && (g(t2), true);
  }
  function d() {
    const t2 = /^}/.exec(s2);
    return !!t2 && (g(t2), true);
  }
  function y() {
    let t2;
    const e2 = [];
    for ($(), x(e2); s2.length && "}" !== s2.charAt(0) && (t2 = A() || S(), t2); ) e2.push(t2), x(e2);
    return e2;
  }
  function g(t2) {
    const e2 = t2[0];
    return (function(t3) {
      const e3 = t3.match(/\n/g);
      e3 && (m2 += e3.length);
      const i2 = t3.lastIndexOf("\n");
      h = ~i2 ? t3.length - i2 : h + t3.length;
    })(e2), s2 = s2.slice(e2.length), t2;
  }
  function $() {
    const t2 = /^\s*/.exec(s2);
    t2 && g(t2);
  }
  function x(t2) {
    t2 = t2 || [];
    let e2 = V();
    for (; e2; ) t2.push(e2), e2 = V();
    return t2;
  }
  function V() {
    const t2 = u();
    if ("/" !== s2.charAt(0) || "*" !== s2.charAt(1)) return;
    const e2 = /^\/\*[^]*?\*\//.exec(s2);
    return e2 ? (g(e2), t2({ type: i.comment, comment: e2[0].slice(2, -2) })) : l("End of comment missing");
  }
  function k() {
    const t2 = /^([^{]+)/.exec(s2);
    if (!t2) return;
    g(t2);
    return ((t3, e2) => {
      const i2 = [];
      let s3 = 0;
      for (; s3 < t3.length; ) {
        const r2 = n(t3, e2, s3);
        if (-1 === r2) return i2.push(t3.substring(s3)), i2;
        i2.push(t3.substring(s3, r2)), s3 = r2 + 1;
      }
      return i2;
    })(o(t2[0]).replace(r, ""), [","]).map((t3) => o(t3));
  }
  function v() {
    const t2 = u(), e2 = /^(\*?[-#/*\\\w]+(\[[0-9a-z_-]+\])?)\s*/.exec(s2);
    if (!e2) return;
    g(e2);
    const c2 = o(e2[0]), a2 = /^:\s*/.exec(s2);
    if (!a2) return l("property missing ':'");
    g(a2);
    let m3 = "";
    const h2 = n(s2, [";", "}"]);
    if (-1 !== h2) {
      m3 = s2.substring(0, h2);
      g([m3]), m3 = o(m3).replace(r, "");
    }
    const p2 = t2({ type: i.declaration, property: c2.replace(r, ""), value: m3 }), f2 = /^[;\s]*/.exec(s2);
    return f2 && g(f2), p2;
  }
  function w() {
    const t2 = [];
    if (!f()) return l("missing '{'");
    x(t2);
    let e2 = v();
    for (; e2; ) t2.push(e2), x(t2), e2 = v();
    return d() ? t2 : l("missing '}'");
  }
  function b() {
    const t2 = [], e2 = u();
    let n2 = /^((\d+\.\d+|\.\d+|\d+)%?|[a-z]+)\s*/.exec(s2);
    for (; n2; ) {
      const e3 = g(n2);
      t2.push(e3[1]);
      const i2 = /^,\s*/.exec(s2);
      i2 && g(i2), n2 = /^((\d+\.\d+|\.\d+|\d+)%?|[a-z]+)\s*/.exec(s2);
    }
    if (t2.length) return e2({ type: i.keyframe, values: t2, declarations: w() || [] });
  }
  const j = M("import"), O = M("charset"), E = M("namespace");
  function M(t2) {
    const e2 = new RegExp("^@" + t2 + `\\s*((?::?[^;'"]|"(?:\\\\"|[^"])*?"|'(?:\\\\'|[^'])*?')+)(?:;|$)`);
    return () => {
      const i2 = u(), n2 = e2.exec(s2);
      if (!n2) return;
      const r2 = g(n2), o2 = { type: t2 };
      return o2[t2] = r2[1].trim(), i2(o2);
    };
  }
  function A() {
    if ("@" === s2[0]) return (function() {
      const t2 = u(), e2 = /^@([-\w]+)?keyframes\s*/.exec(s2);
      if (!e2) return;
      const n2 = g(e2)[1], r2 = /^([-\w]+)\s*/.exec(s2);
      if (!r2) return l("@keyframes missing name");
      const o2 = g(r2)[1];
      if (!f()) return l("@keyframes missing '{'");
      let c2 = x(), a2 = b();
      for (; a2; ) c2.push(a2), c2 = c2.concat(x()), a2 = b();
      return d() ? t2({ type: i.keyframes, name: o2, vendor: n2, keyframes: c2 }) : l("@keyframes missing '}'");
    })() || (function() {
      const t2 = u(), e2 = /^@media *([^{]+)/.exec(s2);
      if (!e2) return;
      const n2 = o(g(e2)[1]);
      if (!f()) return l("@media missing '{'");
      const r2 = x().concat(y());
      return d() ? t2({ type: i.media, media: n2, rules: r2 }) : l("@media missing '}'");
    })() || (function() {
      const t2 = u(), e2 = /^@custom-media\s+(--\S+)\s+([^{;\s][^{;]*);/.exec(s2);
      if (!e2) return;
      const n2 = g(e2);
      return t2({ type: i.customMedia, name: o(n2[1]), media: o(n2[2]) });
    })() || (function() {
      const t2 = u(), e2 = /^@supports *([^{]+)/.exec(s2);
      if (!e2) return;
      const n2 = o(g(e2)[1]);
      if (!f()) return l("@supports missing '{'");
      const r2 = x().concat(y());
      return d() ? t2({ type: i.supports, supports: n2, rules: r2 }) : l("@supports missing '}'");
    })() || j() || O() || E() || (function() {
      const t2 = u(), e2 = /^@([-\w]+)?document *([^{]+)/.exec(s2);
      if (!e2) return;
      const n2 = g(e2), r2 = o(n2[1]), c2 = o(n2[2]);
      if (!f()) return l("@document missing '{'");
      const a2 = x().concat(y());
      return d() ? t2({ type: i.document, document: c2, vendor: r2, rules: a2 }) : l("@document missing '}'");
    })() || (function() {
      const t2 = u(), e2 = /^@page */.exec(s2);
      if (!e2) return;
      g(e2);
      const n2 = k() || [];
      if (!f()) return l("@page missing '{'");
      let r2 = x(), o2 = v();
      for (; o2; ) r2.push(o2), r2 = r2.concat(x()), o2 = v();
      return d() ? t2({ type: i.page, selectors: n2, declarations: r2 }) : l("@page missing '}'");
    })() || (function() {
      const t2 = u(), e2 = /^@host\s*/.exec(s2);
      if (!e2) return;
      if (g(e2), !f()) return l("@host missing '{'");
      const n2 = x().concat(y());
      return d() ? t2({ type: i.host, rules: n2 }) : l("@host missing '}'");
    })() || (function() {
      const t2 = u(), e2 = /^@font-face\s*/.exec(s2);
      if (!e2) return;
      if (g(e2), !f()) return l("@font-face missing '{'");
      let n2 = x(), r2 = v();
      for (; r2; ) n2.push(r2), n2 = n2.concat(x()), r2 = v();
      return d() ? t2({ type: i.fontFace, declarations: n2 }) : l("@font-face missing '}'");
    })() || (function() {
      const t2 = u(), e2 = /^@container *([^{]+)/.exec(s2);
      if (!e2) return;
      const n2 = o(g(e2)[1]);
      if (!f()) return l("@container missing '{'");
      const r2 = x().concat(y());
      return d() ? t2({ type: i.container, container: n2, rules: r2 }) : l("@container missing '}'");
    })() || (function() {
      const t2 = u(), e2 = /^@starting-style\s*/.exec(s2);
      if (!e2) return;
      if (g(e2), !f()) return l("@starting-style missing '{'");
      const n2 = x().concat(y());
      return d() ? t2({ type: i.startingStyle, rules: n2 }) : l("@starting-style missing '}'");
    })() || (function() {
      const t2 = u(), e2 = /^@layer *([^{;@]+)/.exec(s2);
      if (!e2) return;
      const n2 = o(g(e2)[1]);
      if (!f()) {
        const e3 = /^[;\s]*/.exec(s2);
        return e3 && g(e3), t2({ type: i.layer, layer: n2 });
      }
      const r2 = x().concat(y());
      return d() ? t2({ type: i.layer, layer: n2, rules: r2 }) : l("@layer missing '}'");
    })();
  }
  function S() {
    const t2 = u(), e2 = k();
    return e2 ? (x(), t2({ type: i.rule, selectors: e2, declarations: w() || [] })) : l("selector missing");
  }
  return c((function() {
    const t2 = y();
    return { type: i.stylesheet, stylesheet: { source: a?.source, rules: t2, parsingErrors: p } };
  })());
};

// node_modules/.pnpm/dom-accessibility-api@0.6.3/node_modules/dom-accessibility-api/dist/polyfills/array.from.mjs
var toStr = Object.prototype.toString;
function isCallable(fn) {
  return typeof fn === "function" || toStr.call(fn) === "[object Function]";
}
function toInteger(value) {
  var number = Number(value);
  if (isNaN(number)) {
    return 0;
  }
  if (number === 0 || !isFinite(number)) {
    return number;
  }
  return (number > 0 ? 1 : -1) * Math.floor(Math.abs(number));
}
var maxSafeInteger = Math.pow(2, 53) - 1;
function toLength(value) {
  var len = toInteger(value);
  return Math.min(Math.max(len, 0), maxSafeInteger);
}
function arrayFrom(arrayLike, mapFn) {
  var C = Array;
  var items = Object(arrayLike);
  if (arrayLike == null) {
    throw new TypeError("Array.from requires an array-like object - not null or undefined");
  }
  if (typeof mapFn !== "undefined") {
    if (!isCallable(mapFn)) {
      throw new TypeError("Array.from: when provided, the second argument must be a function");
    }
  }
  var len = toLength(items.length);
  var A = isCallable(C) ? Object(new C(len)) : new Array(len);
  var k = 0;
  var kValue;
  while (k < len) {
    kValue = items[k];
    if (mapFn) {
      A[k] = mapFn(kValue, k);
    } else {
      A[k] = kValue;
    }
    k += 1;
  }
  A.length = len;
  return A;
}

// node_modules/.pnpm/dom-accessibility-api@0.6.3/node_modules/dom-accessibility-api/dist/polyfills/SetLike.mjs
function _typeof(o2) {
  "@babel/helpers - typeof";
  return _typeof = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function(o3) {
    return typeof o3;
  } : function(o3) {
    return o3 && "function" == typeof Symbol && o3.constructor === Symbol && o3 !== Symbol.prototype ? "symbol" : typeof o3;
  }, _typeof(o2);
}
function _classCallCheck(instance, Constructor) {
  if (!(instance instanceof Constructor)) {
    throw new TypeError("Cannot call a class as a function");
  }
}
function _defineProperties(target, props) {
  for (var i2 = 0; i2 < props.length; i2++) {
    var descriptor = props[i2];
    descriptor.enumerable = descriptor.enumerable || false;
    descriptor.configurable = true;
    if ("value" in descriptor) descriptor.writable = true;
    Object.defineProperty(target, _toPropertyKey(descriptor.key), descriptor);
  }
}
function _createClass(Constructor, protoProps, staticProps) {
  if (protoProps) _defineProperties(Constructor.prototype, protoProps);
  if (staticProps) _defineProperties(Constructor, staticProps);
  Object.defineProperty(Constructor, "prototype", { writable: false });
  return Constructor;
}
function _defineProperty(obj, key, value) {
  key = _toPropertyKey(key);
  if (key in obj) {
    Object.defineProperty(obj, key, { value, enumerable: true, configurable: true, writable: true });
  } else {
    obj[key] = value;
  }
  return obj;
}
function _toPropertyKey(arg) {
  var key = _toPrimitive(arg, "string");
  return _typeof(key) === "symbol" ? key : String(key);
}
function _toPrimitive(input, hint) {
  if (_typeof(input) !== "object" || input === null) return input;
  var prim = input[Symbol.toPrimitive];
  if (prim !== void 0) {
    var res = prim.call(input, hint || "default");
    if (_typeof(res) !== "object") return res;
    throw new TypeError("@@toPrimitive must return a primitive value.");
  }
  return (hint === "string" ? String : Number)(input);
}
var SetLike = (function() {
  function SetLike2() {
    var items = arguments.length > 0 && arguments[0] !== void 0 ? arguments[0] : [];
    _classCallCheck(this, SetLike2);
    _defineProperty(this, "items", void 0);
    this.items = items;
  }
  _createClass(SetLike2, [{
    key: "add",
    value: function add(value) {
      if (this.has(value) === false) {
        this.items.push(value);
      }
      return this;
    }
  }, {
    key: "clear",
    value: function clear() {
      this.items = [];
    }
  }, {
    key: "delete",
    value: function _delete(value) {
      var previousLength = this.items.length;
      this.items = this.items.filter(function(item) {
        return item !== value;
      });
      return previousLength !== this.items.length;
    }
  }, {
    key: "forEach",
    value: function forEach(callbackfn) {
      var _this = this;
      this.items.forEach(function(item) {
        callbackfn(item, item, _this);
      });
    }
  }, {
    key: "has",
    value: function has(value) {
      return this.items.indexOf(value) !== -1;
    }
  }, {
    key: "size",
    get: function get() {
      return this.items.length;
    }
  }]);
  return SetLike2;
})();
var SetLike_default = typeof Set === "undefined" ? Set : SetLike;

// node_modules/.pnpm/dom-accessibility-api@0.6.3/node_modules/dom-accessibility-api/dist/getRole.mjs
function getLocalName(element) {
  var _element$localName;
  return (
    // eslint-disable-next-line no-restricted-properties -- actual guard for environments without localName
    (_element$localName = element.localName) !== null && _element$localName !== void 0 ? _element$localName : (
      // eslint-disable-next-line no-restricted-properties -- required for the fallback
      element.tagName.toLowerCase()
    )
  );
}
var localNameToRoleMappings = {
  article: "article",
  aside: "complementary",
  button: "button",
  datalist: "listbox",
  dd: "definition",
  details: "group",
  dialog: "dialog",
  dt: "term",
  fieldset: "group",
  figure: "figure",
  // WARNING: Only with an accessible name
  form: "form",
  footer: "contentinfo",
  h1: "heading",
  h2: "heading",
  h3: "heading",
  h4: "heading",
  h5: "heading",
  h6: "heading",
  header: "banner",
  hr: "separator",
  html: "document",
  legend: "legend",
  li: "listitem",
  math: "math",
  main: "main",
  menu: "list",
  nav: "navigation",
  ol: "list",
  optgroup: "group",
  // WARNING: Only in certain context
  option: "option",
  output: "status",
  progress: "progressbar",
  // WARNING: Only with an accessible name
  section: "region",
  summary: "button",
  table: "table",
  tbody: "rowgroup",
  textarea: "textbox",
  tfoot: "rowgroup",
  // WARNING: Only in certain context
  td: "cell",
  th: "columnheader",
  thead: "rowgroup",
  tr: "row",
  ul: "list"
};
var prohibitedAttributes = {
  caption: /* @__PURE__ */ new Set(["aria-label", "aria-labelledby"]),
  code: /* @__PURE__ */ new Set(["aria-label", "aria-labelledby"]),
  deletion: /* @__PURE__ */ new Set(["aria-label", "aria-labelledby"]),
  emphasis: /* @__PURE__ */ new Set(["aria-label", "aria-labelledby"]),
  generic: /* @__PURE__ */ new Set(["aria-label", "aria-labelledby", "aria-roledescription"]),
  insertion: /* @__PURE__ */ new Set(["aria-label", "aria-labelledby"]),
  none: /* @__PURE__ */ new Set(["aria-label", "aria-labelledby"]),
  paragraph: /* @__PURE__ */ new Set(["aria-label", "aria-labelledby"]),
  presentation: /* @__PURE__ */ new Set(["aria-label", "aria-labelledby"]),
  strong: /* @__PURE__ */ new Set(["aria-label", "aria-labelledby"]),
  subscript: /* @__PURE__ */ new Set(["aria-label", "aria-labelledby"]),
  superscript: /* @__PURE__ */ new Set(["aria-label", "aria-labelledby"])
};
function hasGlobalAriaAttributes(element, role) {
  return [
    "aria-atomic",
    "aria-busy",
    "aria-controls",
    "aria-current",
    "aria-description",
    "aria-describedby",
    "aria-details",
    // "disabled",
    "aria-dropeffect",
    // "errormessage",
    "aria-flowto",
    "aria-grabbed",
    // "haspopup",
    "aria-hidden",
    // "invalid",
    "aria-keyshortcuts",
    "aria-label",
    "aria-labelledby",
    "aria-live",
    "aria-owns",
    "aria-relevant",
    "aria-roledescription"
  ].some(function(attributeName) {
    var _prohibitedAttributes;
    return element.hasAttribute(attributeName) && !((_prohibitedAttributes = prohibitedAttributes[role]) !== null && _prohibitedAttributes !== void 0 && _prohibitedAttributes.has(attributeName));
  });
}
function ignorePresentationalRole(element, implicitRole) {
  return hasGlobalAriaAttributes(element, implicitRole);
}
function getRole(element) {
  var explicitRole = getExplicitRole(element);
  if (explicitRole === null || presentationRoles.indexOf(explicitRole) !== -1) {
    var implicitRole = getImplicitRole(element);
    if (presentationRoles.indexOf(explicitRole || "") === -1 || ignorePresentationalRole(element, implicitRole || "")) {
      return implicitRole;
    }
  }
  return explicitRole;
}
function getImplicitRole(element) {
  var mappedByTag = localNameToRoleMappings[getLocalName(element)];
  if (mappedByTag !== void 0) {
    return mappedByTag;
  }
  switch (getLocalName(element)) {
    case "a":
    case "area":
    case "link":
      if (element.hasAttribute("href")) {
        return "link";
      }
      break;
    case "img":
      if (element.getAttribute("alt") === "" && !ignorePresentationalRole(element, "img")) {
        return "presentation";
      }
      return "img";
    case "input": {
      var _ref = element, type = _ref.type;
      switch (type) {
        case "button":
        case "image":
        case "reset":
        case "submit":
          return "button";
        case "checkbox":
        case "radio":
          return type;
        case "range":
          return "slider";
        case "email":
        case "tel":
        case "text":
        case "url":
          if (element.hasAttribute("list")) {
            return "combobox";
          }
          return "textbox";
        case "search":
          if (element.hasAttribute("list")) {
            return "combobox";
          }
          return "searchbox";
        case "number":
          return "spinbutton";
        default:
          return null;
      }
    }
    case "select":
      if (element.hasAttribute("multiple") || element.size > 1) {
        return "listbox";
      }
      return "combobox";
  }
  return null;
}
function getExplicitRole(element) {
  var role = element.getAttribute("role");
  if (role !== null) {
    var explicitRole = role.trim().split(" ")[0];
    if (explicitRole.length > 0) {
      return explicitRole;
    }
  }
  return null;
}

// node_modules/.pnpm/dom-accessibility-api@0.6.3/node_modules/dom-accessibility-api/dist/util.mjs
var presentationRoles = ["presentation", "none"];
function isElement(node) {
  return node !== null && node.nodeType === node.ELEMENT_NODE;
}
function isHTMLTableCaptionElement(node) {
  return isElement(node) && getLocalName(node) === "caption";
}
function isHTMLInputElement(node) {
  return isElement(node) && getLocalName(node) === "input";
}
function isHTMLOptGroupElement(node) {
  return isElement(node) && getLocalName(node) === "optgroup";
}
function isHTMLSelectElement(node) {
  return isElement(node) && getLocalName(node) === "select";
}
function isHTMLTableElement(node) {
  return isElement(node) && getLocalName(node) === "table";
}
function isHTMLTextAreaElement(node) {
  return isElement(node) && getLocalName(node) === "textarea";
}
function safeWindow(node) {
  var _ref = node.ownerDocument === null ? node : node.ownerDocument, defaultView = _ref.defaultView;
  if (defaultView === null) {
    throw new TypeError("no window available");
  }
  return defaultView;
}
function isHTMLFieldSetElement(node) {
  return isElement(node) && getLocalName(node) === "fieldset";
}
function isHTMLLegendElement(node) {
  return isElement(node) && getLocalName(node) === "legend";
}
function isHTMLSlotElement(node) {
  return isElement(node) && getLocalName(node) === "slot";
}
function isSVGElement(node) {
  return isElement(node) && node.ownerSVGElement !== void 0;
}
function isSVGSVGElement(node) {
  return isElement(node) && getLocalName(node) === "svg";
}
function isSVGTitleElement(node) {
  return isSVGElement(node) && getLocalName(node) === "title";
}
function queryIdRefs(node, attributeName) {
  if (isElement(node) && node.hasAttribute(attributeName)) {
    var ids = node.getAttribute(attributeName).split(" ");
    var root = node.getRootNode ? node.getRootNode() : node.ownerDocument;
    return ids.map(function(id) {
      return root.getElementById(id);
    }).filter(
      function(element) {
        return element !== null;
      }
      // TODO: why does this not narrow?
    );
  }
  return [];
}
function hasAnyConcreteRoles(node, roles2) {
  if (isElement(node)) {
    return roles2.indexOf(getRole(node)) !== -1;
  }
  return false;
}

// node_modules/.pnpm/dom-accessibility-api@0.6.3/node_modules/dom-accessibility-api/dist/accessible-name-and-description.mjs
function asFlatString(s2) {
  return s2.trim().replace(/\s\s+/g, " ");
}
function isHidden(node, getComputedStyleImplementation) {
  if (!isElement(node)) {
    return false;
  }
  if (node.hasAttribute("hidden") || node.getAttribute("aria-hidden") === "true") {
    return true;
  }
  var style = getComputedStyleImplementation(node);
  return style.getPropertyValue("display") === "none" || style.getPropertyValue("visibility") === "hidden";
}
function isControl(node) {
  return hasAnyConcreteRoles(node, ["button", "combobox", "listbox", "textbox"]) || hasAbstractRole(node, "range");
}
function hasAbstractRole(node, role) {
  if (!isElement(node)) {
    return false;
  }
  switch (role) {
    case "range":
      return hasAnyConcreteRoles(node, ["meter", "progressbar", "scrollbar", "slider", "spinbutton"]);
    default:
      throw new TypeError("No knowledge about abstract role '".concat(role, "'. This is likely a bug :("));
  }
}
function querySelectorAllSubtree(element, selectors) {
  var elements = arrayFrom(element.querySelectorAll(selectors));
  queryIdRefs(element, "aria-owns").forEach(function(root) {
    elements.push.apply(elements, arrayFrom(root.querySelectorAll(selectors)));
  });
  return elements;
}
function querySelectedOptions(listbox) {
  if (isHTMLSelectElement(listbox)) {
    return listbox.selectedOptions || querySelectorAllSubtree(listbox, "[selected]");
  }
  return querySelectorAllSubtree(listbox, '[aria-selected="true"]');
}
function isMarkedPresentational(node) {
  return hasAnyConcreteRoles(node, presentationRoles);
}
function isNativeHostLanguageTextAlternativeElement(node) {
  return isHTMLTableCaptionElement(node);
}
function allowsNameFromContent(node) {
  return hasAnyConcreteRoles(node, ["button", "cell", "checkbox", "columnheader", "gridcell", "heading", "label", "legend", "link", "menuitem", "menuitemcheckbox", "menuitemradio", "option", "radio", "row", "rowheader", "switch", "tab", "tooltip", "treeitem"]);
}
function isDescendantOfNativeHostLanguageTextAlternativeElement(node) {
  return false;
}
function getValueOfTextbox(element) {
  if (isHTMLInputElement(element) || isHTMLTextAreaElement(element)) {
    return element.value;
  }
  return element.textContent || "";
}
function getTextualContent(declaration) {
  var content = declaration.getPropertyValue("content");
  if (/^["'].*["']$/.test(content)) {
    return content.slice(1, -1);
  }
  return "";
}
function isLabelableElement(element) {
  var localName = getLocalName(element);
  return localName === "button" || localName === "input" && element.getAttribute("type") !== "hidden" || localName === "meter" || localName === "output" || localName === "progress" || localName === "select" || localName === "textarea";
}
function findLabelableElement(element) {
  if (isLabelableElement(element)) {
    return element;
  }
  var labelableElement = null;
  element.childNodes.forEach(function(childNode) {
    if (labelableElement === null && isElement(childNode)) {
      var descendantLabelableElement = findLabelableElement(childNode);
      if (descendantLabelableElement !== null) {
        labelableElement = descendantLabelableElement;
      }
    }
  });
  return labelableElement;
}
function getControlOfLabel(label) {
  if (label.control !== void 0) {
    return label.control;
  }
  var htmlFor = label.getAttribute("for");
  if (htmlFor !== null) {
    return label.ownerDocument.getElementById(htmlFor);
  }
  return findLabelableElement(label);
}
function getLabels(element) {
  var labelsProperty = element.labels;
  if (labelsProperty === null) {
    return labelsProperty;
  }
  if (labelsProperty !== void 0) {
    return arrayFrom(labelsProperty);
  }
  if (!isLabelableElement(element)) {
    return null;
  }
  var document = element.ownerDocument;
  return arrayFrom(document.querySelectorAll("label")).filter(function(label) {
    return getControlOfLabel(label) === element;
  });
}
function getSlotContents(slot) {
  var assignedNodes = slot.assignedNodes();
  if (assignedNodes.length === 0) {
    return arrayFrom(slot.childNodes);
  }
  return assignedNodes;
}
function computeTextAlternative(root) {
  var options = arguments.length > 1 && arguments[1] !== void 0 ? arguments[1] : {};
  var consultedNodes = new SetLike_default();
  var window = safeWindow(root);
  var _options$compute = options.compute, compute = _options$compute === void 0 ? "name" : _options$compute, _options$computedStyl = options.computedStyleSupportsPseudoElements, computedStyleSupportsPseudoElements = _options$computedStyl === void 0 ? options.getComputedStyle !== void 0 : _options$computedStyl, _options$getComputedS = options.getComputedStyle, getComputedStyle = _options$getComputedS === void 0 ? window.getComputedStyle.bind(window) : _options$getComputedS, _options$hidden = options.hidden, hidden = _options$hidden === void 0 ? false : _options$hidden;
  function computeMiscTextAlternative(node, context) {
    var accumulatedText = "";
    if (isElement(node) && computedStyleSupportsPseudoElements) {
      var pseudoBefore = getComputedStyle(node, "::before");
      var beforeContent = getTextualContent(pseudoBefore);
      accumulatedText = "".concat(beforeContent, " ").concat(accumulatedText);
    }
    var childNodes = isHTMLSlotElement(node) ? getSlotContents(node) : arrayFrom(node.childNodes).concat(queryIdRefs(node, "aria-owns"));
    childNodes.forEach(function(child) {
      var result = computeTextAlternative2(child, {
        isEmbeddedInLabel: context.isEmbeddedInLabel,
        isReferenced: false,
        recursion: true
      });
      var display2 = isElement(child) ? getComputedStyle(child).getPropertyValue("display") : "inline";
      var separator = display2 !== "inline" ? " " : "";
      accumulatedText += "".concat(separator).concat(result).concat(separator);
    });
    if (isElement(node) && computedStyleSupportsPseudoElements) {
      var pseudoAfter = getComputedStyle(node, "::after");
      var afterContent = getTextualContent(pseudoAfter);
      accumulatedText = "".concat(accumulatedText, " ").concat(afterContent);
    }
    return accumulatedText.trim();
  }
  function useAttribute(element, attributeName) {
    var attribute = element.getAttributeNode(attributeName);
    if (attribute !== null && !consultedNodes.has(attribute) && attribute.value.trim() !== "") {
      consultedNodes.add(attribute);
      return attribute.value;
    }
    return null;
  }
  function computeTooltipAttributeValue(node) {
    if (!isElement(node)) {
      return null;
    }
    return useAttribute(node, "title");
  }
  function computeElementTextAlternative(node) {
    if (!isElement(node)) {
      return null;
    }
    if (isHTMLFieldSetElement(node)) {
      consultedNodes.add(node);
      var children = arrayFrom(node.childNodes);
      for (var i2 = 0; i2 < children.length; i2 += 1) {
        var child = children[i2];
        if (isHTMLLegendElement(child)) {
          return computeTextAlternative2(child, {
            isEmbeddedInLabel: false,
            isReferenced: false,
            recursion: false
          });
        }
      }
    } else if (isHTMLTableElement(node)) {
      consultedNodes.add(node);
      var _children = arrayFrom(node.childNodes);
      for (var _i = 0; _i < _children.length; _i += 1) {
        var _child = _children[_i];
        if (isHTMLTableCaptionElement(_child)) {
          return computeTextAlternative2(_child, {
            isEmbeddedInLabel: false,
            isReferenced: false,
            recursion: false
          });
        }
      }
    } else if (isSVGSVGElement(node)) {
      consultedNodes.add(node);
      var _children2 = arrayFrom(node.childNodes);
      for (var _i2 = 0; _i2 < _children2.length; _i2 += 1) {
        var _child2 = _children2[_i2];
        if (isSVGTitleElement(_child2)) {
          return _child2.textContent;
        }
      }
      return null;
    } else if (getLocalName(node) === "img" || getLocalName(node) === "area") {
      var nameFromAlt = useAttribute(node, "alt");
      if (nameFromAlt !== null) {
        return nameFromAlt;
      }
    } else if (isHTMLOptGroupElement(node)) {
      var nameFromLabel = useAttribute(node, "label");
      if (nameFromLabel !== null) {
        return nameFromLabel;
      }
    }
    if (isHTMLInputElement(node) && (node.type === "button" || node.type === "submit" || node.type === "reset")) {
      var nameFromValue = useAttribute(node, "value");
      if (nameFromValue !== null) {
        return nameFromValue;
      }
      if (node.type === "submit") {
        return "Submit";
      }
      if (node.type === "reset") {
        return "Reset";
      }
    }
    var labels = getLabels(node);
    if (labels !== null && labels.length !== 0) {
      consultedNodes.add(node);
      return arrayFrom(labels).map(function(element) {
        return computeTextAlternative2(element, {
          isEmbeddedInLabel: true,
          isReferenced: false,
          recursion: true
        });
      }).filter(function(label) {
        return label.length > 0;
      }).join(" ");
    }
    if (isHTMLInputElement(node) && node.type === "image") {
      var _nameFromAlt = useAttribute(node, "alt");
      if (_nameFromAlt !== null) {
        return _nameFromAlt;
      }
      var nameFromTitle = useAttribute(node, "title");
      if (nameFromTitle !== null) {
        return nameFromTitle;
      }
      return "Submit Query";
    }
    if (hasAnyConcreteRoles(node, ["button"])) {
      var nameFromSubTree = computeMiscTextAlternative(node, {
        isEmbeddedInLabel: false,
        isReferenced: false
      });
      if (nameFromSubTree !== "") {
        return nameFromSubTree;
      }
    }
    return null;
  }
  function computeTextAlternative2(current, context) {
    if (consultedNodes.has(current)) {
      return "";
    }
    if (!hidden && isHidden(current, getComputedStyle) && !context.isReferenced) {
      consultedNodes.add(current);
      return "";
    }
    var labelAttributeNode = isElement(current) ? current.getAttributeNode("aria-labelledby") : null;
    var labelElements = labelAttributeNode !== null && !consultedNodes.has(labelAttributeNode) ? queryIdRefs(current, "aria-labelledby") : [];
    if (compute === "name" && !context.isReferenced && labelElements.length > 0) {
      consultedNodes.add(labelAttributeNode);
      return labelElements.map(function(element) {
        return computeTextAlternative2(element, {
          isEmbeddedInLabel: context.isEmbeddedInLabel,
          isReferenced: true,
          // this isn't recursion as specified, otherwise we would skip
          // `aria-label` in
          // <input id="myself" aria-label="foo" aria-labelledby="myself"
          recursion: false
        });
      }).join(" ");
    }
    var skipToStep2E = context.recursion && isControl(current) && compute === "name";
    if (!skipToStep2E) {
      var ariaLabel = (isElement(current) && current.getAttribute("aria-label") || "").trim();
      if (ariaLabel !== "" && compute === "name") {
        consultedNodes.add(current);
        return ariaLabel;
      }
      if (!isMarkedPresentational(current)) {
        var elementTextAlternative = computeElementTextAlternative(current);
        if (elementTextAlternative !== null) {
          consultedNodes.add(current);
          return elementTextAlternative;
        }
      }
    }
    if (hasAnyConcreteRoles(current, ["menu"])) {
      consultedNodes.add(current);
      return "";
    }
    if (skipToStep2E || context.isEmbeddedInLabel || context.isReferenced) {
      if (hasAnyConcreteRoles(current, ["combobox", "listbox"])) {
        consultedNodes.add(current);
        var selectedOptions = querySelectedOptions(current);
        if (selectedOptions.length === 0) {
          return isHTMLInputElement(current) ? current.value : "";
        }
        return arrayFrom(selectedOptions).map(function(selectedOption) {
          return computeTextAlternative2(selectedOption, {
            isEmbeddedInLabel: context.isEmbeddedInLabel,
            isReferenced: false,
            recursion: true
          });
        }).join(" ");
      }
      if (hasAbstractRole(current, "range")) {
        consultedNodes.add(current);
        if (current.hasAttribute("aria-valuetext")) {
          return current.getAttribute("aria-valuetext");
        }
        if (current.hasAttribute("aria-valuenow")) {
          return current.getAttribute("aria-valuenow");
        }
        return current.getAttribute("value") || "";
      }
      if (hasAnyConcreteRoles(current, ["textbox"])) {
        consultedNodes.add(current);
        return getValueOfTextbox(current);
      }
    }
    if (allowsNameFromContent(current) || isElement(current) && context.isReferenced || isNativeHostLanguageTextAlternativeElement(current) || isDescendantOfNativeHostLanguageTextAlternativeElement(current)) {
      var accumulatedText2F = computeMiscTextAlternative(current, {
        isEmbeddedInLabel: context.isEmbeddedInLabel,
        isReferenced: false
      });
      if (accumulatedText2F !== "") {
        consultedNodes.add(current);
        return accumulatedText2F;
      }
    }
    if (current.nodeType === current.TEXT_NODE) {
      consultedNodes.add(current);
      return current.textContent || "";
    }
    if (context.recursion) {
      consultedNodes.add(current);
      return computeMiscTextAlternative(current, {
        isEmbeddedInLabel: context.isEmbeddedInLabel,
        isReferenced: false
      });
    }
    var tooltipAttributeValue = computeTooltipAttributeValue(current);
    if (tooltipAttributeValue !== null) {
      consultedNodes.add(current);
      return tooltipAttributeValue;
    }
    consultedNodes.add(current);
    return "";
  }
  return asFlatString(computeTextAlternative2(root, {
    isEmbeddedInLabel: false,
    // by spec computeAccessibleDescription starts with the referenced elements as roots
    isReferenced: compute === "description",
    recursion: false
  }));
}

// node_modules/.pnpm/dom-accessibility-api@0.6.3/node_modules/dom-accessibility-api/dist/accessible-description.mjs
function _typeof2(o2) {
  "@babel/helpers - typeof";
  return _typeof2 = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function(o3) {
    return typeof o3;
  } : function(o3) {
    return o3 && "function" == typeof Symbol && o3.constructor === Symbol && o3 !== Symbol.prototype ? "symbol" : typeof o3;
  }, _typeof2(o2);
}
function ownKeys(e2, r2) {
  var t2 = Object.keys(e2);
  if (Object.getOwnPropertySymbols) {
    var o2 = Object.getOwnPropertySymbols(e2);
    r2 && (o2 = o2.filter(function(r3) {
      return Object.getOwnPropertyDescriptor(e2, r3).enumerable;
    })), t2.push.apply(t2, o2);
  }
  return t2;
}
function _objectSpread(e2) {
  for (var r2 = 1; r2 < arguments.length; r2++) {
    var t2 = null != arguments[r2] ? arguments[r2] : {};
    r2 % 2 ? ownKeys(Object(t2), true).forEach(function(r3) {
      _defineProperty2(e2, r3, t2[r3]);
    }) : Object.getOwnPropertyDescriptors ? Object.defineProperties(e2, Object.getOwnPropertyDescriptors(t2)) : ownKeys(Object(t2)).forEach(function(r3) {
      Object.defineProperty(e2, r3, Object.getOwnPropertyDescriptor(t2, r3));
    });
  }
  return e2;
}
function _defineProperty2(obj, key, value) {
  key = _toPropertyKey2(key);
  if (key in obj) {
    Object.defineProperty(obj, key, { value, enumerable: true, configurable: true, writable: true });
  } else {
    obj[key] = value;
  }
  return obj;
}
function _toPropertyKey2(arg) {
  var key = _toPrimitive2(arg, "string");
  return _typeof2(key) === "symbol" ? key : String(key);
}
function _toPrimitive2(input, hint) {
  if (_typeof2(input) !== "object" || input === null) return input;
  var prim = input[Symbol.toPrimitive];
  if (prim !== void 0) {
    var res = prim.call(input, hint || "default");
    if (_typeof2(res) !== "object") return res;
    throw new TypeError("@@toPrimitive must return a primitive value.");
  }
  return (hint === "string" ? String : Number)(input);
}
function computeAccessibleDescription(root) {
  var options = arguments.length > 1 && arguments[1] !== void 0 ? arguments[1] : {};
  var description = queryIdRefs(root, "aria-describedby").map(function(element) {
    return computeTextAlternative(element, _objectSpread(_objectSpread({}, options), {}, {
      compute: "description"
    }));
  }).join(" ");
  if (description === "") {
    var ariaDescription = root.getAttribute("aria-description");
    description = ariaDescription === null ? "" : ariaDescription;
  }
  if (description === "") {
    var title = root.getAttribute("title");
    description = title === null ? "" : title;
  }
  return description;
}

// node_modules/.pnpm/dom-accessibility-api@0.6.3/node_modules/dom-accessibility-api/dist/accessible-name.mjs
function prohibitsNaming(node) {
  return hasAnyConcreteRoles(node, ["caption", "code", "deletion", "emphasis", "generic", "insertion", "none", "paragraph", "presentation", "strong", "subscript", "superscript"]);
}
function computeAccessibleName(root) {
  var options = arguments.length > 1 && arguments[1] !== void 0 ? arguments[1] : {};
  if (prohibitsNaming(root)) {
    return "";
  }
  return computeTextAlternative(root, options);
}

// node_modules/.pnpm/@testing-library+jest-dom@6.9.1/node_modules/@testing-library/jest-dom/dist/matchers-35e4d3bd.mjs
var import_aria_query = __toESM(require_lib(), 1);
var import_picocolors = __toESM(require_picocolors(), 1);
var import_css = __toESM(require_css_escape(), 1);
var GenericTypeError = class extends Error {
  constructor(expectedString, received, matcherFn, context) {
    super();
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, matcherFn);
    }
    let withType = "";
    try {
      withType = context.utils.printWithType(
        "Received",
        received,
        context.utils.printReceived
      );
    } catch (e2) {
    }
    this.message = [
      context.utils.matcherHint(
        `${context.isNot ? ".not" : ""}.${matcherFn.name}`,
        "received",
        ""
      ),
      "",
      // eslint-disable-next-line new-cap
      `${context.utils.RECEIVED_COLOR(
        "received"
      )} value must ${expectedString}.`,
      withType
    ].join("\n");
  }
};
var HtmlElementTypeError = class extends GenericTypeError {
  constructor(...args) {
    super("be an HTMLElement or an SVGElement", ...args);
  }
};
var NodeTypeError = class extends GenericTypeError {
  constructor(...args) {
    super("be a Node", ...args);
  }
};
function checkHasWindow(htmlElement, ErrorClass, ...args) {
  if (!htmlElement || !htmlElement.ownerDocument || !htmlElement.ownerDocument.defaultView) {
    throw new ErrorClass(htmlElement, ...args);
  }
}
function checkNode(node, ...args) {
  checkHasWindow(node, NodeTypeError, ...args);
  const window = node.ownerDocument.defaultView;
  if (!(node instanceof window.Node)) {
    throw new NodeTypeError(node, ...args);
  }
}
function checkHtmlElement(htmlElement, ...args) {
  checkHasWindow(htmlElement, HtmlElementTypeError, ...args);
  const window = htmlElement.ownerDocument.defaultView;
  if (!(htmlElement instanceof window.HTMLElement) && !(htmlElement instanceof window.SVGElement)) {
    throw new HtmlElementTypeError(htmlElement, ...args);
  }
}
var InvalidCSSError = class extends Error {
  constructor(received, matcherFn, context) {
    super();
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, matcherFn);
    }
    this.message = [
      received.message,
      "",
      // eslint-disable-next-line new-cap
      context.utils.RECEIVED_COLOR(`Failing css:`),
      // eslint-disable-next-line new-cap
      context.utils.RECEIVED_COLOR(`${received.css}`)
    ].join("\n");
  }
};
function parseCSS(css, ...args) {
  const ast = m(`selector { ${css} }`, { silent: true }).stylesheet;
  if (ast.parsingErrors && ast.parsingErrors.length > 0) {
    const { reason, line } = ast.parsingErrors[0];
    throw new InvalidCSSError(
      {
        css,
        message: `Syntax error parsing expected css: ${reason} on line: ${line}`
      },
      ...args
    );
  }
  const parsedRules = ast.rules[0].declarations.filter((d) => d.type === "declaration").reduce(
    (obj, { property, value }) => Object.assign(obj, { [property]: value }),
    {}
  );
  return parsedRules;
}
function display(context, value) {
  return typeof value === "string" ? value : context.utils.stringify(value);
}
function getMessage(context, matcher, expectedLabel, expectedValue, receivedLabel, receivedValue) {
  return [
    `${matcher}
`,
    // eslint-disable-next-line new-cap
    `${expectedLabel}:
${context.utils.EXPECTED_COLOR(
      (0, import_redent.default)(display(context, expectedValue), 2)
    )}`,
    // eslint-disable-next-line new-cap
    `${receivedLabel}:
${context.utils.RECEIVED_COLOR(
      (0, import_redent.default)(display(context, receivedValue), 2)
    )}`
  ].join("\n");
}
function matches(textToMatch, matcher) {
  if (matcher instanceof RegExp) {
    return matcher.test(textToMatch);
  } else {
    return textToMatch.includes(String(matcher));
  }
}
function deprecate(name, replacementText) {
  console.warn(
    `Warning: ${name} has been deprecated and will be removed in future updates.`,
    replacementText
  );
}
function normalize(text) {
  return text.replace(/\s+/g, " ").trim();
}
function getTag(element) {
  return element.tagName && element.tagName.toLowerCase();
}
function getSelectValue({ multiple, options }) {
  const selectedOptions = [...options].filter((option) => option.selected);
  if (multiple) {
    return [...selectedOptions].map((opt) => opt.value);
  }
  if (selectedOptions.length === 0) {
    return void 0;
  }
  return selectedOptions[0].value;
}
function getInputValue(inputElement) {
  switch (inputElement.type) {
    case "number":
      return inputElement.value === "" ? null : Number(inputElement.value);
    case "checkbox":
      return inputElement.checked;
    default:
      return inputElement.value;
  }
}
var rolesSupportingValues = ["meter", "progressbar", "slider", "spinbutton"];
function getAccessibleValue(element) {
  if (!rolesSupportingValues.includes(element.getAttribute("role"))) {
    return void 0;
  }
  return Number(element.getAttribute("aria-valuenow"));
}
function getSingleElementValue(element) {
  if (!element) {
    return void 0;
  }
  switch (element.tagName.toLowerCase()) {
    case "input":
      return getInputValue(element);
    case "select":
      return getSelectValue(element);
    default: {
      return element.value ?? getAccessibleValue(element);
    }
  }
}
function toSentence(array, { wordConnector = ", ", lastWordConnector = " and " } = {}) {
  return [array.slice(0, -1).join(wordConnector), array[array.length - 1]].join(
    array.length > 1 ? lastWordConnector : ""
  );
}
function compareAsSet(val1, val2) {
  if (Array.isArray(val1) && Array.isArray(val2)) {
    return [...new Set(val1)].every((v) => new Set(val2).has(v));
  }
  return val1 === val2;
}
function toBeInTheDOM(element, container) {
  deprecate(
    "toBeInTheDOM",
    "Please use toBeInTheDocument for searching the entire document and toContainElement for searching a specific container."
  );
  if (element) {
    checkHtmlElement(element, toBeInTheDOM, this);
  }
  if (container) {
    checkHtmlElement(container, toBeInTheDOM, this);
  }
  return {
    pass: container ? container.contains(element) : !!element,
    message: () => {
      return [
        this.utils.matcherHint(
          `${this.isNot ? ".not" : ""}.toBeInTheDOM`,
          "element",
          ""
        ),
        "",
        "Received:",
        `  ${this.utils.printReceived(
          element ? element.cloneNode(false) : element
        )}`
      ].join("\n");
    }
  };
}
function toBeInTheDocument(element) {
  if (element !== null || !this.isNot) {
    checkHtmlElement(element, toBeInTheDocument, this);
  }
  const pass = element === null ? false : element.ownerDocument === element.getRootNode({ composed: true });
  const errorFound = () => {
    return `expected document not to contain element, found ${this.utils.stringify(
      element.cloneNode(true)
    )} instead`;
  };
  const errorNotFound = () => {
    return `element could not be found in the document`;
  };
  return {
    pass,
    message: () => {
      return [
        this.utils.matcherHint(
          `${this.isNot ? ".not" : ""}.toBeInTheDocument`,
          "element",
          ""
        ),
        "",
        // eslint-disable-next-line new-cap
        this.utils.RECEIVED_COLOR(this.isNot ? errorFound() : errorNotFound())
      ].join("\n");
    }
  };
}
function toBeEmpty(element) {
  deprecate(
    "toBeEmpty",
    "Please use instead toBeEmptyDOMElement for finding empty nodes in the DOM."
  );
  checkHtmlElement(element, toBeEmpty, this);
  return {
    pass: element.innerHTML === "",
    message: () => {
      return [
        this.utils.matcherHint(
          `${this.isNot ? ".not" : ""}.toBeEmpty`,
          "element",
          ""
        ),
        "",
        "Received:",
        `  ${this.utils.printReceived(element.innerHTML)}`
      ].join("\n");
    }
  };
}
function toBeEmptyDOMElement(element) {
  checkHtmlElement(element, toBeEmptyDOMElement, this);
  return {
    pass: isEmptyElement(element),
    message: () => {
      return [
        this.utils.matcherHint(
          `${this.isNot ? ".not" : ""}.toBeEmptyDOMElement`,
          "element",
          ""
        ),
        "",
        "Received:",
        `  ${this.utils.printReceived(element.innerHTML)}`
      ].join("\n");
    }
  };
}
function isEmptyElement(element) {
  const nonCommentChildNodes = [...element.childNodes].filter((node) => node.nodeType !== 8);
  return nonCommentChildNodes.length === 0;
}
function toContainElement(container, element) {
  checkHtmlElement(container, toContainElement, this);
  if (element !== null) {
    checkHtmlElement(element, toContainElement, this);
  }
  return {
    pass: container.contains(element),
    message: () => {
      return [
        this.utils.matcherHint(
          `${this.isNot ? ".not" : ""}.toContainElement`,
          "element",
          "element"
        ),
        "",
        // eslint-disable-next-line new-cap
        this.utils.RECEIVED_COLOR(`${this.utils.stringify(
          container.cloneNode(false)
        )} ${this.isNot ? "contains:" : "does not contain:"} ${this.utils.stringify(element ? element.cloneNode(false) : element)}
        `)
      ].join("\n");
    }
  };
}
function getNormalizedHtml(container, htmlText) {
  const div = container.ownerDocument.createElement("div");
  div.innerHTML = htmlText;
  return div.innerHTML;
}
function toContainHTML(container, htmlText) {
  checkHtmlElement(container, toContainHTML, this);
  if (typeof htmlText !== "string") {
    throw new Error(`.toContainHTML() expects a string value, got ${htmlText}`);
  }
  return {
    pass: container.outerHTML.includes(getNormalizedHtml(container, htmlText)),
    message: () => {
      return [
        this.utils.matcherHint(
          `${this.isNot ? ".not" : ""}.toContainHTML`,
          "element",
          ""
        ),
        "Expected:",
        // eslint-disable-next-line new-cap
        `  ${this.utils.EXPECTED_COLOR(htmlText)}`,
        "Received:",
        `  ${this.utils.printReceived(container.cloneNode(true))}`
      ].join("\n");
    }
  };
}
function toHaveTextContent(node, checkWith, options = { normalizeWhitespace: true }) {
  checkNode(node, toHaveTextContent, this);
  const textContent = options.normalizeWhitespace ? normalize(node.textContent) : node.textContent.replace(/\u00a0/g, " ");
  const checkingWithEmptyString = textContent !== "" && checkWith === "";
  return {
    pass: !checkingWithEmptyString && matches(textContent, checkWith),
    message: () => {
      const to = this.isNot ? "not to" : "to";
      return getMessage(
        this,
        this.utils.matcherHint(
          `${this.isNot ? ".not" : ""}.toHaveTextContent`,
          "element",
          ""
        ),
        checkingWithEmptyString ? `Checking with empty string will always match, use .toBeEmptyDOMElement() instead` : `Expected element ${to} have text content`,
        checkWith,
        "Received",
        textContent
      );
    }
  };
}
function toHaveAccessibleDescription(htmlElement, expectedAccessibleDescription) {
  checkHtmlElement(htmlElement, toHaveAccessibleDescription, this);
  const actualAccessibleDescription = computeAccessibleDescription(htmlElement);
  const missingExpectedValue = arguments.length === 1;
  let pass = false;
  if (missingExpectedValue) {
    pass = actualAccessibleDescription !== "";
  } else {
    pass = expectedAccessibleDescription instanceof RegExp ? expectedAccessibleDescription.test(actualAccessibleDescription) : this.equals(
      actualAccessibleDescription,
      expectedAccessibleDescription
    );
  }
  return {
    pass,
    message: () => {
      const to = this.isNot ? "not to" : "to";
      return getMessage(
        this,
        this.utils.matcherHint(
          `${this.isNot ? ".not" : ""}.${toHaveAccessibleDescription.name}`,
          "element",
          ""
        ),
        `Expected element ${to} have accessible description`,
        expectedAccessibleDescription,
        "Received",
        actualAccessibleDescription
      );
    }
  };
}
var ariaInvalidName = "aria-invalid";
var validStates = ["false"];
function toHaveAccessibleErrorMessage(htmlElement, expectedAccessibleErrorMessage) {
  checkHtmlElement(htmlElement, toHaveAccessibleErrorMessage, this);
  const to = this.isNot ? "not to" : "to";
  const method = this.isNot ? ".not.toHaveAccessibleErrorMessage" : ".toHaveAccessibleErrorMessage";
  const errormessageId = htmlElement.getAttribute("aria-errormessage");
  const errormessageIdInvalid = !!errormessageId && /\s+/.test(errormessageId);
  if (errormessageIdInvalid) {
    return {
      pass: false,
      message: () => {
        return getMessage(
          this,
          this.utils.matcherHint(method, "element"),
          "Expected element's `aria-errormessage` attribute to be empty or a single, valid ID",
          "",
          "Received",
          `aria-errormessage="${errormessageId}"`
        );
      }
    };
  }
  const ariaInvalidVal = htmlElement.getAttribute(ariaInvalidName);
  const fieldValid = !htmlElement.hasAttribute(ariaInvalidName) || validStates.includes(ariaInvalidVal);
  if (fieldValid) {
    return {
      pass: false,
      message: () => {
        return getMessage(
          this,
          this.utils.matcherHint(method, "element"),
          "Expected element to be marked as invalid with attribute",
          `${ariaInvalidName}="${String(true)}"`,
          "Received",
          htmlElement.hasAttribute("aria-invalid") ? `${ariaInvalidName}="${htmlElement.getAttribute(ariaInvalidName)}` : null
        );
      }
    };
  }
  const error = normalize(
    htmlElement.ownerDocument.getElementById(errormessageId)?.textContent ?? ""
  );
  return {
    pass: expectedAccessibleErrorMessage === void 0 ? Boolean(error) : expectedAccessibleErrorMessage instanceof RegExp ? expectedAccessibleErrorMessage.test(error) : this.equals(error, expectedAccessibleErrorMessage),
    message: () => {
      return getMessage(
        this,
        this.utils.matcherHint(method, "element"),
        `Expected element ${to} have accessible error message`,
        expectedAccessibleErrorMessage ?? "",
        "Received",
        error
      );
    }
  };
}
var elementRoleList = buildElementRoleList(import_aria_query.elementRoles);
function toHaveRole(htmlElement, expectedRole) {
  checkHtmlElement(htmlElement, toHaveRole, this);
  const actualRoles = getExplicitOrImplicitRoles(htmlElement);
  const pass = actualRoles.some((el) => el === expectedRole);
  return {
    pass,
    message: () => {
      const to = this.isNot ? "not to" : "to";
      return getMessage(
        this,
        this.utils.matcherHint(
          `${this.isNot ? ".not" : ""}.${toHaveRole.name}`,
          "element",
          ""
        ),
        `Expected element ${to} have role`,
        expectedRole,
        "Received",
        actualRoles.join(", ")
      );
    }
  };
}
function getExplicitOrImplicitRoles(htmlElement) {
  const hasExplicitRole = htmlElement.hasAttribute("role");
  if (hasExplicitRole) {
    const roleValue = htmlElement.getAttribute("role");
    return roleValue.split(" ").filter(Boolean);
  }
  const implicitRoles = getImplicitAriaRoles(htmlElement);
  return implicitRoles;
}
function getImplicitAriaRoles(currentNode) {
  for (const { match, roles: roles2 } of elementRoleList) {
    if (match(currentNode)) {
      return [...roles2];
    }
  }
  return [];
}
function buildElementRoleList(elementRolesMap) {
  function makeElementSelector({ name, attributes }) {
    return `${name}${attributes.map(({ name: attributeName, value, constraints = [] }) => {
      const shouldNotExist = constraints.indexOf("undefined") !== -1;
      if (shouldNotExist) {
        return `:not([${attributeName}])`;
      } else if (value) {
        return `[${attributeName}="${value}"]`;
      } else {
        return `[${attributeName}]`;
      }
    }).join("")}`;
  }
  function getSelectorSpecificity({ attributes = [] }) {
    return attributes.length;
  }
  function bySelectorSpecificity({ specificity: leftSpecificity }, { specificity: rightSpecificity }) {
    return rightSpecificity - leftSpecificity;
  }
  function match(element) {
    let { attributes = [] } = element;
    const typeTextIndex = attributes.findIndex(
      (attribute) => attribute.value && attribute.name === "type" && attribute.value === "text"
    );
    if (typeTextIndex >= 0) {
      attributes = [
        ...attributes.slice(0, typeTextIndex),
        ...attributes.slice(typeTextIndex + 1)
      ];
    }
    const selector = makeElementSelector({ ...element, attributes });
    return (node) => {
      if (typeTextIndex >= 0 && node.type !== "text") {
        return false;
      }
      return node.matches(selector);
    };
  }
  let result = [];
  for (const [element, roles2] of elementRolesMap.entries()) {
    result = [
      ...result,
      {
        match: match(element),
        roles: Array.from(roles2),
        specificity: getSelectorSpecificity(element)
      }
    ];
  }
  return result.sort(bySelectorSpecificity);
}
function toHaveAccessibleName(htmlElement, expectedAccessibleName) {
  checkHtmlElement(htmlElement, toHaveAccessibleName, this);
  const actualAccessibleName = computeAccessibleName(htmlElement);
  const missingExpectedValue = arguments.length === 1;
  let pass = false;
  if (missingExpectedValue) {
    pass = actualAccessibleName !== "";
  } else {
    pass = expectedAccessibleName instanceof RegExp ? expectedAccessibleName.test(actualAccessibleName) : this.equals(actualAccessibleName, expectedAccessibleName);
  }
  return {
    pass,
    message: () => {
      const to = this.isNot ? "not to" : "to";
      return getMessage(
        this,
        this.utils.matcherHint(
          `${this.isNot ? ".not" : ""}.${toHaveAccessibleName.name}`,
          "element",
          ""
        ),
        `Expected element ${to} have accessible name`,
        expectedAccessibleName,
        "Received",
        actualAccessibleName
      );
    }
  };
}
function printAttribute(stringify, name, value) {
  return value === void 0 ? name : `${name}=${stringify(value)}`;
}
function getAttributeComment(stringify, name, value) {
  return value === void 0 ? `element.hasAttribute(${stringify(name)})` : `element.getAttribute(${stringify(name)}) === ${stringify(value)}`;
}
function toHaveAttribute(htmlElement, name, expectedValue) {
  checkHtmlElement(htmlElement, toHaveAttribute, this);
  const isExpectedValuePresent = expectedValue !== void 0;
  const hasAttribute = htmlElement.hasAttribute(name);
  const receivedValue = htmlElement.getAttribute(name);
  return {
    pass: isExpectedValuePresent ? hasAttribute && this.equals(receivedValue, expectedValue) : hasAttribute,
    message: () => {
      const to = this.isNot ? "not to" : "to";
      const receivedAttribute = hasAttribute ? printAttribute(this.utils.stringify, name, receivedValue) : null;
      const matcher = this.utils.matcherHint(
        `${this.isNot ? ".not" : ""}.toHaveAttribute`,
        "element",
        this.utils.printExpected(name),
        {
          secondArgument: isExpectedValuePresent ? this.utils.printExpected(expectedValue) : void 0,
          comment: getAttributeComment(
            this.utils.stringify,
            name,
            expectedValue
          )
        }
      );
      return getMessage(
        this,
        matcher,
        `Expected the element ${to} have attribute`,
        printAttribute(this.utils.stringify, name, expectedValue),
        "Received",
        receivedAttribute
      );
    }
  };
}
function getExpectedClassNamesAndOptions(params) {
  const lastParam = params.pop();
  let expectedClassNames, options;
  if (typeof lastParam === "object" && !(lastParam instanceof RegExp)) {
    expectedClassNames = params;
    options = lastParam;
  } else {
    expectedClassNames = params.concat(lastParam);
    options = { exact: false };
  }
  return { expectedClassNames, options };
}
function splitClassNames(str) {
  if (!str) return [];
  return str.split(/\s+/).filter((s2) => s2.length > 0);
}
function isSubset$1(subset, superset) {
  return subset.every(
    (strOrRegexp) => typeof strOrRegexp === "string" ? superset.includes(strOrRegexp) : superset.some((className) => strOrRegexp.test(className))
  );
}
function toHaveClass(htmlElement, ...params) {
  checkHtmlElement(htmlElement, toHaveClass, this);
  const { expectedClassNames, options } = getExpectedClassNamesAndOptions(params);
  const received = splitClassNames(htmlElement.getAttribute("class"));
  const expected = expectedClassNames.reduce(
    (acc, className) => acc.concat(
      typeof className === "string" || !className ? splitClassNames(className) : className
    ),
    []
  );
  const hasRegExp = expected.some((className) => className instanceof RegExp);
  if (options.exact && hasRegExp) {
    throw new Error("Exact option does not support RegExp expected class names");
  }
  if (options.exact) {
    return {
      pass: isSubset$1(expected, received) && expected.length === received.length,
      message: () => {
        const to = this.isNot ? "not to" : "to";
        return getMessage(
          this,
          this.utils.matcherHint(
            `${this.isNot ? ".not" : ""}.toHaveClass`,
            "element",
            this.utils.printExpected(expected.join(" "))
          ),
          `Expected the element ${to} have EXACTLY defined classes`,
          expected.join(" "),
          "Received",
          received.join(" ")
        );
      }
    };
  }
  return expected.length > 0 ? {
    pass: isSubset$1(expected, received),
    message: () => {
      const to = this.isNot ? "not to" : "to";
      return getMessage(
        this,
        this.utils.matcherHint(
          `${this.isNot ? ".not" : ""}.toHaveClass`,
          "element",
          this.utils.printExpected(expected.join(" "))
        ),
        `Expected the element ${to} have class`,
        expected.join(" "),
        "Received",
        received.join(" ")
      );
    }
  } : {
    pass: this.isNot ? received.length > 0 : false,
    message: () => this.isNot ? getMessage(
      this,
      this.utils.matcherHint(".not.toHaveClass", "element", ""),
      "Expected the element to have classes",
      "(none)",
      "Received",
      received.join(" ")
    ) : [
      this.utils.matcherHint(`.toHaveClass`, "element"),
      "At least one expected class must be provided."
    ].join("\n")
  };
}
function getStyleDeclaration(document, css) {
  const styles = {};
  const copy = document.createElement("div");
  Object.keys(css).forEach((property) => {
    copy.style[property] = css[property];
    styles[property] = copy.style[property];
  });
  return styles;
}
function isSubset(styles, computedStyle) {
  return !!Object.keys(styles).length && Object.entries(styles).every(([prop, value]) => {
    const isCustomProperty = prop.startsWith("--");
    const spellingVariants = [prop];
    if (!isCustomProperty) spellingVariants.push(prop.toLowerCase());
    return spellingVariants.some(
      (name) => computedStyle[name] === value || computedStyle.getPropertyValue(name) === value
    );
  });
}
function printoutStyles(styles) {
  return Object.keys(styles).sort().map((prop) => `${prop}: ${styles[prop]};`).join("\n");
}
function expectedDiff(diffFn, expected, computedStyles) {
  const received = Array.from(computedStyles).filter((prop) => expected[prop] !== void 0).reduce(
    (obj, prop) => Object.assign(obj, { [prop]: computedStyles.getPropertyValue(prop) }),
    {}
  );
  const diffOutput = diffFn(printoutStyles(expected), printoutStyles(received));
  return diffOutput.replace(`${import_picocolors.default.red("+ Received")}
`, "");
}
function toHaveStyle(htmlElement, css) {
  checkHtmlElement(htmlElement, toHaveStyle, this);
  const parsedCSS = typeof css === "object" ? css : parseCSS(css, toHaveStyle, this);
  const { getComputedStyle } = htmlElement.ownerDocument.defaultView;
  const expected = getStyleDeclaration(htmlElement.ownerDocument, parsedCSS);
  const received = getComputedStyle(htmlElement);
  return {
    pass: isSubset(expected, received),
    message: () => {
      const matcher = `${this.isNot ? ".not" : ""}.toHaveStyle`;
      return [
        this.utils.matcherHint(matcher, "element", ""),
        expectedDiff(this.utils.diff, expected, received)
      ].join("\n\n");
    }
  };
}
function toHaveFocus(element) {
  checkHtmlElement(element, toHaveFocus, this);
  return {
    pass: element.ownerDocument.activeElement === element,
    message: () => {
      return [
        this.utils.matcherHint(
          `${this.isNot ? ".not" : ""}.toHaveFocus`,
          "element",
          ""
        ),
        "",
        ...this.isNot ? [
          "Received element is focused:",
          `  ${this.utils.printReceived(element)}`
        ] : [
          "Expected element with focus:",
          `  ${this.utils.printExpected(element)}`,
          "Received element with focus:",
          `  ${this.utils.printReceived(
            element.ownerDocument.activeElement
          )}`
        ]
      ].join("\n");
    }
  };
}
function getMultiElementValue(elements) {
  const types = [...new Set(elements.map((element) => element.type))];
  if (types.length !== 1) {
    throw new Error(
      "Multiple form elements with the same name must be of the same type"
    );
  }
  switch (types[0]) {
    case "radio": {
      const theChosenOne = elements.find((radio) => radio.checked);
      return theChosenOne ? theChosenOne.value : void 0;
    }
    case "checkbox":
      return elements.filter((checkbox) => checkbox.checked).map((checkbox) => checkbox.value);
    default:
      return elements.map((element) => element.value);
  }
}
function getFormValue(container, name) {
  const elements = [...container.querySelectorAll(`[name="${(0, import_css.default)(name)}"]`)];
  if (elements.length === 0) {
    return void 0;
  }
  switch (elements.length) {
    case 1:
      return getSingleElementValue(elements[0]);
    default:
      return getMultiElementValue(elements);
  }
}
function getPureName(name) {
  return /\[\]$/.test(name) ? name.slice(0, -2) : name;
}
function getAllFormValues(container) {
  const names = Array.from(container.elements).map((element) => element.name);
  return names.reduce(
    (obj, name) => ({
      ...obj,
      [getPureName(name)]: getFormValue(container, name)
    }),
    {}
  );
}
function toHaveFormValues(formElement, expectedValues) {
  checkHtmlElement(formElement, toHaveFormValues, this);
  if (!formElement.elements) {
    throw new Error("toHaveFormValues must be called on a form or a fieldset");
  }
  const formValues = getAllFormValues(formElement);
  return {
    pass: Object.entries(expectedValues).every(
      ([name, expectedValue]) => compareAsSet(formValues[name], expectedValue)
    ),
    message: () => {
      const to = this.isNot ? "not to" : "to";
      const matcher = `${this.isNot ? ".not" : ""}.toHaveFormValues`;
      const commonKeyValues = Object.keys(formValues).filter((key) => expectedValues.hasOwnProperty(key)).reduce((obj, key) => ({ ...obj, [key]: formValues[key] }), {});
      return [
        this.utils.matcherHint(matcher, "element", ""),
        `Expected the element ${to} have form values`,
        this.utils.diff(expectedValues, commonKeyValues)
      ].join("\n\n");
    }
  };
}
function isStyleVisible(element) {
  const { getComputedStyle } = element.ownerDocument.defaultView;
  const { display: display2, visibility, opacity } = getComputedStyle(element);
  return display2 !== "none" && visibility !== "hidden" && visibility !== "collapse" && opacity !== "0" && opacity !== 0;
}
function isAttributeVisible(element, previousElement) {
  let detailsVisibility;
  if (previousElement) {
    detailsVisibility = element.nodeName === "DETAILS" && previousElement.nodeName !== "SUMMARY" ? element.hasAttribute("open") : true;
  } else {
    detailsVisibility = element.nodeName === "DETAILS" ? element.hasAttribute("open") : true;
  }
  return !element.hasAttribute("hidden") && detailsVisibility;
}
function isElementVisible(element, previousElement) {
  return isStyleVisible(element) && isAttributeVisible(element, previousElement) && (!element.parentElement || isElementVisible(element.parentElement, element));
}
function toBeVisible(element) {
  checkHtmlElement(element, toBeVisible, this);
  const isInDocument = element.ownerDocument === element.getRootNode({ composed: true });
  const isVisible = isInDocument && isElementVisible(element);
  return {
    pass: isVisible,
    message: () => {
      const is = isVisible ? "is" : "is not";
      return [
        this.utils.matcherHint(
          `${this.isNot ? ".not" : ""}.toBeVisible`,
          "element",
          ""
        ),
        "",
        `Received element ${is} visible${isInDocument ? "" : " (element is not in the document)"}:`,
        `  ${this.utils.printReceived(element.cloneNode(false))}`
      ].join("\n");
    }
  };
}
var FORM_TAGS$2 = [
  "fieldset",
  "input",
  "select",
  "optgroup",
  "option",
  "button",
  "textarea"
];
function isFirstLegendChildOfFieldset(element, parent) {
  return getTag(element) === "legend" && getTag(parent) === "fieldset" && element.isSameNode(
    Array.from(parent.children).find((child) => getTag(child) === "legend")
  );
}
function isElementDisabledByParent(element, parent) {
  return isElementDisabled(parent) && !isFirstLegendChildOfFieldset(element, parent);
}
function isCustomElement(tag) {
  return tag.includes("-");
}
function canElementBeDisabled(element) {
  const tag = getTag(element);
  return FORM_TAGS$2.includes(tag) || isCustomElement(tag);
}
function isElementDisabled(element) {
  return canElementBeDisabled(element) && element.hasAttribute("disabled");
}
function isAncestorDisabled(element) {
  const parent = element.parentElement;
  return Boolean(parent) && (isElementDisabledByParent(element, parent) || isAncestorDisabled(parent));
}
function isElementOrAncestorDisabled(element) {
  return canElementBeDisabled(element) && (isElementDisabled(element) || isAncestorDisabled(element));
}
function toBeDisabled(element) {
  checkHtmlElement(element, toBeDisabled, this);
  const isDisabled2 = isElementOrAncestorDisabled(element);
  return {
    pass: isDisabled2,
    message: () => {
      const is = isDisabled2 ? "is" : "is not";
      return [
        this.utils.matcherHint(
          `${this.isNot ? ".not" : ""}.toBeDisabled`,
          "element",
          ""
        ),
        "",
        `Received element ${is} disabled:`,
        `  ${this.utils.printReceived(element.cloneNode(false))}`
      ].join("\n");
    }
  };
}
function toBeEnabled(element) {
  checkHtmlElement(element, toBeEnabled, this);
  const isEnabled = !isElementOrAncestorDisabled(element);
  return {
    pass: isEnabled,
    message: () => {
      const is = isEnabled ? "is" : "is not";
      return [
        this.utils.matcherHint(
          `${this.isNot ? ".not" : ""}.toBeEnabled`,
          "element",
          ""
        ),
        "",
        `Received element ${is} enabled:`,
        `  ${this.utils.printReceived(element.cloneNode(false))}`
      ].join("\n");
    }
  };
}
var FORM_TAGS$1 = ["select", "textarea"];
var ARIA_FORM_TAGS = ["input", "select", "textarea"];
var UNSUPPORTED_INPUT_TYPES = [
  "color",
  "hidden",
  "range",
  "submit",
  "image",
  "reset"
];
var SUPPORTED_ARIA_ROLES = [
  "checkbox",
  "combobox",
  "gridcell",
  "listbox",
  "radiogroup",
  "spinbutton",
  "textbox",
  "tree"
];
function isRequiredOnFormTagsExceptInput(element) {
  return FORM_TAGS$1.includes(getTag(element)) && element.hasAttribute("required");
}
function isRequiredOnSupportedInput(element) {
  return getTag(element) === "input" && element.hasAttribute("required") && (element.hasAttribute("type") && !UNSUPPORTED_INPUT_TYPES.includes(element.getAttribute("type")) || !element.hasAttribute("type"));
}
function isElementRequiredByARIA(element) {
  return element.hasAttribute("aria-required") && element.getAttribute("aria-required") === "true" && (ARIA_FORM_TAGS.includes(getTag(element)) || element.hasAttribute("role") && SUPPORTED_ARIA_ROLES.includes(element.getAttribute("role")));
}
function toBeRequired(element) {
  checkHtmlElement(element, toBeRequired, this);
  const isRequired = isRequiredOnFormTagsExceptInput(element) || isRequiredOnSupportedInput(element) || isElementRequiredByARIA(element);
  return {
    pass: isRequired,
    message: () => {
      const is = isRequired ? "is" : "is not";
      return [
        this.utils.matcherHint(
          `${this.isNot ? ".not" : ""}.toBeRequired`,
          "element",
          ""
        ),
        "",
        `Received element ${is} required:`,
        `  ${this.utils.printReceived(element.cloneNode(false))}`
      ].join("\n");
    }
  };
}
var FORM_TAGS = ["form", "input", "select", "textarea"];
function isElementHavingAriaInvalid(element) {
  return element.hasAttribute("aria-invalid") && element.getAttribute("aria-invalid") !== "false";
}
function isSupportsValidityMethod(element) {
  return FORM_TAGS.includes(getTag(element));
}
function isElementInvalid(element) {
  const isHaveAriaInvalid = isElementHavingAriaInvalid(element);
  if (isSupportsValidityMethod(element)) {
    return isHaveAriaInvalid || !element.checkValidity();
  } else {
    return isHaveAriaInvalid;
  }
}
function toBeInvalid(element) {
  checkHtmlElement(element, toBeInvalid, this);
  const isInvalid = isElementInvalid(element);
  return {
    pass: isInvalid,
    message: () => {
      const is = isInvalid ? "is" : "is not";
      return [
        this.utils.matcherHint(
          `${this.isNot ? ".not" : ""}.toBeInvalid`,
          "element",
          ""
        ),
        "",
        `Received element ${is} currently invalid:`,
        `  ${this.utils.printReceived(element.cloneNode(false))}`
      ].join("\n");
    }
  };
}
function toBeValid(element) {
  checkHtmlElement(element, toBeValid, this);
  const isValid = !isElementInvalid(element);
  return {
    pass: isValid,
    message: () => {
      const is = isValid ? "is" : "is not";
      return [
        this.utils.matcherHint(
          `${this.isNot ? ".not" : ""}.toBeValid`,
          "element",
          ""
        ),
        "",
        `Received element ${is} currently valid:`,
        `  ${this.utils.printReceived(element.cloneNode(false))}`
      ].join("\n");
    }
  };
}
function toHaveValue(htmlElement, expectedValue) {
  checkHtmlElement(htmlElement, toHaveValue, this);
  if (htmlElement.tagName.toLowerCase() === "input" && ["checkbox", "radio"].includes(htmlElement.type)) {
    throw new Error(
      "input with type=checkbox or type=radio cannot be used with .toHaveValue(). Use .toBeChecked() for type=checkbox or .toHaveFormValues() instead"
    );
  }
  const receivedValue = getSingleElementValue(htmlElement);
  const expectsValue = expectedValue !== void 0;
  let expectedTypedValue = expectedValue;
  let receivedTypedValue = receivedValue;
  if (expectedValue == receivedValue && expectedValue !== receivedValue) {
    expectedTypedValue = `${expectedValue} (${typeof expectedValue})`;
    receivedTypedValue = `${receivedValue} (${typeof receivedValue})`;
  }
  return {
    pass: expectsValue ? compareAsSet(receivedValue, expectedValue) : Boolean(receivedValue),
    message: () => {
      const to = this.isNot ? "not to" : "to";
      const matcher = this.utils.matcherHint(
        `${this.isNot ? ".not" : ""}.toHaveValue`,
        "element",
        expectedValue
      );
      return getMessage(
        this,
        matcher,
        `Expected the element ${to} have value`,
        expectsValue ? expectedTypedValue : "(any)",
        "Received",
        receivedTypedValue
      );
    }
  };
}
function toHaveDisplayValue(htmlElement, expectedValue) {
  checkHtmlElement(htmlElement, toHaveDisplayValue, this);
  const tagName = htmlElement.tagName.toLowerCase();
  if (!["select", "input", "textarea"].includes(tagName)) {
    throw new Error(
      ".toHaveDisplayValue() currently supports only input, textarea or select elements, try with another matcher instead."
    );
  }
  if (tagName === "input" && ["radio", "checkbox"].includes(htmlElement.type)) {
    throw new Error(
      `.toHaveDisplayValue() currently does not support input[type="${htmlElement.type}"], try with another matcher instead.`
    );
  }
  const values = getValues(tagName, htmlElement);
  const expectedValues = getExpectedValues(expectedValue);
  const numberOfMatchesWithValues = expectedValues.filter(
    (expected) => values.some(
      (value) => expected instanceof RegExp ? expected.test(value) : this.equals(value, String(expected))
    )
  ).length;
  const matchedWithAllValues = numberOfMatchesWithValues === values.length;
  const matchedWithAllExpectedValues = numberOfMatchesWithValues === expectedValues.length;
  return {
    pass: matchedWithAllValues && matchedWithAllExpectedValues,
    message: () => getMessage(
      this,
      this.utils.matcherHint(
        `${this.isNot ? ".not" : ""}.toHaveDisplayValue`,
        "element",
        ""
      ),
      `Expected element ${this.isNot ? "not " : ""}to have display value`,
      expectedValue,
      "Received",
      values
    )
  };
}
function getValues(tagName, htmlElement) {
  return tagName === "select" ? Array.from(htmlElement).filter((option) => option.selected).map((option) => option.textContent) : [htmlElement.value];
}
function getExpectedValues(expectedValue) {
  return expectedValue instanceof Array ? expectedValue : [expectedValue];
}
function toBeChecked(element) {
  checkHtmlElement(element, toBeChecked, this);
  const isValidInput = () => {
    return element.tagName.toLowerCase() === "input" && ["checkbox", "radio"].includes(element.type);
  };
  const isValidAriaElement = () => {
    return roleSupportsChecked(element.getAttribute("role")) && ["true", "false"].includes(element.getAttribute("aria-checked"));
  };
  if (!isValidInput() && !isValidAriaElement()) {
    return {
      pass: false,
      message: () => `only inputs with type="checkbox" or type="radio" or elements with ${supportedRolesSentence()} and a valid aria-checked attribute can be used with .toBeChecked(). Use .toHaveValue() instead`
    };
  }
  const isChecked = () => {
    if (isValidInput()) return element.checked;
    return element.getAttribute("aria-checked") === "true";
  };
  return {
    pass: isChecked(),
    message: () => {
      const is = isChecked() ? "is" : "is not";
      return [
        this.utils.matcherHint(
          `${this.isNot ? ".not" : ""}.toBeChecked`,
          "element",
          ""
        ),
        "",
        `Received element ${is} checked:`,
        `  ${this.utils.printReceived(element.cloneNode(false))}`
      ].join("\n");
    }
  };
}
function supportedRolesSentence() {
  return toSentence(
    supportedRoles().map((role) => `role="${role}"`),
    { lastWordConnector: " or " }
  );
}
function supportedRoles() {
  return import_aria_query.roles.keys().filter(roleSupportsChecked);
}
function roleSupportsChecked(role) {
  return import_aria_query.roles.get(role)?.props["aria-checked"] !== void 0;
}
function toBePartiallyChecked(element) {
  checkHtmlElement(element, toBePartiallyChecked, this);
  const isValidInput = () => {
    return element.tagName.toLowerCase() === "input" && element.type === "checkbox";
  };
  const isValidAriaElement = () => {
    return element.getAttribute("role") === "checkbox";
  };
  if (!isValidInput() && !isValidAriaElement()) {
    return {
      pass: false,
      message: () => 'only inputs with type="checkbox" or elements with role="checkbox" and a valid aria-checked attribute can be used with .toBePartiallyChecked(). Use .toHaveValue() instead'
    };
  }
  const isPartiallyChecked = () => {
    const isAriaMixed = element.getAttribute("aria-checked") === "mixed";
    if (isValidInput()) {
      return element.indeterminate || isAriaMixed;
    }
    return isAriaMixed;
  };
  return {
    pass: isPartiallyChecked(),
    message: () => {
      const is = isPartiallyChecked() ? "is" : "is not";
      return [
        this.utils.matcherHint(
          `${this.isNot ? ".not" : ""}.toBePartiallyChecked`,
          "element",
          ""
        ),
        "",
        `Received element ${is} partially checked:`,
        `  ${this.utils.printReceived(element.cloneNode(false))}`
      ].join("\n");
    }
  };
}
function toHaveDescription(htmlElement, checkWith) {
  deprecate(
    "toHaveDescription",
    "Please use toHaveAccessibleDescription."
  );
  checkHtmlElement(htmlElement, toHaveDescription, this);
  const expectsDescription = checkWith !== void 0;
  const descriptionIDRaw = htmlElement.getAttribute("aria-describedby") || "";
  const descriptionIDs = descriptionIDRaw.split(/\s+/).filter(Boolean);
  let description = "";
  if (descriptionIDs.length > 0) {
    const document = htmlElement.ownerDocument;
    const descriptionEls = descriptionIDs.map((descriptionID) => document.getElementById(descriptionID)).filter(Boolean);
    description = normalize(descriptionEls.map((el) => el.textContent).join(" "));
  }
  return {
    pass: expectsDescription ? checkWith instanceof RegExp ? checkWith.test(description) : this.equals(description, checkWith) : Boolean(description),
    message: () => {
      const to = this.isNot ? "not to" : "to";
      return getMessage(
        this,
        this.utils.matcherHint(
          `${this.isNot ? ".not" : ""}.toHaveDescription`,
          "element",
          ""
        ),
        `Expected the element ${to} have description`,
        this.utils.printExpected(checkWith),
        "Received",
        this.utils.printReceived(description)
      );
    }
  };
}
function toHaveErrorMessage(htmlElement, checkWith) {
  deprecate("toHaveErrorMessage", "Please use toHaveAccessibleErrorMessage.");
  checkHtmlElement(htmlElement, toHaveErrorMessage, this);
  if (!htmlElement.hasAttribute("aria-invalid") || htmlElement.getAttribute("aria-invalid") === "false") {
    const not = this.isNot ? ".not" : "";
    return {
      pass: false,
      message: () => {
        return getMessage(
          this,
          this.utils.matcherHint(`${not}.toHaveErrorMessage`, "element", ""),
          `Expected the element to have invalid state indicated by`,
          'aria-invalid="true"',
          "Received",
          htmlElement.hasAttribute("aria-invalid") ? `aria-invalid="${htmlElement.getAttribute("aria-invalid")}"` : this.utils.printReceived("")
        );
      }
    };
  }
  const expectsErrorMessage = checkWith !== void 0;
  const errormessageIDRaw = htmlElement.getAttribute("aria-errormessage") || "";
  const errormessageIDs = errormessageIDRaw.split(/\s+/).filter(Boolean);
  let errormessage = "";
  if (errormessageIDs.length > 0) {
    const document = htmlElement.ownerDocument;
    const errormessageEls = errormessageIDs.map((errormessageID) => document.getElementById(errormessageID)).filter(Boolean);
    errormessage = normalize(
      errormessageEls.map((el) => el.textContent).join(" ")
    );
  }
  return {
    pass: expectsErrorMessage ? checkWith instanceof RegExp ? checkWith.test(errormessage) : this.equals(errormessage, checkWith) : Boolean(errormessage),
    message: () => {
      const to = this.isNot ? "not to" : "to";
      return getMessage(
        this,
        this.utils.matcherHint(
          `${this.isNot ? ".not" : ""}.toHaveErrorMessage`,
          "element",
          ""
        ),
        `Expected the element ${to} have error message`,
        this.utils.printExpected(checkWith),
        "Received",
        this.utils.printReceived(errormessage)
      );
    }
  };
}
function getSelection(element) {
  const selection = element.ownerDocument.getSelection();
  if (["input", "textarea"].includes(element.tagName.toLowerCase())) {
    if (["radio", "checkbox"].includes(element.type)) return "";
    return element.value.toString().substring(element.selectionStart, element.selectionEnd);
  }
  if (selection.anchorNode === null || selection.focusNode === null) {
    return "";
  }
  const originalRange = selection.getRangeAt(0);
  const temporaryRange = element.ownerDocument.createRange();
  if (selection.containsNode(element, false)) {
    temporaryRange.selectNodeContents(element);
    selection.removeAllRanges();
    selection.addRange(temporaryRange);
  } else if (element.contains(selection.anchorNode) && element.contains(selection.focusNode)) ;
  else {
    const selectionStartsWithinElement = element === originalRange.startContainer || element.contains(originalRange.startContainer);
    const selectionEndsWithinElement = element === originalRange.endContainer || element.contains(originalRange.endContainer);
    selection.removeAllRanges();
    if (selectionStartsWithinElement || selectionEndsWithinElement) {
      temporaryRange.selectNodeContents(element);
      if (selectionStartsWithinElement) {
        temporaryRange.setStart(
          originalRange.startContainer,
          originalRange.startOffset
        );
      }
      if (selectionEndsWithinElement) {
        temporaryRange.setEnd(
          originalRange.endContainer,
          originalRange.endOffset
        );
      }
      selection.addRange(temporaryRange);
    }
  }
  const result = selection.toString();
  selection.removeAllRanges();
  selection.addRange(originalRange);
  return result;
}
function toHaveSelection(htmlElement, expectedSelection) {
  checkHtmlElement(htmlElement, toHaveSelection, this);
  const expectsSelection = expectedSelection !== void 0;
  if (expectsSelection && typeof expectedSelection !== "string") {
    throw new Error(`expected selection must be a string or undefined`);
  }
  const receivedSelection = getSelection(htmlElement);
  return {
    pass: expectsSelection ? compareAsSet(receivedSelection, expectedSelection) : Boolean(receivedSelection),
    message: () => {
      const to = this.isNot ? "not to" : "to";
      const matcher = this.utils.matcherHint(
        `${this.isNot ? ".not" : ""}.toHaveSelection`,
        "element",
        expectedSelection
      );
      return getMessage(
        this,
        matcher,
        `Expected the element ${to} have selection`,
        expectsSelection ? expectedSelection : "(any)",
        "Received",
        receivedSelection
      );
    }
  };
}
function toBePressed(element) {
  checkHtmlElement(element, toBePressed, this);
  const roles2 = (element.getAttribute("role") || "").split(" ").map((role) => role.trim());
  const isButton = element.tagName.toLowerCase() === "button" || element.tagName.toLowerCase() === "input" && element.type === "button" || roles2.includes("button");
  const pressedAttribute = element.getAttribute("aria-pressed");
  const isValidAriaElement = pressedAttribute === "true" || pressedAttribute === "false";
  if (!isButton || !isValidAriaElement) {
    return {
      pass: false,
      message: () => `Only button or input with type="button" or element with role="button" and a valid aria-pressed attribute can be used with .toBePressed()`
    };
  }
  const isPressed = pressedAttribute === "true";
  return {
    pass: isButton && isPressed,
    message: () => {
      const matcher = this.utils.matcherHint(
        `${this.isNot ? ".not" : ""}.toBePressed`,
        "element",
        ""
      );
      return getMessage(
        this,
        matcher,
        `Expected element to have`,
        `aria-pressed="${this.isNot ? "false" : "true"}"`,
        `Received`,
        `aria-pressed="${pressedAttribute}"`
      );
    }
  };
}
function toBePartiallyPressed(element) {
  checkHtmlElement(element, toBePartiallyPressed, this);
  const roles2 = (element.getAttribute("role") || "").split(" ").map((role) => role.trim());
  const isButton = element.tagName.toLowerCase() === "button" || element.tagName.toLowerCase() === "input" && element.type === "button" || roles2.includes("button");
  const pressedAttribute = element.getAttribute("aria-pressed");
  const isValidAriaElement = pressedAttribute === "true" || pressedAttribute === "false" || pressedAttribute === "mixed";
  if (!isButton || !isValidAriaElement) {
    return {
      pass: false,
      message: () => `Only button or input with type="button" or element with role="button" and a valid aria-pressed attribute can be used with .toBePartiallyPressed()`
    };
  }
  const isPartiallyPressed = pressedAttribute === "mixed";
  return {
    pass: isButton && isPartiallyPressed,
    message: () => {
      const to = this.isNot ? "not to" : "to";
      const matcher = this.utils.matcherHint(
        `${this.isNot ? ".not" : ""}.toBePartiallyPressed`,
        "element",
        ""
      );
      return getMessage(
        this,
        matcher,
        `Expected element ${to} have`,
        `aria-pressed="mixed"`,
        `Received`,
        `aria-pressed="${pressedAttribute}"`
      );
    }
  };
}
var DOCUMENT_POSITION_DISCONNECTED = 1;
var DOCUMENT_POSITION_PRECEDING = 2;
var DOCUMENT_POSITION_FOLLOWING = 4;
var DOCUMENT_POSITION_CONTAINS = 8;
var DOCUMENT_POSITION_CONTAINED_BY = 16;
var DOCUMENT_POSITION_IMPLEMENTATION_SPECIFIC = 32;
var DOCUMENT_POSITIONS_STRINGS = {
  [DOCUMENT_POSITION_DISCONNECTED]: "Node.DOCUMENT_POSITION_DISCONNECTED",
  [DOCUMENT_POSITION_PRECEDING]: "Node.DOCUMENT_POSITION_PRECEDING",
  [DOCUMENT_POSITION_FOLLOWING]: "Node.DOCUMENT_POSITION_FOLLOWING",
  [DOCUMENT_POSITION_CONTAINS]: "Node.DOCUMENT_POSITION_CONTAINS",
  [DOCUMENT_POSITION_CONTAINED_BY]: "Node.DOCUMENT_POSITION_CONTAINED_BY",
  [DOCUMENT_POSITION_IMPLEMENTATION_SPECIFIC]: "Node.DOCUMENT_POSITION_IMPLEMENTATION_SPECIFIC"
};
function makeDocumentPositionErrorString(documentPosition) {
  if (documentPosition in DOCUMENT_POSITIONS_STRINGS) {
    return `${DOCUMENT_POSITIONS_STRINGS[documentPosition]} (${documentPosition})`;
  }
  return `Unknown document position (${documentPosition})`;
}
function checkToAppear(methodName, targetDocumentPosition) {
  return function(element, secondElement) {
    checkHtmlElement(element, toAppearBefore, this);
    checkHtmlElement(secondElement, toAppearBefore, this);
    const documentPosition = element.compareDocumentPosition(secondElement);
    const pass = documentPosition === targetDocumentPosition;
    return {
      pass,
      message: () => {
        return [
          this.utils.matcherHint(
            `${this.isNot ? ".not" : ""}.${methodName}`,
            "element",
            "secondElement"
          ),
          "",
          `Received: ${makeDocumentPositionErrorString(documentPosition)}`
        ].join("\n");
      }
    };
  };
}
function toAppearBefore(element, secondElement) {
  return checkToAppear("toAppearBefore", DOCUMENT_POSITION_FOLLOWING).apply(
    this,
    [element, secondElement]
  );
}
function toAppearAfter(element, secondElement) {
  return checkToAppear("toAppearAfter", DOCUMENT_POSITION_PRECEDING).apply(
    this,
    [element, secondElement]
  );
}
var extensions = Object.freeze({
  __proto__: null,
  toAppearAfter,
  toAppearBefore,
  toBeChecked,
  toBeDisabled,
  toBeEmpty,
  toBeEmptyDOMElement,
  toBeEnabled,
  toBeInTheDOM,
  toBeInTheDocument,
  toBeInvalid,
  toBePartiallyChecked,
  toBePartiallyPressed,
  toBePressed,
  toBeRequired,
  toBeValid,
  toBeVisible,
  toContainElement,
  toContainHTML,
  toHaveAccessibleDescription,
  toHaveAccessibleErrorMessage,
  toHaveAccessibleName,
  toHaveAttribute,
  toHaveClass,
  toHaveDescription,
  toHaveDisplayValue,
  toHaveErrorMessage,
  toHaveFocus,
  toHaveFormValues,
  toHaveRole,
  toHaveSelection,
  toHaveStyle,
  toHaveTextContent,
  toHaveValue
});

// node_modules/.pnpm/@testing-library+jest-dom@6.9.1/node_modules/@testing-library/jest-dom/dist/index.mjs
var import_redent2 = __toESM(require_redent(), 1);
var import_aria_query2 = __toESM(require_lib(), 1);
var import_picocolors2 = __toESM(require_picocolors(), 1);
var import_css2 = __toESM(require_css_escape(), 1);
expect.extend(extensions);
//# sourceMappingURL=@testing-library_jest-dom.js.map
