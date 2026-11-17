import React from 'react';
import {
  Zap,
  ShoppingBag,
  Search,
  ArrowLeft,
  ArrowRight,
  Plus,
  Minus,
  Star,
  Truck,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  MapPin,
  Phone,
  PhoneCall,
  User,
  ShieldCheck,
  Trash2,
  Tag,
  Clock,
  Sparkles,
  Package,
  PackageCheck,
  MessageSquare,
  CreditCard,
  Landmark,
  Banknote,
  Lock,
  Coffee,
  Leaf,
  Gift,
  Flame,
  Layers,
  Heart,
  Store,
  Grid,
  RefreshCw,
  X,
  SlidersHorizontal,
  ChevronUp,
  TrendingUp,
  Crown,
  PartyPopper,
  TriangleAlert,
  Ticket,
  Home,
  Building,
  FileText,
  Bike,
  Mountain,
  Sprout,
  BadgeCheck,
  Receipt,
  Eye,
  EyeOff,
  Share2,
  CircleHelp,
  Activity,
  Copy,
  Bell,
  BellRing,
  QrCode,
  ScanQrCode,
  Coins,
  LucideProps,
} from 'lucide-react-native';
import { theme } from '../../theme';
import { useResponsive } from '../../utils/responsive';

export type IconName =
  | 'zap'
  | 'shopping-bag'
  | 'search'
  | 'arrow-left'
  | 'arrow-right'
  | 'plus'
  | 'minus'
  | 'star'
  | 'truck'
  | 'check'
  | 'chevron-down'
  | 'chevron-up'
  | 'chevron-left'
  | 'chevron-right'
  | 'sliders'
  | 'trending-up'
  | 'x'
  | 'map-pin'
  | 'phone'
  | 'phone-call'
  | 'user'
  | 'shield-check'
  | 'trash'
  | 'tag'
  | 'clock'
  | 'sparkles'
  | 'package'
  | 'package-check'
  | 'message-square'
  | 'credit-card'
  | 'landmark'
  | 'banknote'
  | 'lock'
  | 'coffee'
  | 'leaf'
  | 'gift'
  | 'flame'
  | 'layers'
  | 'heart'
  | 'store'
  | 'grid'
  | 'refresh'
  | 'close'
  | 'crown'
  | 'party-popper'
  | 'alert-triangle'
  | 'ticket'
  | 'home'
  | 'building'
  | 'file-text'
  | 'bike'
  | 'mountain'
  | 'sprout'
  | 'badge-check'
  | 'receipt'
  | 'eye'
  | 'eye-off'
  | 'share'
  | 'help-circle'
  | 'activity'
  | 'bell'
  | 'bell-ring'
  | 'qr-code'
  | 'scan-qr'
  | 'coins'
  | 'coin'
  | 'copy';

interface IconProps extends Omit<LucideProps, 'ref'> {
  name: IconName;
  size?: number;
  color?: string;
  fill?: string;
  strokeWidth?: number;
}

export const Icon: React.FC<IconProps> = ({
  name,
  size = 20,
  color = theme.colors.textPrimary,
  fill,
  strokeWidth = 2,
  ...props
}) => {
  const { isTablet } = useResponsive();
  const scaledSize = isTablet ? Math.round(size * 1.2) : size;

  const commonProps = {
    size: scaledSize,
    color,
    strokeWidth,
    ...(fill ? { fill } : {}),
    ...props,
  };

  switch (name) {
    case 'zap':
      return <Zap {...commonProps} />;
    case 'shopping-bag':
      return <ShoppingBag {...commonProps} />;
    case 'search':
      return <Search {...commonProps} />;
    case 'arrow-left':
      return <ArrowLeft {...commonProps} />;
    case 'arrow-right':
      return <ArrowRight {...commonProps} />;
    case 'plus':
      return <Plus {...commonProps} />;
    case 'minus':
      return <Minus {...commonProps} />;
    case 'star':
      return <Star {...commonProps} fill={fill || color} />;
    case 'truck':
      return <Truck {...commonProps} />;
    case 'check':
      return <Check {...commonProps} />;
    case 'chevron-down':
      return <ChevronDown {...commonProps} />;
    case 'chevron-up':
      return <ChevronUp {...commonProps} />;
    case 'chevron-left':
      return <ChevronLeft {...commonProps} />;
    case 'chevron-right':
      return <ChevronRight {...commonProps} />;
    case 'sliders':
      return <SlidersHorizontal {...commonProps} />;
    case 'trending-up':
      return <TrendingUp {...commonProps} />;
    case 'map-pin':
      return <MapPin {...commonProps} />;
    case 'phone':
      return <Phone {...commonProps} />;
    case 'phone-call':
      return <PhoneCall {...commonProps} />;
    case 'user':
      return <User {...commonProps} />;
    case 'shield-check':
      return <ShieldCheck {...commonProps} />;
    case 'trash':
      return <Trash2 {...commonProps} />;
    case 'tag':
      return <Tag {...commonProps} />;
    case 'clock':
      return <Clock {...commonProps} />;
    case 'sparkles':
      return <Sparkles {...commonProps} />;
    case 'package':
      return <Package {...commonProps} />;
    case 'package-check':
      return <PackageCheck {...commonProps} />;
    case 'message-square':
      return <MessageSquare {...commonProps} />;
    case 'credit-card':
      return <CreditCard {...commonProps} />;
    case 'landmark':
      return <Landmark {...commonProps} />;
    case 'banknote':
      return <Banknote {...commonProps} />;
    case 'lock':
      return <Lock {...commonProps} />;
    case 'coffee':
      return <Coffee {...commonProps} />;
    case 'leaf':
      return <Leaf {...commonProps} />;
    case 'gift':
      return <Gift {...commonProps} />;
    case 'flame':
      return <Flame {...commonProps} />;
    case 'layers':
      return <Layers {...commonProps} />;
    case 'heart':
      return <Heart {...commonProps} />;
    case 'store':
      return <Store {...commonProps} />;
    case 'grid':
      return <Grid {...commonProps} />;
    case 'refresh':
      return <RefreshCw {...commonProps} />;
    case 'close':
    case 'x':
      return <X {...commonProps} />;
    case 'crown':
      return <Crown {...commonProps} />;
    case 'party-popper':
      return <PartyPopper {...commonProps} />;
    case 'alert-triangle':
      return <TriangleAlert {...commonProps} />;
    case 'ticket':
      return <Ticket {...commonProps} />;
    case 'home':
      return <Home {...commonProps} />;
    case 'building':
      return <Building {...commonProps} />;
    case 'file-text':
      return <FileText {...commonProps} />;
    case 'bike':
      return <Bike {...commonProps} />;
    case 'mountain':
      return <Mountain {...commonProps} />;
    case 'sprout':
      return <Sprout {...commonProps} />;
    case 'badge-check':
      return <BadgeCheck {...commonProps} />;
    case 'receipt':
      return <Receipt {...commonProps} />;
    case 'eye':
      return <Eye {...commonProps} />;
    case 'eye-off':
      return <EyeOff {...commonProps} />;
    case 'share':
      return <Share2 {...commonProps} />;
    case 'help-circle':
      return <CircleHelp {...commonProps} />;
    case 'activity':
      return <Activity {...commonProps} />;
    case 'copy':
      return <Copy {...commonProps} />;
    case 'bell':
      return <Bell {...commonProps} />;
    case 'bell-ring':
      return <BellRing {...commonProps} />;
    case 'qr-code':
      return <QrCode {...commonProps} />;
    case 'scan-qr':
      return <ScanQrCode {...commonProps} />;
    case 'coins':
    case 'coin':
      return <Coins {...commonProps} />;
    default:
      return <Coffee {...commonProps} />;
  }
};

export default Icon;
