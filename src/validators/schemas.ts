import '../openapi/setup';
import { z } from '../openapi/setup';
import { PaginationMetaSchema } from '../docs/swagger/registerRoute';

export const objectIdSchema = z
  .string()
  .regex(/^[a-fA-F0-9]{24}$/, 'Invalid id')
  .openapi({ example: '674a1b2c3d4e5f6789012345' });

export const passwordSchema = z
  .string()
  .min(8, 'Use at least 8 characters, with a letter and a number')
  .max(72, 'Password is too long')
  .regex(/[A-Za-z]/, 'Password must include a letter')
  .regex(/\d/, 'Password must include a number')
  .openapi({ example: 'Farmer@123' });

export const phoneSchema = z.string().min(10).max(15).openapi({ example: '9876543210' });

export const locationSchema = z
  .object({
    longitude: z.number().gte(-180).lte(180).openapi({ example: 88.48 }),
    latitude: z.number().gte(-90).lte(90).openapi({ example: 22.72 }),
  })
  .openapi('GeoLocation');

export const pageQuery = {
  page: z.coerce.number().int().min(1).default(1).openapi({ example: 1 }),
  limit: z.coerce.number().int().min(1).max(100).default(20).openapi({ example: 20 }),
  sortOrder: z.enum(['asc', 'desc']).default('desc').openapi({ example: 'desc' }),
};

export const idParams = z.object({ id: objectIdSchema }).openapi('IdParams');
export const farmerIdParams = z.object({ farmerId: objectIdSchema });
export const buyerIdParams = z.object({ buyerId: objectIdSchema });
export const listingIdParams = z.object({ listingId: objectIdSchema });
export const userIdParams = z.object({ userId: objectIdSchema });
export const cropIdParams = z.object({ cropId: objectIdSchema });
export const marketIdParams = z.object({ marketId: objectIdSchema });
export const memberParams = z.object({ id: objectIdSchema, farmerId: objectIdSchema });

const loose = {
  _id: objectIdSchema.optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
};

export const UserSchema = z
  .object({
    ...loose,
    name: z.string().openapi({ example: 'Rabi Mondal' }),
    phone: phoneSchema,
    email: z.string().nullable().optional(),
    role: z.string().openapi({ example: 'FARMER' }),
    roles: z.array(z.string()),
    isPhoneVerified: z.boolean(),
    isEmailVerified: z.boolean(),
    isActive: z.boolean(),
    isBlocked: z.boolean(),
  })
  .passthrough()
  .openapi('User');

export const FarmerSchema = z
  .object({
    ...loose,
    userId: objectIdSchema,
    farmerName: z.string().openapi({ example: 'Rabi Mondal' }),
    district: z.string().openapi({ example: 'North 24 Parganas' }),
    state: z.string().openapi({ example: 'West Bengal' }),
    verificationStatus: z.enum(['PENDING', 'VERIFIED', 'REJECTED']),
    isVerified: z.boolean(),
    rating: z.number(),
    location: z.object({ type: z.literal('Point'), coordinates: z.array(z.number()) }).nullable().optional(),
  })
  .passthrough()
  .openapi('Farmer');

export const BuyerSchema = z
  .object({
    ...loose,
    businessName: z.string().openapi({ example: 'Bapi Traders' }),
    businessType: z.string().openapi({ example: 'TRADER' }),
    district: z.string(),
    verificationStatus: z.enum(['PENDING', 'VERIFIED', 'REJECTED']),
    rating: z.number(),
  })
  .passthrough()
  .openapi('Buyer');

export const FpoSchema = z
  .object({
    ...loose,
    name: z.string().openapi({ example: 'Gaighata Vegetable FPO' }),
    registrationNumber: z.string().openapi({ example: 'FPO-WB-2026-001' }),
    district: z.string(),
    memberCount: z.number(),
    verificationStatus: z.enum(['PENDING', 'VERIFIED', 'REJECTED']),
  })
  .passthrough()
  .openapi('FPO');

export const MarketSchema = z
  .object({
    ...loose,
    name: z.string().openapi({ example: 'Koley Market' }),
    marketCode: z.string().openapi({ example: 'KOL-KOLEY' }),
    marketType: z.string(),
    district: z.string(),
    commissionRate: z.number().openapi({ example: 2 }),
    isActive: z.boolean(),
  })
  .passthrough()
  .openapi('Market');

export const CropSchema = z
  .object({
    ...loose,
    name: z.string().openapi({ example: 'Tomato' }),
    bengaliName: z.string().nullable().optional(),
    category: z.string(),
    unit: z.string().openapi({ example: 'KG' }),
    season: z.string(),
    isActive: z.boolean(),
  })
  .passthrough()
  .openapi('Crop');

export const ListingSchema = z
  .object({
    ...loose,
    farmerId: objectIdSchema,
    cropId: objectIdSchema,
    title: z.string(),
    quantity: z.number().openapi({ example: 800 }),
    availableQuantity: z.number(),
    unit: z.string().openapi({ example: 'KG' }),
    expectedPrice: z.number().openapi({ example: 28 }),
    qualityGrade: z.string().openapi({ example: 'A' }),
    status: z.string().openapi({ example: 'ACTIVE' }),
    isNegotiable: z.boolean(),
    allowBidding: z.boolean(),
  })
  .passthrough()
  .openapi('Listing');

export const OfferSchema = z
  .object({
    ...loose,
    listingId: objectIdSchema,
    buyerId: objectIdSchema,
    farmerId: objectIdSchema,
    offeredPrice: z.number().openapi({ example: 26 }),
    quantity: z.number().openapi({ example: 500 }),
    status: z.string().openapi({ example: 'PENDING' }),
  })
  .passthrough()
  .openapi('Offer');

export const OrderSchema = z
  .object({
    ...loose,
    orderNumber: z.string().openapi({ example: 'VEG-2026-000001' }),
    buyerId: objectIdSchema,
    farmerId: objectIdSchema,
    quantity: z.number(),
    unitPrice: z.number(),
    subtotal: z.number(),
    totalAmount: z.number(),
    paymentStatus: z.string(),
    orderStatus: z.string().openapi({ example: 'PENDING' }),
  })
  .passthrough()
  .openapi('Order');

export const PaymentSchema = z
  .object({
    ...loose,
    orderId: objectIdSchema,
    amount: z.number().openapi({ example: 14000 }),
    currency: z.string().openapi({ example: 'INR' }),
    method: z.string(),
    provider: z.string(),
    status: z.string().openapi({ example: 'PENDING' }),
  })
  .passthrough()
  .openapi('Payment');

export const DeliverySchema = z
  .object({
    ...loose,
    orderId: objectIdSchema,
    status: z.string().openapi({ example: 'REQUESTED' }),
    estimatedCost: z.number(),
  })
  .passthrough()
  .openapi('Delivery');

export const RequirementSchema = z
  .object({
    ...loose,
    cropId: objectIdSchema,
    quantity: z.number().openapi({ example: 1000 }),
    targetPrice: z.number().openapi({ example: 30 }),
    status: z.string(),
  })
  .passthrough()
  .openapi('Requirement');

export const MarketPriceSchema = z
  .object({
    ...loose,
    cropId: objectIdSchema,
    marketId: objectIdSchema,
    minimumPrice: z.number(),
    maximumPrice: z.number(),
    modalPrice: z.number().openapi({ example: 31 }),
    unit: z.string(),
  })
  .passthrough()
  .openapi('MarketPrice');

export const NotificationSchema = z
  .object({
    ...loose,
    channel: z.string(),
    event: z.string(),
    title: z.string(),
    body: z.string(),
    isRead: z.boolean(),
  })
  .passthrough()
  .openapi('Notification');

export const ConversationSchema = z
  .object({ ...loose, participants: z.array(z.string()), lastMessage: z.string().nullable().optional() })
  .passthrough()
  .openapi('Conversation');

export const MessageSchema = z
  .object({ ...loose, conversationId: objectIdSchema, senderId: objectIdSchema, message: z.string(), isRead: z.boolean() })
  .passthrough()
  .openapi('Message');

export const ReviewSchema = z
  .object({ ...loose, orderId: objectIdSchema, reviewerId: objectIdSchema, revieweeId: objectIdSchema, rating: z.number().min(1).max(5) })
  .passthrough()
  .openapi('Review');

export const DisputeSchema = z
  .object({ ...loose, orderId: objectIdSchema, reason: z.string(), status: z.string() })
  .passthrough()
  .openapi('Dispute');

export const DocumentSchema = z
  .object({
    ...loose,
    fileUrl: z.string().nullable(),
    fileKey: z.string(),
    fileName: z.string(),
    mimeType: z.string(),
    documentType: z.string(),
  })
  .passthrough()
  .openapi('Document');

export function ok<T extends z.ZodTypeAny>(data: T) {
  return z.object({
    success: z.literal(true),
    message: z.string(),
    data,
    meta: z.null(),
  });
}

export function page<T extends z.ZodTypeAny>(data: T) {
  return z.object({
    success: z.literal(true),
    message: z.string(),
    data: z.array(data),
    meta: PaginationMetaSchema,
  });
}

export const registerBody = z
  .object({
    name: z.string().min(2).max(80).openapi({ example: 'Rabi Mondal' }),
    phone: phoneSchema,
    email: z.string().trim().email('Enter a valid email, or leave it blank').optional().or(z.literal('')),
    password: passwordSchema,
    role: z.enum(['FARMER', 'BUYER', 'TRADER', 'RETAILER', 'RESTAURANT', 'TRANSPORTER']).openapi({ example: 'FARMER' }),
  })
  .openapi('RegisterRequest');

export const loginBody = z
  .object({
    identifier: z.string().min(3).openapi({ example: '9876543210' }),
    password: z.string().min(1).openapi({ example: 'Farmer@123' }),
  })
  .openapi('LoginRequest');

export const refreshBody = z.object({ refreshToken: z.string().min(10) }).openapi('RefreshRequest');
export const identifierBody = z.object({ identifier: z.string().min(3) }).openapi('ForgotPasswordRequest');
export const resetBody = z
  .object({ identifier: z.string().min(3), code: z.string().length(6), newPassword: passwordSchema })
  .openapi('ResetPasswordRequest');
export const verifyPhoneBody = z.object({ phone: phoneSchema, code: z.string().length(6) }).openapi('VerifyPhoneRequest');
export const verifyEmailBody = z.object({ email: z.string().email(), code: z.string().length(6) }).openapi('VerifyEmailRequest');
export const updateMeBody = z.object({
  name: z.string().min(2).max(80).optional(),
  email: z.string().email().optional(),
  profileImage: z.string().url().optional(),
});
export const locationBody = locationSchema.extend({
  address: z.string().optional(),
  village: z.string().optional(),
  district: z.string().optional(),
  state: z.string().optional(),
  pincode: z.string().regex(/^\d{6}$/).optional(),
});
export const changePasswordBody = z.object({ currentPassword: z.string().min(1), newPassword: passwordSchema });

const bankSchema = z.object({
  accountHolderName: z.string().min(2),
  accountNumber: z.string().min(6).max(18),
  ifsc: z.string().regex(/^[A-Z]{4}0[A-Z0-9]{6}$/i),
  bankName: z.string().min(2),
  branch: z.string().optional(),
});

export const farmerBody = z
  .object({
    farmerName: z.string().min(2).openapi({ example: 'Rabi Mondal' }),
    farmName: z.string().optional(),
    fatherName: z.string().optional(),
    phone: phoneSchema,
    address: z.string().min(3),
    village: z.string().optional(),
    gramPanchayat: z.string().optional(),
    block: z.string().optional(),
    district: z.string().min(2).openapi({ example: 'North 24 Parganas' }),
    state: z.string().optional().openapi({ example: 'West Bengal' }),
    pincode: z.string().regex(/^\d{6}$/).openapi({ example: '743273' }),
    location: locationSchema,
    farmSize: z.number().positive().optional(),
    farmSizeUnit: z.enum(['ACRE', 'BIGHA', 'HECTARE', 'DECIMAL']).optional(),
    primaryCrops: z.array(objectIdSchema).optional(),
    farmingType: z.enum(['ORGANIC', 'CONVENTIONAL', 'MIXED', 'NATURAL']).optional(),
    bankDetails: bankSchema.optional(),
  })
  .openapi('FarmerProfileRequest');

export const farmerPatch = farmerBody.partial();

export const buyerBody = z
  .object({
    businessName: z.string().min(2).openapi({ example: 'Bapi Traders' }),
    businessType: z.enum(['WHOLESALER', 'TRADER', 'RETAILER', 'RESTAURANT', 'HOTEL', 'PROCESSOR']),
    ownerName: z.string().min(2),
    phone: phoneSchema,
    email: z.string().email().optional(),
    gstNumber: z.string().regex(/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/i).optional(),
    address: z.string().min(3),
    village: z.string().optional(),
    block: z.string().optional(),
    district: z.string().min(2).openapi({ example: 'Kolkata' }),
    state: z.string().optional(),
    pincode: z.string().regex(/^\d{6}$/).optional(),
    markets: z.array(objectIdSchema).optional(),
    preferredCrops: z.array(objectIdSchema).optional(),
    buyingCapacity: z.number().positive().optional(),
    paymentTerms: z.string().max(200).optional(),
    location: locationSchema,
  })
  .openapi('BuyerProfileRequest');

export const fpoBody = z.object({
  name: z.string().min(2).openapi({ example: 'Gaighata Vegetable FPO' }),
  registrationNumber: z.string().min(3),
  description: z.string().optional(),
  contactPerson: z.string().min(2),
  phone: phoneSchema,
  email: z.string().email().optional(),
  address: z.string().min(3),
  village: z.string().optional(),
  block: z.string().optional(),
  district: z.string().min(2),
  state: z.string().optional(),
  pincode: z.string().regex(/^\d{6}$/).optional(),
  location: locationSchema,
  primaryCrops: z.array(objectIdSchema).optional(),
});

export const memberBody = z.object({ farmerId: objectIdSchema });

export const marketBody = z.object({
  name: z.string().min(2).openapi({ example: 'Barasat Krishak Bazar' }),
  marketCode: z.string().min(3).max(30).openapi({ example: 'N24-BARASAT' }),
  marketType: z.enum(['MANDI', 'KRISHAK_BAZAR', 'WHOLESALE_MARKET', 'RETAIL_MARKET', 'COLLECTION_CENTER']),
  address: z.string().min(3),
  village: z.string().optional(),
  block: z.string().optional(),
  district: z.string().min(2).openapi({ example: 'North 24 Parganas' }),
  state: z.string().optional(),
  pincode: z.string().regex(/^\d{6}$/).optional(),
  location: locationSchema,
  operatingDays: z.array(z.enum(['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'])).optional(),
  openingTime: z.string().optional().openapi({ example: '06:00' }),
  closingTime: z.string().optional().openapi({ example: '14:00' }),
  commodities: z.array(objectIdSchema).optional(),
  commissionRate: z.number().min(0).max(20).optional().openapi({ example: 2 }),
});

export const cropBody = z.object({
  name: z.string().min(2).openapi({ example: 'Tomato' }),
  localNames: z.array(z.string()).optional(),
  bengaliName: z.string().optional().openapi({ example: 'টমেটো' }),
  category: z.enum(['VEGETABLE', 'LEAFY', 'ROOT', 'GOURD', 'SPICE']),
  unit: z.enum(['KG', 'QUINTAL', 'TONNE', 'PIECE', 'BUNDLE', 'CRATE']).default('KG'),
  image: z.string().url().optional(),
  description: z.string().optional(),
  season: z.enum(['RABI', 'KHARIF', 'ZAID', 'YEAR_ROUND']),
});

export const listingBody = z
  .object({
    cropId: objectIdSchema.openapi({ example: '674a1b2c3d4e5f6789012345' }),
    fpoId: objectIdSchema.optional(),
    title: z.string().max(140).optional(),
    description: z.string().max(1000).optional(),
    quantity: z.number().int().positive().openapi({ example: 800 }),
    unit: z.enum(['KG', 'QUINTAL', 'TONNE', 'PIECE', 'BUNDLE', 'CRATE']).openapi({ example: 'KG' }),
    qualityGrade: z.enum(['A', 'B', 'C']).openapi({ example: 'A' }),
    qualityParameters: z
      .object({
        size: z.string().optional(),
        color: z.string().optional(),
        moisture: z.string().optional(),
        organic: z.boolean().optional(),
        notes: z.string().optional(),
      })
      .optional(),
    expectedPrice: z.number().positive().openapi({ example: 28 }),
    minimumPrice: z.number().positive().optional(),
    harvestDate: z.string().min(8).openapi({ example: '2026-10-01' }),
    availableFrom: z.string().min(8).openapi({ example: '2026-10-01T06:00:00.000Z' }),
    availableUntil: z.string().min(8).openapi({ example: '2026-10-02T18:00:00.000Z' }),
    marketId: objectIdSchema.optional(),
    preferredMarketId: objectIdSchema.optional(),
    location: locationSchema.optional(),
    pickupLocation: z
      .object({
        address: z.string(),
        landmark: z.string().optional(),
        longitude: z.number(),
        latitude: z.number(),
      })
      .optional(),
    images: z.array(z.string().url()).max(8).optional(),
    isNegotiable: z.boolean().optional().openapi({ example: true }),
    allowBidding: z.boolean().optional().openapi({ example: true }),
    district: z.string().optional(),
    state: z.string().optional(),
  })
  .openapi('ListingRequest');

export const listingQuery = z.object({
  ...pageQuery,
  sortBy: z.enum(['createdAt', 'expectedPrice', 'quantity', 'availableFrom']).optional(),
  crop: z.string().optional().openapi({ example: 'tomato' }),
  cropId: objectIdSchema.optional(),
  marketId: objectIdSchema.optional(),
  district: z.string().optional().openapi({ example: 'North 24 Parganas' }),
  farmer: objectIdSchema.optional(),
  farmerId: objectIdSchema.optional(),
  fpo: objectIdSchema.optional(),
  fpoId: objectIdSchema.optional(),
  minPrice: z.coerce.number().optional(),
  maxPrice: z.coerce.number().optional(),
  minQuantity: z.coerce.number().int().positive().optional(),
  quality: z.enum(['A', 'B', 'C']).optional(),
  qualityGrade: z.enum(['A', 'B', 'C']).optional(),
  availableFrom: z.string().optional(),
  availableUntil: z.string().optional(),
  status: z.enum(['DRAFT', 'ACTIVE', 'PARTIALLY_SOLD', 'SOLD', 'EXPIRED', 'CANCELLED']).optional(),
  q: z.string().max(80).optional(),
  lat: z.coerce.number().optional(),
  lng: z.coerce.number().optional(),
  radius: z.coerce.number().positive().optional(),
});

export const nearbyQuery = z.object({
  ...pageQuery,
  lat: z.coerce.number().openapi({ example: 22.72 }),
  lng: z.coerce.number().openapi({ example: 88.48 }),
  radius: z.coerce.number().positive().optional().openapi({ example: 20000 }),
});

export const requirementBody = z.object({
  cropId: objectIdSchema,
  quantity: z.number().int().positive().openapi({ example: 1000 }),
  unit: z.enum(['KG', 'QUINTAL', 'TONNE', 'PIECE', 'BUNDLE', 'CRATE']),
  targetPrice: z.number().positive().openapi({ example: 30 }),
  qualityGrade: z.enum(['A', 'B', 'C']).optional(),
  requiredDate: z.string().openapi({ example: '2026-10-01' }),
  marketId: objectIdSchema.optional(),
  district: z.string().optional(),
  state: z.string().optional(),
  location: locationSchema.optional(),
  notes: z.string().max(500).optional(),
  expiresAt: z.string().optional(),
});

export const offerBody = z.object({
  offeredPrice: z.number().positive().openapi({ example: 26 }),
  quantity: z.number().int().positive().openapi({ example: 500 }),
  message: z.string().max(500).optional(),
  expiresAt: z.string().min(8).optional(),
});

export const counterBody = z.object({
  offeredPrice: z.number().positive(),
  quantity: z.number().int().positive(),
  message: z.string().max(500).optional(),
});

export const orderBody = z.object({
  listingId: objectIdSchema,
  quantity: z.number().int().positive(),
  deliveryLocation: z
    .object({
      address: z.string(),
      landmark: z.string().optional(),
      longitude: z.number().optional(),
      latitude: z.number().optional(),
    })
    .optional(),
  transportCharge: z.number().min(0).optional(),
  discount: z.number().min(0).optional(),
  scheduledPickupDate: z.string().optional(),
  scheduledDeliveryDate: z.string().optional(),
  notes: z.string().max(500).optional(),
  idempotencyKey: z.string().min(8).max(80).optional(),
});

export const statusBody = z.object({
  status: z.enum(['PENDING', 'CONFIRMED', 'READY_FOR_PICKUP', 'PICKED_UP', 'IN_TRANSIT', 'DELIVERED', 'COMPLETED', 'CANCELLED', 'DISPUTED']),
});

export const paymentCreateBody = z.object({
  orderId: objectIdSchema,
  amount: z.number().positive().optional(),
  method: z.enum(['CASH', 'UPI', 'BANK_TRANSFER', 'RAZORPAY']),
  provider: z.enum(['CASH', 'MANUAL', 'RAZORPAY', 'MOCK']).optional(),
  idempotencyKey: z.string().min(8).max(80).optional(),
});

export const paymentVerifyBody = z.object({
  paymentId: objectIdSchema,
  providerPaymentId: z.string().optional(),
  signature: z.string().optional(),
});

export const refundBody = z.object({ amount: z.number().positive().optional(), reason: z.string().max(200).optional() });

export const deliveryBody = z.object({
  orderId: objectIdSchema,
  pickupAddress: z.string().optional(),
  dropAddress: z.string().min(3),
  dropLongitude: z.number().optional(),
  dropLatitude: z.number().optional(),
  scheduledPickup: z.string().optional(),
  scheduledDelivery: z.string().optional(),
  estimatedCost: z.number().min(0).optional(),
});

export const assignBody = z.object({ transporterId: objectIdSchema, vehicleId: objectIdSchema });
export const deliveryStatusBody = z.object({
  status: z.enum(['REQUESTED', 'ASSIGNED', 'PICKED_UP', 'IN_TRANSIT', 'DELIVERED', 'CANCELLED']),
  note: z.string().max(300).optional(),
});

export const transporterBody = z.object({
  businessName: z.string().min(2),
  phone: phoneSchema,
  vehicleTypes: z.array(z.enum(['PICKUP', 'MINI_TRUCK', 'TRUCK', 'THREE_WHEELER', 'TRACTOR'])).min(1),
  vehicles: z.array(z.object({
    vehicleNumber: z.string().min(4),
    vehicleType: z.enum(['PICKUP', 'MINI_TRUCK', 'TRUCK', 'THREE_WHEELER', 'TRACTOR']),
    capacity: z.number().positive(),
    driverName: z.string().min(2),
    driverPhone: phoneSchema,
  })).min(1),
  serviceAreas: z.array(z.object({ district: z.string(), state: z.string().optional() })).min(1),
  location: locationSchema,
});

export const priceBody = z.object({
  cropId: objectIdSchema,
  marketId: objectIdSchema,
  date: z.string().openapi({ example: '2026-10-01' }),
  minimumPrice: z.number().min(0).openapi({ example: 28 }),
  maximumPrice: z.number().min(0).openapi({ example: 34 }),
  modalPrice: z.number().min(0).openapi({ example: 31 }),
  unit: z.enum(['KG', 'QUINTAL', 'TONNE', 'PIECE', 'BUNDLE', 'CRATE']).default('KG'),
  source: z.enum(['MANUAL', 'INTERNAL_ORDERS', 'AGMARKNET']).optional(),
});

export const conversationBody = z.object({
  participantId: objectIdSchema,
  listingId: objectIdSchema.optional(),
  orderId: objectIdSchema.optional(),
});
export const messageBody = z.object({
  message: z.string().min(1).max(2000),
  messageType: z.enum(['TEXT', 'IMAGE', 'SYSTEM']).optional(),
  attachments: z.array(z.string()).optional(),
});
export const reviewBody = z.object({
  orderId: objectIdSchema,
  rating: z.number().int().min(1).max(5).openapi({ example: 5 }),
  comment: z.string().max(1000).optional(),
});
export const disputeBody = z.object({
  orderId: objectIdSchema,
  reason: z.string().min(3).max(120),
  description: z.string().min(10).max(2000),
  images: z.array(z.string().url()).optional(),
});
export const resolveBody = z.object({
  status: z.enum(['UNDER_REVIEW', 'RESOLVED', 'REJECTED']),
  resolution: z.string().max(2000).optional(),
});
export const verificationBody = z.object({ status: z.enum(['PENDING', 'VERIFIED', 'REJECTED']) });
export const blockBody = z.object({ isBlocked: z.boolean() });
export const rolesBody = z.object({
  roles: z.array(z.enum(['SUPER_ADMIN', 'ADMIN', 'FARMER', 'FPO_ADMIN', 'BUYER', 'TRADER', 'RETAILER', 'RESTAURANT', 'TRANSPORTER', 'MARKET_MANAGER'])).min(1),
});

export const listQuery = z.object({ ...pageQuery, sortBy: z.string().optional(), status: z.string().optional(), q: z.string().optional() });
export const simplePage = z.object({ ...pageQuery });
