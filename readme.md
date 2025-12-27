# Out-of-Order CPU Pipeline Simulator

A **cycle-accurate out-of-order CPU pipeline simulator** with a React-based UI.  
Models key microarchitectural components and visualizes instruction flow across pipeline stages.

## Features

- Cycle-by-cycle execution
- Out-of-order scheduling with in-order commit
- Live visualization of:
  - Pipeline stages
  - Reorder Buffer (ROB)
  - Issue Queue (IQ)
  - Register Map Table (RMT)
  - Architectural Register File (ARF)
- Custom instruction trace input

## Modeled Components

- Fetch, Decode, Rename, RegRead, Dispatch, Issue, Execute, Writeback, Retire
- ROB for precise state
- IQ for dynamic scheduling
- RMT for register renaming
- ARF for committed architectural state

## Instruction Trace Format

pc opcode dst src1 src2

Example:
```
0 2 2 3 4
3 1 5 2 4
```

- opcode 1 - ALU inst latency 1
- opcode 2 - ALU inst latency 3
- opcode 3 - ALU inst latency 5

## Tech Stack

- JavaScript (ES6+)
- React
- CSS Grid–based layout

## TODO

opcode 4 - load imm

example
0x01 4 1 1

pc opcode pc
opcode 5 - branch pc
