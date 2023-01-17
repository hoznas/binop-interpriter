import { readFileSync } from "fs";
import { Evaluator } from "./evaluator";

const e = new Evaluator();
let fileContent = readFileSync("./sample.duo").toString();
//console.log(fileContent);
const result = e.eval(fileContent);
console.log(result.str());
