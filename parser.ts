import { Apply, BinOp, IoObject, Message, Num, Str } from "./object";
import { isBinOp, isLPar, isRPar, Token } from "./tokenizer";

class TokenReader {
  tokens: Token[];
  ptr: number;
  constructor(tokens: Token[]) {
    this.tokens = tokens;
    this.ptr = -1;
  }
  next(): Token {
    this.ptr += 1;
    return this.tokens[this.ptr];
  }
  prev(): Token {
    this.ptr -= 1;
    return this.tokens[this.ptr];
  }
  curr(): Token {
    return this.tokens[this.ptr];
  }
  seeNext(n: number = 1): Token {
    return this.tokens[this.ptr + n];
  }
  endOfToken(): boolean {
    return !(this.ptr < this.tokens.length - 1);
  }
}

function binOpRate(op: string): number {
  if (op === ".") return 0;
  if (op === "*" || op === "/" || op === "%") return 1;
  if (op === "+" || op === "-") return 2;
  if (op === "<" || op === ">" || op === "<=" || op === ">=") return 3;
  if (op === "==" || op === "!=") return 4;
  if (op === "&&" || op === "||") return 5;
  if (op === "=" || op === ":=") return 6;
  if (op === ";") return 7;
  if (op === ",") return 8;
  throw "unknown BinOp(" + op + ")";
}

export function parse(tokens: Token[]): IoObject {
  const reader = new TokenReader(tokens);
  const result = parseBinOp(reader);
  return result;
}

function parseBinOp(reader: TokenReader, depth: number = 8): IoObject {
  if (depth == -1) {
    return parseFactor(reader);
  } else if (reader.endOfToken()) {
    throw "parseBinOp()";
  } else {
    const result = parseBinOp(reader, depth - 1);
    if (reader.endOfToken()) {
      return result;
    } else {
      const next = reader.seeNext();
      if (isRPar(next)) {
        return result;
      } else {
        if (isBinOp(next) && binOpRate(next.value) == depth) {
          return parseBinOp2(reader, result, depth);
        }
      }
    }
    return result;
  }
}

function parseBinOp2(reader: TokenReader, lhs: any, depth: number): IoObject {
  let result = lhs;
  while (true) {
    if (reader.endOfToken()) {
      return result;
    } else if (isRPar(reader.seeNext())) {
      return result;
    } else if (binOpRate(reader.seeNext()?.value) == depth) {
      const op = reader.next();
      const code2 = parseBinOp(reader, depth - 1);
      result = new BinOp(op.value, result, code2);
    } else {
      return result;
    }
  }
}

function parseFactor(reader: TokenReader): IoObject {
  const token = reader.next();
  let result: IoObject;
  if (token.type === "num") {
    result = new Num(Number(token.value));
  } else if (token.type === "str") {
    result = new Str(token.value);
  } else if (token.type === "(") {
    result = parseBinOp(reader, 8);
    reader.next(); // drop ")"
  } else if (token.type === ")") {
    throw "parseFactor() syntax error => ')' unmatch";
  } else if (token.type === "sym") {
    const s = token.value;
    if (reader.endOfToken()) {
      result = new Message(s);
    } else if (isLPar(reader.seeNext())) {
      if (isRPar(reader.seeNext(2))) {
        // no argument
        const m = new Message(s, []);
        reader.next(); // drop "("
        reader.next(); // drop ")"
        result = m;
      } else {
        // some argument(s)
        reader.next(); // drop "("
        const args = parseBinOp(reader, 8);
        const m = new Message(s, toArray(args));
        reader.next(); // drop ")"
        result = m;
      }
    } else {
      result = new Message(s);
    }
  } else {
    throw "parseFactor()";
  }
  if (!reader.endOfToken() && isLPar(reader.seeNext())) {
    reader.next();
    const args = parseBinOp(reader);
    return new Apply(result, toArray(args));
  } else {
    return result;
  }
}

function toArray(obj?: IoObject): IoObject[] {
  if (obj == undefined) {
    return [];
  } else if (obj instanceof BinOp && obj.op == ",") {
    return toArray(obj.lhs).concat(obj.rhs);
  } else {
    return [obj];
  }
}
