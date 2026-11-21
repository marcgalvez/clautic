export interface ShopItem { id: string; key: string; name: string; slot: string; description: string; price: number; min_level: number; exclusive: boolean; color: string; owned: boolean }
export interface Catalog { coins: number; level: number; items: ShopItem[] }
