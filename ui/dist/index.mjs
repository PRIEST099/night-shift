import { jsxs, jsx, Fragment } from "react/jsx-runtime";
import { defineApp } from "@kirocrew/app-sdk";
import { MinusCircle, CheckCircle2, XCircle } from "lucide-react";
const schemaVersion = 1;
const patrolId = "20261125T154231Z";
const generatedAt = "2026-11-25T15:48:35.382Z";
const sites = [
  {
    name: "cursed-shop",
    owner: "demo-team",
    scoreBefore: 84.3,
    scoreAfter: 84.3,
    scoreChange: 0,
    newCount: 91,
    worsenedCount: 0,
    resolvedCount: 0,
    fixes: [
      {
        hauntingId: "index-html-NamelessSpirit-d3eefb7e",
        type: "NamelessSpirit",
        severity: "Wraith",
        page: "/index.html",
        decision: "kept",
        reasons: [],
        attempts: 2,
        changedFiles: [
          "index.html"
        ],
        origin: "recorded-attempt",
        earlierAttempts: [
          {
            attempt: 1,
            decision: "rejected",
            reasons: [
              `new-haunting: TheVeiled on /index.html, 1 before and 2 after: <button type="button" class="sparkle-link subscribe-sparkle" aria-hidden="true" onclick="document.getElementById('products').scrollIntoView()"><img src="img/sparkle.svg" alt="" class="sparkle" width="24" height="24"></button>`
            ]
          }
        ]
      }
    ],
    notAttempted: [
      {
        hauntingId: "index-html-NamelessSpirit-dbf2d295",
        type: "NamelessSpirit",
        severity: "Restless",
        page: "/index.html",
        why: "beyond maxFixesPerSite (5)"
      },
      {
        hauntingId: "index-html-NamelessSpirit-09f1cb78",
        type: "NamelessSpirit",
        severity: "Restless",
        page: "/index.html",
        why: "beyond maxFixesPerSite (5)"
      },
      {
        hauntingId: "index-html-NamelessSpirit-478bb10d",
        type: "NamelessSpirit",
        severity: "Restless",
        page: "/index.html",
        why: "beyond maxFixesPerSite (5)"
      },
      {
        hauntingId: "index-html-NamelessSpirit-4e0a940f",
        type: "NamelessSpirit",
        severity: "Wraith",
        page: "/index.html",
        why: "in the work list, no fix record"
      },
      {
        hauntingId: "index-html-NamelessSpirit-46b7439f",
        type: "NamelessSpirit",
        severity: "Wraith",
        page: "/index.html",
        why: "in the work list, no fix record"
      },
      {
        hauntingId: "index-html-NamelessSpirit-3f8d23a7",
        type: "NamelessSpirit",
        severity: "Wraith",
        page: "/index.html",
        why: "in the work list, no fix record"
      },
      {
        hauntingId: "index-html-NamelessSpirit-dbba5d8a",
        type: "NamelessSpirit",
        severity: "Wraith",
        page: "/index.html",
        why: "in the work list, no fix record"
      },
      {
        hauntingId: "index-html-NamelessSpirit-ce7af3f9",
        type: "NamelessSpirit",
        severity: "Wraith",
        page: "/index.html",
        why: "beyond maxFixesPerSite (5)"
      },
      {
        hauntingId: "index-html-NamelessSpirit-f437cf3b",
        type: "NamelessSpirit",
        severity: "Wraith",
        page: "/index.html",
        why: "beyond maxFixesPerSite (5)"
      },
      {
        hauntingId: "index-html-LostSoul-6f195bbc",
        type: "LostSoul",
        severity: "Restless",
        page: "/index.html",
        why: "beyond maxFixesPerSite (5)"
      },
      {
        hauntingId: "index-html-LostSoul-facbb9c8",
        type: "LostSoul",
        severity: "Restless",
        page: "/index.html",
        why: "beyond maxFixesPerSite (5)"
      },
      {
        hauntingId: "index-html-LostSoul-df82e1dc",
        type: "LostSoul",
        severity: "Restless",
        page: "/index.html",
        why: "beyond maxFixesPerSite (5)"
      },
      {
        hauntingId: "index-html-LostSoul-d09f6648",
        type: "LostSoul",
        severity: "Restless",
        page: "/index.html",
        why: "beyond maxFixesPerSite (5)"
      },
      {
        hauntingId: "index-html-LostSoul-71f354ef",
        type: "LostSoul",
        severity: "Restless",
        page: "/index.html",
        why: "beyond maxFixesPerSite (5)"
      },
      {
        hauntingId: "index-html-LostSoul-2a097e1b",
        type: "LostSoul",
        severity: "Restless",
        page: "/index.html",
        why: "beyond maxFixesPerSite (5)"
      },
      {
        hauntingId: "index-html-LostSoul-071d6844",
        type: "LostSoul",
        severity: "Restless",
        page: "/index.html",
        why: "beyond maxFixesPerSite (5)"
      },
      {
        hauntingId: "index-html-LostSoul-91d44fe7",
        type: "LostSoul",
        severity: "Restless",
        page: "/index.html",
        why: "beyond maxFixesPerSite (5)"
      },
      {
        hauntingId: "index-html-HollowPortrait-305934d6",
        type: "HollowPortrait",
        severity: "Restless",
        page: "/index.html",
        why: "beyond maxFixesPerSite (5)"
      },
      {
        hauntingId: "index-html-HollowPortrait-31c074fb",
        type: "HollowPortrait",
        severity: "Restless",
        page: "/index.html",
        why: "beyond maxFixesPerSite (5)"
      },
      {
        hauntingId: "index-html-HollowPortrait-223cfe0d",
        type: "HollowPortrait",
        severity: "Restless",
        page: "/index.html",
        why: "beyond maxFixesPerSite (5)"
      },
      {
        hauntingId: "index-html-HollowPortrait-725dec6d",
        type: "HollowPortrait",
        severity: "Restless",
        page: "/index.html",
        why: "beyond maxFixesPerSite (5)"
      },
      {
        hauntingId: "index-html-TheVeiled-042c20eb",
        type: "TheVeiled",
        severity: "Restless",
        page: "/index.html",
        why: "beyond maxFixesPerSite (5)"
      },
      {
        hauntingId: "index-html-InvisibleWanderer-400e34cb",
        type: "InvisibleWanderer",
        severity: "Restless",
        page: "/index.html",
        why: "beyond maxFixesPerSite (5)"
      },
      {
        hauntingId: "index-html-InvisibleWanderer-e101498c",
        type: "InvisibleWanderer",
        severity: "Restless",
        page: "/index.html",
        why: "beyond maxFixesPerSite (5)"
      },
      {
        hauntingId: "index-html-InvisibleWanderer-41d34657",
        type: "InvisibleWanderer",
        severity: "Restless",
        page: "/index.html",
        why: "beyond maxFixesPerSite (5)"
      },
      {
        hauntingId: "index-html-InvisibleWanderer-aff2aff1",
        type: "InvisibleWanderer",
        severity: "Restless",
        page: "/index.html",
        why: "beyond maxFixesPerSite (5)"
      },
      {
        hauntingId: "index-html-InvisibleWanderer-3edb30d2",
        type: "InvisibleWanderer",
        severity: "Restless",
        page: "/index.html",
        why: "beyond maxFixesPerSite (5)"
      },
      {
        hauntingId: "index-html-InvisibleWanderer-55a32591",
        type: "InvisibleWanderer",
        severity: "Restless",
        page: "/index.html",
        why: "beyond maxFixesPerSite (5)"
      },
      {
        hauntingId: "index-html-InvisibleWanderer-6c6bb2b6",
        type: "InvisibleWanderer",
        severity: "Restless",
        page: "/index.html",
        why: "beyond maxFixesPerSite (5)"
      },
      {
        hauntingId: "index-html-InvisibleWanderer-cfccfbc3",
        type: "InvisibleWanderer",
        severity: "Restless",
        page: "/index.html",
        why: "beyond maxFixesPerSite (5)"
      },
      {
        hauntingId: "index-html-InvisibleWanderer-71736992",
        type: "InvisibleWanderer",
        severity: "Restless",
        page: "/index.html",
        why: "beyond maxFixesPerSite (5)"
      },
      {
        hauntingId: "index-html-InvisibleWanderer-795c85d8",
        type: "InvisibleWanderer",
        severity: "Restless",
        page: "/index.html",
        why: "beyond maxFixesPerSite (5)"
      },
      {
        hauntingId: "index-html-InvisibleWanderer-f22abfd8",
        type: "InvisibleWanderer",
        severity: "Restless",
        page: "/index.html",
        why: "beyond maxFixesPerSite (5)"
      },
      {
        hauntingId: "index-html-InvisibleWanderer-0636fe61",
        type: "InvisibleWanderer",
        severity: "Restless",
        page: "/index.html",
        why: "beyond maxFixesPerSite (5)"
      },
      {
        hauntingId: "index-html-InvisibleWanderer-ede81f70",
        type: "InvisibleWanderer",
        severity: "Restless",
        page: "/index.html",
        why: "beyond maxFixesPerSite (5)"
      },
      {
        hauntingId: "index-html-InvisibleWanderer-849ad3d1",
        type: "InvisibleWanderer",
        severity: "Restless",
        page: "/index.html",
        why: "beyond maxFixesPerSite (5)"
      },
      {
        hauntingId: "index-html-InvisibleWanderer-a3c71155",
        type: "InvisibleWanderer",
        severity: "Restless",
        page: "/index.html",
        why: "beyond maxFixesPerSite (5)"
      },
      {
        hauntingId: "index-html-InvisibleWanderer-504862b1",
        type: "InvisibleWanderer",
        severity: "Restless",
        page: "/index.html",
        why: "beyond maxFixesPerSite (5)"
      },
      {
        hauntingId: "index-html-InvisibleWanderer-26c4c687",
        type: "InvisibleWanderer",
        severity: "Restless",
        page: "/index.html",
        why: "beyond maxFixesPerSite (5)"
      },
      {
        hauntingId: "index-html-InvisibleWanderer-ba76a501",
        type: "InvisibleWanderer",
        severity: "Restless",
        page: "/index.html",
        why: "beyond maxFixesPerSite (5)"
      },
      {
        hauntingId: "index-html-TheFog-05bb8874",
        type: "TheFog",
        severity: "Restless",
        page: "/index.html",
        why: "beyond maxFixesPerSite (5)"
      },
      {
        hauntingId: "index-html-TheFog-fe1735d2",
        type: "TheFog",
        severity: "Restless",
        page: "/index.html",
        why: "beyond maxFixesPerSite (5)"
      },
      {
        hauntingId: "index-html-TheFog-76ef46ef",
        type: "TheFog",
        severity: "Restless",
        page: "/index.html",
        why: "beyond maxFixesPerSite (5)"
      },
      {
        hauntingId: "index-html-TheFog-e43d00a8",
        type: "TheFog",
        severity: "Restless",
        page: "/index.html",
        why: "beyond maxFixesPerSite (5)"
      },
      {
        hauntingId: "index-html-TheFog-9544b51b",
        type: "TheFog",
        severity: "Restless",
        page: "/index.html",
        why: "beyond maxFixesPerSite (5)"
      },
      {
        hauntingId: "index-html-TheFog-49f5c754",
        type: "TheFog",
        severity: "Restless",
        page: "/index.html",
        why: "beyond maxFixesPerSite (5)"
      },
      {
        hauntingId: "index-html-TheFog-b5798c8f",
        type: "TheFog",
        severity: "Restless",
        page: "/index.html",
        why: "beyond maxFixesPerSite (5)"
      },
      {
        hauntingId: "product-html-NamelessSpirit-dbf2d295",
        type: "NamelessSpirit",
        severity: "Restless",
        page: "/product.html",
        why: "beyond maxFixesPerSite (5)"
      },
      {
        hauntingId: "product-html-NamelessSpirit-09f1cb78",
        type: "NamelessSpirit",
        severity: "Restless",
        page: "/product.html",
        why: "beyond maxFixesPerSite (5)"
      },
      {
        hauntingId: "product-html-NamelessSpirit-478bb10d",
        type: "NamelessSpirit",
        severity: "Restless",
        page: "/product.html",
        why: "beyond maxFixesPerSite (5)"
      },
      {
        hauntingId: "product-html-LostSoul-7e5cbad2",
        type: "LostSoul",
        severity: "Restless",
        page: "/product.html",
        why: "beyond maxFixesPerSite (5)"
      },
      {
        hauntingId: "product-html-LostSoul-20694952",
        type: "LostSoul",
        severity: "Restless",
        page: "/product.html",
        why: "beyond maxFixesPerSite (5)"
      },
      {
        hauntingId: "product-html-LostSoul-4827f417",
        type: "LostSoul",
        severity: "Restless",
        page: "/product.html",
        why: "beyond maxFixesPerSite (5)"
      },
      {
        hauntingId: "product-html-LostSoul-1de8f791",
        type: "LostSoul",
        severity: "Restless",
        page: "/product.html",
        why: "beyond maxFixesPerSite (5)"
      },
      {
        hauntingId: "product-html-LostSoul-8d0d7236",
        type: "LostSoul",
        severity: "Restless",
        page: "/product.html",
        why: "beyond maxFixesPerSite (5)"
      },
      {
        hauntingId: "product-html-LostSoul-cec17add",
        type: "LostSoul",
        severity: "Restless",
        page: "/product.html",
        why: "beyond maxFixesPerSite (5)"
      },
      {
        hauntingId: "product-html-LostSoul-a2516120",
        type: "LostSoul",
        severity: "Restless",
        page: "/product.html",
        why: "beyond maxFixesPerSite (5)"
      },
      {
        hauntingId: "product-html-LostSoul-c0a1c12a",
        type: "LostSoul",
        severity: "Restless",
        page: "/product.html",
        why: "beyond maxFixesPerSite (5)"
      },
      {
        hauntingId: "product-html-LostSoul-8a0c008c",
        type: "LostSoul",
        severity: "Restless",
        page: "/product.html",
        why: "beyond maxFixesPerSite (5)"
      },
      {
        hauntingId: "product-html-LostSoul-24ffcb7e",
        type: "LostSoul",
        severity: "Restless",
        page: "/product.html",
        why: "beyond maxFixesPerSite (5)"
      },
      {
        hauntingId: "product-html-HollowPortrait-d40521af",
        type: "HollowPortrait",
        severity: "Restless",
        page: "/product.html",
        why: "beyond maxFixesPerSite (5)"
      },
      {
        hauntingId: "product-html-HollowPortrait-ac151cbc",
        type: "HollowPortrait",
        severity: "Restless",
        page: "/product.html",
        why: "beyond maxFixesPerSite (5)"
      },
      {
        hauntingId: "product-html-HollowPortrait-66a12a64",
        type: "HollowPortrait",
        severity: "Restless",
        page: "/product.html",
        why: "beyond maxFixesPerSite (5)"
      },
      {
        hauntingId: "product-html-HollowPortrait-d6717f5b",
        type: "HollowPortrait",
        severity: "Restless",
        page: "/product.html",
        why: "beyond maxFixesPerSite (5)"
      },
      {
        hauntingId: "product-html-InvisibleWanderer-400e34cb",
        type: "InvisibleWanderer",
        severity: "Restless",
        page: "/product.html",
        why: "beyond maxFixesPerSite (5)"
      },
      {
        hauntingId: "product-html-InvisibleWanderer-e101498c",
        type: "InvisibleWanderer",
        severity: "Restless",
        page: "/product.html",
        why: "beyond maxFixesPerSite (5)"
      },
      {
        hauntingId: "product-html-InvisibleWanderer-41d34657",
        type: "InvisibleWanderer",
        severity: "Restless",
        page: "/product.html",
        why: "beyond maxFixesPerSite (5)"
      },
      {
        hauntingId: "product-html-InvisibleWanderer-aff2aff1",
        type: "InvisibleWanderer",
        severity: "Restless",
        page: "/product.html",
        why: "beyond maxFixesPerSite (5)"
      },
      {
        hauntingId: "product-html-InvisibleWanderer-3edb30d2",
        type: "InvisibleWanderer",
        severity: "Restless",
        page: "/product.html",
        why: "beyond maxFixesPerSite (5)"
      },
      {
        hauntingId: "product-html-InvisibleWanderer-55a32591",
        type: "InvisibleWanderer",
        severity: "Restless",
        page: "/product.html",
        why: "beyond maxFixesPerSite (5)"
      },
      {
        hauntingId: "product-html-TheFog-73c0867f",
        type: "TheFog",
        severity: "Restless",
        page: "/product.html",
        why: "beyond maxFixesPerSite (5)"
      },
      {
        hauntingId: "product-html-TheFog-847aaaaf",
        type: "TheFog",
        severity: "Restless",
        page: "/product.html",
        why: "beyond maxFixesPerSite (5)"
      },
      {
        hauntingId: "product-html-TheFog-5101e1f2",
        type: "TheFog",
        severity: "Restless",
        page: "/product.html",
        why: "beyond maxFixesPerSite (5)"
      },
      {
        hauntingId: "product-html-TheFog-b5798c8f",
        type: "TheFog",
        severity: "Restless",
        page: "/product.html",
        why: "beyond maxFixesPerSite (5)"
      },
      {
        hauntingId: "product-html-ShatteredOrder-7bdd8d2d",
        type: "ShatteredOrder",
        severity: "Restless",
        page: "/product.html",
        why: "beyond maxFixesPerSite (5)"
      },
      {
        hauntingId: "checkout-html-CursedLoop-3d43c1e9",
        type: "CursedLoop",
        severity: "Wraith",
        page: "/checkout.html",
        why: "beyond maxFixesPerSite (5)"
      },
      {
        hauntingId: "checkout-html-NamelessSpirit-dbf2d295",
        type: "NamelessSpirit",
        severity: "Restless",
        page: "/checkout.html",
        why: "beyond maxFixesPerSite (5)"
      },
      {
        hauntingId: "checkout-html-NamelessSpirit-09f1cb78",
        type: "NamelessSpirit",
        severity: "Restless",
        page: "/checkout.html",
        why: "beyond maxFixesPerSite (5)"
      },
      {
        hauntingId: "checkout-html-NamelessSpirit-478bb10d",
        type: "NamelessSpirit",
        severity: "Restless",
        page: "/checkout.html",
        why: "beyond maxFixesPerSite (5)"
      },
      {
        hauntingId: "checkout-html-WhisperingField-3973ebee",
        type: "WhisperingField",
        severity: "Wraith",
        page: "/checkout.html",
        why: "beyond maxFixesPerSite (5)"
      },
      {
        hauntingId: "checkout-html-WhisperingField-884b3a1a",
        type: "WhisperingField",
        severity: "Wraith",
        page: "/checkout.html",
        why: "beyond maxFixesPerSite (5)"
      },
      {
        hauntingId: "checkout-html-HollowPortrait-9fcfac80",
        type: "HollowPortrait",
        severity: "Restless",
        page: "/checkout.html",
        why: "beyond maxFixesPerSite (5)"
      },
      {
        hauntingId: "checkout-html-HollowPortrait-33ccbf91",
        type: "HollowPortrait",
        severity: "Restless",
        page: "/checkout.html",
        why: "beyond maxFixesPerSite (5)"
      },
      {
        hauntingId: "checkout-html-TheVeiled-ccd05688",
        type: "TheVeiled",
        severity: "Restless",
        page: "/checkout.html",
        why: "beyond maxFixesPerSite (5)"
      },
      {
        hauntingId: "checkout-html-TheVeiled-82a7909c",
        type: "TheVeiled",
        severity: "Restless",
        page: "/checkout.html",
        why: "beyond maxFixesPerSite (5)"
      },
      {
        hauntingId: "checkout-html-TheFog-01849678",
        type: "TheFog",
        severity: "Banished",
        page: "/checkout.html",
        why: "Banished severity"
      },
      {
        hauntingId: "checkout-html-TheFog-c653665c",
        type: "TheFog",
        severity: "Banished",
        page: "/checkout.html",
        why: "Banished severity"
      },
      {
        hauntingId: "checkout-html-SilentTongue-c20529d3",
        type: "SilentTongue",
        severity: "Restless",
        page: "/checkout.html",
        why: "beyond maxFixesPerSite (5)"
      },
      {
        hauntingId: "checkout-html-ShatteredOrder-f573bf0a",
        type: "ShatteredOrder",
        severity: "Restless",
        page: "/checkout.html",
        why: "beyond maxFixesPerSite (5)"
      },
      {
        hauntingId: "checkout-html-ShatteredOrder-c80871b8",
        type: "ShatteredOrder",
        severity: "Restless",
        page: "/checkout.html",
        why: "beyond maxFixesPerSite (5)"
      }
    ],
    errors: []
  }
];
const lastReport = {
  schemaVersion,
  patrolId,
  generatedAt,
  sites
};
function looksLikeReport(value) {
  if (typeof value !== "object" || value === null) return false;
  const v = value;
  return v["schemaVersion"] === 1 && typeof v["patrolId"] === "string" && Array.isArray(v["sites"]);
}
function loadReport() {
  return looksLikeReport(lastReport) ? lastReport : void 0;
}
const STYLE = `
.ns-report { font-family: system-ui, sans-serif; color: #1a1a1a; background: #ffffff; max-width: 60rem; margin: 0 auto; padding: 1.5rem; line-height: 1.5; }
.ns-report h1 { font-size: 1.75rem; margin: 0 0 0.25rem; }
.ns-report h2 { font-size: 1.35rem; margin: 2rem 0 0.5rem; }
.ns-report h3 { font-size: 1.1rem; margin: 1.25rem 0 0.5rem; }
.ns-report table { border-collapse: collapse; margin: 0.5rem 0 1rem; }
.ns-report caption { text-align: left; font-weight: 600; padding-bottom: 0.25rem; }
.ns-report th, .ns-report td { border: 1px solid #595959; padding: 0.35rem 0.75rem; text-align: left; }
.ns-report th { background: #ececec; }
.ns-report li { margin: 0.35rem 0; }
.ns-report .ns-outcome { display: inline-flex; align-items: center; gap: 0.35rem; font-weight: 600; }
.ns-report .ns-note { color: #404040; }
.ns-report code { background: #f0f0f0; padding: 0 0.25rem; border-radius: 3px; }
.ns-report a:focus-visible, .ns-report summary:focus-visible { outline: 3px solid #0b3d91; outline-offset: 2px; }
`;
function changeText(change) {
  if (change < 0) return `${change.toFixed(1)} (better)`;
  if (change > 0) return `+${change.toFixed(1)} (worse)`;
  return "0.0 (no change)";
}
function Outcome({ kept }) {
  return /* @__PURE__ */ jsxs("span", { className: "ns-outcome", children: [
    kept ? /* @__PURE__ */ jsx(CheckCircle2, { "aria-hidden": "true", size: 18 }) : /* @__PURE__ */ jsx(XCircle, { "aria-hidden": "true", size: 18 }),
    kept ? "Kept" : "Rejected"
  ] });
}
function FixItem({ fix }) {
  return /* @__PURE__ */ jsxs("li", { children: [
    /* @__PURE__ */ jsx(Outcome, { kept: fix.decision === "kept" }),
    " ",
    /* @__PURE__ */ jsx("code", { children: fix.hauntingId }),
    ` ${fix.type} (${fix.severity}) on ${fix.page}, ${fix.attempts} attempt${fix.attempts === 1 ? "" : "s"}.`,
    fix.origin === "recorded-attempt" ? " Recorded attempt, not an agent run." : "",
    fix.changedFiles.length > 0 ? ` Changed: ${fix.changedFiles.join(", ")}.` : "",
    (fix.reasons.length > 0 || fix.decision === "rejected" && fix.earlierAttempts.length > 0) && /* @__PURE__ */ jsxs("ul", { children: [
      fix.decision === "rejected" && fix.earlierAttempts.flatMap(
        (a) => a.reasons.map((r, i) => /* @__PURE__ */ jsx("li", { children: `Attempt ${a.attempt} ${a.decision}: ${r}` }, `${a.attempt}-${i}`))
      ),
      fix.reasons.map((r, i) => /* @__PURE__ */ jsx("li", { children: r }, i))
    ] })
  ] });
}
function ReplacedRejections({ fix }) {
  const earlier = fix.earlierAttempts.filter((a) => a.decision === "rejected");
  return /* @__PURE__ */ jsx(Fragment, { children: earlier.map((a) => /* @__PURE__ */ jsxs("li", { children: [
    /* @__PURE__ */ jsx(Outcome, { kept: false }),
    " ",
    /* @__PURE__ */ jsx("code", { children: fix.hauntingId }),
    ` attempt ${a.attempt} was rejected, then a later attempt was kept.`,
    fix.origin === "recorded-attempt" ? " Recorded attempt, not an agent run." : "",
    /* @__PURE__ */ jsx("ul", { children: a.reasons.map((r, i) => /* @__PURE__ */ jsx("li", { children: r }, i)) })
  ] }, `${fix.hauntingId}-${a.attempt}`)) });
}
function SiteSection({ site, index: index2 }) {
  const headingId = `ns-site-${index2}`;
  const kept = site.fixes.filter((f) => f.decision === "kept");
  const rejected = site.fixes.filter((f) => f.decision === "rejected");
  const replaced = kept.flatMap((f) => f.earlierAttempts.filter((a) => a.decision === "rejected"));
  return /* @__PURE__ */ jsxs("section", { "aria-labelledby": headingId, children: [
    /* @__PURE__ */ jsx("h2", { id: headingId, children: site.name }),
    /* @__PURE__ */ jsxs("p", { children: [
      "Owner: ",
      site.owner || "unassigned"
    ] }),
    /* @__PURE__ */ jsxs("table", { children: [
      /* @__PURE__ */ jsx("caption", { children: `Haunting Score for ${site.name} (lower is better)` }),
      /* @__PURE__ */ jsx("thead", { children: /* @__PURE__ */ jsxs("tr", { children: [
        /* @__PURE__ */ jsx("th", { scope: "col", children: "Score before" }),
        /* @__PURE__ */ jsx("th", { scope: "col", children: "Score after" }),
        /* @__PURE__ */ jsx("th", { scope: "col", children: "Change" })
      ] }) }),
      /* @__PURE__ */ jsx("tbody", { children: /* @__PURE__ */ jsxs("tr", { children: [
        /* @__PURE__ */ jsx("td", { children: site.scoreBefore.toFixed(1) }),
        /* @__PURE__ */ jsx("td", { children: site.scoreAfter.toFixed(1) }),
        /* @__PURE__ */ jsx("td", { children: changeText(site.scoreChange) })
      ] }) })
    ] }),
    /* @__PURE__ */ jsx("p", { children: `New hauntings: ${site.newCount}. Worsened: ${site.worsenedCount}. Resolved: ${site.resolvedCount}.` }),
    /* @__PURE__ */ jsx("h3", { children: "Kept fixes" }),
    kept.length > 0 ? /* @__PURE__ */ jsx("ul", { children: kept.map((f) => /* @__PURE__ */ jsx(FixItem, { fix: f }, f.hauntingId)) }) : /* @__PURE__ */ jsx("p", { children: "None." }),
    /* @__PURE__ */ jsx("h3", { children: "Rejected fixes" }),
    rejected.length > 0 || replaced.length > 0 ? /* @__PURE__ */ jsxs("ul", { children: [
      rejected.map((f) => /* @__PURE__ */ jsx(FixItem, { fix: f }, f.hauntingId)),
      kept.map((f) => /* @__PURE__ */ jsx(ReplacedRejections, { fix: f }, f.hauntingId))
    ] }) : /* @__PURE__ */ jsx("p", { children: "None." }),
    /* @__PURE__ */ jsx("h3", { children: "Not attempted" }),
    site.notAttempted.length > 0 ? /* @__PURE__ */ jsxs("ul", { children: [
      site.notAttempted.slice(0, 10).map((n) => /* @__PURE__ */ jsxs("li", { children: [
        /* @__PURE__ */ jsx(MinusCircle, { "aria-hidden": "true", size: 16 }),
        " ",
        /* @__PURE__ */ jsx("code", { children: n.hauntingId }),
        ` ${n.type} (${n.severity}) on ${n.page}. ${n.why}.`
      ] }, n.hauntingId)),
      site.notAttempted.length > 10 && /* @__PURE__ */ jsx("li", { children: `...and ${site.notAttempted.length - 10} more, listed in report.json.` })
    ] }) : /* @__PURE__ */ jsx("p", { children: "None." }),
    site.errors.length > 0 && /* @__PURE__ */ jsxs(Fragment, { children: [
      /* @__PURE__ */ jsx("h3", { children: "Errors" }),
      /* @__PURE__ */ jsx("ul", { children: site.errors.map((e, i) => /* @__PURE__ */ jsx("li", { children: e }, i)) })
    ] })
  ] });
}
function ReportView({ report }) {
  return /* @__PURE__ */ jsxs("main", { className: "ns-report", lang: "en", children: [
    /* @__PURE__ */ jsx("style", { children: STYLE }),
    /* @__PURE__ */ jsx("h1", { children: "Morning report" }),
    report === void 0 ? /* @__PURE__ */ jsxs("p", { children: [
      "No report yet. Run ",
      /* @__PURE__ */ jsx("code", { children: "night-shift patrol --no-agents" }),
      " or ask the warden to run a patrol, then run",
      " ",
      /* @__PURE__ */ jsx("code", { children: "night-shift report --publish-ui" }),
      " and ",
      /* @__PURE__ */ jsx("code", { children: "npm run build:ui" }),
      "."
    ] }) : /* @__PURE__ */ jsxs(Fragment, { children: [
      /* @__PURE__ */ jsx("p", { className: "ns-note", children: `Patrol ${report.patrolId}, generated ${report.generatedAt}. Lower scores are better.` }),
      report.sites.length === 0 ? /* @__PURE__ */ jsx("p", { children: "No sites were patrolled." }) : report.sites.map((s, i) => /* @__PURE__ */ jsx(SiteSection, { site: s, index: i }, s.name))
    ] })
  ] });
}
function MorningReport() {
  return /* @__PURE__ */ jsx(ReportView, { report: loadReport() });
}
const index = defineApp({
  pages: [{ route: "/apps/night-shift", component: MorningReport }]
});
export {
  index as default
};
