# Physical Apollo acceptance handoff

Recovered primary commit: `510859101618ad5085f72691e47fcac96a726f3b` on `integration/iphone-offline-v2`, matching remote on recovery. Primary chain passes 33 entries, head `c8b9fb9198f5356d68765a840d1b31301b17373679a57a933fe6e61584a1ef31`. BP-0031 root is `5abb6d8541fc9b2409b8e491a227e47e341c9735ff86cf593e868e7a676525e7`; latest verified successor is BP-0032, root `061d59f89791a9e0eb6c8b0575f1a5b4031e5dcce38304367d467663ac22f2e0`.

BP-0030 original recording bytes/hash match their receipt. Physical iPhone + Apollo generation is OBSERVED. BP-0032 reports airplane-mode generation but its second recording is unavailable as valid local bytes (a matching filename exists in Downloads but contains zero bytes; identity check FAILED). Its visual transcription fails the required summary code and is rejected. Independent offline inference and exact device response-byte capture remain NOT_TESTED in this Codex lane. Do not repair the model response or loosen the contract.

The primary PR #3 is OPEN/DRAFT; its actual head is newer than its body. Issues #2/#3/#4/#5 remain OPEN/PARTIAL; #8 remains OPEN/DEFERRED. Direct Project #3 field inspection requires missing GitHub project scope. No issue closure is warranted.

## Phone run

1. Transfer the unchanged `fixtures/iphone/apollo_context_packet_v2.txt` before disabling connectivity. SHA-256: `80e92bd4d0583fb58b261164ba2e53543ce7482a0f767bc7c3368c460de54147`, 2540 bytes. Do not edit or regenerate it.
2. On the physical phone, start a recording restricted to the synthetic test. Show the exact installed Apollo model label/details. Set Airplane Mode on and explicitly turn Wi-Fi off; show both controls. Keep Bluetooth available only if needed; do not use Mirroring connectivity as proof of isolation.
3. Start a fresh Apollo conversation, submit that same packet and record generation and final output. Do not use OpenRouter or any cloud provider. Record a reachability check if claiming more than observed radio state.
4. Copy the entire response without changing whitespace, quotes, summary code or wrapping; save exact UTF-8 bytes as a local response file. If copy fidelity is not verifiable, retain UNKNOWN. Finish recording before reconnecting for file transfer.
5. After transfer, execute:

```sh
python3 scripts/verify_apollo_capture.py --response /absolute/path/response.txt --receipt /absolute/path/new-receipt.json --observed-at 'YYYY-MM-DDTHH:MM:SSZ' --model '<observed exact label or UNKNOWN>'
```

Exit 0 means schema valid only; exit 2 means rejected. A rejected response is a valid gate demonstration, not successful model compliance. The receipt hashes original response bytes, pins packet/catalog identity, checks the bundled wallet remains unchanged, and never upgrades network or correctness claims automatically. Do not commit an unchecked arbitrary response or personal recording.

6. Hand the side-lane commit, receipt, original media path/hash and explicit observation limits to the primary lane. Only primary allocates canonical breakpoint IDs. Claude independently reviews. Prescription purchase remains BLOCKED; real PHI excluded; wallet stays simulated.
