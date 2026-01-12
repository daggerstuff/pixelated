import {
  __commonJS
} from "./chunk-PLDDJCW6.js";

// node_modules/.pnpm/dayjs@1.11.19/node_modules/dayjs/plugin/calendar.js
var require_calendar = __commonJS({
  "node_modules/.pnpm/dayjs@1.11.19/node_modules/dayjs/plugin/calendar.js"(exports, module) {
    !(function(e, t) {
      "object" == typeof exports && "undefined" != typeof module ? module.exports = t() : "function" == typeof define && define.amd ? define(t) : (e = "undefined" != typeof globalThis ? globalThis : e || self).dayjs_plugin_calendar = t();
    })(exports, (function() {
      "use strict";
      return function(e, t, a) {
        var n = "h:mm A", d = { lastDay: "[Yesterday at] " + n, sameDay: "[Today at] " + n, nextDay: "[Tomorrow at] " + n, nextWeek: "dddd [at] " + n, lastWeek: "[Last] dddd [at] " + n, sameElse: "MM/DD/YYYY" };
        t.prototype.calendar = function(e2, t2) {
          var n2 = t2 || this.$locale().calendar || d, o = a(e2 || void 0).startOf("d"), s = this.diff(o, "d", true), i = "sameElse", f = s < -6 ? i : s < -1 ? "lastWeek" : s < 0 ? "lastDay" : s < 1 ? "sameDay" : s < 2 ? "nextDay" : s < 7 ? "nextWeek" : i, l = n2[f] || d[f];
          return "function" == typeof l ? l.call(this, a()) : this.format(l);
        };
      };
    }));
  }
});
export default require_calendar();
//# sourceMappingURL=dayjs_plugin_calendar.js.map
