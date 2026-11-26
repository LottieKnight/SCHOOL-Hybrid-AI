import { ensureCapsScaffold, getCapsScaffoldPath } from "../src/gen/caps-scaffold";

const scaffold = ensureCapsScaffold();

console.log(`CAPS scaffold saved to ${getCapsScaffoldPath()}`);
console.log(`Phases: ${Object.keys(scaffold.phases).length}`);
