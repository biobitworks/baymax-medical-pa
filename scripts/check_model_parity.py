"""Compare exact admissions and decoded selections from hash-pinned shared corpora."""
import base64
import hashlib
import json
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'src'))
from baymax_travel.model import CATALOG_SHA256, validate_response

CORPORA = {
    'tests/vectors/model_admission_v3.json': '8e10ab3796ca5fd6eb3c0e4818a0ca2fb9dffea1eb07ebf396783dfc31e17618',
    'tests/vectors/model_admission_strict_edges_v1.json': 'b35f4fcf3a2ceea3a1ddf8a7f7f47f7ca0ca52678dd59473a719821ee80c01e9',
}


def load_vectors():
    vectors = []
    for path, expected_hash in CORPORA.items():
        data = (ROOT / path).read_bytes()
        if hashlib.sha256(data).hexdigest() != expected_hash:
            raise ValueError('immutable corpus hash mismatch: ' + path)
        for vector in json.loads(data):
            if base64.b64decode(vector['raw_base64'], validate=True) != vector['raw'].encode('utf-8'):
                raise ValueError('raw/base64 byte mismatch: ' + vector['VECTOR_ID'])
            if vector['EXPECTED_STATE'] not in {'ACCEPT', 'REJECT'}:
                raise ValueError('invalid expected state')
            vectors.append(vector)
    if len({v['VECTOR_ID'] for v in vectors}) != len(vectors):
        raise ValueError('duplicate vector ID')
    return vectors


def run():
    vectors = load_vectors()
    catalog_path = ROOT / 'fixtures/iphone/apollo_catalog_v2.json'
    if hashlib.sha256(catalog_path.read_bytes()).hexdigest() != CATALOG_SHA256:
        raise ValueError('catalog hash mismatch')
    with tempfile.TemporaryDirectory(prefix='baymax-parity-') as directory:
        exe = Path(directory) / 'parity'
        subprocess.run([
            'swiftc', '-parse-as-library', str(ROOT / 'ios/OfflineTravelDemo/ModelInference.swift'),
            str(ROOT / 'tests/ModelParity.swift'), '-o', str(exe),
        ], check=True)
        swift = json.loads(subprocess.check_output(
            [str(exe), str(catalog_path), *(str(ROOT / p) for p in CORPORA)], text=True))
    if [r['VECTOR_ID'] for r in swift] != [v['VECTOR_ID'] for v in vectors]:
        raise ValueError('Swift vector coverage/order mismatch')
    catalog = json.loads(catalog_path.read_bytes())
    results = []
    for vector, swift_row in zip(vectors, swift):
        selection = None
        try:
            selection = validate_response(vector['raw'], catalog)
            state = 'ACCEPT'
        except (ValueError, TypeError, UnicodeError):
            state = 'REJECT'
        results.append({
            'VECTOR_ID': vector['VECTOR_ID'], 'EXPECTED_STATE': vector['EXPECTED_STATE'],
            'PYTHON_STATE': state, 'SWIFT_STATE': swift_row['SWIFT_STATE'],
            'SELECTION_PARITY': selection == swift_row.get('selection'),
        })
    passed = all(r['EXPECTED_STATE'] == r['PYTHON_STATE'] == r['SWIFT_STATE']
                 and r['SELECTION_PARITY'] for r in results)
    return {
        'schema': 'baymax.model-parity.v2', 'state': 'PASS' if passed else 'FAIL',
        'vector_count': len(results), 'accepted': sum(r['PYTHON_STATE'] == 'ACCEPT' for r in results),
        'rejected': sum(r['PYTHON_STATE'] == 'REJECT' for r in results),
        'corpora_sha256': CORPORA, 'catalog_sha256': CATALOG_SHA256,
        'exact_parity_scope': 'Every vector: expected admission state and full decoded selection',
        'results': results,
    }


if __name__ == '__main__':
    receipt = run()
    print(json.dumps(receipt, indent=2, sort_keys=True))
    sys.exit(0 if receipt['state'] == 'PASS' else 1)
