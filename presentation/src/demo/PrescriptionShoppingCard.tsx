import {Img,staticFile} from 'remotion';
import {Cue} from './Interaction';
import React, { useState, useId } from 'react';
import { ShoppingBag, Check, Minus, Plus, ArrowUpRight } from './Icons';

const pharmacies = [
  { id: 'care', name: 'Care Corner Pharmacy', price: 18, pickup: 'Pickup tomorrow · sample estimate' },
  { id: 'travel', name: 'Travel Well Pharmacy', price: 21, pickup: 'Pickup today · sample estimate' },
  { id: 'neighborhood', name: 'Neighborhood Pharmacy', price: 20, pickup: 'Pickup tomorrow · sample estimate' },
];
const money = (amount: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
export type PrescriptionDemoState = {pharmacyId:string;quantity:number;stage:'cart'|'review'|'complete';consent:boolean};
export function PrescriptionShoppingCard({demoState}:{demoState?:PrescriptionDemoState}) {
  const radioName = useId();
  const [localPharmacyId, setPharmacyId] = useState('care');
  const [localQuantity, setQuantity] = useState(1);
  const [localStage, setStage] = useState<'cart' | 'review' | 'complete'>('cart');
  const [localConsent, setConsent] = useState(false);
  const pharmacyId=demoState?.pharmacyId??localPharmacyId;
  const quantity=demoState?.quantity??localQuantity;
  const stage=demoState?.stage??localStage;
  const consent=demoState?.consent??localConsent;
  const pharmacy = pharmacies.find(p => p.id === pharmacyId)!;
  const reset = () => { setPharmacyId('care'); setQuantity(1); setConsent(false); setStage('cart'); };
  return <section className={`rx-shopping rx-stage-${stage}`} aria-label="Prescription shopping demo">
    <div className="rx-heading"><span className="stat-icon green"><ShoppingBag size={22} /></span><div><span className="eyebrow">PRESCRIPTION SHOPPING</span><h3>A little care, ready to collect.</h3></div><span className="rx-demo">Demo</span></div>
    <p className="rx-caption">Try the shopping journey with fictional pharmacies, prices, and prescription details.</p>
    {stage === 'complete' ? <div className="rx-complete" role="status"><span className="stat-icon green"><Check /></span><h3>Your demo order is ready.</h3><p>{quantity} {quantity === 1 ? 'pack' : 'packs'} · {pharmacy.name} · {money(pharmacy.price * quantity)}</p><p>No payment or purchase was made. A real order would require a valid prescription and pharmacy verification.</p><button className="outline" onClick={reset}>Start again</button></div> : <>
      <div className="rx-product"><Img className="rx-product-thumb" src={staticFile('medicines/demo-refill.jpg')}/><div><b>Existing prescription refill</b><p>Sample pack · 30 tablets</p><small>Medication and strength must match your prescription.</small></div></div>
      {stage === 'cart' ? <>
        <fieldset className="rx-pharmacies"><legend>Browse refill options</legend>{pharmacies.map(p => <label key={p.id} className={`rx-pharmacy ${pharmacyId === p.id ? 'selected' : ''}`}><Img className="rx-card-image" src={staticFile('medicines/demo-refill.jpg')}/><span className="rx-card-title">Prescription refill</span><span className="rx-card-detail">Sample pack · 30 tablets</span><input type="radio" name={radioName} checked={pharmacyId === p.id} onChange={() => setPharmacyId(p.id)} /><span><b>{p.name}</b><small>{p.pickup}</small></span><Cue id={p.id}/><strong>{money(p.price)}<small>per pack</small></strong></label>)}</fieldset>
        <div className="rx-quantity"><div><b>Packs in your demo cart</b><small>Demo quantities only, not a dosing recommendation</small></div><div className="rx-counter"><button aria-label="Remove one pack" disabled={quantity === 1} onClick={() => setQuantity(q => Math.max(1, q - 1))}><Minus size={16} /></button><output aria-label="Pack quantity" aria-live="polite">{quantity}</output><button aria-label="Add one pack" disabled={quantity === 3} onClick={() => setQuantity(q => Math.min(3, q + 1))}><Plus size={16} /><Cue id="Plus"/></button></div></div>
      </> : <div className="rx-review"><span className="eyebrow">REVIEW YOUR DEMO ORDER</span><p><b>{pharmacy.name}</b><br />{pharmacy.pickup}</p><p>{quantity} {quantity === 1 ? 'pack' : 'packs'} × {money(pharmacy.price)}</p><p>Prescription verification: required for a real order.</p><button className="text-btn" onClick={() => { setConsent(false); setStage('cart'); }}>Edit cart</button></div>}
      <div className="rx-total"><span>Sample total<small>USD · pickup · fictional pricing</small></span><strong aria-live="polite">{money(pharmacy.price * quantity)}</strong></div>
      {stage === 'review' && <label className="consent"><input type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)} />I understand this is a demo and no medication will be purchased.<Cue id="Consent"/></label>}
      <button className="primary rx-checkout" disabled={stage === 'review' && !consent} onClick={() => { if (stage === 'cart') { setConsent(false); setStage('review'); } else if (consent) setStage('complete'); }}>{stage === 'cart' ? 'Review demo order' : 'Confirm demo order'}<ArrowUpRight size={16} /><Cue id={stage==='cart'?'Review demo order':'Confirm demo order'}/></button>
      <p className="fine">Demo only. No prescription is verified, no payment is collected, and no order is sent.</p>
    </>}
  </section>;
}
