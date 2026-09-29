export const ROLES = [
  'SUPER_ADMIN',
  'ADMIN',
  'FARMER',
  'FPO_ADMIN',
  'BUYER',
  'TRADER',
  'RETAILER',
  'RESTAURANT',
  'TRANSPORTER',
  'MARKET_MANAGER',
] as const;

export type Role = (typeof ROLES)[number];

export const SELF_REGISTER_ROLES = [
  'FARMER',
  'BUYER',
  'TRADER',
  'RETAILER',
  'RESTAURANT',
  'TRANSPORTER',
] as const;

export type SelfRegisterRole = (typeof SELF_REGISTER_ROLES)[number];

export const BUYER_ROLES: readonly Role[] = ['BUYER', 'TRADER', 'RETAILER', 'RESTAURANT'];
export const FARMER_ROLES: readonly Role[] = ['FARMER', 'FPO_ADMIN'];
export const ADMIN_ROLES: readonly Role[] = ['SUPER_ADMIN', 'ADMIN'];
export const STAFF_ROLES: readonly Role[] = ['SUPER_ADMIN', 'ADMIN', 'MARKET_MANAGER', 'FPO_ADMIN'];

export const VERIFICATION_STATUSES = ['PENDING', 'VERIFIED', 'REJECTED'] as const;
export type VerificationStatus = (typeof VERIFICATION_STATUSES)[number];

export const BUSINESS_TYPES = [
  'WHOLESALER',
  'TRADER',
  'RETAILER',
  'RESTAURANT',
  'HOTEL',
  'PROCESSOR',
] as const;
export type BusinessType = (typeof BUSINESS_TYPES)[number];

export const MARKET_TYPES = [
  'MANDI',
  'KRISHAK_BAZAR',
  'WHOLESALE_MARKET',
  'RETAIL_MARKET',
  'COLLECTION_CENTER',
] as const;
export type MarketType = (typeof MARKET_TYPES)[number];

export const LISTING_STATUSES = [
  'DRAFT',
  'ACTIVE',
  'PARTIALLY_SOLD',
  'SOLD',
  'EXPIRED',
  'CANCELLED',
] as const;
export type ListingStatus = (typeof LISTING_STATUSES)[number];

export const LIVE_LISTING_STATUSES: readonly ListingStatus[] = ['ACTIVE', 'PARTIALLY_SOLD'];

export const OFFER_STATUSES = [
  'PENDING',
  'ACCEPTED',
  'REJECTED',
  'COUNTERED',
  'EXPIRED',
  'CANCELLED',
] as const;
export type OfferStatus = (typeof OFFER_STATUSES)[number];

export const OPEN_OFFER_STATUSES: readonly OfferStatus[] = ['PENDING', 'COUNTERED'];

export const ORDER_STATUSES = [
  'PENDING',
  'CONFIRMED',
  'READY_FOR_PICKUP',
  'PICKED_UP',
  'IN_TRANSIT',
  'DELIVERED',
  'COMPLETED',
  'CANCELLED',
  'DISPUTED',
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const ORDER_PAYMENT_STATUSES = [
  'UNPAID',
  'PENDING',
  'PARTIALLY_PAID',
  'PAID',
  'REFUNDED',
  'FAILED',
] as const;
export type OrderPaymentStatus = (typeof ORDER_PAYMENT_STATUSES)[number];

export const PAYMENT_STATUSES = [
  'PENDING',
  'AUTHORIZED',
  'SUCCESS',
  'FAILED',
  'REFUNDED',
  'PARTIAL_REFUND',
] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const PAYMENT_METHODS = ['CASH', 'UPI', 'BANK_TRANSFER', 'RAZORPAY'] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const PAYMENT_PROVIDERS = ['CASH', 'MANUAL', 'RAZORPAY', 'MOCK'] as const;
export type PaymentProviderName = (typeof PAYMENT_PROVIDERS)[number];

export const UNITS = ['KG', 'QUINTAL', 'TONNE', 'PIECE', 'BUNDLE', 'CRATE'] as const;
export type Unit = (typeof UNITS)[number];

export const QUALITY_GRADES = ['A', 'B', 'C'] as const;
export type QualityGrade = (typeof QUALITY_GRADES)[number];

export const FARMING_TYPES = ['ORGANIC', 'CONVENTIONAL', 'MIXED', 'NATURAL'] as const;
export type FarmingType = (typeof FARMING_TYPES)[number];

export const FARM_SIZE_UNITS = ['ACRE', 'BIGHA', 'HECTARE', 'DECIMAL'] as const;
export type FarmSizeUnit = (typeof FARM_SIZE_UNITS)[number];

export const REQUIREMENT_STATUSES = ['OPEN', 'FULFILLED', 'EXPIRED', 'CANCELLED'] as const;
export type RequirementStatus = (typeof REQUIREMENT_STATUSES)[number];

export const DELIVERY_STATUSES = [
  'REQUESTED',
  'ASSIGNED',
  'PICKED_UP',
  'IN_TRANSIT',
  'DELIVERED',
  'CANCELLED',
] as const;
export type DeliveryStatus = (typeof DELIVERY_STATUSES)[number];

export const VEHICLE_TYPES = ['PICKUP', 'MINI_TRUCK', 'TRUCK', 'THREE_WHEELER', 'TRACTOR'] as const;
export type VehicleType = (typeof VEHICLE_TYPES)[number];

export const NOTIFICATION_CHANNELS = ['IN_APP', 'SMS', 'EMAIL', 'WHATSAPP', 'PUSH'] as const;
export type NotificationChannelName = (typeof NOTIFICATION_CHANNELS)[number];

export const NOTIFICATION_EVENTS = [
  'NEW_OFFER',
  'OFFER_ACCEPTED',
  'OFFER_REJECTED',
  'NEW_ORDER',
  'ORDER_CONFIRMED',
  'ORDER_CANCELLED',
  'PAYMENT_SUCCESS',
  'PAYMENT_FAILED',
  'PICKUP_ASSIGNED',
  'DELIVERY_STARTED',
  'DELIVERY_COMPLETED',
] as const;
export type NotificationEventName = (typeof NOTIFICATION_EVENTS)[number];

export const DISPUTE_STATUSES = ['OPEN', 'UNDER_REVIEW', 'RESOLVED', 'REJECTED'] as const;
export type DisputeStatus = (typeof DISPUTE_STATUSES)[number];

export const DOCUMENT_TYPES = [
  'AADHAAR',
  'PAN',
  'GST',
  'FPO_REGISTRATION',
  'BANK_PROOF',
  'BUSINESS_DOCUMENT',
  'OTHER',
] as const;
export type DocumentType = (typeof DOCUMENT_TYPES)[number];

export const MESSAGE_TYPES = ['TEXT', 'IMAGE', 'SYSTEM'] as const;
export type MessageType = (typeof MESSAGE_TYPES)[number];

export const AUDIT_ACTIONS = [
  'LOGIN',
  'CREATE_LISTING',
  'UPDATE_LISTING',
  'CREATE_OFFER',
  'ACCEPT_OFFER',
  'CREATE_ORDER',
  'PAYMENT',
  'ORDER_STATUS_CHANGE',
  'USER_BLOCKED',
  'USER_VERIFIED',
] as const;
export type AuditAction = (typeof AUDIT_ACTIONS)[number];

export const CROP_CATEGORIES = ['VEGETABLE', 'LEAFY', 'ROOT', 'GOURD', 'SPICE'] as const;
export type CropCategory = (typeof CROP_CATEGORIES)[number];

export const SEASONS = ['RABI', 'KHARIF', 'ZAID', 'YEAR_ROUND'] as const;
export type Season = (typeof SEASONS)[number];

export const WEEKDAYS = [
  'MONDAY',
  'TUESDAY',
  'WEDNESDAY',
  'THURSDAY',
  'FRIDAY',
  'SATURDAY',
  'SUNDAY',
] as const;
export type Weekday = (typeof WEEKDAYS)[number];

export const OTP_PURPOSES = ['PHONE_VERIFY', 'EMAIL_VERIFY', 'PASSWORD_RESET'] as const;
export type OtpPurpose = (typeof OTP_PURPOSES)[number];

export const PRICE_SOURCES = ['MANUAL', 'INTERNAL_ORDERS', 'AGMARKNET'] as const;
export type PriceSource = (typeof PRICE_SOURCES)[number];

export const MAX_PAGE_LIMIT = 100;
export const DEFAULT_PAGE_LIMIT = 20;
export const PAISE_PER_RUPEE = 100;
export const OTP_TTL_MS = 10 * 60 * 1000;
export const DEFAULT_OFFER_TTL_MS = 24 * 60 * 60 * 1000;
export const MAX_NEARBY_RADIUS_METERS = 200_000;
export const DEFAULT_NEARBY_RADIUS_METERS = 20_000;
