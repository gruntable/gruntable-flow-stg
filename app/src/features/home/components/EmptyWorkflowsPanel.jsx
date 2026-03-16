import { C, S } from '../../../platform/styles.jsx';

export default function EmptyWorkflowsPanel({ onNewWorkflow }) {
  return (
    <div style={{
      border: `1px solid ${C.border}`, borderRadius: 8,
      padding: '32px 40px', background: C.bg,
      ...S.col(16),
    }}>
      <div style={{ fontSize: 16, fontWeight: 700, color: C.black }}>
        Welcome to Gruntable!
      </div>
      <div style={{ fontSize: 13, color: C.mid, maxWidth: 560, lineHeight: 1.6 }}>
        Gruntable helps you turn messy files into clean, structured data — no coding required.
        Upload a file, let AI extract and transform your data, and export the result to Excel.
      </div>
      <div style={{ fontSize: 13, fontWeight: 600, color: C.black, marginTop: 4 }}>
        Get started in 3 easy steps:
      </div>
      <div style={{ ...S.col(8) }}>
        {[
          'Browse the templates below and pick one that fits your use case.',
          'Customize the workflow in the editor — adjust prompts, add or remove steps.',
          'Run the workflow and download your output.',
        ].map((step, i) => (
          <div key={i} style={{ ...S.flex(10), fontSize: 13, color: C.mid }}>
            <span style={{ fontWeight: 700, color: C.black, minWidth: 18 }}>{i + 1}.</span>
            {step}
          </div>
        ))}
      </div>
      <div style={{ ...S.flex(8), alignItems: 'center', marginTop: 8 }}>
        <button style={S.btnP} onClick={onNewWorkflow}>
          + New Workflow
        </button>
        <span style={{ fontSize: 13, color: C.mid }}>or browse templates below</span>
      </div>
    </div>
  );
}
