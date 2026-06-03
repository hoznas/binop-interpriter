"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// ts-interpreter/tests.ts
var import_node_test = require("node:test");
var import_node_assert = __toESM(require("node:assert"));

// ts-interpreter/object.ts
var BoObject = class {
  compare(other) {
    if (this === other) return 0;
    else return -1;
  }
  clone() {
    return this;
  }
};
var Num = class _Num extends BoObject {
  constructor(value) {
    super();
    this.value = value;
  }
  str() {
    return this.value.toString();
  }
  compare(other) {
    if (other instanceof _Num) {
      const result = this.value - other.value;
      if (result === 0) return 0;
      else if (result < 0) return -1;
      else return 1;
    }
    return -1;
  }
};
var Str = class _Str extends BoObject {
  constructor(value) {
    super();
    this.value = value;
  }
  str() {
    return `"${this.value}"`;
  }
  compare(other) {
    if (other instanceof _Str) {
      if (this.value === other.value) return 0;
      else if (this.value < other.value) return -1;
      else return 1;
    }
    return -1;
  }
  concat(other) {
    if (other instanceof _Str) return new _Str(this.value + other.value);
    else return new _Str(this.value + other.str());
  }
};
var Nil = class _Nil extends BoObject {
  static {
    this.instance = new _Nil();
  }
  constructor() {
    super();
  }
  str() {
    return "nil";
  }
  compare(other) {
    if (other instanceof _Nil) return 0;
    else return -1;
  }
  static getInstance() {
    return _Nil.instance;
  }
};
var NIL = Nil.getInstance();
var Message = class _Message extends BoObject {
  constructor(receiver, slotName, args) {
    super();
    this.receiver = receiver;
    if (slotName !== ".") {
      this.slotName = slotName;
      this.args = args;
    } else if (args?.length === 1 && args[0] instanceof _Message) {
      this.slotName = args[0].slotName;
      this.args = args[0].args;
    } else {
      throw new Error(
        `ERROR new Message(${receiver?.str()},${slotName},${args?.map((e) => e.str()).join()})`
      );
    }
  }
  str() {
    const receiverStr = this.receiver ? this.receiver.str() : "";
    let argsStr;
    if (this.args) {
      argsStr = "(" + this.args.map((e) => e.str()).join(", ") + ")";
    } else {
      argsStr = "";
    }
    if (this.slotName === "." && this.args?.length === 1)
      return receiverStr + "." + this.args[0].str();
    else if (this.receiver === void 0) return this.slotName + argsStr;
    else return receiverStr + "." + this.slotName + argsStr;
  }
};
var Fun = class extends BoObject {
  constructor(args, env) {
    super();
    if (args.length === 0) {
      throw new Error("ERROR new Fun(no-argument)");
    }
    this.body = args[args.length - 1];
    this.argList = args.slice(0, args.length - 1).map((e) => {
      if (e instanceof Message && !e.receiver && !e.args) return e.slotName;
      else throw new Error(`ERROR new Fun() => type error. value=${e.str()}`);
    });
    this.createdEnv = env;
  }
  str() {
    const argStr = this.argList.length === 0 ? "" : this.argList.join(",") + ",";
    return `fun(${argStr}${this.body.str()})`;
  }
};
var Macro = class extends BoObject {
  constructor(args) {
    super();
    if (args.length === 0) {
      throw new Error("ERROR new Macro(no-argument)");
    }
    this.body = args[args.length - 1];
    this.argList = args.slice(0, args.length - 1).map((e) => {
      if (e instanceof Message && !e.receiver && !e.args) return e.slotName;
      else throw new Error(`ERROR new Macro()  value=${e.str()}`);
    });
  }
  str() {
    const argStr = this.argList.length === 0 ? "" : this.argList.join(",") + ",";
    return `macro(${argStr}${this.body.str()})`;
  }
};
var UserObject = class _UserObject extends BoObject {
  constructor(slot, proto) {
    super();
    this.memory = slot;
    this.proto = proto;
  }
  compare(other) {
    if (this === other) return 0;
    else return -1;
  }
  str() {
    const s = Array.from(this.memory.slots.entries()).map(([k, v]) => {
      return k + ":" + v.str();
    }).join(",");
    return "{" + s + "}";
  }
  clone() {
    return new _UserObject(this.memory.subMemory(), this);
  }
  define(name, value) {
    return this.memory.define(name, value);
  }
  update(name, value) {
    return this.memory.update(name, value);
  }
  assignToObject(name, value) {
    return this.memory.defineForce(name, value);
  }
  get(name) {
    return this.memory.get(name);
  }
};

// ts-interpreter/builtin-functions.ts
var BuiltinFunction = class extends BoObject {
  constructor(name, fun) {
    super();
    this.name = name;
    this.fun = fun;
  }
  // CPS版: 継続kを受け取る
  callK(receiver, args, env, k) {
    return this.fun(receiver, args, env, k);
  }
  str() {
    return this.name;
  }
};
var FUN = new BuiltinFunction("fun", (_receiver, args, env, k) => {
  if (args?.length >= 1) return k(new Fun(args, env));
  throw new Error(`ERROR fun(args.len===${args?.length}) arg length error`);
});
var MACRO = new BuiltinFunction(
  "macro",
  (_receiver, args, _env, k) => {
    if (args.length >= 1) return k(new Macro(args));
    throw new Error(`ERROR macro(args.len===${args.length}) arg length error`);
  }
);
var MESSAGE = new BuiltinFunction(
  "message",
  (_receiver, args, _env, k) => {
    if (args.length >= 2 && args[0] instanceof Str) {
      const type = args[0].value;
      if (type == "__" && args.length === 2 && args[1] instanceof Str) {
        return k(new Message(void 0, args[1].value, void 0));
      } else if (type === "_@" && args[1] instanceof Str) {
        return k(
          new Message(void 0, args[1].value, args.slice(2, args.length))
        );
      } else if (type === "@_" && args.length === 3 && args[2] instanceof Str) {
        return k(new Message(args[1], args[2].value, void 0));
      } else if (type === "@@" && args[2] instanceof Str) {
        return k(
          new Message(args[1], args[2].value, args.slice(3, args.length))
        );
      }
    }
    throw new Error(
      `ERROR MESSAGE(${args.map((e) => {
        e.str();
      }).join(",")})`
    );
  }
);
var EVAL_NODE = new BuiltinFunction(
  "evalNode",
  (_receiver, args, env, k) => {
    if (args.length === 1) {
      return evalNodeK(
        args[0],
        env,
        (innerNode) => (
          // 2回目の評価: 得られたASTを実行する
          new Thunk(() => evalNodeK(innerNode, env, k))
        )
      );
    }
    throw new Error(
      `ERROR evalNode(args.len===${args.length}) arg length error`
    );
  }
);
var EVAL_STR = new BuiltinFunction(
  "evalStr",
  (_receiver, args, env, k) => {
    if (args.length === 1 && args[0] instanceof Str) {
      return evalStrK(args[0].value, env, k);
    }
    throw new Error(
      `ERROR evalStr(args.len===${args.length}) arg length error`
    );
  }
);
var evalIfK = (mes, env, k) => {
  if (!mes.receiver) throw new Error("ERROR evalIf(no receiver)");
  if (!(mes.args?.length === 1 || mes.args?.length === 2))
    throw new Error("ERROR evalIf(arg length error)");
  return evalNodeK(mes.receiver, env, (receiver) => {
    const block = receiver !== NIL ? mes.args[0] : mes.args[1] || NIL;
    return new Thunk(() => evalNodeK(block, env, k));
  });
};
var evalPrintK = (mes, env, k) => {
  if (!mes.receiver) throw new Error("ERROR evalPrint(no receiver)");
  if (mes.args?.length !== 0)
    throw new Error("ERROR evalPrint(arg length error)");
  return evalNodeK(mes.receiver, env, (result) => {
    Evaluator.print(result.str());
    return k(result);
  });
};
var evalCloneK = (mes, env, k) => {
  if (!mes.receiver) throw new Error("ERROR evalClone(no receiver)");
  if (mes.args?.length !== 0)
    throw new Error("ERROR evalClone(arg length error)");
  return evalNodeK(mes.receiver, env, (result) => k(result.clone()));
};
var defaultMethodMapK = {
  if: evalIfK,
  print: evalPrintK,
  clone: evalCloneK
};

// ts-interpreter/memory.ts
var Memory = class _Memory {
  constructor(superMemory = void 0) {
    this.super = superMemory;
    this.slots = /* @__PURE__ */ new Map();
  }
  subMemory() {
    return new _Memory(this);
  }
  find(name) {
    if (this.slots.get(name)) {
      return this.slots;
    } else if (this.super) {
      return this.super.find(name);
    } else {
      return void 0;
    }
  }
  get(name) {
    const slot = this.find(name);
    return slot && slot.get(name);
  }
  define(name, value) {
    const isDefined = this.slots.get(name);
    if (!isDefined) {
      this.slots.set(name, value);
      return value;
    } else {
      return null;
    }
  }
  defineForce(name, value) {
    this.slots.set(name, value);
    return value;
  }
  update(name, value) {
    const slot = this.find(name);
    if (slot) {
      slot.set(name, value);
      return value;
    } else {
      return null;
    }
  }
  show() {
    this.super?.show();
    this.slots.forEach((value, name) => {
      console.log(`Slot.Show(${name} = ${value.str()})`);
    });
  }
};

// ts-interpreter/tokenizer.ts
var binop = /^(<=|>=|==|!=|:=|&&|\|\||[.*%+\-\/<>=,])/m;
var terminator = /^(\n|;)/m;
var whiteSpace = /^([ \t])/m;
var num = /^(\d+)/m;
var str = /^("(?:[^"]*)")/m;
var sym = /^([a-zA-Z_][a-zA-Z0-9_]*)/m;
var lpar = /^(\()/m;
var rpar = /^(\))/m;
var tokenize = (code) => {
  const processedCode = preprocess(code);
  const result = makeTokenList(processedCode);
  return filterSemicolon(result);
};
var preprocess = (code) => {
  return code.replace(/(\r\n|\r|\n|;)+/g, ";");
};
var makeTokenList = (code, result = []) => {
  if (code.length > 0) {
    const [token, restCode] = getToken(code);
    if (token) {
      result.push(token);
    }
    return makeTokenList(restCode, result);
  } else {
    return filterSemicolon(result);
  }
};
var getToken = (code) => {
  let match;
  let token;
  if (match = code.match(num)) {
    token = { type: "num", value: match[1] };
  } else if (match = code.match(str)) {
    const temp = match[1];
    token = { type: "str", value: temp.substring(1, temp.length - 1) };
  } else if (match = code.match(lpar)) {
    token = { type: "(", value: match[1] };
  } else if (match = code.match(rpar)) {
    token = { type: ")", value: match[1] };
  } else if (match = code.match(binop)) {
    token = { type: "binop", value: match[1] };
  } else if (match = code.match(terminator)) {
    token = { type: "binop", value: ";" };
  } else if (match = code.match(whiteSpace)) {
    token = null;
  } else if (match = code.match(sym)) {
    token = { type: "sym", value: match[1] };
  } else {
    throw new Error(`ERROR getToken(${code})`);
  }
  let usedLen;
  if (token) {
    usedLen = token.type === "str" ? token.value.length + 2 : token.value.length;
  } else {
    usedLen = 1;
  }
  const rest = code.substring(usedLen, code.length);
  return [token, rest];
};
var filterSemicolon = (tokens) => {
  while (tokens.length > 1 && isTerminator(tokens[0])) {
    tokens.shift();
  }
  while (tokens.length > 1 && isTerminator(tokens[tokens.length - 1])) {
    tokens.pop();
  }
  return filter2(filter1(tokens));
};
var filter1 = (tokens) => {
  const result = [];
  for (let i = 0; i < tokens.length - 1; i++) {
    if (isTerminator(tokens[i]) && isTerminator(tokens[i + 1])) {
    } else if (isTerminator(tokens[i]) && isRPar(tokens[i + 1])) {
    } else if (isTerminator(tokens[i]) && isBinOp(tokens[i + 1])) {
    } else {
      result.push(tokens[i]);
    }
  }
  result.push(tokens[tokens.length - 1]);
  return result;
};
var filter2 = (tokens) => {
  const result = [];
  for (let i = 1; i < tokens.length; i++) {
    if (isLPar(tokens[i - 1]) && isTerminator(tokens[i])) {
    } else if (isBinOp(tokens[i - 1]) && isTerminator(tokens[i])) {
    } else {
      result.push(tokens[i]);
    }
  }
  result.unshift(tokens[0]);
  return result;
};
var isTerminator = (t) => {
  return t.type === "binop" && (t.value === ";" || t.value === "\n");
};
var isLPar = (t) => {
  return t.type === "(";
};
var isRPar = (t) => {
  return t.type === ")";
};
var isBinOp = (t) => {
  return t.type === "binop";
};
var isSym = (t) => {
  return t.type === "sym";
};

// ts-interpreter/parser.ts
var TokenReader = class {
  constructor(tokens) {
    this.tokens = tokens;
    this.ptr = -1;
  }
  next() {
    this.ptr += 1;
    return this.tokens[this.ptr];
  }
  prev() {
    this.ptr -= 1;
    return this.tokens[this.ptr];
  }
  curr() {
    return this.tokens[this.ptr];
  }
  seeNext(n = 1) {
    return this.tokens[this.ptr + n];
  }
  endOfToken() {
    return !(this.ptr < this.tokens.length - 1);
  }
  restCount() {
    return this.tokens.length - 1 - this.ptr;
  }
  drop(tokenStr) {
    const t = this.next();
    if (t.value !== tokenStr)
      throw new Error(`ERROR TokenReader::drop("${tokenStr}")=>"${t.value}"`);
  }
};
var binOpRate = (op) => {
  if (op === ".") return 0;
  if (op === "*" || op === "/" || op === "%") return 1;
  if (op === "+" || op === "-") return 2;
  if (op === "<" || op === ">" || op === "<=" || op === ">=") return 3;
  if (op === "==" || op === "!=") return 4;
  if (op === "&&" || op === "||") return 5;
  if (op === ":=" || op === "=") return 7;
  if (/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(op)) return 8;
  if (op === ";") return 9;
  if (op === ",") return 10;
  throw new Error(`ERROR binOpRate() =>unknown BinOp(${op})`);
};
var parse = (tokens) => {
  const reader = new TokenReader(tokens);
  const result = parseBinOp(reader, 9);
  return result;
};
var parseBinOp = (reader, depth) => {
  if (depth === -1) {
    return parseFactor(reader);
  } else if (reader.endOfToken()) {
    throw new Error("ERROR parseBinOp(end of code)");
  } else {
    const result = parseBinOp(reader, depth - 1);
    if (reader.endOfToken()) {
      return result;
    } else {
      const next = reader.seeNext();
      if (isRPar(next)) {
        return result;
      } else {
        if (isBinOp(next) || isSym(next) && binOpRate(next.value) === depth) {
          return parseBinOp2(reader, result, depth);
        }
      }
    }
    return result;
  }
};
var parseBinOp2 = (reader, lhs, depth) => {
  let result = lhs;
  while (true) {
    if (reader.endOfToken()) {
      return result;
    } else if (isRPar(reader.seeNext())) {
      return result;
    } else if (binOpRate(reader.seeNext()?.value) == depth) {
      const op = reader.next();
      const code2 = parseBinOp(reader, depth - 1);
      result = new Message(result, op.value, [code2]);
    } else {
      return result;
    }
  }
};
var parseFactor = (reader) => {
  const token = reader.next();
  if (token.type === "num") {
    return new Num(Number(token.value));
  } else if (token.type === "str") {
    return new Str(token.value);
  } else if (token.type === "(") {
    return parseParents(reader);
  } else if (token.type === "sym") {
    const s = token.value;
    return parseMessage(s, reader);
  } else if (token.type === ")") {
    throw new Error("ERROR parseFactor() syntax error => ')' unmatch");
  } else {
    throw new Error(`ERROR parseFactor() => arg=BinOp(${token.value})`);
  }
};
var parseMessage = (slotName, reader) => {
  if (reader.restCount() >= 2 && isLPar(reader.seeNext(1))) {
    const args = parseArgParents(reader);
    return new Message(void 0, slotName, args);
  } else {
    return new Message(void 0, slotName);
  }
};
var parseArgParents = (reader) => {
  reader.drop("(");
  if (isRPar(reader.seeNext())) {
    reader.drop(")");
    return [];
  } else {
    const args = toArray(parseBinOp(reader, 10));
    reader.drop(")");
    return args;
  }
};
var parseParents = (reader) => {
  const result = parseBinOp(reader, 9);
  reader.drop(")");
  return result;
};
var toArray = (obj) => {
  if (obj instanceof Message && obj.receiver !== void 0 && obj.slotName === "," && obj.args?.length === 1) {
    return [...toArray(obj.receiver), obj.args[0]];
  }
  return [obj];
};

// ts-interpreter/evaluator.ts
var Thunk = class {
  constructor(fn) {
    this.fn = fn;
  }
};
var trampoline2 = (bounce) => {
  while (bounce instanceof Thunk) {
    bounce = bounce.fn();
  }
  return bounce;
};
var Evaluator = class _Evaluator {
  static {
    this.print = (msg) => {
      console.log("foo", msg);
    };
  }
  constructor(print = (msg) => console.log(msg)) {
    this.rootEnvironmentSlot = new Memory();
    this.rootObjectSlot = new Memory();
    _Evaluator.print = print;
    this.rootEnvironmentSlot.define(
      "Object",
      new UserObject(this.rootObjectSlot)
    );
    this.rootEnvironmentSlot.define("nil", NIL);
    this.rootEnvironmentSlot.define("fun", FUN);
    this.rootEnvironmentSlot.define("macro", MACRO);
    this.rootEnvironmentSlot.define("evalNode", EVAL_NODE);
    this.rootEnvironmentSlot.define("evalStr", EVAL_STR);
    this.rootEnvironmentSlot.define("message", MESSAGE);
  }
  eval(code) {
    return trampoline2(evalStrK(code, this.rootEnvironmentSlot, (x) => x));
  }
};
var evalStrK = (code, env, k) => {
  const tokens = tokenize(code);
  const node = parse(tokens);
  return evalNodeK(node, env, k);
};
var evalNodeK = (node, env, k) => {
  if (!(node instanceof Message)) {
    return k(node);
  }
  if (node.receiver && node.args?.length === 1) {
    const [lhs, op, rhs] = [node.receiver, node.slotName, node.args[0]];
    if (["+", "-", "*", "/", "%"].includes(op)) {
      return evalArithmeticOpK(lhs, op, rhs, env, k);
    }
    if (["==", "!=", "<", "<=", ">", ">="].includes(op)) {
      return evalCompareOpK(lhs, op, rhs, env, k);
    }
    if (["=", ":=", ";", ",", "&&", "||"].includes(op)) {
      return evalSpecialOpK(lhs, op, rhs, env, k);
    }
  }
  return evalMessageK(node, env, k);
};
var evalArithmeticOpK = (lhs, op, rhs, env, k) => {
  return evalNodeK(
    lhs,
    env,
    (eLhs) => new Thunk(
      () => evalNodeK(
        rhs,
        env,
        (eRhs) => k(computeArithmetic(eLhs, op, eRhs))
        // ← 計算結果を継続に渡す
      )
    )
  );
};
var computeArithmetic = (eLhs, op, eRhs) => {
  if (eLhs instanceof Num) {
    const n = eRhs instanceof Num ? eRhs.value : eRhs instanceof Str ? Number(eRhs.value) : void 0;
    if (n === void 0) throw new Error("ERROR computeArithmetic");
    if (op === "+") return new Num(eLhs.value + n);
    if (op === "-") return new Num(eLhs.value - n);
    if (op === "*") return new Num(eLhs.value * n);
    if (op === "/") return new Num(eLhs.value / n);
    if (op === "%") return new Num(eLhs.value % n);
  } else if (eLhs instanceof Str) {
    if (op === "+" && (eRhs instanceof Str || eRhs instanceof Num)) {
      return new Str(eLhs.value.concat(eRhs.value.toString()));
    } else if (eRhs instanceof Num) {
      if (op === "/") return new Str(eLhs.value.substring(0, eRhs.value));
      if (op === "%") return new Str(eLhs.value.substring(eRhs.value));
    }
  }
  throw new Error(`ERROR computeArithmetic(${eLhs.str()} ${op} ${eRhs.str()})`);
};
var evalCompareOpK = (lhs, op, rhs, env, k) => {
  return evalNodeK(
    lhs,
    env,
    (eLhs) => new Thunk(
      () => evalNodeK(rhs, env, (eRhs) => k(computeCompare(eLhs, op, eRhs)))
    )
  );
};
var computeCompare = (eLhs, op, eRhs) => {
  const cmp = eLhs.compare(eRhs);
  const t = new Num(1);
  if (op === "==") return cmp === 0 ? t : NIL;
  if (op === "!=") return cmp !== 0 ? t : NIL;
  if (op === "<") return cmp < 0 ? t : NIL;
  if (op === "<=") return cmp <= 0 ? t : NIL;
  if (op === ">") return cmp > 0 ? t : NIL;
  return cmp >= 0 ? t : NIL;
};
var evalSpecialOpK = (lhs, op, rhs, env, k) => {
  if (op === ";") {
    return evalNodeK(
      lhs,
      env,
      (_discarded) => new Thunk(() => evalNodeK(rhs, env, k))
    );
  } else if (op === "&&") {
    return evalNodeK(
      lhs,
      env,
      (eLhs) => eLhs === NIL ? k(NIL) : new Thunk(() => evalNodeK(rhs, env, k))
    );
  } else if (op === "||") {
    return evalNodeK(
      lhs,
      env,
      (eLhs) => eLhs !== NIL ? k(eLhs) : new Thunk(() => evalNodeK(rhs, env, k))
    );
  } else if (op === ":=" && lhs instanceof Message) {
    return evalNodeK(
      rhs,
      env,
      (value) => evalAssignK("define", lhs, value, env, k)
    );
  } else if (op === "=" && lhs instanceof Message) {
    return evalNodeK(
      rhs,
      env,
      (value) => evalAssignK("update", lhs, value, env, k)
    );
  }
  throw new Error(`ERROR evalSpecialOpK(${lhs.str()} ${op} ${rhs.str()})`);
};
var evalAssignK = (flag, message, value, env, k) => {
  if (message.receiver) {
    return evalNodeK(message.receiver, env, (assignReceiver) => {
      if (assignReceiver instanceof UserObject && !message.args) {
        return k(assignReceiver.assignToObject(message.slotName, value));
      }
      throw new Error("ERROR evalAssignK()");
    });
  } else {
    if (!message.args) {
      if (flag === "define") {
        const result2 = env.define(message.slotName, value);
        if (result2) return k(result2);
        throw new Error(
          `ERROR evalAssignK() define error: ${message.slotName}`
        );
      }
      const result = env.update(message.slotName, value);
      if (result) return k(result);
      throw new Error(`ERROR evalAssignK() update error: ${message.slotName}`);
    }
  }
  throw new Error("ERROR evalAssignK()");
};
var evalMessageK = (mes, env, k) => {
  const defaultResult = evalIfDefaultFunctionK(mes, env, k);
  if (defaultResult !== void 0) return defaultResult;
  const afterReceiver = (receiver) => {
    const f = receiver && receiver instanceof UserObject ? receiver.get(mes.slotName) : env.get(mes.slotName);
    if (!f)
      throw new Error(
        `ERROR evalMessageK() => ${mes.slotName} is not defined.`
      );
    if (!mes.args) return k(f);
    if (f instanceof Fun) {
      return evalFunCallK2(receiver, f, mes.args, env, k);
    } else if (f instanceof Macro) {
      return evalMacroCallK(receiver, f, mes.args, env, k);
    } else if (f instanceof BuiltinFunction) {
      return f.callK(receiver, mes.args, env, k);
    }
    throw new Error(
      `ERROR evalMessageK() => ${mes.slotName} is not fun or macro`
    );
  };
  if (mes.receiver) {
    return evalNodeK(
      mes.receiver,
      env,
      (receiver) => new Thunk(() => afterReceiver(receiver))
    );
  }
  return afterReceiver(void 0);
};
var evalIfDefaultFunctionK = (mes, env, k) => {
  const method = defaultMethodMapK[mes.slotName];
  if (!method) return void 0;
  return method(mes, env, k);
};
var evalArgsK = (args, env, k) => {
  const results = [];
  const evalNext = (i) => {
    if (i >= args.length) return k(results);
    return evalNodeK(args[i], env, (result) => {
      results.push(result);
      return new Thunk(() => evalNext(i + 1));
    });
  };
  return evalNext(0);
};
var evalFunCallK2 = (_this, fun, args, callerEnv, k) => {
  return evalArgsK(args, callerEnv, (evaluatedArgs) => {
    const closure = bind(
      _this,
      fun.argList,
      evaluatedArgs,
      fun.createdEnv.subMemory()
    );
    return new Thunk(() => evalNodeK(fun.body, closure, k));
  });
};
var evalMacroCallK = (_this, macro, args, callerEnv, k) => {
  const closure = bind(_this, macro.argList, args, callerEnv.subMemory());
  return new Thunk(() => evalNodeK(macro.body, closure, k));
};
var bind = (_this, argList, values, createdEnv) => {
  const closure = createdEnv.subMemory();
  if (argList.length !== values.length)
    throw new Error("ERROR bind() => arg length error.");
  for (let i = 0; i < argList.length; i++) {
    closure.defineForce(argList[i], values[i]);
  }
  if (_this) closure.defineForce("this", _this);
  return closure;
};

// ts-interpreter/printer.ts
var LogPrinter = class {
  constructor() {
    this.printLogs = [];
    this.getPrintFunction = () => {
      return (msg) => this.print(msg);
    };
  }
  print(msg) {
    this.printLogs.push(msg);
  }
  getLogs() {
    return this.printLogs;
  }
  getLastLogs() {
    if (this.printLogs.length === 0) {
      return void 0;
    }
    return this.printLogs[this.printLogs.length - 1];
  }
};

// ts-interpreter/tests.ts
(0, import_node_test.describe)("Tokenizer", () => {
  const tests = [
    ["123", "123"],
    ["abc", "abc"],
    ['"abc def"', "abc def"],
    [`"abc "${"\n"}"def"`, "abc |;|def"],
    [";;abc;def;;zzz;;", "abc|;|def|;|zzz"],
    [
      ';;;abc.f(;c;,;;a;;b;;)  ;;;;;  def(;;"a b c";) ; ; xxx; zzz ;;  ;',
      "abc|.|f|(|c|,|a|;|b|)|;|def|(|a b c|)|;|xxx|;|zzz"
    ]
  ];
  for (const [code, expected] of tests) {
    (0, import_node_test.test)(`should tokenize: ${code.substring(0, 20)}...`, () => {
      const result = tokenize(code);
      const result_str = result.map((e) => e.value).join("|");
      import_node_assert.default.strictEqual(result_str, expected);
    });
  }
});
(0, import_node_test.describe)("Parser", () => {
  const tests = [
    ["123", "123"],
    ['"abc def"', '"abc def"'],
    ["abc", "abc"],
    ["1+2", "1.+(2)"],
    ["1+2*3", "1.+(2.*(3))"],
    ["(1+2)*3", "1.+(2).*(3)"],
    ["1.print", "1.print"],
    ["1 op 2", "1.op(2)"],
    ["1.print;2.print();", "1.print.;(2.print())"],
    ["print;print()\nprint(1+2)", "print.;(print()).;(print(1.+(2)))"],
    [
      "i:=0;while(i<10,x:=i*2;x.println)",
      "i.:=(0).;(while(i.<(10), x.:=(i.*(2)).;(x.println)))"
    ],
    ["print", "print"],
    ["print()", "print()"],
    ["print(1)", "print(1)"],
    ["print(1,2)", "print(1, 2)"],
    ["Object.clone().clone()", "Object.clone().clone()"],
    ["obj func arg", "obj.func(arg)"]
  ];
  for (const [code, expected] of tests) {
    (0, import_node_test.test)(`should parse: ${code}`, () => {
      const tokens = tokenize(code);
      const exp = parse(tokens);
      const result_str = exp.str();
      import_node_assert.default.strictEqual(result_str, expected);
    });
  }
});
(0, import_node_test.describe)("Memory (Scope)", () => {
  (0, import_node_test.test)("should define and get a variable in the same scope", () => {
    const env = new Memory();
    const result = env.define("x", new Num(42));
    import_node_assert.default.strictEqual(result?.str(), "42");
    import_node_assert.default.strictEqual(env.get("x")?.str(), "42");
  });
  (0, import_node_test.test)("should return null when defining a variable twice", () => {
    const env = new Memory();
    env.define("x", new Num(1));
    const result = env.define("x", new Num(2));
    import_node_assert.default.strictEqual(result, null);
    import_node_assert.default.strictEqual(env.get("x")?.str(), "1");
  });
  (0, import_node_test.test)("should get undefined for non-existent variable", () => {
    const env = new Memory();
    import_node_assert.default.strictEqual(env.get("nonexistent"), void 0);
  });
  (0, import_node_test.test)("should update an existing variable", () => {
    const env = new Memory();
    env.define("x", new Num(1));
    const result = env.update("x", new Num(2));
    import_node_assert.default.strictEqual(result?.str(), "2");
    import_node_assert.default.strictEqual(env.get("x")?.str(), "2");
  });
  (0, import_node_test.test)("should return null when updating non-existent variable", () => {
    const env = new Memory();
    const result = env.update("nonexistent", new Num(1));
    import_node_assert.default.strictEqual(result, null);
  });
  (0, import_node_test.test)("should get variable from parent scope", () => {
    const parent = new Memory();
    const child = parent.subMemory();
    parent.define("x", new Num(10));
    import_node_assert.default.strictEqual(child.get("x")?.str(), "10");
  });
  (0, import_node_test.test)("should shadow parent variable in child scope", () => {
    const parent = new Memory();
    const child = parent.subMemory();
    parent.define("x", new Num(10));
    child.define("x", new Num(20));
    import_node_assert.default.strictEqual(parent.get("x")?.str(), "10");
    import_node_assert.default.strictEqual(child.get("x")?.str(), "20");
  });
  (0, import_node_test.test)("should update parent variable from child scope", () => {
    const parent = new Memory();
    const child = parent.subMemory();
    parent.define("x", new Num(10));
    child.update("x", new Num(99));
    import_node_assert.default.strictEqual(parent.get("x")?.str(), "99");
    import_node_assert.default.strictEqual(child.get("x")?.str(), "99");
  });
  (0, import_node_test.test)("should update only the nearest scope when shadowed", () => {
    const parent = new Memory();
    const child = parent.subMemory();
    parent.define("x", new Num(10));
    child.define("x", new Num(20));
    child.update("x", new Num(30));
    import_node_assert.default.strictEqual(parent.get("x")?.str(), "10");
    import_node_assert.default.strictEqual(child.get("x")?.str(), "30");
  });
  (0, import_node_test.test)("should work with multi-level scope chain", () => {
    const global = new Memory();
    const middle = global.subMemory();
    const local = middle.subMemory();
    global.define("a", new Num(1));
    middle.define("b", new Num(2));
    local.define("c", new Num(3));
    import_node_assert.default.strictEqual(local.get("a")?.str(), "1");
    import_node_assert.default.strictEqual(local.get("b")?.str(), "2");
    import_node_assert.default.strictEqual(local.get("c")?.str(), "3");
    import_node_assert.default.strictEqual(middle.get("a")?.str(), "1");
    import_node_assert.default.strictEqual(middle.get("c"), void 0);
  });
  (0, import_node_test.test)("should force define (overwrite existing variable)", () => {
    const env = new Memory();
    env.define("x", new Num(1));
    const result = env.defineForce("x", new Num(2));
    import_node_assert.default.strictEqual(result.str(), "2");
    import_node_assert.default.strictEqual(env.get("x")?.str(), "2");
  });
});
(0, import_node_test.describe)("Evaluator", () => {
  (0, import_node_test.describe)("Literals", () => {
    (0, import_node_test.test)("should evaluate number literal", () => {
      const e = new Evaluator();
      import_node_assert.default.strictEqual(e.eval("123").str(), "123");
    });
    (0, import_node_test.test)("should evaluate string literal", () => {
      const e = new Evaluator();
      import_node_assert.default.strictEqual(e.eval('"abc def"').str(), '"abc def"');
    });
  });
  (0, import_node_test.describe)("Arithmetic operations", () => {
    (0, import_node_test.test)("should evaluate addition and multiplication with precedence", () => {
      const e = new Evaluator();
      import_node_assert.default.strictEqual(e.eval("1+2*3").str(), "7");
    });
    (0, import_node_test.test)("should evaluate parenthesized expression", () => {
      const e = new Evaluator();
      import_node_assert.default.strictEqual(e.eval("(1+2)*3").str(), "9");
      import_node_assert.default.strictEqual(e.eval("(1+2)").str(), "3");
    });
    (0, import_node_test.test)("should concatenate strings", () => {
      const e = new Evaluator();
      import_node_assert.default.strictEqual(e.eval('"abc" + "def"').str(), '"abcdef"');
    });
    (0, import_node_test.test)("should convert number to string when concatenating", () => {
      const e = new Evaluator();
      import_node_assert.default.strictEqual(e.eval('"abc" + 123').str(), '"abc123"');
    });
    (0, import_node_test.test)("should convert string to number when adding", () => {
      const e = new Evaluator();
      import_node_assert.default.strictEqual(e.eval('123 + "123"').str(), "246");
    });
  });
  (0, import_node_test.describe)("String operations (car/cdr style)", () => {
    (0, import_node_test.test)("should get first character with /", () => {
      const e = new Evaluator();
      import_node_assert.default.strictEqual(e.eval('"abc" / 1').str(), '"a"');
    });
    (0, import_node_test.test)("should get rest of string with %", () => {
      const e = new Evaluator();
      import_node_assert.default.strictEqual(e.eval('"abc" % 1').str(), '"bc"');
    });
  });
  (0, import_node_test.describe)("Comparison operations", () => {
    (0, import_node_test.test)("should compare numbers", () => {
      const e = new Evaluator();
      import_node_assert.default.strictEqual(e.eval("2>1").str(), "1");
      import_node_assert.default.strictEqual(e.eval("1 + 1 == 3").str(), "nil");
    });
  });
  (0, import_node_test.describe)("Logical operations", () => {
    (0, import_node_test.test)("should evaluate && with short-circuit", () => {
      const e = new Evaluator();
      import_node_assert.default.strictEqual(e.eval("1 && nil").str(), "nil");
      import_node_assert.default.strictEqual(e.eval("nil && nil").str(), "nil");
      import_node_assert.default.strictEqual(e.eval("nil && 1").str(), "nil");
      import_node_assert.default.strictEqual(e.eval("1 && 1").str(), "1");
    });
    (0, import_node_test.test)("should evaluate || with short-circuit", () => {
      const e = new Evaluator();
      import_node_assert.default.strictEqual(e.eval("nil || nil").str(), "nil");
      import_node_assert.default.strictEqual(e.eval("1 || nil").str(), "1");
      import_node_assert.default.strictEqual(e.eval("nil || 1").str(), "1");
      import_node_assert.default.strictEqual(e.eval("1 || 1").str(), "1");
    });
  });
  (0, import_node_test.describe)("Variables", () => {
    (0, import_node_test.test)("should define and use variable with :=", () => {
      const e = new Evaluator();
      import_node_assert.default.strictEqual(e.eval("a := 5; a*4").str(), "20");
    });
    (0, import_node_test.test)("should update variable with =", () => {
      const e = new Evaluator();
      import_node_assert.default.strictEqual(e.eval("b := 5; b=b+1; b").str(), "6");
    });
  });
  (0, import_node_test.describe)("Sequence operator", () => {
    (0, import_node_test.test)("should evaluate sequence and return last value", () => {
      const e = new Evaluator();
      import_node_assert.default.strictEqual(e.eval("1 + 1;2*4").str(), "8");
    });
  });
  (0, import_node_test.describe)("Control flow (if)", () => {
    (0, import_node_test.test)("should execute true branch when condition is truthy", () => {
      const e = new Evaluator();
      import_node_assert.default.strictEqual(
        e.eval('(2>1).if(r:="big",r:="small");r').str(),
        '"big"'
      );
    });
    (0, import_node_test.test)("should execute false branch when condition is nil", () => {
      const e = new Evaluator();
      import_node_assert.default.strictEqual(
        e.eval('(1>2).if(s:="big",s:="small");s').str(),
        '"small"'
      );
    });
    (0, import_node_test.test)("should treat non-nil values as truthy", () => {
      const e = new Evaluator();
      import_node_assert.default.strictEqual(e.eval('1.if("t","f")').str(), '"t"');
    });
  });
  (0, import_node_test.describe)("Functions", () => {
    (0, import_node_test.test)("should create function with fun", () => {
      const e = new Evaluator();
      import_node_assert.default.strictEqual(
        e.eval("fun(a,b,(a+b).print())").str(),
        "fun(a,b,a.+(b).print())"
      );
    });
    (0, import_node_test.test)("should call function with arguments", () => {
      const e = new Evaluator();
      import_node_assert.default.strictEqual(e.eval("add:=fun(a,b,a+b);add(6/3,2)").str(), "4");
    });
    (0, import_node_test.test)("should support recursion", () => {
      const e = new Evaluator();
      import_node_assert.default.strictEqual(
        e.eval("pow:=fun(n,(n<=1).if(1,n*pow(n-1)));pow(3)").str(),
        "6"
      );
    });
    (0, import_node_test.test)("should create closure", () => {
      const e = new Evaluator();
      import_node_assert.default.strictEqual(
        e.eval("create:=fun(c:=0;fun(c=c+1));counter:=create();counter();counter()").str(),
        "2"
      );
    });
  });
  (0, import_node_test.describe)("Print function", () => {
    (0, import_node_test.test)("should print value and return it", () => {
      const logPrinter = new LogPrinter();
      const e = new Evaluator(logPrinter.getPrintFunction());
      import_node_assert.default.strictEqual(e.eval("(1+2).print()").str(), "3");
      import_node_assert.default.strictEqual(logPrinter.getLastLogs(), "3");
    });
    (0, import_node_test.test)("should print in function call", () => {
      const logPrinter = new LogPrinter();
      const e = new Evaluator(logPrinter.getPrintFunction());
      import_node_assert.default.strictEqual(
        e.eval("f:=fun((1+2).print());f()").str(),
        "3"
      );
      import_node_assert.default.strictEqual(logPrinter.getLastLogs(), "3");
    });
  });
  (0, import_node_test.describe)("Objects", () => {
    (0, import_node_test.test)("should access built-in Object", () => {
      const e = new Evaluator();
      import_node_assert.default.strictEqual(e.eval("Object").str(), "{}");
    });
    (0, import_node_test.test)("should clone Object", () => {
      const e = new Evaluator();
      import_node_assert.default.strictEqual(e.eval("Object.clone()").str(), "{}");
    });
    (0, import_node_test.test)("should clone number (returns same value)", () => {
      const e = new Evaluator();
      import_node_assert.default.strictEqual(e.eval("123.clone()").str(), "123");
    });
    (0, import_node_test.test)("should set and get object slot", () => {
      const e = new Evaluator();
      e.eval("o:=Object.clone();o.x:=1");
      import_node_assert.default.strictEqual(e.eval("o").str(), "{x:1}");
      import_node_assert.default.strictEqual(e.eval("o.x").str(), "1");
    });
    (0, import_node_test.test)("should support method with this", () => {
      const e = new Evaluator();
      import_node_assert.default.strictEqual(
        e.eval("obj:=Object.clone();obj.v:=12;obj.f:=fun(a,b,this.v+a+b);obj.f(3,2)").str(),
        "17"
      );
    });
    (0, import_node_test.test)("should support custom infix operator", () => {
      const e = new Evaluator();
      import_node_assert.default.strictEqual(
        e.eval("obj2:=Object.clone();obj2.setA=fun(arg,this.a=arg);obj2 setA 123;obj2.a").str(),
        "123"
      );
    });
    (0, import_node_test.test)("should support prototype chain method lookup", () => {
      const e = new Evaluator();
      const code = `
        parent := Object.clone();
        parent.greet = fun(name, "Hello, " + name);
        child := parent.clone();
        child.name = "Alice";
        child.greet("World")
      `;
      import_node_assert.default.strictEqual(e.eval(code).str(), '"Hello, World"');
    });
    (0, import_node_test.test)("should bind this correctly in inherited methods", () => {
      const e = new Evaluator();
      const code = `
        parent := Object.clone();
        parent.getName = fun(x, this.name);
        child := parent.clone();
        child.name = "Alice";
        child.getName("dummy")
      `;
      import_node_assert.default.strictEqual(e.eval(code).str(), '"Alice"');
    });
  });
  (0, import_node_test.describe)("Cons cells (Lisp-style lists)", () => {
    (0, import_node_test.test)("should create cons cell", () => {
      const e = new Evaluator();
      e.eval("cons:=fun(a,b,o:=Object.clone();o.car=a;o.cdr=b;o)");
      import_node_assert.default.strictEqual(e.eval("cons(1,2)").str(), "{car:1,cdr:2}");
    });
    (0, import_node_test.test)("should create and process list", () => {
      const e = new Evaluator();
      e.eval("cons:=fun(a,b,o:=Object.clone();o.car=a;o.cdr=b;o)");
      e.eval("list:=fun(i,n,(i<n).if(cons(i,list(i+1,n)),nil))");
      e.eval("l:=list(0,10)");
      import_node_assert.default.strictEqual(
        e.eval("l").str(),
        "{car:0,cdr:{car:1,cdr:{car:2,cdr:{car:3,cdr:{car:4,cdr:{car:5,cdr:{car:6,cdr:{car:7,cdr:{car:8,cdr:{car:9,cdr:nil}}}}}}}}}}"
      );
    });
    (0, import_node_test.test)("should sum list recursively", () => {
      const e = new Evaluator();
      e.eval("cons:=fun(a,b,o:=Object.clone();o.car=a;o.cdr=b;o)");
      e.eval("list:=fun(i,n,(i<n).if(cons(i,list(i+1,n)),nil))");
      e.eval("l:=list(0,10)");
      e.eval("sum:=fun(ls, ls.if(ls.car+sum(ls.cdr),0))");
      import_node_assert.default.strictEqual(e.eval("sum(l)").str(), "45");
    });
  });
  (0, import_node_test.describe)("Metaprogramming", () => {
    (0, import_node_test.test)("should create Message with method name only", () => {
      const e = new Evaluator();
      import_node_assert.default.strictEqual(e.eval('message("__","method")').str(), "method");
    });
    (0, import_node_test.test)("should create Message with method call", () => {
      const e = new Evaluator();
      import_node_assert.default.strictEqual(e.eval('message("_@","method")').str(), "method()");
    });
    (0, import_node_test.test)("should create Message with arguments", () => {
      const e = new Evaluator();
      import_node_assert.default.strictEqual(
        e.eval('message("_@","method", 1,2,3)').str(),
        "method(1, 2, 3)"
      );
    });
    (0, import_node_test.test)("should create Message with receiver", () => {
      const e = new Evaluator();
      import_node_assert.default.strictEqual(
        e.eval('message("@_",target,"method")').str(),
        "target.method"
      );
    });
    (0, import_node_test.test)("should create full Message with receiver and args", () => {
      const e = new Evaluator();
      import_node_assert.default.strictEqual(
        e.eval('message("@@", target,"method")').str(),
        "target.method()"
      );
      import_node_assert.default.strictEqual(
        e.eval('message("@@", target,"method", 1,2,3)').str(),
        "target.method(1, 2, 3)"
      );
    });
    (0, import_node_test.test)("should evaluate Message node", () => {
      const e = new Evaluator();
      import_node_assert.default.strictEqual(
        e.eval('evalNode(message("@@",5,"+",7))').str(),
        "12"
      );
    });
    (0, import_node_test.test)("should evaluate string as code", () => {
      const e = new Evaluator();
      import_node_assert.default.strictEqual(e.eval('evalStr("5+7")').str(), "12");
    });
  });
  (0, import_node_test.describe)("Macros", () => {
    (0, import_node_test.test)("should create and use custom if macro", () => {
      const logPrinter = new LogPrinter();
      const e = new Evaluator(logPrinter.getPrintFunction());
      e.eval("myIf := macro(condition,trueCase,falseCase,evalNode(condition).if(evalNode(trueCase), evalNode(falseCase)))");
      e.eval("numA := 111;numB := 222");
      import_node_assert.default.strictEqual(
        e.eval("myIf(numA<=numB, numA.print(), numB.print())").str(),
        "111"
      );
      import_node_assert.default.strictEqual(logPrinter.getLastLogs(), "111");
    });
  });
});
