// node_modules/.pnpm/piccolore@0.1.3/node_modules/piccolore/dist/index.js
var e = globalThis.process || {};
var t = e.argv || [];
var n = e.env || {};
var r = !(n.NO_COLOR || t.includes(`--no-color`)) && (!!n.FORCE_COLOR || t.includes(`--color`) || e.platform === `win32` || (e.stdout || {}).isTTY && n.TERM !== `dumb` || !!n.CI);
var i = (e2, t2, n2 = e2) => (r2) => {
  let i2 = `` + r2, o2 = i2.indexOf(t2, e2.length);
  return ~o2 ? e2 + a(i2, t2, n2, o2) + t2 : e2 + i2 + t2;
};
var a = (e2, t2, n2, r2) => {
  let i2 = ``, a2 = 0;
  do
    i2 += e2.substring(a2, r2) + n2, a2 = r2 + t2.length, r2 = e2.indexOf(t2, a2);
  while (~r2);
  return i2 + e2.substring(a2);
};
var o = (e2 = r) => {
  let t2 = e2 ? i : () => String;
  return { isColorSupported: e2, reset: t2(`\x1B[0m`, `\x1B[0m`), bold: t2(`\x1B[1m`, `\x1B[22m`, `\x1B[22m\x1B[1m`), dim: t2(`\x1B[2m`, `\x1B[22m`, `\x1B[22m\x1B[2m`), italic: t2(`\x1B[3m`, `\x1B[23m`), underline: t2(`\x1B[4m`, `\x1B[24m`), inverse: t2(`\x1B[7m`, `\x1B[27m`), hidden: t2(`\x1B[8m`, `\x1B[28m`), strikethrough: t2(`\x1B[9m`, `\x1B[29m`), black: t2(`\x1B[30m`, `\x1B[39m`), red: t2(`\x1B[31m`, `\x1B[39m`), green: t2(`\x1B[32m`, `\x1B[39m`), yellow: t2(`\x1B[33m`, `\x1B[39m`), blue: t2(`\x1B[34m`, `\x1B[39m`), magenta: t2(`\x1B[35m`, `\x1B[39m`), cyan: t2(`\x1B[36m`, `\x1B[39m`), white: t2(`\x1B[37m`, `\x1B[39m`), gray: t2(`\x1B[90m`, `\x1B[39m`), bgBlack: t2(`\x1B[40m`, `\x1B[49m`), bgRed: t2(`\x1B[41m`, `\x1B[49m`), bgGreen: t2(`\x1B[42m`, `\x1B[49m`), bgYellow: t2(`\x1B[43m`, `\x1B[49m`), bgBlue: t2(`\x1B[44m`, `\x1B[49m`), bgMagenta: t2(`\x1B[45m`, `\x1B[49m`), bgCyan: t2(`\x1B[46m`, `\x1B[49m`), bgWhite: t2(`\x1B[47m`, `\x1B[49m`), blackBright: t2(`\x1B[90m`, `\x1B[39m`), redBright: t2(`\x1B[91m`, `\x1B[39m`), greenBright: t2(`\x1B[92m`, `\x1B[39m`), yellowBright: t2(`\x1B[93m`, `\x1B[39m`), blueBright: t2(`\x1B[94m`, `\x1B[39m`), magentaBright: t2(`\x1B[95m`, `\x1B[39m`), cyanBright: t2(`\x1B[96m`, `\x1B[39m`), whiteBright: t2(`\x1B[97m`, `\x1B[39m`), bgBlackBright: t2(`\x1B[100m`, `\x1B[49m`), bgRedBright: t2(`\x1B[101m`, `\x1B[49m`), bgGreenBright: t2(`\x1B[102m`, `\x1B[49m`), bgYellowBright: t2(`\x1B[103m`, `\x1B[49m`), bgBlueBright: t2(`\x1B[104m`, `\x1B[49m`), bgMagentaBright: t2(`\x1B[105m`, `\x1B[49m`), bgCyanBright: t2(`\x1B[106m`, `\x1B[49m`), bgWhiteBright: t2(`\x1B[107m`, `\x1B[49m`) };
};
var s = o();

export {
  s
};
//# sourceMappingURL=chunk-IGZPV57A.js.map
