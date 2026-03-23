import { MitigationDebugClient } from "./MitigationDebugClient";

export default function Page() {
  return (
    <div style={{ padding: 16, fontFamily: "system-ui" }}>
      <h1>Mitigation Debug</h1>
      <p>Shows server cache + mitigation optimisation API health.</p>
      <MitigationDebugClient />
    </div>
  );
}
