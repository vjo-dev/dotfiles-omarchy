---
name: capex-request
description: Guide the user through documenting and submitting a CAPEX request (Heraeus Medical / Medevio process). Use when the user wants to request a CAPEX, buy new equipment or capital goods, fill a CIM (PR03-4335), a Safety Checklist (FR-0096), or the CAPEX form (TEM-0059). Triggers - CAPEX, capex request, capital expenditure, CIM, change impact matrix, EHS MOC checklist, EQUI article, purchase of new machine.
---

# CAPEX Request — Agent Playbook

Guide the user step by step through documenting and submitting a **CAPEX request**, filling the three required documents and tracking approvals.

## Step 0 — ALWAYS ask for the applicable documents first

Before anything else, ask the user (one question) to provide the current applicable documents, e.g. by copying them into the working folder or giving paths. **The versions the user provides are the valid ones** — do not assume versions from this skill are current; templates are controlled documents in CAQ and may have been revised.

Request these three templates (the workflow itself is already documented in this skill — do not ask for the "Request a CAPEX" process document):

1. CIM template — `HMSA-PR03-4335 - Change impact matrix (CIM)` (.docx)
2. Safety checklist — `GHMV-FR-0096 - Safety Checklist for New or Modified Machines and Infrastructure` (.xlsx)
3. CAPEX form — `GHMV-TEM-0059 - Capex Checklist Template` (.xlsx)

If the provided versions differ from what is described below, **inspect the provided files and follow them** — the field lists below are a reference based on CIM rev 4, FR-0096 v3.00.0001, TEM-0059 v3.00.0002.

Then collect the project basics via `ask_user_question` (one question per call):

- [ ] Project name, site, business line, project manager
- [ ] What the project consists of and what the money buys (equipment? service? software?)
- [ ] Justification (quantified benefit), urgency, alternatives
- [ ] Total amount + currency
- [ ] Supplier offers (how many? purchasing involved? availability at other sites checked?)
- [ ] Does a CIM already exist? (if yes, get its QR number)
- [ ] Any physical change on site? (determines how much of the safety checklist is N/A)

> Sanity check: if the request is a low-value **service** with no asset acquired, suggest the user confirm with Controlling whether it is really CAPEX (vs. OPEX) before building the full dossier.

## Workflow (10 steps)

1. **Obtain offers from several suppliers.** Single offer requires justification on the CAPEX form.
2. **Create a CIM (PR03-4335)** if none exists: download template from CAQ → complete → have it **signed** → register in CAQ with a **QR number**.
3. **Create a Safety Checklist (FR-0096)**: download from CAQ → fill in → **validated by EHS**.
4. **Create the CAPEX form (TEM-0059)**: download from CAQ → fill in → **validated by the Director**.
5. **Send the complete dossier to Daniel** (offers + CIM + safety checklist + CAPEX form).
6. **Retrieve the CAPEX number.**
7. **Obtain Daniel's validation.**
8. **Create an EQUI article**: email the supplier offer + CAPEX number to the **Methods department**.
9. **Wait for EQUI validation by Controlling.**
10. **Enter the purchase requisition** ("Create a purchase order" process).

Approval chain: CIM signatures → EHS (FR-0096) → Director (TEM-0059) → Daniel (CAPEX number + validation) → Controlling (EQUI).

## Document 1 — CIM (PR03-4335, Word)

Delete all blue instruction notes before approval. **(M)** = mandatory.

- **Title (M)**: `QR-xxxx CIM for "<title of the change>"`
- **Initiator (M)**, **team members (M)** (initials, ≥1), **date (M)** (assessment start)
- Change control number: CCID / QR / TR / DCR, or `N/A`
- **Description of change (M)**, **current situation (M)**, **future situation (M)**
- **Impact assessment I** — per change type, fill current/future/risks & mitigations (or N/A + justification): raw material, product in contact, production environment, production equipment, production method, inspection equipment and method, manpower
- **Impact assessment II** — impacted customers; HMSA & customer P/N + revisions; WIP parts to address (Y/N + lots); stock to check (Y/N + lots, labels/re-labelling)
- **Impact assessment III** — customer approval required? (Quality/Sales, reference quality agreements); Supplier Request for Change required? (Engineering/Purchasing); validation impact + justification (Engineering/Quality)
- **Final decision (M)** — copy exactly one standard conclusion: (1) no impact → no CCID; (2) potential impact → CCID to be assessed; (3) impact → CCID required. Plus mitigation actions/conclusion (M).
- Attached documents list (or N/A)
- Approvals: Initiator (Eng/Quality) · Engineering or Quality · Production (adapt departments if required)

## Document 2 — Safety Checklist (GHMV-FR-0096, Excel)

Main tab **EHS MOC Checklist**, completed by the project owner **together with EHS**.

Header: project/change name · project owner + date · EHS reviewer approval + review date.

22 checkpoints, each answered **Yes / No / N/A / Don't know** + "Intelex action item needed?" + comments: (1) chemicals & quantities, (2) SDS to EHS, (3) SAP numbers + chemical inventory, (4) releases to air/water/ground, (5) wastewater changes, (6) increased flammable/toxic storage, (7) waste streams reviewed, (8) releases of flammables/vapors/dust/toxics, (9) flammables/dust inside equipment, (10) fire protection/gas detection changes, (11) lasers/radiation/UV/magnets, (12) electrical standards (UL/CE), (13) hazards guarded & labeled, (14) access to moving parts prevented, (15) robotics envelopes, (16) START/STOP + emergency controls, (17) energy isolation (LOTO), (18) LEV, (19) PPE, (20) ergonomics, (21) procedures/training, (22) other concerns.

Supporting tabs, complete as applicable (software-only changes → N/A): Project_Task_List · Facilities Assessment Form (power, gas, water, air, floor prep, lighting + signatures) · CAL_PM Assessment · MACHINE SPECIFICATION · Comparison (supplier matrix).

## Document 3 — CAPEX Form (GHMV-TEM-0059, Excel)

Tab **Equipment Capex** — fill yellow cells (column C in v3) and attach to the approval request:

| Field | What to enter |
|---|---|
| Project name | Title |
| Company | Site dropdown: HMPR, HMHD, HMFD, HMCR, HMSG, HMTC, HMDD, HMHK, HMSA, DC |
| Business line | Business line |
| Project manager | Name |
| Total amount / Currency | Amount + currency |
| Description | What the project consists of |
| Reason | Why needed; benefit — **quantify if possible** |
| Urgency | What happens if not spent |
| Alternatives | E.g. repair instead of new equipment |
| Availability at other Medevio sites checked? | Tick / N/A |
| Purchasing involved / price negotiated? | Tick |
| Number of supplier offers | Count; **justify if only one** |
| Further comment | E.g. why purchasing is not involved |

## Deliverables to produce for the user

1. A draft markdown file (`CAPEX_<project>_DRAFT.md`) in the working folder with: project summary, full CIM text ready to paste, safety-checklist answers, CAPEX-form values, and the remaining-steps checklist.
2. Offer to fill **copies** of the provided Excel templates directly (openpyxl; never overwrite the originals; name copies `<TEM|FR>-..._<project>_FILLED.xlsx`). Warn the user that openpyxl may drop dropdown validations/conditional formatting — they should verify in Excel.
3. The CIM (.docx) is best filled manually by the user from the draft text; do not attempt fragile docx editing unless asked.

## Execution checklist to track with the user

- [ ] Supplier offer(s) attached
- [ ] CIM filled → signed → registered in CAQ with QR number
- [ ] FR-0096 filled → EHS validation
- [ ] TEM-0059 filled → Director validation
- [ ] Dossier to Daniel → CAPEX number → Daniel's validation
- [ ] Offer + CAPEX number to Methods → EQUI article → Controlling validation
- [ ] Purchase requisition entered
