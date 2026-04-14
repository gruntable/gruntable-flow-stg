import { useState } from "react";
import { C, S } from "../../../../../styles.jsx";

export default function BetaBadge() {
  const [showDisclaimer, setShowDisclaimer] = useState(false);

  return (
    <>
      {/* Beta Badge - clickable to show disclaimer */}
      <div 
        onClick={() => setShowDisclaimer(true)}
        style={{
          ...S.flex(6),
          cursor: "pointer",
          padding: "4px 8px",
          borderRadius: 6,
          background: "#f0f0f0",
          border: `1px solid ${C.border}`,
          transition: "all 0.15s",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = "#e8e8e8";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = "#f0f0f0";
        }}
      >
        <span style={{ 
          fontSize: 13, 
          fontWeight: 700, 
          color: C.black,
        }}>
          Gruntable Flow
        </span>
        <span style={{
          fontSize: 10,
          fontWeight: 600,
          color: C.amber,
          background: "#fef3c7",
          padding: "2px 6px",
          borderRadius: 4,
          letterSpacing: 0.5,
        }}>
          BETA
        </span>
      </div>

      {/* Disclaimer Modal */}
      {showDisclaimer && (
        <div
          onClick={() => setShowDisclaimer(false)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.45)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: C.white,
              borderRadius: 10,
              width: 400,
              maxWidth: "90vw",
              boxShadow: "0 8px 32px rgba(0,0,0,0.18)",
              display: "flex",
              flexDirection: "column",
            }}
          >
            {/* Header */}
            <div style={{
              padding: "20px 24px",
              borderBottom: `1px solid ${C.border}`,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}>
              <div style={{ ...S.flex(8), alignItems: "center" }}>
                <span style={{ fontSize: 16, fontWeight: 700, color: C.black }}>
                  Gruntable Flow
                </span>
                <span style={{
                  fontSize: 10,
                  fontWeight: 600,
                  color: C.amber,
                  background: "#fef3c7",
                  padding: "2px 6px",
                  borderRadius: 4,
                  letterSpacing: 0.5,
                }}>
                  BETA
                </span>
              </div>
              <button
                onClick={() => setShowDisclaimer(false)}
                style={{
                  background: "none",
                  border: "none",
                  fontSize: 20,
                  color: C.muted,
                  cursor: "pointer",
                  padding: "0 4px",
                  lineHeight: 1,
                }}
              >
                ×
              </button>
            </div>

            {/* Content */}
            <div style={{ padding: "20px 24px" }}>
              <div style={{
                fontSize: 13,
                fontWeight: 500,
                color: C.mid,
                marginBottom: 16,
                lineHeight: 1.6,
              }}>
                Welcome to Gruntable Flow! We're excited to have you try our beta version.
              </div>

              <div style={{
                margin: 0,
                fontSize: 13,
                color: C.mid,
                lineHeight: 1.8,
              }}>
                <div style={{ marginBottom: 12 }}>
                  <strong style={{ color: C.black }}>What's this?</strong><br />
                  This is an early release we're building together with users like you. It's completely free while in beta.
                </div>

                <div style={{ marginBottom: 12 }}>
                  <strong style={{ color: C.black }}>A few things to know:</strong>
                  <ul style={{ margin: "8px 0", paddingLeft: 20 }}>
                    <li>You might encounter bugs or changes as we improve the product</li>
                    <li>We recommend testing with sample data before processing important files</li>
                    <li>We take your privacy seriously and never share your data</li>
                  </ul>
                </div>

                <div style={{
                  padding: "12px 16px",
                  background: "#fef3c7",
                  borderRadius: 6,
                  borderLeft: `3px solid ${C.amber}`,
                  fontSize: 12,
                  color: C.black,
                }}>
                  <strong>Tip:</strong> Export your work regularly as a backup while we work toward full stability.
                </div>
              </div>
            </div>

            {/* Footer */}
            <div style={{
              padding: "16px 24px",
              borderTop: `1px solid ${C.border}`,
              display: "flex",
              justifyContent: "flex-end",
            }}>
              <button
                onClick={() => setShowDisclaimer(false)}
                style={{
                  ...S.btnP,
                  padding: "8px 16px",
                }}
              >
                Got it
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
