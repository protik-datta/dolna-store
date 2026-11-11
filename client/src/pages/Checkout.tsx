import {useEffect,useState} from 'react';
import {useMutation,useQuery} from '@tanstack/react-query';
import {useNavigate,Link} from 'react-router-dom';
import {api,errorMessage,money} from '../lib/api';
import {useCart} from '../context/CartContext';
import type {Order} from '../types';
import {useSeo} from '../hooks/useSeo';
import {track} from '../lib/analytics';
interface Quote {items:{productId:string;variantId?:string;name:string;variantLabel:string;unitPrice:number;quantity:number;lineTotal:number}[];subtotal:number;deliveryCharge:number;total:number}
export default function Checkout(){
  const {items,subtotal,clear}=useCart();
  const nav=useNavigate();
  const [form,setForm]=useState({name:'',phone:'',address:'',deliveryZone:'dhaka',note:''});
  const [key]=useState(()=>crypto.randomUUID());
  const [error,setError]=useState('');
  useSeo('চেকআউট — দোলনা','আপনার অর্ডার সম্পন্ন করুন।');
  useEffect(()=>{if(items.length===0)nav('/cart',{replace:true});},[items.length,nav]);
  useEffect(()=>{if(items.length)track('InitiateCheckout',{content_ids:items.map(i=>i.product._id),content_type:'product',currency:'BDT',value:subtotal});},[items,subtotal]);
  const quote=useQuery({
    queryKey:['order-quote',items.map(i=>[i.product._id,i.variantId||'',i.quantity]),form.deliveryZone],
    enabled:items.length>0,
    queryFn:async()=>((await api.post('/orders/quote',{items:items.map(i=>({productId:i.product._id,variantId:i.variantId,quantity:i.quantity})),deliveryZone:form.deliveryZone})).data.data as Quote)
  });
  const mutation=useMutation({
    mutationFn:async()=>{
      const payload={items:items.map(i=>({productId:i.product._id,variantId:i.variantId,quantity:i.quantity})),customer:{name:form.name,phone:form.phone,address:form.address},deliveryZone:form.deliveryZone,note:form.note};
      return (await api.post('/orders',payload,{headers:{'Idempotency-Key':key}})).data.data as Order;
    },
    onSuccess:order=>{clear();nav(`/order/${order.orderNumber}`,{state:{order}});},
    onError:e=>setError(errorMessage(e))
  });
  const update=(field:keyof typeof form,value:string)=>setForm(p=>({...p,[field]:value}));
  return <section className="section container checkout-page">
    <div className="page-heading"><span className="eyebrow">ALMOST YOURS</span><h1>অর্ডার সম্পন্ন করুন</h1><p>আপনার তথ্য দিন, আমরা বাকি ব্যবস্থা করছি।</p></div>
    <div className="checkout-grid">
      <form className="checkout-form" onSubmit={e=>{e.preventDefault();setError('');mutation.mutate();}}>
        <h2>ডেলিভারির তথ্য</h2>
        <label>আপনার নাম<input required minLength={2} value={form.name} onChange={e=>update('name',e.target.value)} placeholder="সম্পূর্ণ নাম"/></label>
        <label>মোবাইল নম্বর<input required value={form.phone} onChange={e=>update('phone',e.target.value)} placeholder="01XXXXXXXXX" inputMode="tel"/></label>
        <label>সম্পূর্ণ ঠিকানা<textarea required minLength={8} value={form.address} onChange={e=>update('address',e.target.value)} placeholder="বাসা/রোড, এলাকা, জেলা" rows={3}/></label>
        <label>ডেলিভারি এলাকা<select value={form.deliveryZone} onChange={e=>update('deliveryZone',e.target.value)}><option value="dhaka">ঢাকার ভিতরে</option><option value="outside">ঢাকার বাইরে</option></select></label>
        <label>অতিরিক্ত নির্দেশনা (ঐচ্ছিক)<textarea value={form.note} onChange={e=>update('note',e.target.value)} rows={2} placeholder="বিশেষ কোনো নির্দেশনা থাকলে লিখুন"/></label>
        {quote.isLoading&&<p className="secure-note">সার্ভারে পণ্যের দাম ও স্টক যাচাই হচ্ছে...</p>}
        {quote.isError&&<p className="form-error">{errorMessage(quote.error)}</p>}
        {error&&<p className="form-error">{error}</p>}
        <button className="btn btn-dark full" disabled={mutation.isPending||quote.isLoading||!quote.data||quote.isError||items.length===0}>{mutation.isPending?'অর্ডার পাঠানো হচ্ছে...':'ক্যাশ অন ডেলিভারিতে অর্ডার করুন'}</button>
        <p className="secure-note">আপনার তথ্য শুধুমাত্র অর্ডার সম্পন্ন করার জন্য ব্যবহার করা হবে।</p>
      </form>
      <aside className="summary-card">
        <h2>আপনার অর্ডার</h2>
        {quote.data?.items.map((i,index)=><div className="checkout-line" key={`${i.productId}-${i.variantId||index}`}><span>{i.name} {i.variantLabel} × {i.quantity}</span><b>{money(i.lineTotal)}</b></div>)}
        {!quote.data&&!quote.isError&&<p>সার্ভার থেকে মূল্য যাচাই করা হচ্ছে...</p>}
        <hr/>
        <div><span>সাবটোটাল</span><b>{money(quote.data?.subtotal??subtotal)}</b></div>
        <div><span>ডেলিভারি চার্জ</span><b>{quote.data?money(quote.data.deliveryCharge):'—'}</b></div>
        <div className="summary-total"><span>সর্বমোট</span><strong>{quote.data?money(quote.data.total):'—'}</strong></div>
        <span className="cod-note">ক্যাশ অন ডেলিভারি · পণ্য হাতে পেয়ে মূল্য পরিশোধ করুন</span>
        <Link to="/cart" className="continue-link">ব্যাগ পরিবর্তন করুন</Link>
      </aside>
    </div>
  </section>;
}
