import React from "react";

import { useState, useEffect } from "react";

/*********************************************************************
 * This file follows (as closely as possible) the SAME CLASS STRUCTURE
 * and FUNCTION NAMES as your given C++ reference code.
 *
 * Key differences (unavoidable):
 * - No pointers -> object references
 * - No FILE / fscanf -> trace array
 * - No malloc/free -> JS garbage collection
 *********************************************************************/

/********************** Instruction ****************************/
class Instruction {
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

/********************** Simulator ****************************/
class Simulator {
  constructor(robSize, iqSize, width) {
    this.rob = new ROB(robSize);
    this.iq = new IQ(iqSize, width);
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
      inst.rDst = r;
      inst.rnBegin = this.cycleNo;
    }
    this.RNb = this.DEb;
    this.DEb = [];
  }

  dispatch() {
    if (!this.RNb.length || this.DIb.length) return;
    if (this.iq.freeSize() < this.width) return;
    this.iq.insert(this.RNb);
    this.DIb = this.RNb;
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
      this.rob.pop();
    }
  }

  cycle() {
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
}

/********************** React UI ****************************/
// function printState(sim) {
//   let out = "";
//   out += `CycleNo: ${sim.cycleNo}
// `;

//   out += "FE: " + sim.FEb.map(i => i.indx).join(" ") + "
// ";
//   out += "DE: " + sim.DEb.map(i => i.indx).join(" ") + "
// ";
//   out += "RN: " + sim.RNb.map(i => i.indx).join(" ") + "
// ";
//   out += "RR: " + sim.RRb.map(i => i.indx).join(" ") + "
// ";
//   out += "DI: " + sim.DIb.map(i => i.indx).join(" ") + "
// ";

//   out += "
// ROB:
// ";
//   if (sim.rob.empty()) {
//     out += "[Empty]
// ";
//   } else {
//     let i = sim.rob.s;
//     while (true) {
//       const e = sim.rob.entries[i];
//       out += `Idx:${i} dst:${e.dst} rdy:${e.rdy} inst:${e.inst?.indx ?? "null"}
// `;
//       if (i === sim.rob.e && !sim.rob.isFull) break;
//       i = (i + 1) % sim.rob.size;
//       if (sim.rob.isFull && i === sim.rob.e) break;
//     }
//   }

//   out += "
// IQ:
// ";
//   sim.iq.entries.forEach(e => {
//     out += `inst:${e.inst.indx} rdy1:${e.rdySrc1} rdy2:${e.rdySrc2}
// `;
//   });

//   out += "
// EX:
// ";
//   out += sim.execList.map(i => i.indx).join(" ") + "
// ";

//   out += "WB:
// ";
//   out += sim.WB.map(i => i.indx).join(" ") + "
// ";

//   return out;
// }

function PipelineColumn() {
  const stages = [
    { name: "Fetch", key: "FEb" },
    { name: "Decode", key: "DEb" },
    { name: "Rename", key: "RNb", highlight: true },
    { name: "Register Read", key: "RRb" },
    { name: "Dispatch", key: "DIb", highlight: true },
    { name: "Issue", key: "IQ" },
    { name: "Execute", key: "EX" },
    { name: "Writeback", key: "WB" },
    { name: "Retire", key: "RT" },
  ];

  return (
    <div className="flex flex-col gap-3">
      {stages.map((s) => (
        <div
          key={s.name}
          className={`rounded-lg px-4 py-2 text-center text-sm font-semibold shadow 
            ${
              s.highlight ? "bg-red-500 text-white" : "bg-blue-500 text-white"
            }`}>
          {s.name}
        </div>
      ))}
    </div>
  );
}

function StageBox({ title, items }) {
  return (
    <div className="rounded-xl border p-3">
      <h3 className="font-semibold mb-2 text-xs">{title}</h3>
      {items.length === 0 ? (
        <p className="text-xs text-gray-400">Empty</p>
      ) : (
        items.map((i) => (
          <div
            key={i.indx}
            className="text-xs bg-gray-100 rounded px-2 py-1 mb-1">
            i{i.indx}
          </div>
        ))
      )}
    </div>
  );
}
// ({ title, items }) {
//   return (
//     <div className="rounded-2xl shadow p-3">
//       <h3 className="font-semibold mb-2 text-sm">{title}</h3>
//       {items.length === 0 ? (
//         <p className="text-xs text-gray-400">Empty</p>
//       ) : (
//         items.map(i => (
//           <div key={i.indx} className="text-xs bg-gray-100 rounded px-2 py-1 mb-1">
//             Inst {i.indx}
//           </div>
//         ))
//       )}
//     </div>
//   );
// }

function ROBBox({ rob }) {
  return (
    <div className="rounded-2xl shadow p-3 col-span-2">
      <h3 className="font-semibold mb-2 text-sm">ROB</h3>
      {rob.empty() ? (
        <p className="text-xs text-gray-400">Empty</p>
      ) : (
        <div className="grid grid-cols-4 gap-2">
          {rob.entries.map((e, idx) => (
            <div
              key={idx}
              className={`text-xs rounded px-2 py-1 border ${
                e.rdy ? "bg-green-100" : "bg-red-100"
              }`}>
              <div>Idx:{idx}</div>
              <div>Inst:{e.inst?.indx ?? "-"}</div>
              <div>Rdy:{String(e.rdy)}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function IQBox({ iq }) {
  return (
    <div className="rounded-2xl shadow p-3">
      <h3 className="font-semibold mb-2 text-sm">IQ</h3>
      {iq.entries.length === 0 ? (
        <p className="text-xs text-gray-400">Empty</p>
      ) : (
        iq.entries.map((e, i) => (
          <div key={i} className="text-xs bg-gray-100 rounded px-2 py-1 mb-1">
            Inst {e.inst.indx} | S1:{String(e.rdySrc1)} S2:{String(e.rdySrc2)}
          </div>
        ))
      )}
    </div>
  );
}

export default function App() {
  const [sim] = useState(() => new Simulator(16, 8, 2));
  const [, force] = useState(0);

  useEffect(() => {
    const t = [];
    for (let i = 0; i < 20; i++)
      t.push(new Instruction(i * 4, 0, i % 8, 0, 1, i));
    sim.loadTrace(t);
  }, []);

  return (
    <div className="p-6 space-y-4">
      <button
        className="px-4 py-2 rounded-xl shadow bg-black text-white"
        onClick={() => {
          sim.cycle();
          force((x) => x + 1);
        }}>
        Advance Cycle
      </button>

      <div className="grid grid-cols-3 gap-4">
        <StageBox title="Fetch (FE)" items={sim.FEb} />
        <StageBox title="Decode (DE)" items={sim.DEb} />
        <StageBox title="Rename (RN)" items={sim.RNb} />
        <StageBox title="RegRead (RR)" items={sim.RRb} />
        <StageBox title="Dispatch (DI)" items={sim.DIb} />
        <StageBox title="Execute (EX)" items={sim.execList} />
        <StageBox title="WriteBack (WB)" items={sim.WB} />
        <ROBBox rob={sim.rob} />
        <IQBox iq={sim.iq} />
      </div>
    </div>
  );
}
