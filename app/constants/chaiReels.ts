export interface ChaiReel {
  id: string;
  title: string;
  flavor: string;
  flavorDetail: string;
  tagline: string;
  description: string;
  durationSeconds: number;
  durationLabel: string;
  videoUrl: string;
  posterUrl: string;
  estateProvenance: string;
  elevation: string;
  aromaNotes: string[];
  asmrType: 'nature' | 'boiling' | 'milk_pour' | 'pouring';
  asmrDescription: string;
  productId: number;
  productName: string;
  productPrice: number;
  productWeight: string;
  productPrice1Kg: number;
  productMrp1Kg: number;
  productWeight1Kg: string;
  productImageUrl: string;
  accentColor: string;
  badgeText: string;
}

export const CHAI_REELS: ChaiReel[] = [
  {
    id: 'normal-chai-harvest',
    title: 'Normal Chai',
    flavor: 'Normal Chai',
    flavorDetail: 'Classic Upper Assam Kadak',
    tagline: 'Classic Upper Assam Kadak Brew',
    description: 'Pure single-origin strong Assam CTC tea. Deep amber liquor with an invigorating malty character, crafted for authentic Indian mornings.',
    durationSeconds: 10,
    durationLabel: '0:10',
    videoUrl: '/uploads/videos/vardhamrit_brand_reel.mp4',
    posterUrl: '/uploads/categories/normal_chai.jpg',
    estateProvenance: 'Upper Assam Heritage Estates',
    elevation: '2,200 ft above sea level',
    aromaNotes: ['Robust Malt', 'Strong Kadak Body', 'Single Origin Leaf'],
    asmrType: 'nature',
    asmrDescription: 'Garden leaf plucking & brisk morning kadak brew',
    productId: 1,
    productName: 'Vardhamrit Normal Chai (Classic Kadak)',
    productPrice: 149,
    productWeight: '200 g',
    productPrice1Kg: 519,
    productMrp1Kg: 650,
    productWeight1Kg: '1 kg',
    productImageUrl: '/uploads/products/classic_200g.png',
    accentColor: '#16A34A',
    badgeText: 'NORMAL CHAI',
  },
  {
    id: 'masala-chai-infusion',
    title: 'Masala Chai',
    flavor: 'Masala Chai',
    flavorDetail: 'Royal 7-Spice Kadha Blend',
    tagline: 'Hand-Pounded Cloves, Cinnamon & Elaichi',
    description: 'Infused with whole green cardamom pods, cinnamon, cloves, black pepper, and dry ginger blooming into boiling water for comforting spiced warmth.',
    durationSeconds: 10,
    durationLabel: '0:10',
    videoUrl: '/uploads/videos/vardhamrit_brand_reel.mp4',
    posterUrl: '/uploads/categories/masala_chai.jpg',
    estateProvenance: 'Jorhat Spiced Tea Gardens',
    elevation: '1,800 ft',
    aromaNotes: ['Green Cardamom', 'Ceylon Cinnamon', 'Crushed Clove'],
    asmrType: 'boiling',
    asmrDescription: 'Rolling boil & bubbling spices infusion',
    productId: 2,
    productName: 'Vardhamrit Grand Masala Chai',
    productPrice: 169,
    productWeight: '200 g',
    productPrice1Kg: 699,
    productMrp1Kg: 950,
    productWeight1Kg: '1 kg',
    productImageUrl: '/uploads/products/masala_200g.png',
    accentColor: '#D97706',
    badgeText: 'MASALA CHAI',
  },
  {
    id: 'keser-chai-swirl',
    title: 'Keser Chai',
    flavor: 'Keser Chai',
    flavorDetail: 'Kashmiri Saffron & Almond Swirl',
    tagline: 'Pure Kashmiri Mogra Saffron & Roasted Almonds',
    description: 'Rich warm milk poured into aromatic black tea, infused with pure Kashmiri Mogra saffron threads and delicate roasted almond flakes.',
    durationSeconds: 10,
    durationLabel: '0:10',
    videoUrl: '/uploads/videos/vardhamrit_brand_reel.mp4',
    posterUrl: '/uploads/categories/kesar_chai.jpg',
    estateProvenance: 'Pampore Valley & Assam Foothills',
    elevation: '5,300 ft',
    aromaNotes: ['Kashmiri Saffron', 'Roasted Almond', 'Golden Caramel'],
    asmrType: 'milk_pour',
    asmrDescription: 'Velvety milk pour & saffron swirl',
    productId: 3,
    productName: 'Vardhamrit Royal Keser Saffron Chai',
    productPrice: 219,
    productWeight: '200 g',
    productPrice1Kg: 1199,
    productMrp1Kg: 1550,
    productWeight1Kg: '1 kg',
    productImageUrl: '/uploads/products/kesar_200g.png',
    accentColor: '#B45309',
    badgeText: 'KESER CHAI',
  },
  {
    id: 'chocolate-chai-ritual',
    title: 'Chocolate Chai',
    flavor: 'Chocolate Chai',
    flavorDetail: 'Dark Cocoa Nibs & Velvet Brew',
    tagline: 'Dutch Dark Cocoa Nibs & Assam Granules',
    description: 'Decadent dark cocoa nibs gently infused with bold Assam CTC black tea and sweet cinnamon for a luxurious dessert tea ritual.',
    durationSeconds: 10,
    durationLabel: '0:10',
    videoUrl: '/uploads/videos/vardhamrit_brand_reel.mp4',
    posterUrl: '/uploads/categories/chocolate_chai.jpg',
    estateProvenance: 'Artisan Cocoa & Tea Craft',
    elevation: 'Single Estate Blend',
    aromaNotes: ['Dark Dutch Cacao', 'Malty Cocoa Nibs', 'Sweet Cinnamon'],
    asmrType: 'pouring',
    asmrDescription: 'Steaming chocolate chai pour & royal sip',
    productId: 4,
    productName: 'Vardhamrit Artisan Chocolate Chai',
    productPrice: 189,
    productWeight: '200 g',
    productPrice1Kg: 799,
    productMrp1Kg: 1050,
    productWeight1Kg: '1 kg',
    productImageUrl: '/uploads/products/chocolate_200g.png',
    accentColor: '#78350F',
    badgeText: 'CHOCOLATE CHAI',
  },
];

/**
 * Resolves a matching Chai Reel for ANY product in the catalog.
 * Guarantees every single product has an associated brand story reel!
 */
export function getReelForProduct(product?: {
  id: number | string;
  name?: string;
  slug?: string;
  category?: any;
} | null): ChaiReel {
  if (!product) return CHAI_REELS[0];

  const name = (product.name || '').toLowerCase();
  const slug = (product.slug || '').toLowerCase();
  const categorySlug =
    typeof product.category === 'string'
      ? product.category.toLowerCase()
      : (product.category?.slug || '').toLowerCase();

  // 1. Keser / Saffron blends
  if (
    name.includes('kesar') ||
    name.includes('keser') ||
    slug.includes('kesar') ||
    slug.includes('keser') ||
    categorySlug.includes('keser') ||
    categorySlug.includes('kesar')
  ) {
    return CHAI_REELS[2];
  }

  // 2. Masala / Spiced / Kadha blends
  if (
    name.includes('masala') ||
    name.includes('kadha') ||
    name.includes('spiced') ||
    slug.includes('masala') ||
    categorySlug.includes('masala')
  ) {
    return CHAI_REELS[1];
  }

  // 3. Chocolate / Cocoa blends
  if (
    name.includes('chocolate') ||
    name.includes('cocoa') ||
    name.includes('cacao') ||
    slug.includes('chocolate') ||
    categorySlug.includes('chocolate')
  ) {
    return CHAI_REELS[3];
  }

  // 4. Normal / Kadak / Classic Assam blends
  if (
    name.includes('normal') ||
    name.includes('kadak') ||
    name.includes('classic') ||
    slug.includes('normal') ||
    slug.includes('kadak') ||
    categorySlug.includes('normal')
  ) {
    return CHAI_REELS[0];
  }

  // 5. Check direct ID matching
  const directMatch = CHAI_REELS.find((r) => r.productId === Number(product.id));
  if (directMatch) return directMatch;

  // 6. Universal fallback: default to the first reel (Normal Chai)
  return CHAI_REELS[0];
}
