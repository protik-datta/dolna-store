import React,{lazy,Suspense} from 'react';
import ReactDOM from 'react-dom/client';
import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import {BrowserRouter,Route,Routes} from 'react-router-dom';
import {HelmetProvider} from 'react-helmet-async';
import {CartProvider} from './context/CartContext';
import {Layout} from './components/Layout';
import './style.css';
const Home=lazy(()=>import('./pages/Home'));
const Shop=lazy(()=>import('./pages/Shop'));
const ProductPage=lazy(()=>import('./pages/Product'));
const Cart=lazy(()=>import('./pages/Cart'));
const Checkout=lazy(()=>import('./pages/Checkout'));
const OrderPage=lazy(()=>import('./pages/Order'));
const NotFound=lazy(()=>import('./pages/NotFound'));
const client=new QueryClient({defaultOptions:{queries:{staleTime:30000,retry:1,refetchOnWindowFocus:false}}});
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <HelmetProvider>
      <QueryClientProvider client={client}>
        <CartProvider>
          <BrowserRouter future={{v7_startTransition:true,v7_relativeSplatPath:true}}>
            <Suspense fallback={<div className="container section">লোড হচ্ছে...</div>}>
              <Routes>
                <Route element={<Layout/>}>
                  <Route path="/" element={<Home/>}/>
                  <Route path="/shop" element={<Shop/>}/>
                  <Route path="/product/:slug" element={<ProductPage/>}/>
                  <Route path="/cart" element={<Cart/>}/>
                  <Route path="/checkout" element={<Checkout/>}/>
                  <Route path="/order/:orderNumber" element={<OrderPage/>}/>
                  <Route path="*" element={<NotFound/>}/>
                </Route>
              </Routes>
            </Suspense>
          </BrowserRouter>
        </CartProvider>
      </QueryClientProvider>
    </HelmetProvider>
  </React.StrictMode>
);
