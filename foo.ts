import { readFileSync } from "fs";

const terminator = /^(\n|;)/m;
const str = /^("(?:[^"]*)")/m;

const code = `"abc"${"\n"}"def"`;
const x = code.charAt(5);
console.log(x, x.charCodeAt(0));

const match = code.match(str);
const temp = match![1];
const just = temp.substring(1, temp.length - 1);
const rest = code.substring(match![1].length, code.length);

console.log(`|${code}|`);
console.log(`|${just}|`);
console.log(`|${rest}|`);

let s = readFileSync("./sample.duo").toString();
for (let i = 0; i < s.length; i++) {
  //console.log(`i=${i} char=${s.charAt(i)} code=${s.charCodeAt(i)}`);
}
