/* jshint esversion: 6 */
const ESC = '\x1B';
const CSI = '\x9B';
const BEL = '\x07';

const original = new RegExp("([" + ESC + CSI + "][[\\]()#;?]*(?:(?:(?:[a-zA-Z\\d]*(?:;[-a-zA-Z\\d\\/#&.:=?%@~_]*)*)?" + BEL + ")|(?:(?:\\d{1,4}(?:;\\d{0,4})*)?[\\dA-PR-TZcf-ntqry=><~])))", "g");
const replacement = new RegExp("([" + ESC + CSI + "][[\\]()#;?]*(?:[a-zA-Z\\d]*(?:;[-a-zA-Z\\d\\/#&.:=?%@~_]*)*" + BEL + "|(?:\\d{1,4}(?:;\\d{0,4})*)?[\\dA-PR-TZcf-ntqry=><~]))", "g");

const samples = [
  "normal text",
  "\u001B[31mred\u001B[0m",
  "prefix\u001B]0;title\u0007suffix",
  "\u009B1;2;3mtext",
  "mixed \u001B[1;31mbold red\u001B[0m and \u001B]0;title\u0007more"
];

for (const s of samples) {
  const o = s.replace(original, "");
  const r = s.replace(replacement, "");
  const ok = o === r;
  console.log(JSON.stringify(s));
  console.log(" original =>", JSON.stringify(o));
  console.log(" replace  =>", JSON.stringify(r));
  console.log(" match?   =>", ok);
  console.log("---");
  if (!ok) {
    process.exitCode = 2;
  }
}

console.log('Done.');
