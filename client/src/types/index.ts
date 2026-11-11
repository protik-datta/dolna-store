export interface Image {url:string;publicId:string;width?:number;height?:number}
export interface Variant {_id:string;label:string;sku?:string;price?:number;stock:number}
export interface Product {_id:string;name:string;slug:string;collection:string;shortDescription?:string;description?:string;price:number;compareAtPrice?:number;images:Image[];variants:Variant[];stock:number;features:string[];specs:{label:string;value:string}[];isPublished:boolean;isFeatured:boolean}
export interface Testimonial {_id:string;name:string;location?:string;text:string;rating:number}
export interface Order {orderNumber:string;items:{product:string;name:string;variantLabel?:string;image?:string;quantity:number;unitPrice:number;lineTotal:number}[];customer:{name:string;phone:string;address:string};subtotal:number;deliveryCharge:number;total:number;status:string;deliveryZone:string;paymentMethod?:'manual'|'cod'}
export interface CartItem {product:Product;variantId?:string;quantity:number}
