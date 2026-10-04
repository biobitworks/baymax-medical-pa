import React, { useState, useId } from 'react';
import { ShoppingBag, Check, Minus, Plus, ArrowUpRight } from 'lucide-react';

const pharmacies = [
  { id: 'care', name: 'Care Corner Pharmacy', price: 18, pickup: 'Pickup tomorrow · sample estimate' },
  { id: 'travel', name: 'Travel Well Pharmacy', price: 21, pickup: 'Pickup today · sample estimate' },
];
const money = (amount: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
export function PrescriptionShoppingCard() {
  const radioName = useId();
  const [pharmacyId, setPharmacyId] = useState('care');
  const [quantity, setQuantity] = useState(1);
  const [stage, setStage] = useState<'cart' | 'review' | 'complete'>('cart');
  const [consent, setConsent] = useState(false);
  const pharmacy = pharmacies.find(p => p.id === pharmacyId)!;
  const reset = () => { setPharmacyId('care'); setQuantity(1); setConsent(false); setStage('cart'); };
  return <section className="rx-shopping" aria-label="Prescription shopping demo">
    <div className="rx-heading"><span className="stat-icon green"><ShoppingBag size={22} /></span><div><span className="eyebrow">PRESCRIPTION SHOPPING</span><h3>A little care, ready to collect.</h3></div><span className="rx-demo">Demo</span></div>
    <p className="rx-caption">Choose a pharmacy, adjust your cart, and review your demo order.</p>
    {stage === 'complete' ? <div className="rx-complete" role="status"><span className="stat-icon green"><Check /></span><h3>Your demo order is ready.</h3><p>{quantity} {quantity === 1 ? 'pack' : 'packs'} · {pharmacy.name} · {money(pharmacy.price * quantity)}</p><p>No payment or purchase was made. A real order would require a valid prescription and pharmacy verification.</p><button className="outline" onClick={reset}>Start again</button></div> : <>
      <div className="rx-product"><img className="rx-product-image" src="/medicines/demo-refill.jpg" alt="Illustrative demo refill bottle, 30 tablets"/><div><b>Existing prescription refill</b><p>Sample pack · 30 tablets</p><small>Medication and strength must match your prescription.</small></div></div>
      {stage === 'cart' ? <>
        <fieldset className="rx-pharmacies"><legend>Browse refill options</legend><div className="rx-options-grid">{pharmacies.map(p => <label key={p.id} className={`rx-pharmacy ${pharmacyId === p.id ? 'selected' : ''}`}><div className="rx-card-photo"><img src="/medicines/demo-refill.jpg" alt="Fictional refill bottle, 30 tablets"/>{pharmacyId === p.id && <span>Selected</span>}</div><div className="rx-card-body"><b>Prescription refill</b><small>Sample pack · 30 tablets</small><strong>{money(p.price)}<small>per pack</small></strong><span className="rx-card-pharmacy"><input type="radio" name={radioName} checked={pharmacyId === p.id} onChange={() => setPharmacyId(p.id)} /><b>{p.name}</b></span><small>{p.pickup}</small></div></label>)}</div></fieldset>
        <div className="rx-quantity"><div><b>Packs in your demo cart</b><small>Demo quantities only, not a dosing recommendation</small></div><div className="rx-counter"><button aria-label="Remove one pack" disabled={quantity === 1} onClick={() => setQuantity(q => Math.max(1, q - 1))}><Minus size={16} /></button><output aria-label="Pack quantity" aria-live="polite">{quantity}</output><button aria-label="Add one pack" disabled={quantity === 3} onClick={() => setQuantity(q => Math.min(3, q + 1))}><Plus size={16} /></button></div></div>
      </> : <div className="rx-review"><span className="eyebrow">REVIEW YOUR DEMO ORDER</span><p><b>{pharmacy.name}</b><br />{pharmacy.pickup}</p><p>{quantity} {quantity === 1 ? 'pack' : 'packs'} × {money(pharmacy.price)}</p><p>Prescription verification: required for a real order.</p><button className="text-btn" onClick={() => { setConsent(false); setStage('cart'); }}>Edit cart</button></div>}
      <div className="rx-total"><span>Sample total<small>USD · pickup · sample pricing</small></span><strong aria-live="polite">{money(pharmacy.price * quantity)}</strong></div>
      {stage === 'review' && <label className="consent"><input type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)} />I understand this is a demo and no medication will be purchased.</label>}
      <button className="primary rx-checkout" disabled={stage === 'review' && !consent} onClick={() => { if (stage === 'cart') { setConsent(false); setStage('review'); } else if (consent) setStage('complete'); }}>{stage === 'cart' ? 'Review demo order' : 'Confirm demo order'}<ArrowUpRight size={16} /></button>
      <p className="fine">Demo only. No prescription is verified, no payment is collected, and no order is sent.</p>
    </>}
  </section>;
}
