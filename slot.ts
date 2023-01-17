import { IoObject } from "./object";

type map = { [key: string]: IoObject };

export class Slot {
  super: Slot | undefined;
  slot: map;
  constructor(e: Slot | undefined = undefined) {
    this.super = e;
    this.slot = {};
  }
  subSlot() {
    return new Slot(this);
  }
  find(s: string): map | null {
    if (this.slot[s]) {
      return this.slot;
    } else if (this.super) {
      return this.super.find(s);
    } else {
      return null;
    }
  }
  get(s: string): IoObject | null {
    const slot = this.find(s);
    return slot && slot[s];
  }
  define(s: string, v: IoObject): IoObject | null {
    const val = this.slot[s];
    if (!val) {
      this.slot[s] = v;
      return v;
    } else {
      return null;
    }
  }
  defineForce(s: string, v: IoObject): IoObject {
    this.slot[s] = v;
    return v;
  }
  update(s: string, v: IoObject): IoObject | null {
    const slot = this.find(s);
    if (slot) {
      slot[s] = v;
      return v;
    } else {
      return null;
    }
  }
}
