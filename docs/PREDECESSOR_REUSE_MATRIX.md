# Predecessor reuse matrix

The Baymax fork is a successor application, not a merge of predecessor histories.

| Repository | Pinned commit | What Baymax should reuse | Rights decision |
|---|---|---|---|
| jerelvelarde/baymax-medical-pa | `74bfe7708ba1a94dd856bd69ed852f8288f72bf7` | product framing, medical boundaries, demo story | upstream root license unresolved; preserve as fork parent |
| biobitworks/carescribe | `90ac3d203cd5705421dc1926bce04e5f096a9531` | privacy threat model, claim-audit discipline, synthetic-data policy, bounded provider boundary | MIT software; exact imports require notice |
| biobitworks/agent-foundry | `caaae178bede2c314ab9e4fc9f2528e69b2a858c` | provider-neutral event semantics, frozen-context comparison, replay/divergence, ordered-Merkle design principles | repository license unselected; reimplement concepts rather than copy code |
| biobitworks/vithia-verifiable-long-horizon-agents | `3489da0e17ffb1a4b62b5549486b2240088a1a1d` | Golden Route, exact context projection, successor breakpoints, independently verified commitments | mixed rights: applicable Apache-2.0 software + CC BY-NC-ND governed artifacts |
| biobitworks/jev-space-invaders | `dbca313a22b3f3bdc35f7b4f45d5fd550b22b9b9` | fail-closed provider/license gate, minimum disclosure, no silent fallback, replay discipline | general root license not recovered; reference patterns only |

## Import rule

Before copying an exact predecessor file:
1. recover exact source commit and file;
2. establish its license/rights;
3. record source identity;
4. preserve attribution/NOTICE requirements;
5. run secret/private-data scan;
6. admit it as an explicit transformation or import event.

Do not copy an MMR root or claim historical continuity merely because code or concepts share lineage.
