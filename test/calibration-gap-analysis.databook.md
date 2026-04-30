---
id: urn:databook:prompt-response:c06892d9
title: "Prompt Response: Review the sensor records in the primary-graph block. Identify which…"
type: databook
version: 1.0.0
created: 2026-04-26

author:
  - name: Kurt Cagle
    iri: https://holongraph.com/people/kurt-cagle
    role: orchestrator
  - name: Chloe Shannon
    iri: https://holongraph.com/people/chloe-shannon
    role: transformer

process:
  transformer: "claude-sonnet-4-6"
  transformer_type: llm
  transformer_iri: https://api.anthropic.com/v1/models/claude-sonnet-4-6
  inputs:
    - iri: https://w3id.org/databook/test/observatory-v1
      role: primary
      description: "Full DataBook: GGSC Test: Geodetic Observatory Knowledge Graph v1"
    - iri: urn:prompt:inline
      role: context
      description: "Review the sensor records in the primary-graph block. Identify which sensors lack a lastCalibrated date or have a calibration date before 2026-01-01. For each gap, suggest a corrective SPARQL UPDATE s"
  timestamp: 2026-04-26T06:29:15Z
  agent:
    name: Chloe Shannon
    iri: https://holongraph.com/people/chloe-shannon
    role: transformer
---

## Prompt

```prompt
<!-- databook:id: source-prompt -->
Review the sensor records in the primary-graph block. Identify which sensors lack a lastCalibrated date or have a calibration date before 2026-01-01. For each gap, suggest a corrective SPARQL UPDATE statement.
```

## Response

```markdown
<!-- databook:id: prompt-response -->
## Sensor Calibration Audit

### Step 1 — Inventory of Sensor Calibration Dates

Reviewing the three sensor records in the `primary-graph` block:

| Sensor | IRI | `obs:lastCalibrated` | Status |
|---|---|---|---|
| Absolute Gravity Sensor FG5-X | `obs:GravitySensor` | `2026-01-15` | ✅ After threshold |
| Vaisala PTB330 Barometer | `obs:PressureSensor` | `2026-02-01` | ✅ After threshold |
| Lippmann Tiltmeter LT-3 | `obs:TiltSensor` | *(absent)* | ❌ Missing |

### Step 2 — Gap Analysis

**Finding 1 — Missing calibration date (`obs:TiltSensor`)**
The `obs:TiltSensor` triple block has no `obs:lastCalibrated` predicate at all. This violates any reasonable operational policy and would fail a SHACL shape if one were added for that property.

**Finding 2 — No sensors breach the `2026-01-01` threshold**
Both sensors that *do* carry a calibration date are dated in 2026, so no *stale* calibration correction is needed for existing dates.

---

### Step 3 — Corrective SPARQL UPDATE Statements

#### Fix 1 — Insert missing calibration date for `obs:TiltSensor`

Because the triple does not exist at all, a plain `INSERT DATA` is the safest
form — there is nothing to delete.

```sparql
PREFIX obs: <https://w3id.org/databook/test/observatory-v1#>
PREFIX xsd: <http://www.w3.org/2001/XMLSchema#>

INSERT DATA {
  GRAPH <https://w3id.org/databook/test/observatory-v1#primary-graph> {
    obs:TiltSensor obs:lastCalibrated "2026-04-22"^^xsd:date .
  }
}
```

> **Note:** Replace `"2026-04-22"^^xsd:date` with the verified physical
> calibration date once it is retrieved from the instrument log.
> Until the real date is confirmed, a sentinel value such as
> `"1970-01-01"^^xsd:date` may be preferable to flag the record
> as requiring manual review rather than silently supplying today's date.

---

#### Fix 2 — General-purpose UPDATE for any sensor whose calibration predates 2026-01-01 (defensive / future-proof)

This pattern handles the broader policy requirement stated in the audit task —
it will correct any sensor, present or future, that has a stale
`obs:lastCalibrated` value below the threshold. Replace the `INSERT` date with
the true recalibration date as appropriate.

```sparql
PREFIX obs: <https://w3id.org/databook/test/observatory-v1#>
PREFIX xsd: <http://www.w3.org/2001/XMLSchema#>

DELETE {
  GRAPH <https://w3id.org/databook/test/observatory-v1#primary-graph> {
    ?sensor obs:lastCalibrated ?oldDate .
  }
}
INSERT {
  GRAPH <https://w3id.org/databook/test/observatory-v1#primary-graph> {
    ?sensor obs:lastCalibrated "2026-04-22"^^xsd:date .
  }
}
WHERE {
  GRAPH <https://w3id.org/databook/test/observatory-v1#primary-graph> {
    ?sensor a <http://www.w3.org/ns/sosa/Sensor> ;
            obs:lastCalibrated ?oldDate .
    FILTER ( ?oldDate < "2026-01-01"^^xsd:date )
  }
}
```

---

#### Fix 3 — Flag sensors entirely missing `obs:lastCalibrated` (diagnostic INSERT)

This adds a placeholder `"unknown"` marker using a dedicated
`obs:calibrationStatus` predicate, making the gap machine-discoverable
while avoiding the introduction of a fictitious date.

```sparql
PREFIX obs:  <https://w3id.org/databook/test/observatory-v1#>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>

INSERT {
  GRAPH <https://w3id.org/databook/test/observatory-v1#primary-graph> {
    ?sensor obs:calibrationStatus "UNRECORDED" ;
            rdfs:comment "Calibration date not found in source data — requires physical verification."@en .
  }
}
WHERE {
  GRAPH <https://w3id.org/databook/test/observatory-v1#primary-graph> {
    ?sensor a <http://www.w3.org/ns/sosa/Sensor> .
    FILTER NOT EXISTS { ?sensor obs:lastCalibrated ?any . }
  }
}
```

---

### Step 4 — Recommended Action Plan

| Priority | Sensor | Action |
|---|---|---|
| **High** | `obs:TiltSensor` | Retrieve physical calibration record; apply **Fix 1** with verified date, or **Fix 3** as interim flag |
| **Preventive** | All sensors | Add `obs:lastCalibrated` as a required property in `obs:SensorShape` (SHACL `sh:minCount 1`) so missing dates are caught at ingestion |
| **Ongoing** | All sensors | Schedule periodic execution of **Fix 2** as a maintenance job, integrated with the existing `refresh-calibration` block pattern |

---

### Step 5 — Recommended SHACL Addition to `observatory-shapes`

To prevent this class of gap in future ingestion runs, extend `obs:SensorShape`
with a calibration-date constraint:

```turtle
obs:SensorShape
    sh:property [
        sh:path     obs:lastCalibrated ;
        sh:minCount 1 ;
        sh:datatype xsd:date ;
        sh:message  "Sensor must record a last-calibrated date (xsd:date)."@en ;
    ] ;
    sh:property [
        sh:path        obs:lastCalibrated ;
        sh:minInclusive "2026-01-01"^^xsd:date ;
        sh:message     "Sensor calibration date must not predate 2026-01-01."@en ;
    ] .
```

This closes the loop between the DataBook's SHACL block and the operational
maintenance UPDATE pattern, making calibration-currency a first-class
graph constraint.
```
