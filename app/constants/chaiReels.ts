export interface ChaiReel {
  id: string;
  title: string;
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
  productImageUrl: string;
  accentColor: string;
  badgeText: string;
}

export const CHAI_REELS: ChaiReel[] = [
  {
    id: 'misty-assam-harvest',
    title: 'Misty Assam Dawn Harvest',
    tagline: 'Two leaves & a bud plucked in early sunrise mist',
    description: 'Experience the tranquil stillness of pristine Upper Assam tea gardens. Hand-plucked tender green leaves retaining maximum antioxidant polyphenols.',
    durationSeconds: 10,
    durationLabel: '0:10',
    videoUrl: '/uploads/videos/misty_assam_estate.mp4',
    posterUrl: 'https://images.unsplash.com/photo-1544787219-7f47ccb76574?w=800&q=80',
    estateProvenance: 'Dibrugarh Upper Estate, Assam',
    elevation: '2,200 ft above sea level',
    aromaNotes: ['Fresh Dew', 'Malty Aroma', 'Crisp Forest Leaf'],
    asmrType: 'nature',
    asmrDescription: '🎧 Gentle estate morning breeze & leaf plucking',
    productId: 1,
    productName: 'Vardhamrit Normal Chai (Classic Kadak)',
    productPrice: 279,
    productWeight: '500 g',
    productImageUrl: 'https://images.unsplash.com/photo-1576092768241-dec231879fc3?w=800&q=80',
    accentColor: '#10B981',
    badgeText: 'ESTATE HARVEST',
  },
  {
    id: 'water-boiling-infusion',
    title: 'Simmering CTC & Spices Infusion',
    tagline: 'Rolling boil unlocking golden amber liquor',
    description: 'Watch mountain spring water hit rolling boil. The moment high-grown CTC tea granules bloom and release rich copper hue with fragrant crushed cardamom.',
    durationSeconds: 10,
    durationLabel: '0:10',
    videoUrl: '/uploads/videos/water_boiling_asmr.mp4',
    posterUrl: 'https://images.unsplash.com/photo-1576092768241-dec231879fc3?w=800&q=80',
    estateProvenance: 'Jorhat Heritage Gardens',
    elevation: '1,800 ft',
    aromaNotes: ['Warm Clove', 'Green Elaichi', 'Robust CTC Malt'],
    asmrType: 'boiling',
    asmrDescription: '🎧 Rhythmic water boiling & bubbling spice pop',
    productId: 2,
    productName: 'Vardhamrit Grand Masala Chai',
    productPrice: 199,
    productWeight: '250 g',
    productImageUrl: 'https://images.unsplash.com/photo-1563822249548-9a72b6353cd1?w=800&q=80',
    accentColor: '#F59E0B',
    badgeText: 'CTC INFUSION',
  },
  {
    id: 'velvety-milk-swirl',
    title: 'Velvety Milk Pour & Saffron Swirl',
    tagline: 'Rich full-cream milk cascading into amber liquor',
    description: 'The hypnotic swirl as fresh warm milk folds into boiling CTC tea liquor, blooming into a creamy golden caramel elixir crowned with Kashmiri saffron strands.',
    durationSeconds: 10,
    durationLabel: '0:10',
    videoUrl: '/uploads/videos/milk_swirl_asmr.mp4',
    posterUrl: 'https://images.unsplash.com/photo-1597481499750-3e6b22637e12?w=800&q=80',
    estateProvenance: 'Pampore Highlands & Assam Foothills',
    elevation: '5,300 ft',
    aromaNotes: ['Kashmiri Mogra Saffron', 'Velvet Cream', 'Sweet Almond'],
    asmrType: 'milk_pour',
    asmrDescription: '🎧 Silky stream pour & smooth caramel swirl',
    productId: 3,
    productName: 'Vardhamrit Royal Keser Saffron Chai',
    productPrice: 349,
    productWeight: '250 g Tin',
    productImageUrl: 'https://images.unsplash.com/photo-1597481499750-3e6b22637e12?w=800&q=80',
    accentColor: '#D97706',
    badgeText: 'MILK POUR',
  },
  {
    id: 'steaming-kulhad-pour',
    title: 'Earthy Kulhad Chai Strain & Pour',
    tagline: 'Aerated double-pour into clay earthen cups',
    description: 'Listen to the soothing stream of freshly strained hot masala chai tumbling into raw baked terracotta kulhads, releasing that irreplaceable earthy petrichor aroma.',
    durationSeconds: 10,
    durationLabel: '0:10',
    videoUrl: '/uploads/videos/steaming_chai_kulhad.mp4',
    posterUrl: 'https://images.unsplash.com/photo-1563822249548-9a72b6353cd1?w=800&q=80',
    estateProvenance: 'Traditional Terracotta Kulhad Ritual',
    elevation: 'Artisan Crafted',
    aromaNotes: ['Baked Wet Earth (Sondhi Khushboo)', 'Ginger Zing', 'Caramelized Malt'],
    asmrType: 'pouring',
    asmrDescription: '🎧 Straining stream splash & clay cup warmth',
    productId: 2,
    productName: 'Vardhamrit Grand Masala Chai',
    productPrice: 199,
    productWeight: '250 g',
    productImageUrl: 'https://images.unsplash.com/photo-1563822249548-9a72b6353cd1?w=800&q=80',
    accentColor: '#B45309',
    badgeText: 'KULHAD POUR',
  },
];
