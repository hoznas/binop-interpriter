import { evalNode } from "./evaluator";
import { Slot } from "./slot";

export abstract class IoObject {
  abstract str(): string;
  compare(other: IoObject): number {
    if (this === other) return 0;
    const s1 = this.str();
    const s2 = other.str();
    if (s1 < s2) return -1;
    if (s1 > s2) return 1;
    else return 0;
  }
  send(name: string, args: IoObject[] | undefined, e: Slot): IoObject {
    if (name === "clone" && args?.length === 0) {
      return this;
    } else if (name === "print" && args?.length === 0) {
      console.log(this.str());
      return NIL;
    } else {
      throw "[ERROR] IoObject::send()";
    }
  }
}

export class Num extends IoObject {
  constructor(public value: number) {
    super();
  }
  str(): string {
    return this.value.toString();
  }
  compare(other: IoObject): number {
    if (other instanceof Num) return this.value - other.value;
    return super.compare(other);
  }
}

export class Str extends IoObject {
  constructor(public value: string) {
    super();
  }
  str(): string {
    return `"${this.value}"`;
  }
  compare(other: IoObject): number {
    if (other instanceof Str) {
      if (this.value === other.value) return 0;
      else if (this.value < other.value) return -1;
      else return 1; //this.value > other.value
    }
    return super.compare(other);
  }
  concat(other: IoObject): IoObject {
    if (other instanceof Str) return new Str(this.value + other.value);
    else return new Str(this.value + other.str());
  }
}

export class Nil extends IoObject {
  private static instance = new Nil();
  private constructor() {
    super();
  }
  str(): string {
    return "nil";
  }
  compare(other: IoObject): number {
    if (other instanceof Nil) return 0;
    return super.compare(other);
  }
  static getInstance(): Nil {
    return Nil.instance;
  }
}
export const NIL = Nil.getInstance();

export class BinOp extends IoObject {
  // op --- operator
  // lhs, rhs --- left/right hand side
  constructor(public op: string, public lhs: IoObject, public rhs: IoObject) {
    super();
  }
  str(): string {
    return `(${this.op} ${this.lhs.str()} ${this.rhs.str()})`;
  }
}

export class Message extends IoObject {
  name: string;
  args?: IoObject[];
  constructor(name: string, args?: IoObject[]) {
    super();
    this.name = name;
    this.args = args;
  }
  str(): string {
    if (this.args) {
      return this.name + "(" + this.args.map((e) => e.str()).join(", ") + ")";
    } else {
      return this.name;
    }
  }
}

export class Method extends IoObject {
  argList: string[];
  body: IoObject;
  createdEnv: Slot;
  constructor(args: IoObject[], env: Slot) {
    super();
    if (args.length === 0) {
      throw "new Method(no-argument)";
    }
    this.body = args.pop()!;
    this.argList = args.map((a) => {
      return (a as Message).name;
    });
    this.createdEnv = env;
  }
  call(argList: IoObject[], callerEnv: Slot): IoObject {
    const closure = this.bind(argList.map((arg) => evalNode(arg, callerEnv)));
    return evalNode(this.body, closure);
  }
  bind(values: IoObject[]): Slot {
    const closure = this.createdEnv.subSlot();
    if (this.argList.length !== values.length) throw "ERROR arg length error.";
    for (let i = 0; i < this.argList.length; i++) {
      closure.defineForce(this.argList[i], values[i]);
    }
    return closure;
  }
  str(): string {
    const str = this.argList.length === 0 ? "" : this.argList.join(",") + ",";
    return "fun(" + str + this.body.str() + ")";
  }
}

export class Apply extends IoObject {
  obj: IoObject;
  argList: IoObject[];
  constructor(obj: IoObject, argList: IoObject[]) {
    super();
    this.obj = obj;
    this.argList = argList;
  }
  compare(other: IoObject): number {
    if (this === other) return 0;
    else return -1;
  }
  str(): string {
    return (
      this.obj.str() + "(" + this.argList.map((e) => e.str()).join(",") + ")"
    );
  }
}

export class UserObject extends IoObject {
  slot: Slot;
  constructor(slot: Slot) {
    super();
    this.slot = slot;
  }
  compare(other: IoObject): number {
    if (this === other) return 0;
    else return -1;
  }
  str(): string {
    const s = Object.keys(this.slot.slot)
      .map((k) => {
        const v = this.slot.slot[k];
        return k + ":" + v.str();
      })
      .join(",");
    return "{" + s + "}";
  }
  send(name: string, args: IoObject[] | undefined, e: Slot): IoObject {
    if (name === "clone" && args?.length === 0) {
      return new UserObject(this.slot.subSlot());
    } else if (name === "print" && args?.length === 0) {
      console.log(this.str());
      return NIL;
    } else if (!args) {
      // get property
      const result = this.get(name);
      if (result) return result;
      else throw "UserObject(no property)";
    } else {
      // method call
    }
    console.log(this.str());
    console.log(name);
    throw "ERROR UserObject::send()";
  }
  define(name: string, value: IoObject): IoObject | null {
    return this.slot.define(name, value);
  }
  update(name: string, value: IoObject): IoObject | null {
    return this.slot.update(name, value);
  }
  assignToObject(name: string, value: IoObject): IoObject {
    return this.slot.defineForce(name, value);
  }
  get(name: string): IoObject | null {
    return this.slot.get(name);
  }
}
