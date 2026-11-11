type PixelParams=Record<string,string|number|string[]>;
type PixelFunction=((command:string,event:string,params?:PixelParams)=>void)&{queue?:unknown[][];loaded?:boolean;version?:string;push?:(args:unknown[])=>number};
declare global { interface Window { fbq?: PixelFunction; _fbq?: PixelFunction } }
let initialized=false;
export function initPixel(){
  const id=import.meta.env.VITE_META_PIXEL_ID as string|undefined;
  if(!id||initialized)return;
  initialized=true;
  const queue:unknown[][]=[];
  const stub=((command:string,event:string,params?:PixelParams)=>{queue.push([command,event,params]);}) as PixelFunction;
  stub.queue=queue;stub.loaded=true;stub.version='2.0';stub.push=args=>queue.push(args);
  window.fbq=stub;window._fbq=stub;
  const script=document.createElement('script');script.async=true;script.src='https://connect.facebook.net/en_US/fbevents.js';document.head.appendChild(script);
  window.fbq('init',id);window.fbq('track','PageView');
}
export function track(event:string,params?:PixelParams){if(import.meta.env.VITE_META_PIXEL_ID&&window.fbq)window.fbq('track',event,params);}
