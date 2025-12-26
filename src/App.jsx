import React from "react";

import { useState, useEffect } from "react";
import "./App.css";
import { Simulator, Instruction } from "./Simulator.js";

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
// import { useState, useEffect } from "react";
// import Simulator from "./Simulator";
// import "./App.css";

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
    <div className="component-card rob-card">
      <h2 className="component-title">Reorder Buffer (ROB)</h2>
      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr className="table-header">
              <th className="table-header-cell">ROB Index</th>
              <th className="table-header-cell">Inst Index</th>
              <th className="table-header-cell">Dest Reg</th>
              <th className="table-header-cell">PC</th>
              <th className="table-header-cell">Ready</th>
              <th className="table-header-cell">Head/Tail</th>
            </tr>
          </thead>
          <tbody className="table-body">
            {getROBEntries().map(({ index, entry }) => (
              <tr key={index} className="table-row">
                <td className="table-cell monospace">{index}</td>
                <td className="table-cell bold">
                  {entry.inst ? `I${entry.inst.indx}` : "—"}
                </td>
                <td className="table-cell">R{entry.dst}</td>
                <td className="table-cell monospace">
                  0x{entry.inst?.pc?.toString(16)?.padStart(4, "0") || "0000"}
                </td>
                <td className="table-cell">
                  <span
                    className={`badge ${
                      entry.rdy ? "badge-ready" : "badge-not-ready"
                    }`}>
                    {entry.rdy ? "Ready" : "Not Ready"}
                  </span>
                </td>
                <td className="table-cell">
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
                <td colSpan="6" className="table-cell empty-message">
                  ROB is empty
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="component-status">
        <div className="status-item">
          <span className="status-label">Head (s):</span>
          <span className="status-value">{rob.s}</span>
        </div>
        <div className="status-item">
          <span className="status-label">Tail (e):</span>
          <span className="status-value">{rob.e}</span>
        </div>
        <div className="status-item">
          <span className="status-label">Full:</span>
          <span className="status-value">{rob.full() ? "Yes" : "No"}</span>
        </div>
        <div className="status-item">
          <span className="status-label">Empty:</span>
          <span className="status-value">{rob.empty() ? "Yes" : "No"}</span>
        </div>
      </div>
    </div>
  );
}

function IssueQueueTable({ iq }) {
  return (
    <div className="component-card iq-card">
      <h2 className="component-title">Issue Queue (IQ)</h2>
      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr className="table-header">
              <th className="table-header-cell">IQ Slot</th>
              <th className="table-header-cell">Inst Index</th>
              <th className="table-header-cell">Dest Reg</th>
              <th className="table-header-cell">Src1 Ready</th>
              <th className="table-header-cell">Src2 Ready</th>
              <th className="table-header-cell">Issue Ready</th>
            </tr>
          </thead>
          <tbody className="table-body">
            {iq.entries.map((entry, index) => (
              <tr key={index} className="table-row">
                <td className="table-cell monospace">{index}</td>
                <td className="table-cell bold">I{entry.inst.indx}</td>
                <td className="table-cell">R{entry.dst}</td>
                <td className="table-cell">
                  <span
                    className={`badge ${
                      entry.rdySrc1 ? "badge-success" : "badge-error"
                    }`}>
                    {entry.rdySrc1 ? "✓" : "✗"}
                  </span>
                </td>
                <td className="table-cell">
                  <span
                    className={`badge ${
                      entry.rdySrc2 ? "badge-success" : "badge-error"
                    }`}>
                    {entry.rdySrc2 ? "✓" : "✗"}
                  </span>
                </td>
                <td className="table-cell">
                  <span
                    className={`badge ${
                      entry.rdySrc1 && entry.rdySrc2
                        ? "badge-ready"
                        : "badge-warning"
                    }`}>
                    {entry.rdySrc1 && entry.rdySrc2 ? "Ready" : "Waiting"}
                  </span>
                </td>
              </tr>
            ))}
            {iq.entries.length === 0 && (
              <tr>
                <td colSpan="6" className="table-cell empty-message">
                  Issue Queue is empty
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="component-status">
        <div className="status-item">
          <span className="status-label">Size:</span>
          <span className="status-value">{iq.size}</span>
        </div>
        <div className="status-item">
          <span className="status-label">Used:</span>
          <span className="status-value">{iq.entries.length}</span>
        </div>
        <div className="status-item">
          <span className="status-label">Free:</span>
          <span className="status-value">{iq.freeSize()}</span>
        </div>
        <div className="status-item">
          <span className="status-label">Issue Width:</span>
          <span className="status-value">{iq.width}</span>
        </div>
      </div>
    </div>
  );
}

function RMTTable({ rmt }) {
  return (
    <div className="component-card rmt-card">
      <h2 className="component-title">Register Map Table (RMT)</h2>
      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr className="table-header">
              <th className="table-header-cell">Architectural Register</th>
              <th className="table-header-cell">Maps to ROB Entry</th>
              <th className="table-header-cell">Ready</th>
              <th className="table-header-cell">Instruction</th>
            </tr>
          </thead>
          <tbody className="table-body">
            {rmt.table.map(
              (robEntry, archReg) =>
                robEntry && (
                  <tr key={archReg} className="table-row">
                    <td className="table-cell bold">R{archReg}</td>
                    <td className="table-cell">
                      {robEntry.dst !== undefined
                        ? `ROB[${robEntry.dst}]`
                        : "—"}
                    </td>
                    <td className="table-cell">
                      <span
                        className={`badge ${
                          robEntry.rdy ? "badge-ready" : "badge-not-ready"
                        }`}>
                        {robEntry.rdy ? "Ready" : "Not Ready"}
                      </span>
                    </td>
                    <td className="table-cell">
                      {robEntry.inst ? `I${robEntry.inst.indx}` : "—"}
                    </td>
                  </tr>
                )
            )}
            {rmt.table.every((entry) => !entry) && (
              <tr>
                <td colSpan="4" className="table-cell empty-message">
                  RMT is empty (no register mappings)
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="component-status">
        <div className="status-item">
          <span className="status-label">Total Registers:</span>
          <span className="status-value">{rmt.size}</span>
        </div>
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
    <div className="component-card stages-card">
      <h2 className="component-title">Active Pipeline Stages</h2>
      <div className="stages-grid">
        {stageData.map((stage, idx) => (
          <div key={idx} className="stage-card">
            <div className="stage-name">{stage.name}</div>
            {/* <div className="stage-count">{stage.count}</div> */}
            <div className="stage-count">
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
    window.location.reload();
  };

  const runCycles = (count) => {
    for (let i = 0; i < count; i++) sim.cycle();
    forceUpdate((x) => x + 1);
  };

  return (
    <div className="simulator-app">
      <div className="simulator-container">
        <header className="app-header">
          {/* <h1 className="app-title">Out-of-Order Pipeline Simulator</h1> */}
        </header>

        <div className="control-panel-parent">
          <div className="control-panel">
            <button onClick={handleCycle} className="btn btn-primary">
              Advance Cycle ({sim.width} instructions/cycle)
            </button>
            <button onClick={handleReset} className="btn btn-secondary">
              Reset Simulator
            </button>
            <button onClick={() => runCycles(5)} className="btn btn-success">
              Run 5 Cycles
            </button>
            <button onClick={() => runCycles(10)} className="btn btn-warning">
              Run 10 Cycles
            </button>
          </div>
          <p className="app-subtitle">
            Cycle: <span className="cycle-number">{sim.cycleNo}</span> |
            Instructions Remaining:{" "}
            <span className="instructions-remaining">{sim.trace.length}</span>
          </p>
        </div>

        <div className="panels-grid">
          <ActiveStages sim={sim} />
          <div className="panels-grid-second-col">
            <div className="main-grid">
              <ROBTable rob={sim.rob} />
              <IssueQueueTable iq={sim.iq} />
            </div>

            <RMTTable rmt={sim.rmt} />
          </div>
        </div>

        <div className="component-card config-card">
          <h2 className="component-title">Simulator Configuration</h2>
          <div className="config-grid">
            <div className="config-item">
              <div className="config-label">ROB Size</div>
              <div className="config-value">{sim.rob.size} entries</div>
            </div>
            <div className="config-item">
              <div className="config-label">IQ Size</div>
              <div className="config-value">{sim.iq.size} entries</div>
            </div>
            <div className="config-item">
              <div className="config-label">Issue Width</div>
              <div className="config-value">{sim.width} instructions/cycle</div>
            </div>
            <div className="config-item">
              <div className="config-label">Architectural Registers</div>
              <div className="config-value">{sim.rmt.size} registers</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
