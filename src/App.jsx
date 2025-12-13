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
class Simulator {
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
}

/********************** React UI ****************************/
function PipelineDiagram({ sim }) {
  const stages = [
    { name: "Fetch", key: "FEb", color: "bg-blue-100 border-blue-300" },
    { name: "Decode", key: "DEb", color: "bg-green-100 border-green-300" },
    { name: "Rename", key: "RNb", color: "bg-yellow-100 border-yellow-300" },
    {
      name: "Register Read",
      key: "RRb",
      color: "bg-purple-100 border-purple-300",
    },
    { name: "Dispatch", key: "DIb", color: "bg-pink-100 border-pink-300" },
    { name: "Issue", key: "IQ", color: "bg-indigo-100 border-indigo-300" },
    { name: "Execute", key: "EX", color: "bg-orange-100 border-orange-300" },
    { name: "Write Back", key: "WB", color: "bg-teal-100 border-teal-300" },
    { name: "Retire", key: "ROB", color: "bg-red-100 border-red-300" },
  ];

  // Get instructions for each stage
  const stageInstructions = stages.map((stage) => {
    if (stage.key === "IQ") {
      return sim.iq.entries.map((e) => e.inst);
    } else if (stage.key === "EX") {
      return sim.execList;
    } else if (stage.key === "ROB") {
      // Show instructions in ROB that are ready to retire
      const readyInsts = [];
      if (!sim.rob.empty()) {
        let i = sim.rob.s;
        while (true) {
          const e = sim.rob.entries[i];
          if (e.inst) readyInsts.push(e.inst);
          if (i === sim.rob.e && !sim.rob.isFull) break;
          i = (i + 1) % sim.rob.size;
          if (sim.rob.isFull && i === sim.rob.e) break;
        }
      }
      return readyInsts;
    } else {
      return sim[stage.key] || [];
    }
  });

  return (
    <div className="mb-8">
      <h2 className="text-xl font-bold mb-4 text-gray-800">Pipeline Diagram</h2>
      <div className="flex flex-col md:flex-row items-start gap-4 mb-6">
        <div className="flex flex-col items-center">
          <div className="text-sm font-semibold text-gray-600 mb-2">Stages</div>
          <div className="flex flex-col gap-1">
            {stages.map((stage, idx) => (
              <div
                key={stage.name}
                className="w-32 h-10 flex items-center justify-center text-sm font-medium border-2 rounded"
                style={{
                  borderColor:
                    getComputedStyle(document.documentElement).getPropertyValue(
                      "--" + stage.color.split("-")[1]
                    ) || "#000",
                }}>
                {stage.name}
              </div>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-x-auto">
          <div className="text-sm font-semibold text-gray-600 mb-2">
            Instructions in Pipeline
          </div>
          <div className="flex gap-2">
            {stageInstructions.map((insts, stageIdx) => (
              <div key={stageIdx} className="flex-1 min-w-[100px]">
                <div
                  className={`h-10 border-2 rounded-t ${stages[stageIdx].color} flex items-center justify-center font-semibold`}>
                  {insts.length} instr
                </div>
                <div className="border-2 border-t-0 rounded-b p-2 h-64 overflow-y-auto">
                  {insts.map((inst) => (
                    <div
                      key={inst.indx}
                      className="text-xs p-1 mb-1 bg-white rounded border">
                      <div className="font-semibold">I{inst.indx}</div>
                      <div className="text-gray-600">
                        R{inst.dst} ← R{inst.src1}, R{inst.src2}
                      </div>
                    </div>
                  ))}
                  {insts.length === 0 && (
                    <div className="text-gray-400 text-sm italic text-center mt-4">
                      Empty
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function ROBTable({ rob }) {
  const getROBEntries = () => {
    const entries = [];
    if (!rob.empty()) {
      let i = rob.s;
      let count = 0;
      while (true) {
        const e = rob.entries[i];
        entries.push({ index: i, entry: e });
        count++;

        if (i === rob.e && !rob.isFull) break;
        if (rob.isFull && count >= rob.size) break;

        i = (i + 1) % rob.size;
        if (rob.isFull && i === rob.e) break;
      }
    }
    return entries;
  };

  return (
    <div className="bg-white rounded-xl shadow p-4 mb-6">
      <h2 className="text-xl font-bold mb-4 text-gray-800">
        Reorder Buffer (ROB)
      </h2>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="bg-gray-50">
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border">
                ROB Index
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border">
                Inst Index
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border">
                Dest Reg
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border">
                PC
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border">
                Ready
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border">
                Head/Tail
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {getROBEntries().map(({ index, entry }) => (
              <tr key={index} className="hover:bg-gray-50">
                <td className="px-4 py-3 border text-sm font-mono">{index}</td>
                <td className="px-4 py-3 border text-sm font-semibold">
                  {entry.inst ? `I${entry.inst.indx}` : "—"}
                </td>
                <td className="px-4 py-3 border text-sm">R{entry.dst}</td>
                <td className="px-4 py-3 border text-sm font-mono">
                  0x{entry.inst?.pc?.toString(16)?.padStart(4, "0") || "0000"}
                </td>
                <td className="px-4 py-3 border">
                  <span
                    className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      entry.rdy
                        ? "bg-green-100 text-green-800"
                        : "bg-red-100 text-red-800"
                    }`}>
                    {entry.rdy ? "Ready" : "Not Ready"}
                  </span>
                </td>
                <td className="px-4 py-3 border text-sm">
                  {index === rob.s && index === rob.e
                    ? "Head & Tail"
                    : index === rob.s
                    ? "← Head"
                    : index === rob.e
                    ? "Tail →"
                    : ""}
                </td>
              </tr>
            ))}
            {rob.empty() && (
              <tr>
                <td
                  colSpan="6"
                  className="px-4 py-8 text-center text-gray-500 border">
                  ROB is empty
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="mt-4 text-sm text-gray-600">
        <div className="flex gap-4">
          <span>Head (s): {rob.s}</span>
          <span>Tail (e): {rob.e}</span>
          <span>Full: {rob.full() ? "Yes" : "No"}</span>
          <span>Empty: {rob.empty() ? "Yes" : "No"}</span>
        </div>
      </div>
    </div>
  );
}

function IssueQueueTable({ iq }) {
  return (
    <div className="bg-white rounded-xl shadow p-4 mb-6">
      <h2 className="text-xl font-bold mb-4 text-gray-800">Issue Queue (IQ)</h2>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="bg-gray-50">
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border">
                IQ Slot
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border">
                Inst Index
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border">
                Dest Reg
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border">
                Src1 Ready
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border">
                Src2 Ready
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border">
                Issue Ready
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {iq.entries.map((entry, index) => (
              <tr key={index} className="hover:bg-gray-50">
                <td className="px-4 py-3 border text-sm font-mono">{index}</td>
                <td className="px-4 py-3 border text-sm font-semibold">
                  I{entry.inst.indx}
                </td>
                <td className="px-4 py-3 border text-sm">R{entry.dst}</td>
                <td className="px-4 py-3 border">
                  <span
                    className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      entry.rdySrc1
                        ? "bg-green-100 text-green-800"
                        : "bg-red-100 text-red-800"
                    }`}>
                    {entry.rdySrc1 ? "✓" : "✗"}
                  </span>
                </td>
                <td className="px-4 py-3 border">
                  <span
                    className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      entry.rdySrc2
                        ? "bg-green-100 text-green-800"
                        : "bg-red-100 text-red-800"
                    }`}>
                    {entry.rdySrc2 ? "✓" : "✗"}
                  </span>
                </td>
                <td className="px-4 py-3 border">
                  <span
                    className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      entry.rdySrc1 && entry.rdySrc2
                        ? "bg-green-100 text-green-800"
                        : "bg-yellow-100 text-yellow-800"
                    }`}>
                    {entry.rdySrc1 && entry.rdySrc2 ? "Ready" : "Waiting"}
                  </span>
                </td>
              </tr>
            ))}
            {iq.entries.length === 0 && (
              <tr>
                <td
                  colSpan="6"
                  className="px-4 py-8 text-center text-gray-500 border">
                  Issue Queue is empty
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="mt-4 text-sm text-gray-600">
        <div className="flex gap-4">
          <span>Size: {iq.size}</span>
          <span>Used: {iq.entries.length}</span>
          <span>Free: {iq.freeSize()}</span>
          <span>Issue Width: {iq.width}</span>
        </div>
      </div>
    </div>
  );
}

function RMTTable({ rmt }) {
  return (
    <div className="bg-white rounded-xl shadow p-4 mb-6">
      <h2 className="text-xl font-bold mb-4 text-gray-800">
        Register Map Table (RMT)
      </h2>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="bg-gray-50">
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border">
                Architectural Register
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border">
                Maps to ROB Entry
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border">
                Ready
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border">
                Instruction
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {rmt.table.map(
              (robEntry, archReg) =>
                robEntry && (
                  <tr key={archReg} className="hover:bg-gray-50">
                    <td className="px-4 py-3 border text-sm font-semibold">
                      R{archReg}
                    </td>
                    <td className="px-4 py-3 border text-sm">
                      {robEntry.dst !== undefined
                        ? `ROB[${robEntry.dst}]`
                        : "—"}
                    </td>
                    <td className="px-4 py-3 border">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          robEntry.rdy
                            ? "bg-green-100 text-green-800"
                            : "bg-red-100 text-red-800"
                        }`}>
                        {robEntry.rdy ? "Ready" : "Not Ready"}
                      </span>
                    </td>
                    <td className="px-4 py-3 border text-sm">
                      {robEntry.inst ? `I${robEntry.inst.indx}` : "—"}
                    </td>
                  </tr>
                )
            )}
            {rmt.table.every((entry) => !entry) && (
              <tr>
                <td
                  colSpan="4"
                  className="px-4 py-8 text-center text-gray-500 border">
                  RMT is empty (no register mappings)
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="mt-4 text-sm text-gray-600">
        <span>Total Registers: {rmt.size}</span>
      </div>
    </div>
  );
}

function ActiveStages({ sim }) {
  const stageData = [
    { name: "Fetch", bundle: sim.FEb, count: sim.FEb.length },
    { name: "Decode", bundle: sim.DEb, count: sim.DEb.length },
    { name: "Rename", bundle: sim.RNb, count: sim.RNb.length },
    { name: "Register Read", bundle: sim.RRb, count: sim.RRb.length },
    { name: "Dispatch", bundle: sim.DIb, count: sim.DIb.length },
    {
      name: "Issue Queue",
      bundle: sim.iq.entries.map((e) => e.inst),
      count: sim.iq.entries.length,
    },
    { name: "Execute", bundle: sim.execList, count: sim.execList.length },
    { name: "Write Back", bundle: sim.WB, count: sim.WB.length },
  ];

  return (
    <div className="bg-white rounded-xl shadow p-4 mb-6">
      <h2 className="text-xl font-bold mb-4 text-gray-800">
        Active Pipeline Stages
      </h2>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {stageData.map((stage, idx) => (
          <div
            key={idx}
            className="border rounded-lg p-4 text-center hover:shadow-md transition-shadow">
            <div className="text-sm font-medium text-gray-600 mb-1">
              {stage.name}
            </div>
            <div className="text-2xl font-bold text-blue-600 mb-2">
              {stage.count}
            </div>
            <div className="text-xs text-gray-500">
              Instructions:{" "}
              {stage.bundle.map((inst) => `I${inst.indx}`).join(", ") || "None"}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function App() {
  const [sim] = useState(() => new Simulator(8, 8, 1));
  const [, forceUpdate] = useState(0);

  useEffect(() => {
    // Load sample trace
    const trace = [];
    trace.push(new Instruction(0, 0, 1, 2, 3, 0));
    trace.push(new Instruction(4, 0, 1, 2, 3, 1));
    trace.push(new Instruction(8, 0, 1, 2, 3, 2));
    sim.loadTrace(trace);
    forceUpdate((x) => x + 1);
  }, [sim]);

  const handleCycle = () => {
    sim.cycle();
    forceUpdate((x) => x + 1);
  };

  const handleReset = () => {
    const newSim = new Simulator(8, 8, 1);
    const trace = [];
    // for (let i = 0; i < 32; i++) {
    //   trace.push(new Instruction(i * 4, 0, i % 8, (i + 1) % 8, (i + 2) % 8, i));
    // }
    trace.push(new Instruction(0, 0, 1, 2, 3, 0));
    trace.push(new Instruction(4, 0, 1, 2, 3, 1));
    trace.push(new Instruction(8, 0, 1, 2, 3, 2));
    newSim.loadTrace(trace);
    window.location.reload(); // Quick reset
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        <header className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Out-of-Order Pipeline Simulator
          </h1>
          <p className="text-gray-600">
            Cycle: {sim.cycleNo} | Instructions Remaining: {sim.trace.length}
          </p>
        </header>

        <div className="flex flex-wrap gap-4 mb-6">
          <button
            onClick={handleCycle}
            className="px-6 py-3 bg-blue-600 text-white font-medium rounded-lg shadow hover:bg-blue-700 transition-colors">
            Advance Cycle ({sim.width} instructions/cycle)
          </button>
          <button
            onClick={handleReset}
            className="px-6 py-3 bg-gray-600 text-white font-medium rounded-lg shadow hover:bg-gray-700 transition-colors">
            Reset Simulator
          </button>
          <button
            onClick={() => {
              for (let i = 0; i < 5; i++) sim.cycle();
              forceUpdate((x) => x + 1);
            }}
            className="px-6 py-3 bg-green-600 text-white font-medium rounded-lg shadow hover:bg-green-700 transition-colors">
            Run 5 Cycles
          </button>
        </div>

        {/* <PipelineDiagram sim={sim} /> */}

        <ActiveStages sim={sim} />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          <ROBTable rob={sim.rob} />
          <IssueQueueTable iq={sim.iq} />
        </div>

        <RMTTable rmt={sim.rmt} />

        <div className="bg-white rounded-xl shadow p-6 mt-8">
          <h2 className="text-xl font-bold mb-4 text-gray-800">
            Simulator Configuration
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="border rounded-lg p-4">
              <div className="text-sm text-gray-600">ROB Size</div>
              <div className="text-lg font-semibold">
                {sim.rob.size} entries
              </div>
            </div>
            <div className="border rounded-lg p-4">
              <div className="text-sm text-gray-600">IQ Size</div>
              <div className="text-lg font-semibold">{sim.iq.size} entries</div>
            </div>
            <div className="border rounded-lg p-4">
              <div className="text-sm text-gray-600">Issue Width</div>
              <div className="text-lg font-semibold">
                {sim.width} instructions/cycle
              </div>
            </div>
            <div className="border rounded-lg p-4">
              <div className="text-sm text-gray-600">
                Architectural Registers
              </div>
              <div className="text-lg font-semibold">
                {sim.rmt.size} registers
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
