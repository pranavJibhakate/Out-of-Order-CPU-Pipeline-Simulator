export class Instruction {
  constructor(pc, opcode, dst, src1, src2, indx) {
    this.pc = pc;
    this.opcode = opcode;
    this.dst = dst;
    this.src1 = src1;
    this.src2 = src2;
    this.indx = indx;

    this.latency = 1;
    if (opcode === 2) {
      this.latency = 3;
    } else if (opcode === 3) {
      this.latency = 5;
    }
    this.execTimer = 0;

    // Renamed register pointers
    this.rSrc1 = null;
    this.rSrc2 = null;
    this.rDst = null;

    // IQ entry reference
    this.iqEntry = null;

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

  print() {
    console.log(
      `${this.indx} fu{${this.opcode}} src{${this.src1},${this.src2}} dst{${this.dst}} ` +
        `FE{${this.feEnd - 1},1} ` +
        `DE{${this.deBegin},${this.deEnd - this.deBegin}} ` +
        `RN{${this.rnBegin},${this.rnEnd - this.rnBegin}} ` +
        `RR{${this.rrBegin},${this.rrEnd - this.rrBegin}} ` +
        `DI{${this.diBegin},${this.diEnd - this.diBegin}} ` +
        `IS{${this.isBegin},${this.isEnd - this.isBegin}} ` +
        `EX{${this.exBegin},${this.exEnd - this.exBegin}} ` +
        `WB{${this.wbBegin},${this.wbEnd - this.wbBegin}} ` +
        `RT{${this.rtBegin},${this.rtEnd - this.rtBegin}}`
    );
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
  updateVal(inst) {
    if (this.empty()) return;
    for (let i = this.s; i <= this.e; i++) {
      if (this.entries[i].inst.indx === inst.indx) {
        this.entries[i].inst = inst;
      }
    }
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
  isValid(archReg) {
    if (archReg === -1) return false;
    return this.table[archReg] !== null;
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

  loadFromTrace() {
    if (this.FEb.length) return;
    for (let i = 0; i < this.width && this.trace.length; i++) {
      const inst = this.trace.shift();
      inst.feBegin = this.cycleNo;
      this.FEb.push(inst);
    }
    if (this.trace.length === 0) this.emptyFile = true;
  }

  fetch() {
    if (!this.FEb.length || this.DEb.length) return;
    for (let i of this.FEb) i.feEnd = this.cycleNo;
    this.DEb = this.FEb;
    this.FEb = [];
    for (let i of this.DEb) i.deBegin = this.cycleNo;
  }

  decode() {
    if (!this.DEb.length || this.RNb.length) return;
    for (let i of this.DEb) i.deEnd = this.cycleNo;
    this.RNb = this.DEb;
    this.DEb = [];
    for (let i of this.RNb) i.rnBegin = this.cycleNo;
  }

  rename() {
    if (!this.RNb.length || this.RRb.length) return;
    if (this.rob.emptySize() < this.width) return;

    for (const inst of this.RNb) inst.rnEnd = this.cycleNo;

    for (const inst of this.RNb) {
      if (inst.src1 === -1 || !this.rmt.isValid(inst.src1)) {
        inst.rSrc1 = null;
      } else {
        inst.rSrc1 = this.rmt.getEntry(inst.src1);
        inst.rSrc1.waiting.push({ inst, src: 1 });
      }

      if (inst.src2 === -1 || !this.rmt.isValid(inst.src2)) {
        inst.rSrc2 = null;
      } else {
        inst.rSrc2 = this.rmt.getEntry(inst.src2);
        inst.rSrc2.waiting.push({ inst, src: 2 });
      }

      const robEntry = this.rob.getEntry();
      robEntry.dst = inst.dst;
      robEntry.pc = inst.pc;
      robEntry.rdy = false;
      inst.rDst = robEntry;
      robEntry.inst = inst;

      if (inst.dst !== -1) {
        this.rmt.setEntry(inst.dst, robEntry);
      }
    }

    for (const inst of this.RNb) inst.rrBegin = this.cycleNo;

    this.RRb = this.RNb;
    this.RNb = [];
  }

  regRead() {
    if (!this.RRb.length || this.DIb.length) return;

    for (const inst of this.RRb) inst.rrEnd = this.cycleNo;

    for (const inst of this.RRb) {
      if (inst.rSrc1 && inst.rSrc1.rdy) inst.rSrc1 = null;
      if (inst.rSrc2 && inst.rSrc2.rdy) inst.rSrc2 = null;
    }

    for (const inst of this.RRb) inst.diBegin = this.cycleNo;
    this.DIb = this.RRb;
    this.RRb = [];
  }

  dispatch() {
    if (!this.DIb.length) return;
    if (this.iq.freeSize() < this.width) return;

    for (const inst of this.DIb) {
      inst.diEnd = this.cycleNo;
      inst.isBegin = this.cycleNo;
    }

    this.iq.insert(this.DIb);
    this.DIb = [];
  }

  issue() {
    const issued = this.iq.issue();
    for (const inst of issued) {
      inst.isEnd = this.cycleNo;
      inst.exBegin = this.cycleNo;
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
      inst.wbBegin = this.cycleNo;
      this.WB.push(inst);
    }

    for (const inst of finished) {
      for (const { inst: instWaiting, src: srcType } of inst.rDst.waiting) {
        if (srcType === 1) {
          instWaiting.rSrc1 = null;
          if (instWaiting.iqEntry != null) {
            instWaiting.iqEntry.rdySrc1 = true;
          }
        }

        if (srcType === 2) {
          instWaiting.rSrc2 = null;
          if (instWaiting.iqEntry != null) {
            instWaiting.iqEntry.rdySrc2 = true;
          }
        }
      }
    }
  }

  writeBack() {
    for (let inst of this.WB) {
      inst.rtBegin = this.cycleNo;
      inst.wbEnd = this.cycleNo;
      inst.rDst.rdy = true;
    }
    this.WB = [];
  }

  retire() {
    for (let i = 0; i < this.width; i++) {
      const e = this.rob.peek();
      if (!e || !e.rdy) break;
      e.inst.rtEnd = this.cycleNo;
      e.inst.print();
      this.rob.pop();
    }
  }

  cycle() {
    // debugger;
    this.retire();
    this.writeBack();
    this.execute();
    this.issue();
    this.dispatch();
    this.regRead();
    this.rename();
    this.decode();
    this.fetch();
    this.loadFromTrace();
    this.cycleNo++;
  }

  advance_cycle() {
    return (
      !this.emptyFile ||
      !this.rob.empty() ||
      this.execList.length !== 0 ||
      this.FEb.length !== 0 ||
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
