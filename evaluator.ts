import { EVAL_STR, FUN, IF, PRINT } from "./builtin-functions";
import {
  BinOp,
  IoObject,
  Message,
  Method,
  NIL,
  Num,
  Str,
  UserObject,
} from "./object";
import { parse } from "./parser";
import { Slot } from "./slot";
import { tokenize } from "./tokenizer";

export class Evaluator {
  rootSlot: Slot;
  objectSlot: Slot;
  constructor() {
    this.rootSlot = new Slot();
    this.objectSlot = new Slot();
    this.rootSlot.define("Object", new UserObject(this.objectSlot));
    this.rootSlot.define("nil", NIL);
  }
  eval(code: string): IoObject {
    return evalStr(code, this.rootSlot);
  }
}

export function evalStr(code: string, env: Slot = new Slot()): IoObject {
  const tokens = tokenize(code);
  const node = parse(tokens);
  return evalNode(node, env);
}

export function evalNode(node: IoObject, e: Slot): IoObject {
  if (node instanceof BinOp) {
    return evalBinOp(node, e);
  } else if (node instanceof Message) {
    return evalMessage(undefined, node, e);
  } else {
    // Num Str
    return node;
  }
}
function evalMessage(
  target: IoObject | undefined,
  message: Message,
  e: Slot
): IoObject {
  //console.log(`evalMessage(${target?.str()},${message.str()})`)
  if (target) {
    if (target instanceof UserObject) {
      return target.send(
        message.name,
        message.args?.map((x) => evalNode(x, e)),
        e
      );
    } else {
      return target.send(
        message.name,
        message.args?.map((x) => evalNode(x, e)),
        e
      );
    }
  } else {
    if (!message.args) {
      // as variable
      const result = e.get(message.name);
      if (result) return result;
      else throw `[ERROR] evalMessage() unknown variable."${message.name}"`;
    } else {
      // as call
      if (message.name === "fun") {
        return FUN(message.args, e);
      } else if (message.name === "print") {
        return PRINT(message.args, e);
      } else if (message.name === "if") {
        return IF(message.args, e);
      } else if (message.name === "eval") {
        return EVAL_STR(message.args, e);
      } else if (e.find(message.name)) {
        const method = e.get(message.name) as Method;
        return method.call(message.args, e);
      }
    }
  }
  throw "[ERROR] evalMethod()";
}

function evalBinOp(bop: BinOp, e: Slot): IoObject {
  //console.log(`evalBinOp(${bop.str()})`)
  if (["+", "-", "*", "/", "%"].includes(bop.op)) {
    return evalArithmeticOp(bop, e);
  } else if (["==", "!=", "<", "<=", ">", ">="].includes(bop.op)) {
    return evalCompareOp(bop, e);
  } else if (["=", ":=", ".", ";", ",", "&&", "||"].includes(bop.op)) {
    return evalSpecialOp(bop, e);
  } else {
    throw `[ERROR] unknown operator => {lhs.str()} {op} {rhs.str()} `;
  }
}
function evalArithmeticOp(bop: BinOp, e: Slot): IoObject {
  //console.log(`evalArithmeticOp(${bop.str()})`)
  // + - * / %
  const [op, elhs, erhs] = [bop.op, evalNode(bop.lhs, e), evalNode(bop.rhs, e)];
  if (op === "+" && elhs instanceof Str) return elhs.concat(erhs);
  if (elhs instanceof Num && (erhs instanceof Num || erhs instanceof Str)) {
    const n = erhs instanceof Num ? erhs.value : Number(erhs.value);
    if (op === "+") return new Num(elhs.value + n);
    if (op === "-") return new Num(elhs.value - n);
    if (op === "*") return new Num(elhs.value * n);
    if (op === "/") return new Num(elhs.value / n);
    if (op === "%") return new Num(elhs.value % n);
  }
  throw `[ERROR] type error => {lhs.str()} {op} {rhs.str()}`;
}
function evalCompareOp(bop: BinOp, e: Slot): IoObject {
  //console.log(`evalCompareOp(${bop.str()})`)
  //== != < <= > >=
  const [op, elhs, erhs] = [bop.op, evalNode(bop.lhs, e), evalNode(bop.rhs, e)];
  const cmp = elhs.compare(erhs);
  const t = new Num(1);
  if (op === "==" && cmp === 0) return t;
  if (op === "!=" && cmp !== 0) return t;
  if (op === "<" && cmp < 0) return t;
  if (op === "<=" && cmp <= 0) return t;
  if (op === ">" && cmp > 0) return t;
  if (op === ">=" && cmp >= 0) return t;
  return NIL;
}
function evalSpecialOp(bop: BinOp, e: Slot): IoObject {
  //console.log(`evalSpecialOp(${bop.str()})`)
  //= := . ; , && ||
  const op = bop.op;
  if (op === "&&") {
    const elhs = evalNode(bop.lhs, e);
    return elhs === NIL ? NIL : evalNode(bop.rhs, e);
  } else if (op === "||") {
    const elhs = evalNode(bop.rhs, e);
    return elhs !== NIL ? elhs : evalNode(bop.rhs, e);
  } else if (op === ";") {
    evalNode(bop.lhs, e);
    return evalNode(bop.rhs, e);
  } else if (op === ":=") {
    return evalAssign("define", bop.lhs, evalNode(bop.rhs, e), e);
  } else if (op === "=") {
    return evalAssign("update", bop.lhs, evalNode(bop.rhs, e), e);
  } else if (op === ".") {
    const targetObj = evalNode(bop.lhs, e);
    return evalMessage(targetObj, bop.rhs as Message, e);
  } else if (op === ",") {
    throw "[ERROR] internal error operator[,]";
  }
  throw `[ERROR] unknown operator "${op}" `;
}

function evalAssign(
  flag: "define" | "update",
  target: IoObject,
  value: IoObject,
  e: Slot
): IoObject {
  //console.log(`evalAssign(${flag},${target.str()},${value.str()})`)
  if (target instanceof BinOp && target.op === ".") {
    const targetObject = evalNode(target.lhs, e);
    if (
      targetObject instanceof UserObject &&
      target.rhs instanceof Message &&
      !target.rhs.args
    ) {
      return assignObjectSlot(targetObject, target.rhs.name, value);
    }
    throw "[ERROR] evalAssign(A)";
  } else if (target instanceof Message && !target.args) {
    const result = assignLocalVariable(flag, target.name, value, e);
    if (result) return result;
    else throw `[ERROR] evalAssign(${flag},${target.str()},${value.str()})`;
  }
  throw "[ERROR] evalAssign(C)";
}
function assignObjectSlot(
  targetObj: UserObject,
  varName: string,
  value: IoObject
): IoObject {
  //console.log(`assignObjectSlot(${targetObj.str()},${varName},${value.str()})`)
  return targetObj.assignToObject(varName, value);
}

function assignLocalVariable(
  flag: "define" | "update",
  varName: string,
  value: IoObject,
  e: Slot
): IoObject | null {
  //console.log(`assignLocalVariable(${flag},${varName},${value.str()})`)
  if (flag === "define") return e.define(varName, value);
  else return e.update(varName, value);
}
