export const getTeaImage = (nameOrImage?: string): string => {
  if (!nameOrImage) return '/images/tea/classic_200g.png';
  
  // If it's already a full URL or absolute path
  if (nameOrImage.startsWith('http://') || nameOrImage.startsWith('https://')) {
    return nameOrImage;
  }
  if (nameOrImage.startsWith('/uploads/')) {
    return `http://localhost:5000${nameOrImage}`;
  }
  if (nameOrImage.startsWith('/images/')) {
    return nameOrImage;
  }

  const lower = nameOrImage.toLowerCase();
  if (lower.includes('masala') || lower.includes('kadak')) {
    return '/images/tea/masala_200g.png';
  }
  if (lower.includes('kesar') || lower.includes('saffron') || lower.includes('royal')) {
    return '/images/tea/kesar_200g.png';
  }
  if (lower.includes('chocolate') || lower.includes('cocoa')) {
    return '/images/tea/chocolate_200g.png';
  }
  return '/images/tea/classic_200g.png';
};

export const getFlavourColor = (name?: string): { bg: string; text: string; border: string; badge: string } => {
  const lower = (name || '').toLowerCase();
  if (lower.includes('masala')) {
    return {
      bg: 'bg-amber-50',
      text: 'text-amber-800',
      border: 'border-amber-200',
      badge: 'bg-gradient-to-r from-amber-500 to-amber-600 text-white',
    };
  }
  if (lower.includes('kesar')) {
    return {
      bg: 'bg-yellow-50',
      text: 'text-yellow-800',
      border: 'border-yellow-200',
      badge: 'bg-gradient-to-r from-yellow-500 to-amber-500 text-white',
    };
  }
  if (lower.includes('chocolate')) {
    return {
      bg: 'bg-stone-50',
      text: 'text-stone-800',
      border: 'border-stone-200',
      badge: 'bg-gradient-to-r from-stone-600 to-stone-800 text-white',
    };
  }
  return {
    bg: 'bg-emerald-50',
    text: 'text-emerald-800',
    border: 'border-emerald-200',
    badge: 'bg-gradient-to-r from-emerald-600 to-emerald-700 text-white',
  };
};
