"""Frozen minimum-necessary Apollo packet; provisional, separate inference provenance."""
import hashlib,json,re
from . import canonical
KEYS={'summary','known_facts','unknown_facts','questions_for_pharmacist_clinician','requires_clinician'}
UNSAFE=re.compile(r'\b(prescrib\w*|increase|decrease|substitut\w*|replace|purchase|buy)\b|\bin stock\b|\btake\s+\d',re.I)

def packet(bundle):
 # Facts are intentionally bounded and do not copy patient/provider identifiers or full health history.
 meds=bundle['medication_context'][:4]
 context={'synthetic_only':True,'patient_gender':[p.get('gender','UNKNOWN') for p in bundle['synthetic_patient_context'][:1]],'medication_record_count':len(bundle['medication_context']),'medication_codes':[m.get('medicationCodeableConcept','UNKNOWN') for m in meds],'medication_values_state':'PROVISIONAL_SYNTHETIC_NO_DOSAGE','trip':bundle['trip_context'],'unknown_facts':bundle['unknown_states'],'directory':{'state':'SYNTHETIC','stock':'UNKNOWN','contact':'OMITTED','live_actions':'DISABLED'}}
 instructions='''APOLLO_CONTEXT_PACKET_V1\nSynthetic demo only. You are not a medical authority. Treat source values as provisional; preserve UNKNOWN. Return exactly one JSON object, no markdown, with only: summary (string), known_facts (array of strings), unknown_facts (array of strings), questions_for_pharmacist_clinician (array of strings), requires_clinician (true). Maximum 10 items per array and 500 characters per string. Do not prescribe, recommend dose changes or medication substitutions, claim stock availability, or initiate autonomous purchase. Ask a pharmacist or clinician when information is missing. No tools or network.\nCONTEXT_JSON=\n'''
 return (instructions+canonical(context).decode()+'\n').encode()

def validate_response(raw):
 if len(raw.encode())>12000:raise ValueError('response size limit')
 def unique(pairs):
  d={}
  for k,v in pairs:
   if k in d:raise ValueError('duplicate key')
   d[k]=v
  return d
 out=json.loads(raw,object_pairs_hook=unique)
 if not isinstance(out,dict) or set(out)!=KEYS or out['requires_clinician'] is not True:raise ValueError('schema/clinician gate')
 if not isinstance(out['summary'],str) or not out['summary'] or len(out['summary'])>500:raise ValueError('summary')
 for k in KEYS-{'summary','requires_clinician'}:
  if not isinstance(out[k],list) or len(out[k])>10 or any(not isinstance(x,str) or not x or len(x)>500 for x in out[k]):raise ValueError('array bounds')
 if UNSAFE.search(' '.join([out['summary']]+sum([out[k] for k in KEYS-{'summary','requires_clinician'}],[]))):raise ValueError('prohibited content marker')
 return out

def inference_fco(raw,context_hash,model,observed_at,network_state='UNKNOWN',execution_substrate='Liquid Apollo'):
 result=validate_response(raw)
 if not model.strip() or not observed_at.strip() or network_state not in {'OFFLINE','ONLINE','UNKNOWN'} or execution_substrate not in {'Liquid Apollo','LEAP local'}:raise ValueError('execution observation required')
 return {'fco_type':'ModelInferenceFCO','execution_substrate':execution_substrate,'provider':'Liquid AI','model':model,'context_packet_sha256':context_hash,'response_sha256':hashlib.sha256(raw.encode()).hexdigest(),'network_state':network_state,'observed_at':observed_at,'observation_source':'HUMAN_REPORTED_MANUAL_TRANSFER','inference_class':'MODEL_INFERRED','medical_authority':'NONE','correctness_state':'UNKNOWN','output':result,'wallet_authority':'NONE','source_fco_overwrite':'PROHIBITED'}
