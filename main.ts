import { readFileSync } from 'fs';
import { Evaluator } from './evaluator';

console.log(process.argv);

if (process.argv.length >= 3) {
  const e = new Evaluator();
  let fileContent = readFileSync(process.argv[2]).toString();
  console.log(fileContent);
  e.eval(fileContent);
} else {
  console.log('argument file required');
}
