export class Instruction {
  constructor(pc, opcode, dst, src1, src2, indx) {
    this.pc = pc;
    this.opcode = opcode;
    this.dst = dst;
    this.src1 = src1;
    this.src2 = src2;
    this.indx = indx;

    this.latency = 1;
    this.execTimer = 0;

    // Renamed register pointers
    this.rSrc1 = null;
    this.rSrc2 = null;
    this.rDst = null;

    // IQ entry reference
    this.iqEntry = null;

    // Pipeline timing (same names as C++)
    this.feBegin = this.feEnd = 0;
    this.deBegin = this.deEnd = 0;
    this.rnBegin = this.rnEnd = 0;
    this.rrBegin = this.rrEnd = 0;
    this.diBegin = this.diEnd = 0;
    this.isBegin = this.isEnd = 0;
    this.exBegin = this.exEnd = 0;
    this.wbBegin = this.wbEnd = 0;
    this.rtBegin = this.rtEnd = 0;
  }
}

/********************** ROB Entry ****************************/
class ROBEntry {
  constructor() {
    this.dst = -1;
    this.pc = 0;
    this.rdy = false;
    this.inst = null;
    this.waiting = []; // {inst, srcType}
  }
}

/********************** ROB ****************************/
class ROB {
  constructor(size) {
    this.entries = Array.from({ length: size }, () => new ROBEntry());
    this.size = size;
    this.s = 0;
    this.e = 0;
    this.isFull = false;
  }

  full() {
    return this.isFull;
  }

  empty() {
    return this.s === this.e && !this.isFull;
  }

  emptySize() {
    if (this.full()) return 0;
    const used = (this.e - this.s + this.size) % this.size;
    return this.size - used;
  }

  getEntry() {
    if (this.full()) return null;
    const r = this.entries[this.e];
    this.e = (this.e + 1) % this.size;
    if (this.s === this.e) this.isFull = true;
    return r;
  }

  peek() {
    if (this.empty()) return null;
    return this.entries[this.s];
  }

  pop() {
    if (this.empty()) return null;
    const r = this.entries[this.s];
    this.s = (this.s + 1) % this.size;
    this.isFull = false;
    return r;
  }
}

/********************** IQ Entry ****************************/
class IQEntry {
  constructor(inst) {
    this.inst = inst;
    this.dst = inst.dst;
    this.rdySrc1 = inst.rSrc1 === null;
    this.rdySrc2 = inst.rSrc2 === null;
    this.v = true;
  }
}

/********************** IQ ****************************/
class IQ {
  constructor(size, width) {
    this.size = size;
    this.width = width;
    this.entries = [];
  }

  freeSize() {
    return this.size - this.entries.length;
  }

  insert(DIbundle) {
    for (const inst of DIbundle) {
      const entry = new IQEntry(inst);
      inst.iqEntry = entry;
      this.entries.push(entry);
    }
  }

  issue() {
    const issued = [];
    this.entries.sort((a, b) => a.inst.indx - b.inst.indx);

    for (
      let i = 0;
      i < this.entries.length && issued.length < this.width;
      i++
    ) {
      const e = this.entries[i];
      if (e.v && e.rdySrc1 && e.rdySrc2) {
        issued.push(e.inst);
        this.entries.splice(i, 1);
        i--;
      }
    }
    return issued;
  }
}

/********************** RMT (Register Map Table) ****************************/
class RMT {
  constructor(size = 32) {
    this.size = size;
    this.table = Array(size).fill(null);
  }

  getEntry(archReg) {
    return this.table[archReg];
  }

  setEntry(archReg, robEntry) {
    this.table[archReg] = robEntry;
  }
}

/********************** Simulator ****************************/
export class Simulator {
  constructor(robSize, iqSize, width) {
    this.rob = new ROB(robSize);
    this.iq = new IQ(iqSize, width);
    this.rmt = new RMT();
    this.width = width;

    this.cycleNo = 0;
    this.instNo = 0;

    this.FEb = [];
    this.DEb = [];
    this.RNb = [];
    this.RRb = [];
    this.DIb = [];

    this.execList = [];
    this.WB = [];

    this.trace = [];
    this.emptyFile = false;
  }

  loadTrace(trace) {
    this.trace = trace;
  }

  fetch() {
    if (this.FEb.length) return;
    for (let i = 0; i < this.width && this.trace.length; i++) {
      const inst = this.trace.shift();
      inst.feBegin = this.cycleNo;
      this.FEb.push(inst);
    }
    if (this.trace.length === 0) this.emptyFile = true;
  }

  decode() {
    if (!this.FEb.length || this.DEb.length) return;
    for (const i of this.FEb) i.feEnd = this.cycleNo;
    this.DEb = this.FEb;
    this.FEb = [];
  }

  rename() {
    if (!this.DEb.length || this.RNb.length) return;
    if (this.rob.emptySize() < this.width) return;

    for (const inst of this.DEb) {
      const r = this.rob.getEntry();
      r.inst = inst;
      r.dst = inst.dst;
      inst.rDst = r;
      inst.rnBegin = this.cycleNo;

      this.rmt.setEntry(inst.dst, r);

      inst.rSrc1 = this.rmt.getEntry(inst.src1);
      inst.rSrc2 = this.rmt.getEntry(inst.src2);
    }
    this.RNb = this.DEb;
    this.DEb = [];
  }

  dispatch() {
    this.DIb = [];
    if (!this.RNb.length) return;
    if (this.iq.freeSize() < this.width) return;
    this.iq.insert(this.RNb);
    this.DIb = [...this.RNb];
    this.RNb = [];
  }

  issue() {
    const issued = this.iq.issue();
    for (const inst of issued) {
      inst.isBegin = this.cycleNo;
      this.execList.push(inst);
    }
  }

  execute() {
    const finished = [];
    for (const inst of this.execList) {
      inst.execTimer++;
      if (inst.execTimer === inst.latency) finished.push(inst);
    }

    this.execList = this.execList.filter((i) => !finished.includes(i));

    for (const inst of finished) {
      inst.exEnd = this.cycleNo;
      inst.rDst.rdy = true;
      this.WB.push(inst);
    }
  }

  writeBack() {
    this.WB = [];
  }

  retire() {
    for (let i = 0; i < this.width; i++) {
      const e = this.rob.peek();
      if (!e || !e.rdy) break;
      e.inst.rtEnd = this.cycleNo;
      console.log("inst:");
      this.rob.pop();
    }
  }

  cycle() {
    debugger;
    this.retire();
    this.writeBack();
    this.execute();
    this.issue();
    this.dispatch();
    this.rename();
    this.decode();
    this.fetch();
    this.cycleNo++;
  }

  advance_cycle() {
    return (
      !this.emptyFile ||
      !this.rob.empty() ||
      this.execList.length !== 0 ||
      this.DEb.length !== 0 ||
      this.RNb.length !== 0 ||
      this.RRb.length !== 0 ||
      this.DIb.length !== 0 ||
      this.WB.length !== 0
    );
  }

  sim(simtrace) {
    let trace = [];
    for (let i = 0; i < simtrace.length; i++) {
      let inst = simtrace[i].split(" ");
      trace.push(
        new Instruction(
          parseInt(inst[0], 10),
          parseInt(inst[1], 10),
          parseInt(inst[2], 10),
          parseInt(inst[3], 10),
          parseInt(inst[4], 10),
          i
        )
      );
    }

    this.loadTrace(trace);

    do {
      this.cycle();
    } while (this.advance_cycle());
  }
}
