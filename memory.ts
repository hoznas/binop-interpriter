import { IoObject } from './object';

type map = Map<string, IoObject>;
export class Memory {
  super: Memory | undefined;
  slots: map;
  constructor(s: Memory | undefined = undefined) {
    this.super = s;
    this.slots = new Map<string, IoObject>();
  }
  subMemory() {
    return new Memory(this);
  }
  find(s: string): map | undefined {
    if (this.slots.get(s)) {
      return this.slots;
    } else if (this.super) {
      return this.super.find(s);
    } else {
      return undefined;
    }
  }
  get(s: string): IoObject | undefined {
    const slot = this.find(s);
    return slot && slot.get(s);
  }
  define(s: string, v: IoObject): IoObject | null {
    const val = this.slots.get(s);
    if (!val) {
      this.slots.set(s, v);
      return v;
    } else {
      return null;
    }
  }
  defineForce(s: string, v: IoObject): IoObject {
    this.slots.set(s, v);
    return v;
  }
  update(s: string, v: IoObject): IoObject | null {
    const slot = this.find(s);
    if (slot) {
      slot.set(s, v);
      return v;
    } else {
      return null;
    }
  }
  show() {
    this.super?.show();
    for (let [k, v] of this.slots) {
      console.log(`Slot.Show(${k} = ${v.str()})`);
    }
  }
}
