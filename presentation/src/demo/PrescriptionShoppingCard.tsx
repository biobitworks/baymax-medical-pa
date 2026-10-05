import {assetFile} from './asset';
import {Img} from 'remotion';
import {Cue} from './Interaction';
import React, {useState, useId} from 'react';
import {ShoppingBag, Check, Minus, Plus, ArrowUpRight} from './Icons';

// Example products for an adult with an existing type 2 diabetes care plan.
// Prices are illustrative, not pharmacy quotes or insurance/copay promises.
const products = [
  {id: 'metformin', name: 'Metformin ER 500 mg', pack: '30 extended-release tablets', price: 9,
    category: 'EXISTING PRESCRIPTION', note: 'Refill only · pharmacy verification', image: 'metformin.jpg', prescription: true},
  {id: 'glucose', name: 'Glucose tablets', pack: '10-tablet travel tube', price: 2.49,
    category: 'LOW-GLUCOSE SUPPLIES', note: 'Portable tube for your running kit', image: 'glucose.jpg', prescription: false},
  {id: 'strips', name: 'Blood glucose test strips', pack: '50 strips · check meter compatibility', price: 19.99,
    category: 'GLUCOSE MONITORING', note: 'Match your current glucose meter', image: 'strips.jpg', prescription: false},
];
const pharmacy = 'Care Corner Pharmacy';
const money = (amount: number) => new Intl.NumberFormat('en-US', {style: 'currency', currency: 'USD'}).format(amount);
export type PrescriptionDemoState = {productId:string;quantity:number;stage:'cart'|'review'|'complete';consent:boolean};

export function PrescriptionShoppingCard({demoState}:{demoState?:PrescriptionDemoState}) {
  const radioName = useId();
  const [localProductId, setProductId] = useState('metformin');
  const [localQuantity, setQuantity] = useState(1);
  const [localStage, setStage] = useState<'cart'|'review'|'complete'>('cart');
  const [localConsent, setConsent] = useState(false);
  const productId = demoState?.productId ?? localProductId;
  const product = products.find(p => p.id === productId) ?? products[0];
  const quantity = product.prescription ? 1 : demoState?.quantity ?? localQuantity;
  const stage = demoState?.stage ?? localStage;
  const consent = demoState?.consent ?? localConsent;
  const reset = () => {setProductId('metformin');setQuantity(1);setConsent(false);setStage('cart');};
  const image = (file:string) => assetFile(`medicines/marathon/${file}`);
  return <section className={`rx-shopping rx-stage-${stage}`} aria-label="Diabetes and marathon preparation shopping demo">
    <div className="rx-heading"><span className="stat-icon green"><ShoppingBag size={22}/></span><div><span className="eyebrow">DIABETES · MARATHON PREPARATION</span><h3>Your running kit, reviewed.</h3></div><span className="rx-demo">Demo</span></div>
    <p className="rx-caption">Example products for an existing care plan. Review training, fueling, and medication plans with your diabetes team.</p>
    {stage === 'complete' ? <div className="rx-complete" role="status"><span className="stat-icon green"><Check/></span><h3>Your demo order is ready.</h3><p>{product.name}<br/>{quantity} {quantity === 1 ? 'pack' : 'packs'} · {money(product.price * quantity)}</p><p>{pharmacy} · pickup estimate</p><p>No payment or purchase was made.</p><button className="outline" onClick={reset}>Start again</button></div> : <>
      <div className="rx-product"><Img className="rx-product-thumb" src={image(product.image)} alt={product.name}/><div><b>{product.name}</b><p>{product.pack}</p><small>{product.note}</small></div></div>
      {stage === 'cart' ? <>
        <fieldset className="rx-pharmacies"><legend>Type 2 diabetes · marathon preparation <span className="rx-example-prices">Example prices</span></legend>{products.map(p => <label key={p.id} className={`rx-pharmacy ${productId === p.id ? 'selected' : ''}`}>
          <Img className="rx-card-image" src={image(p.image)} alt={p.name}/><span className="rx-card-category">{p.category}</span><span className="rx-card-title">{p.name}</span><span className="rx-card-detail">{p.pack}</span>
          <input type="radio" name={radioName} checked={productId === p.id} onChange={() => {setProductId(p.id);setQuantity(1);}}/>
          <span className="rx-card-context"><b>{p.note}</b><small>{pharmacy} · pickup estimate</small></span><Cue id={p.id}/><strong>{money(p.price)}<small>per pack · example</small></strong>
        </label>)}</fieldset>
        <div className="rx-quantity"><div><b>{product.prescription ? 'Refill pack' : 'Packs in your kit'}</b><small>{product.prescription ? 'Quantity follows your prescription' : 'Shopping quantity, not a dose'}</small></div><div className="rx-counter"><button aria-label="Remove one pack" disabled={quantity === 1 || product.prescription} onClick={() => setQuantity(q => Math.max(1, q - 1))}><Minus size={16}/></button><output aria-label="Pack quantity">{quantity}</output><button aria-label="Add one pack" disabled={quantity === 3 || product.prescription} onClick={() => setQuantity(q => Math.min(3, q + 1))}><Plus size={16}/><Cue id="Plus"/></button></div></div>
      </> : <div className="rx-review"><span className="eyebrow">REVIEW YOUR RUNNING KIT</span><p><b>{pharmacy}</b><br/>Pickup today · example availability</p><p>{quantity} {quantity === 1 ? 'pack' : 'packs'} × {money(product.price)}</p><p>{product.prescription ? 'Existing prescription and pharmacy verification required.' : product.id === 'strips' ? 'Confirm compatibility with your current meter.' : 'For your low-glucose plan, separate from race fuel.'}</p><button className="text-btn" onClick={() => {setConsent(false);setStage('cart');}}>Edit cart</button></div>}
      <div className="rx-total"><span>Example total<small>USD · illustrative pricing</small></span><strong>{money(product.price * quantity)}</strong></div>
      {stage === 'review' && <label className="consent"><input type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)}/>I reviewed this demo cart. No purchase will be made.<Cue id="Consent"/></label>}
      <button className="primary rx-checkout" disabled={stage === 'review' && !consent} onClick={() => {if(stage === 'cart'){setConsent(false);setStage('review');}else if(consent)setStage('complete');}}>{stage === 'cart' ? 'Review demo order' : 'Confirm demo order'}<ArrowUpRight size={16}/><Cue id={stage === 'cart' ? 'Review demo order' : 'Confirm demo order'}/></button>
      <p className="fine">Demo only. No prescription is verified, payment collected, or order sent.</p>
    </>}
  </section>;
}
