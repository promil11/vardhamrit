import React from 'react';
import Svg, { Path } from 'react-native-svg';
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
  Edit2,
  Pencil,
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
  Mail,
  Camera,
  UploadCloud,
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
  | 'edit'
  | 'edit-2'
  | 'pencil'
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
  | 'copy'
  | 'mail'
  | 'camera'
  | 'upload-cloud'
  | 'trash-2'
  | 'whatsapp';

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
    case 'trash-2':
      return <Trash2 {...commonProps} />;
    case 'camera':
      return <Camera {...commonProps} />;
    case 'upload-cloud':
      return <UploadCloud {...commonProps} />;
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
    case 'edit':
    case 'edit-2':
      return <Edit2 {...commonProps} />;
    case 'pencil':
      return <Pencil {...commonProps} />;
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
    case 'mail':
      return <Mail {...commonProps} />;
    case 'whatsapp':
      return (
        <Svg width={scaledSize} height={scaledSize} viewBox="0 0 24 24" fill="none">
          <Path
            fill={fill || color}
            d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.89 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L0 24l6.335-1.662c1.746.953 3.71 1.456 5.711 1.457h.005c6.554 0 11.89-5.335 11.893-11.893a11.82 11.82 0 00-3.48-8.413z"
          />
        </Svg>
      );
    default:
      return <Coffee {...commonProps} />;
  }
};

export default Icon;
