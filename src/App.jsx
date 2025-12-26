import React from "react";

import { useState, useEffect } from "react";
import "./App.css";
import { Simulator, Instruction } from "../project/Simulator.js";

function ROBTable({ rob }) {
  const getROBEntries = () => {
    const entries = [];
    if (!rob.empty()) {
      let i = rob.s;
      let count = 0;
      for (; i < rob.e; ) {
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
              {/* <th className="table-header-cell">Inst Index</th> */}
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
                {/* <td className="table-cell bold">
                  {entry.inst ? `I${entry.inst.indx}` : "—"}
                </td> */}
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
                  {index === rob.s && index === rob.e - 1
                    ? "Head & Tail"
                    : index === rob.s
                    ? "← Head"
                    : index === rob.e - 1
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
      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr className="table-header">
              <th className="table-header-cell">Reg</th>
              <th className="table-header-cell"># ROB</th>
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
                    {/* <td className="table-cell">
                      <span
                        className={`badge ${
                          robEntry.rdy ? "badge-ready" : "badge-not-ready"
                        }`}>
                        {robEntry.rdy ? "Ready" : "Not Ready"}
                      </span>
                    </td>
                    <td className="table-cell">
                      {robEntry.inst ? `I${robEntry.inst.indx}` : "—"}
                    </td> */}
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
      {/* <div className="component-status">
        <div className="status-item">
          <span className="status-label">Total Registers:</span>
          <span className="status-value">{rmt.size}</span>
        </div>
      </div> */}
    </div>
  );
}

function ActiveStages({ sim }) {
  const stageData = [
    { name: "Fetch", bundle: sim.FEb, count: sim.FEb.length, dispName: "FE" },
    { name: "Decode", bundle: sim.DEb, count: sim.DEb.length, dispName: "DE" },
    { name: "Rename", bundle: sim.RNb, count: sim.RNb.length, dispName: "RE" },
    {
      name: "Register Read",
      bundle: sim.RRb,
      count: sim.RRb.length,
      dispName: "RR",
    },
    {
      name: "Dispatch",
      bundle: sim.DIb,
      count: sim.DIb.length,
      dispName: "Di",
    },
    {
      name: "Issue Queue",
      bundle: sim.iq.entries.map((e) => e.inst),
      count: sim.iq.entries.length,
      dispName: "IS",
    },
    {
      name: "Execute",
      bundle: sim.execList,
      count: sim.execList.length,
      dispName: "EX",
    },
    {
      name: "Write Back",
      bundle: sim.WB,
      count: sim.WB.length,
      dispName: "WB",
    },
  ];

  return (
    <div className="component-card stages-card">
      <h2 className="component-title">Active Pipeline Stages</h2>
      <div className="stages-grid">
        {stageData.map((stage, idx) => (
          <div key={idx} className="stage-card">
            <div className="stage-name">{stage.dispName}</div>
            {/* <div className="stage-count">{stage.count}</div> */}
            <div className="stage-instructions">
              {stage.bundle.map((inst) => `I${inst.indx}`).join(", ") || "None"}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ARFTable({ sim }) {
  return (
    // <div className="component-card arf-card">
    //   <h2 className="component-title">Architectural Register File (ARF)</h2>
    //   <div className="table-container">
    //     <table className="data-table">
    //       <thead>
    //         <tr className="table-header">
    //           <th className="table-header-cell">Reg</th>
    //           <th className="table-header-cell">Value</th>
    //         </tr>
    //       </thead>
    //       <tbody className="table-body">
    //         {Array.from({ length: sim.rmt.size }, (_, i) => (
    //           <tr key={i} className="table-row">
    //             <td className="table-cell bold">R{i}</td>
    //             <td className="table-cell monospace">
    //               {sim.rmt.table[i]?.inst
    //                 ? `I${sim.rmt.table[i].inst.indx}`
    //                 : "—"}
    //             </td>
    //           </tr>
    //         ))}
    //       </tbody>
    //     </table>
    //   </div>
    // </div>
    <div className="component-card arf-card">
      {/* <h2 className="component-title">Architectural Register File (ARF)</h2> */}
      <div className="arf-grid">
        {sim.rmt.size &&
          Array.from({ length: sim.rmt.size }).map((_, idx) => (
            <div key={idx} className="arf-cell">
              R{idx}: {sim.arf[idx] || 0}
            </div>
          ))}
      </div>
    </div>
  );
}

function TraceInput({ sim, onLoad }) {
  const [text, setText] = useState("");
  const [error, setError] = useState("");

  const parseAndLoad = () => {
    try {
      const lines = text.split("\n").filter((l) => l.trim() !== "");
      const trace = lines.map((line, idx) => {
        const parts = line.trim().split(/\s+/).map(Number);
        if (parts.length !== 5 || parts.some(isNaN)) {
          throw new Error(`Invalid format on line ${idx + 1}`);
        }
        const [pc, opcode, dst, src1, src2] = parts;
        return new Instruction(pc, opcode, dst, src1, src2, idx);
      });

      sim.reset();
      sim.loadTrace(trace);
      onLoad();
      setError("");
    } catch (e) {
      setError(e.message);
    }
  };

  return (
    <div className="component-card trace-card">
      <h2 className="component-title">Trace Input</h2>

      <textarea
        className="trace-textarea"
        rows={8}
        placeholder="pc opcode dst src1 src2"
        value={text}
        onChange={(e) => setText(e.target.value)}
      />

      {error && <div className="error-text">{error}</div>}

      <button className="btn btn-primary" onClick={parseAndLoad}>
        Load Trace
      </button>
    </div>
  );
}

export default function App() {
  const [sim] = useState(() => new Simulator(8, 8, 1));
  const [activeTab, setActiveTab] = useState("sim");
  const [, forceUpdate] = useState(0);

  useEffect(() => {
    const trace = [
      new Instruction(0, 2, 2, 3, 4, 0),
      new Instruction(4, 1, 5, 2, 4, 1),
      new Instruction(8, 1, 1, 2, 3, 2),
    ];
    sim.loadTrace(trace);
    forceUpdate((x) => x + 1);
  }, [sim]);

  const handleCycle = () => {
    sim.cycle();
    forceUpdate((x) => x + 1);
  };

  const handleReset = () => sim.reset();
  const runCycles = (count) => {
    for (let i = 0; i < count; i++) sim.cycle();
    forceUpdate((x) => x + 1);
  };

  return (
    <div className="simulator-app">
      <div className="simulator-container">
        <div className="control-panel-parent">
          <div className="tab-bar">
            <button
              className={activeTab === "sim" ? "tab active" : "tab"}
              onClick={() => setActiveTab("sim")}>
              Simulator
            </button>
            <button
              className={activeTab === "trace" ? "tab active" : "tab"}
              onClick={() => setActiveTab("trace")}>
              Trace Input
            </button>
          </div>

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

        {activeTab === "trace" ? (
          <TraceInput sim={sim} onLoad={() => forceUpdate((x) => x + 1)} />
        ) : (
          <div className="cpu-pipeline-grid">
            <div className="area-pipeline">
              <ActiveStages sim={sim} />
            </div>

            <div className="area-rmt">
              <RMTTable rmt={sim.rmt} />
            </div>

            <div className="area-iq">
              <IssueQueueTable iq={sim.iq} />
            </div>

            <div className="area-arf">
              <ARFTable sim={sim} />
            </div>

            <div className="area-rob">
              <ROBTable rob={sim.rob} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
