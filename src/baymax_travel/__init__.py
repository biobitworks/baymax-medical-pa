"""Bounded provider-independent travel context and deterministic demo action gate."""
from collections import Counter
import hashlib,json
MAX_REFERENCES=16

def canonical(x): return json.dumps(x,sort_keys=True,separators=(',',':'),ensure_ascii=False).encode()
def build_bundle(graph,source):
 if graph['synthetic_state']!='SYNTHETIC' or source['synthetic_state']!='SYNTHETIC': raise ValueError('synthetic graph and source required')
 if graph['source_dataset_fco_id']!=source['fco_id']: raise ValueError('source mismatch')
 if any(n['source_dataset_fco_id']!=source['fco_id'] or n['synthetic_state']!='SYNTHETIC' for n in graph['nodes']): raise ValueError('node provenance mismatch')
 counts=Counter(n['source_resource_type'] for n in graph['nodes'])
 refs=sorted(graph['nodes'],key=lambda n:(n['source_resource_type']!='MedicationRequest',n['fco_id']))[:MAX_REFERENCES]
 out={'schema':'baymax.offline-travel-bundle-fco.v1','fco_type':'OfflineTravelBundleFCO','synthetic_state':'SYNTHETIC','correctness_state':'UNKNOWN','source_dataset_fco_id':source['fco_id'],'source_graph_sha256':hashlib.sha256(canonical(graph)).hexdigest(),'source_bundle_sha256':graph['source_bundle_sha256'],'resource_counts':dict(sorted(counts.items())),'resource_references':refs,'omitted_reference_count':len(graph['nodes'])-len(refs),'bounds':{'max_resource_references':MAX_REFERENCES,'clinical_values':'NOT_MAPPED','omission_state':'EXPLICIT_BOUNDED_SELECTION'},'patient_context':{'label':'Synthetic traveler','medical_correctness':'UNKNOWN'},'medication_context':{'record_count':counts['MedicationRequest'],'names':'UNKNOWN','dosage':'UNKNOWN','travel_eligibility':'UNKNOWN'},'trip_context':{'destination':'Bali, Indonesia','dates':'UNKNOWN'},'directory':[{'id':'synthetic-pharmacy-1','label':'Synthetic demo pharmacy','synthetic_state':'SYNTHETIC','phone':'UNKNOWN','availability':'UNKNOWN','call_enabled':False,'purchase_enabled':False}],'freshness':{'source_retrieved_at':source['retrieved_at'],'live_state':'UNKNOWN'},'execution_policy':{'policy_id':'baymax.synthetic-offline-demo.v1','default_route':'LOCAL_ONLY','external_requests_enabled':False,'live_actions_enabled':False},'unknown_states':['Clinical values NOT_MAPPED','Medical correctness UNKNOWN','Travel medication eligibility UNKNOWN','Directory availability UNKNOWN','Generated-data terms UNKNOWN_TERMS']}
 out['fco_id']='offline-travel:'+hashlib.sha256(canonical(out)).hexdigest()
 if len(canonical(out))>20000: raise ValueError('bundle exceeds 20KB bound')
 return out

def gate(action,online=False,consent=False):
 if not consent: return {'state':'BLOCKED','reason':'Demo consent required','dispatch':False}
 if action=='READ_CONTEXT': return {'state':'LOCAL_ONLY','reason':'Synthetic bounded context; no network','dispatch':False}
 if action=='WALLET_PREVIEW': return {'state':'LOCAL_ONLY','reason':'Synthetic zero-funds preview; no signing or spending','dispatch':False}
 if action=='PURCHASE': return {'state':'BLOCKED','reason':'Live medication purchase prohibited','dispatch':False}
 if action in {'CLOUD_SUMMARY','FLY_SYNC','CALL'}: return {'state':'DEFERRED','reason':'Offline' if not online else 'Provider/action authorization absent','dispatch':False}
 return {'state':'BLOCKED','reason':'Unknown action','dispatch':False}

def guarded_request(action,provider,online=False,consent=False):
 decision=gate(action,online,consent)
 if decision['dispatch']: return provider()
 return decision
