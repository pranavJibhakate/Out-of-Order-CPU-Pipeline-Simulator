import fs from "fs";

class ProcParams {
  constructor(robSize, iqSize, width) {
    this.rob_size = robSize;
    this.iq_size = iqSize;
    this.width = width;
  }
}

import { Simulator } from "../src/Simulator.js";

function main() {
  const argv = process.argv;

  if (argv.length !== 6) {
    console.error(`Error: Wrong number of inputs:${argv.length - 2}`);
    process.exit(1);
  }

  const robSize = parseInt(argv[2], 10);
  const iqSize = parseInt(argv[3], 10);
  const width = parseInt(argv[4], 10);
  const traceFile = argv[5];

  const params = new ProcParams(robSize, iqSize, width);

  const sim = new Simulator(params.rob_size, params.iq_size, params.width);

  let traceData;
  try {
    traceData = fs.readFileSync(traceFile, "utf-8");
  } catch (err) {
    console.error(`Error: Unable to open file ${traceFile}`);
    process.exit(1);
  }

  const traceLines = traceData
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  try {
    sim.sim(traceLines);
  } catch (err) {
    console.error(`Error: in sim`);
    process.exit(1);
  }

  console.log("# === Simulator Command =========");
  console.log(
    `# ./sim ${params.rob_size} ${params.iq_size} ${params.width} ${traceFile}`
  );
  console.log("# === Processor Configuration ===");
  console.log(`# ROB_SIZE = ${params.rob_size}`);
  console.log(`# IQ_SIZE  = ${params.iq_size}`);
  console.log(`# WIDTH    = ${params.width}`);
  console.log("# === Simulation Results ========");
  console.log(`# Dynamic Instruction Count    = ${sim.instNo}`);
  console.log(`# Cycles                       = ${sim.cycleNo - 1}`);

  const ipc = sim.instNo / (sim.cycleNo - 1);
  console.log(`# Instructions Per Cycle (IPC) = ${ipc.toFixed(2)}`);
}

main();
