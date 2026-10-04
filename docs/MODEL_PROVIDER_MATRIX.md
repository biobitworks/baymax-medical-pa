# Model and provider matrix

Reviewed: 2026-10-04. This is an architecture selection matrix, not a medical validation or contractual compliance certification.

## Models

| Lane | Candidate | Why | Rights/compliance note | Current Baymax state |
|---|---|---|---|---|
| deterministic authority | Python/Swift rules | auditable fail-closed routing | project-authored policy; legal review still contextual | IMPLEMENTED_MINIMUM |
| edge/on-device primary | Liquid LFM2.5 1.2B Instruct/Thinking | strong edge/phone focus; suitable local privacy lane | LFM Open License; not Apache-2.0; exact commercial terms must be tracked | NOT_TESTED_IN_BAYMAX |
| edge agent | Liquid LFM2.5 2.6B | larger local agent/tool-use candidate | same LFM license gate | NOT_TESTED_IN_BAYMAX |
| trainable living-model candidate | Liquid LFM2.5 1.2B Base | vendor positions Base for heavier domain fine-tuning | training recipe + license + retention evaluation required | NOT_TESTED |
| open independent control | Mistral Ministral 3 3B | edge-oriented independent model family | model is published under Apache-2.0; freeze exact revision/license | NOT_TESTED |
| larger open control | Mistral Ministral 3 8B | larger independent reasoning lane | Apache-2.0 for exact model checked in provider review | NOT_TESTED |
| secondary safety reviewer | Mistral Shieldstral 3B | policy-adaptive safety classification | auxiliary only; never compliance authority | NOT_TESTED |
| small open local baseline | Qwen3 1.7B | already practical locally; independent architecture | Qwen3 open-weight releases use Apache-2.0; pin exact model | NOT_TESTED_IN_BAYMAX |
| stronger open local baseline | Qwen3 4B | comparison lane with cleaner permissive license | Apache-2.0 for exact model/revision to be frozen | NOT_TESTED |
| final medical authority | NONE | models are evidence/decision substrates | clinician/user authority remains separate | BY_DESIGN |

### Selection rule

Do not pick a "winner" from marketing claims.

Freeze one minimized ContextPacket and evaluate the same bytes across candidates for:
- task correctness
- abstention behavior
- privacy leakage
- latency/memory/thermal cost
- structured-output validity
- calibration where measurable
- retention after governed training, if training is performed

Preserve disagreement as evidence.

## Sponsor/service lanes

| Service | Best-fit Baymax role | PHI posture for MVP |
|---|---|---|
| Neon | governed Postgres/control-plane persistence, policy/model/provider registry, privacy-safe audit state | PHI BLOCKED until actual BAA/account/configuration verified |
| Exa | external medical/longevity literature and logistics research | de-identified/minimized query only until exact contract verified |
| Mastra | workflow/agent orchestration | self-host for sensitive lanes |
| Fly.io / Sprites | isolated cloud execution | PHI only after BAA/config/security verification |
| assistant-ui | conversational/approval UI | not a compliance authority |
| CodeRabbit | code-review evidence | no PHI in review payloads |
| Executor | local dev/tool execution | prefer local; not approved as PHI processor by this matrix |
| Kernel | browser action | PHI/medical action eligibility UNKNOWN pending vendor review |
| AgentMail | communication | PHI email BLOCKED pending BAA/vendor review |

## External provider rule

Provider website claims are not enough. The actual Baymax account, agreement, region, endpoint, retention setting, training-use setting, subprocessor scope, and BAA/DPA state must be captured before `ALLOW_CONTRACTED_EXTERNAL`.

## Primary recommendation

For the privacy-first MVP:

`deterministic compliance rules → local Liquid/Qwen/Mistral evaluation → optional de-identified Exa → Neon privacy-safe audit`

No raw personal medical data needs to leave the device/local trust boundary to demonstrate the architecture.

## Public sources reviewed

- Liquid LFM2.5 on-device: https://www.liquid.ai/blog/lfm2-5-1-2b-thinking-on-device-reasoning-under-1gb
- Liquid ExecuTorch deployment: https://www.liquid.ai/blog/how-liquid-ai-uses-executorch-to-power-efficient-flexible-on-device-intelligence
- Liquid LFM Open License: https://www.liquid.ai/lfm-license
- Mistral Ministral 3 3B: https://docs.mistral.ai/models/ministral-3-3b-25-12
- Mistral Ministral 3 8B: https://docs.mistral.ai/models/ministral-3-8b-25-12
- Mistral Shieldstral: https://docs.mistral.ai/models/shieldstral-1-0
- Qwen3: https://qwenlm.github.io/blog/qwen3/
- Neon HIPAA: https://neon.com/blog/hipaa
- Exa enterprise: https://exa.ai/enterprise
- Mastra regulated-agent deployment: https://mastra.ai/blog/secure-governed-agents-regulated-enterprise
- Fly.io compliance: https://fly.io/documents

These URLs are source references, not an admission of contractual compliance.
