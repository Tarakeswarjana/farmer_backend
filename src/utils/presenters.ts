import { bpsToPercent, paiseToRupees } from './money';

type Plain = Record<string, unknown>;

function asPlain(value: object): Plain {
  const candidate = value as { toObject?: () => unknown };
  const plain = typeof candidate.toObject === 'function' ? candidate.toObject() : value;
  return plain as Plain;
}

function text(doc: Plain, key: string): string | null {
  const value = doc[key];
  if (value == null || value === '') {
    return null;
  }
  return String(value);
}

function num(doc: Plain, key: string, fallback = 0): number {
  const value = doc[key];
  return typeof value === 'number' ? value : fallback;
}

function bool(doc: Plain, key: string, fallback = false): boolean {
  const value = doc[key];
  return typeof value === 'boolean' ? value : fallback;
}

function idList(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.map((item) => String(item));
}

function point(value: unknown): { type: 'Point'; coordinates: number[] } | null {
  if (!value || typeof value !== 'object') {
    return null;
  }
  const coordinates = (value as { coordinates?: unknown }).coordinates;
  if (!Array.isArray(coordinates)) {
    return null;
  }
  return { type: 'Point', coordinates: coordinates.map((item) => Number(item)) };
}

function rupees(doc: Plain, key: string): number | null {
  const value = doc[key];
  if (typeof value !== 'number') {
    return null;
  }
  return paiseToRupees(value);
}

export function presentUser(value: object) {
  const doc = asPlain(value);
  return {
    _id: String(doc._id),
    name: text(doc, 'name'),
    phone: text(doc, 'phone'),
    email: text(doc, 'email'),
    role: doc.role,
    roles: idList(doc.roles),
    profileImage: text(doc, 'profileImage'),
    isPhoneVerified: bool(doc, 'isPhoneVerified'),
    isEmailVerified: bool(doc, 'isEmailVerified'),
    isActive: bool(doc, 'isActive'),
    isBlocked: bool(doc, 'isBlocked'),
    isDemo: bool(doc, 'isDemo'),
    lastLoginAt: doc.lastLoginAt ?? null,
    address: text(doc, 'address'),
    village: text(doc, 'village'),
    district: text(doc, 'district'),
    state: text(doc, 'state'),
    pincode: text(doc, 'pincode'),
    location: point(doc.location),
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

function presentBank(value: unknown) {
  if (!value || typeof value !== 'object') {
    return null;
  }
  const bank = value as Plain;
  return {
    accountHolderName: bank.accountHolderName ?? null,
    accountNumberMasked: bank.accountNumberMasked ?? null,
    ifsc: bank.ifsc ?? null,
    bankName: bank.bankName ?? null,
    branch: bank.branch ?? null,
  };
}

export function presentFarmer(value: object, options?: { includePrivate?: boolean }) {
  const doc = asPlain(value);
  return {
    _id: String(doc._id),
    userId: String(doc.userId),
    farmerName: text(doc, 'farmerName'),
    farmName: text(doc, 'farmName'),
    fatherName: text(doc, 'fatherName'),
    phone: options?.includePrivate ? text(doc, 'phone') : null,
    address: text(doc, 'address'),
    village: text(doc, 'village'),
    gramPanchayat: text(doc, 'gramPanchayat'),
    block: text(doc, 'block'),
    district: text(doc, 'district'),
    state: text(doc, 'state'),
    pincode: text(doc, 'pincode'),
    location: point(doc.location),
    farmSize: doc.farmSize ?? null,
    farmSizeUnit: doc.farmSizeUnit ?? null,
    primaryCrops: idList(doc.primaryCrops),
    farmingType: doc.farmingType ?? null,
    bankDetails: options?.includePrivate ? presentBank(doc.bankDetails) : null,
    documents: options?.includePrivate ? (doc.documents ?? []) : [],
    verificationStatus: doc.verificationStatus,
    rating: num(doc, 'rating'),
    ratingCount: num(doc, 'ratingCount'),
    totalOrders: num(doc, 'totalOrders'),
    totalSales: paiseToRupees(num(doc, 'totalSalesPaise')),
    isVerified: bool(doc, 'isVerified'),
    distanceMeters: typeof doc.distanceMeters === 'number' ? doc.distanceMeters : undefined,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

export function presentBuyer(value: object, options?: { includePrivate?: boolean }) {
  const doc = asPlain(value);
  return {
    _id: String(doc._id),
    userId: String(doc.userId),
    businessName: text(doc, 'businessName'),
    businessType: doc.businessType,
    ownerName: text(doc, 'ownerName'),
    phone: options?.includePrivate ? text(doc, 'phone') : null,
    email: options?.includePrivate ? text(doc, 'email') : null,
    gstNumber: options?.includePrivate ? text(doc, 'gstNumber') : null,
    address: text(doc, 'address'),
    village: text(doc, 'village'),
    block: text(doc, 'block'),
    district: text(doc, 'district'),
    state: text(doc, 'state'),
    pincode: text(doc, 'pincode'),
    markets: idList(doc.markets),
    preferredCrops: idList(doc.preferredCrops),
    buyingCapacity: doc.buyingCapacity ?? null,
    buyingCapacityUnit: doc.buyingCapacityUnit ?? 'KG',
    paymentTerms: text(doc, 'paymentTerms'),
    location: point(doc.location),
    verificationStatus: doc.verificationStatus,
    rating: num(doc, 'rating'),
    ratingCount: num(doc, 'ratingCount'),
    isVerified: bool(doc, 'isVerified'),
    documents: options?.includePrivate ? (doc.documents ?? []) : [],
    distanceMeters: typeof doc.distanceMeters === 'number' ? doc.distanceMeters : undefined,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

export function presentMarket(value: object) {
  const doc = asPlain(value);
  return {
    _id: String(doc._id),
    name: text(doc, 'name'),
    marketCode: text(doc, 'marketCode'),
    marketType: doc.marketType,
    address: text(doc, 'address'),
    village: text(doc, 'village'),
    block: text(doc, 'block'),
    district: text(doc, 'district'),
    state: text(doc, 'state'),
    pincode: text(doc, 'pincode'),
    location: point(doc.location),
    operatingDays: doc.operatingDays ?? [],
    openingTime: text(doc, 'openingTime'),
    closingTime: text(doc, 'closingTime'),
    commodities: idList(doc.commodities),
    commissionRate: bpsToPercent(num(doc, 'commissionBps')),
    isActive: bool(doc, 'isActive', true),
    isDemo: bool(doc, 'isDemo'),
    distanceMeters: typeof doc.distanceMeters === 'number' ? doc.distanceMeters : undefined,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

export function presentCrop(value: object) {
  const doc = asPlain(value);
  return {
    _id: String(doc._id),
    name: text(doc, 'name'),
    localNames: doc.localNames ?? [],
    bengaliName: text(doc, 'bengaliName'),
    category: doc.category,
    unit: doc.unit,
    image: text(doc, 'image'),
    description: text(doc, 'description'),
    season: doc.season,
    isActive: bool(doc, 'isActive', true),
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

export function presentListing(value: object) {
  const doc = asPlain(value);
  return {
    _id: String(doc._id),
    farmerId: String(doc.farmerId),
    farmerProfileId: text(doc, 'farmerProfileId'),
    fpoId: text(doc, 'fpoId'),
    cropId: String(doc.cropId),
    title: text(doc, 'title'),
    description: text(doc, 'description'),
    quantity: num(doc, 'quantity'),
    availableQuantity: num(doc, 'availableQuantity'),
    unit: doc.unit,
    qualityGrade: doc.qualityGrade,
    qualityParameters: doc.qualityParameters ?? {},
    expectedPrice: rupees(doc, 'expectedPricePaise'),
    minimumPrice: rupees(doc, 'minimumPricePaise'),
    harvestDate: doc.harvestDate,
    availableFrom: doc.availableFrom,
    availableUntil: doc.availableUntil,
    location: point(doc.location),
    pickupLocation: doc.pickupLocation ?? null,
    preferredMarketId: text(doc, 'preferredMarketId'),
    district: text(doc, 'district'),
    state: text(doc, 'state'),
    images: doc.images ?? [],
    status: doc.status,
    isNegotiable: bool(doc, 'isNegotiable', true),
    allowBidding: bool(doc, 'allowBidding', true),
    distanceMeters: typeof doc.distanceMeters === 'number' ? doc.distanceMeters : undefined,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

export function presentOffer(value: object) {
  const doc = asPlain(value);
  return {
    _id: String(doc._id),
    listingId: String(doc.listingId),
    buyerId: String(doc.buyerId),
    farmerId: String(doc.farmerId),
    offeredPrice: rupees(doc, 'offeredPricePaise'),
    quantity: num(doc, 'quantity'),
    originalPrice: rupees(doc, 'originalPricePaise'),
    originalQuantity: doc.originalQuantity ?? null,
    message: text(doc, 'message'),
    status: doc.status,
    lastCounteredBy: text(doc, 'lastCounteredBy'),
    expiresAt: doc.expiresAt,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

export function presentOrder(value: object) {
  const doc = asPlain(value);
  return {
    _id: String(doc._id),
    orderNumber: text(doc, 'orderNumber'),
    buyerId: String(doc.buyerId),
    farmerId: String(doc.farmerId),
    fpoId: text(doc, 'fpoId'),
    listingId: String(doc.listingId),
    offerId: text(doc, 'offerId'),
    cropId: String(doc.cropId),
    quantity: num(doc, 'quantity'),
    unit: doc.unit,
    unitPrice: rupees(doc, 'unitPricePaise'),
    subtotal: rupees(doc, 'subtotalPaise'),
    commission: rupees(doc, 'commissionPaise'),
    transportCharge: rupees(doc, 'transportChargePaise'),
    tax: rupees(doc, 'taxPaise'),
    discount: rupees(doc, 'discountPaise'),
    totalAmount: rupees(doc, 'totalAmountPaise'),
    pickupLocation: doc.pickupLocation ?? null,
    deliveryLocation: doc.deliveryLocation ?? null,
    marketId: text(doc, 'marketId'),
    scheduledPickupDate: doc.scheduledPickupDate ?? null,
    scheduledDeliveryDate: doc.scheduledDeliveryDate ?? null,
    paymentStatus: doc.paymentStatus,
    orderStatus: doc.orderStatus,
    notes: text(doc, 'notes'),
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

export function presentPayment(value: object) {
  const doc = asPlain(value);
  const metadata = doc.metadata && typeof doc.metadata === 'object' ? (doc.metadata as Plain) : {};
  const safeMetadata: Plain = {};
  for (const [key, nested] of Object.entries(metadata)) {
    if (['signature', 'secret', 'keySecret'].includes(key)) {
      continue;
    }
    safeMetadata[key] = nested;
  }
  return {
    _id: String(doc._id),
    orderId: String(doc.orderId),
    buyerId: String(doc.buyerId),
    amount: rupees(doc, 'amountPaise'),
    currency: text(doc, 'currency') ?? 'INR',
    method: doc.method,
    provider: doc.provider,
    transactionId: text(doc, 'transactionId'),
    providerOrderId: text(doc, 'providerOrderId'),
    status: doc.status,
    paidAt: doc.paidAt ?? null,
    refundedAmount: paiseToRupees(num(doc, 'refundedPaise')),
    metadata: safeMetadata,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

export function presentRequirement(value: object) {
  const doc = asPlain(value);
  return {
    _id: String(doc._id),
    buyerId: String(doc.buyerId),
    buyerProfileId: text(doc, 'buyerProfileId'),
    cropId: String(doc.cropId),
    quantity: num(doc, 'quantity'),
    fulfilledQuantity: num(doc, 'fulfilledQuantity'),
    unit: doc.unit,
    targetPrice: rupees(doc, 'targetPricePaise'),
    qualityGrade: doc.qualityGrade ?? null,
    requiredDate: doc.requiredDate,
    marketId: text(doc, 'marketId'),
    district: text(doc, 'district'),
    state: text(doc, 'state'),
    location: point(doc.location),
    notes: text(doc, 'notes'),
    status: doc.status,
    expiresAt: doc.expiresAt,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

export function presentFpo(value: object) {
  const doc = asPlain(value);
  return {
    _id: String(doc._id),
    name: text(doc, 'name'),
    registrationNumber: text(doc, 'registrationNumber'),
    description: text(doc, 'description'),
    contactPerson: text(doc, 'contactPerson'),
    phone: text(doc, 'phone'),
    email: text(doc, 'email'),
    address: text(doc, 'address'),
    village: text(doc, 'village'),
    block: text(doc, 'block'),
    district: text(doc, 'district'),
    state: text(doc, 'state'),
    pincode: text(doc, 'pincode'),
    location: point(doc.location),
    memberCount: num(doc, 'memberCount'),
    memberFarmerIds: idList(doc.memberFarmerIds),
    primaryCrops: idList(doc.primaryCrops),
    verificationStatus: doc.verificationStatus,
    isVerified: bool(doc, 'isVerified'),
    documents: doc.documents ?? [],
    adminUserId: text(doc, 'adminUserId'),
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

export function presentTransporter(value: object) {
  const doc = asPlain(value);
  return {
    _id: String(doc._id),
    userId: String(doc.userId),
    businessName: text(doc, 'businessName'),
    phone: text(doc, 'phone'),
    vehicleTypes: doc.vehicleTypes ?? [],
    vehicles: doc.vehicles ?? [],
    serviceAreas: doc.serviceAreas ?? [],
    location: point(doc.location),
    verificationStatus: doc.verificationStatus,
    isVerified: bool(doc, 'isVerified'),
    rating: num(doc, 'rating'),
    ratingCount: num(doc, 'ratingCount'),
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

export function presentDelivery(value: object) {
  const doc = asPlain(value);
  return {
    _id: String(doc._id),
    orderId: String(doc.orderId),
    transporterId: text(doc, 'transporterId'),
    vehicleId: text(doc, 'vehicleId'),
    pickupLocation: doc.pickupLocation,
    dropLocation: doc.dropLocation,
    scheduledPickup: doc.scheduledPickup ?? null,
    scheduledDelivery: doc.scheduledDelivery ?? null,
    distance: typeof doc.distanceMeters === 'number' ? doc.distanceMeters : null,
    estimatedCost: rupees(doc, 'estimatedCostPaise') ?? 0,
    actualCost: rupees(doc, 'actualCostPaise'),
    status: doc.status,
    trackingEvents: doc.trackingEvents ?? [],
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

export function presentMarketPrice(value: object) {
  const doc = asPlain(value);
  return {
    _id: String(doc._id),
    cropId: String(doc.cropId),
    marketId: String(doc.marketId),
    date: doc.date,
    minimumPrice: rupees(doc, 'minimumPricePaise'),
    maximumPrice: rupees(doc, 'maximumPricePaise'),
    modalPrice: rupees(doc, 'modalPricePaise'),
    unit: doc.unit,
    source: doc.source,
    isDemo: bool(doc, 'isDemo'),
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

export function presentNotification(value: object) {
  const doc = asPlain(value);
  return {
    _id: String(doc._id),
    channel: doc.channel,
    event: doc.event,
    title: text(doc, 'title'),
    body: text(doc, 'body'),
    entityType: text(doc, 'entityType'),
    entityId: text(doc, 'entityId'),
    isRead: bool(doc, 'isRead'),
    readAt: doc.readAt ?? null,
    status: doc.status,
    createdAt: doc.createdAt,
  };
}

export function presentConversation(value: object) {
  const doc = asPlain(value);
  return {
    _id: String(doc._id),
    participants: idList(doc.participants),
    listingId: text(doc, 'listingId'),
    orderId: text(doc, 'orderId'),
    lastMessage: text(doc, 'lastMessage'),
    lastMessageAt: doc.lastMessageAt ?? null,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

export function presentMessage(value: object) {
  const doc = asPlain(value);
  return {
    _id: String(doc._id),
    conversationId: String(doc.conversationId),
    senderId: String(doc.senderId),
    message: text(doc, 'message'),
    messageType: doc.messageType,
    attachments: doc.attachments ?? [],
    isRead: bool(doc, 'isRead'),
    readAt: doc.readAt ?? null,
    createdAt: doc.createdAt,
  };
}

export function presentReview(value: object) {
  const doc = asPlain(value);
  return {
    _id: String(doc._id),
    orderId: String(doc.orderId),
    reviewerId: String(doc.reviewerId),
    revieweeId: String(doc.revieweeId),
    rating: num(doc, 'rating'),
    comment: text(doc, 'comment'),
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

export function presentDispute(value: object) {
  const doc = asPlain(value);
  return {
    _id: String(doc._id),
    orderId: String(doc.orderId),
    raisedBy: String(doc.raisedBy),
    against: String(doc.against),
    reason: text(doc, 'reason'),
    description: text(doc, 'description'),
    images: doc.images ?? [],
    status: doc.status,
    resolution: text(doc, 'resolution'),
    resolvedBy: text(doc, 'resolvedBy'),
    resolvedAt: doc.resolvedAt ?? null,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

export function presentDocument(value: object) {
  const doc = asPlain(value);
  return {
    _id: String(doc._id),
    fileUrl: text(doc, 'fileUrl'),
    fileKey: text(doc, 'fileKey'),
    fileName: text(doc, 'fileName'),
    mimeType: text(doc, 'mimeType'),
    uploadedBy: String(doc.uploadedBy),
    documentType: doc.documentType,
    ownerType: doc.ownerType,
    ownerId: text(doc, 'ownerId'),
    storage: doc.storage,
    createdAt: doc.createdAt,
  };
}

export function presentAudit(value: object) {
  const doc = asPlain(value);
  return {
    _id: String(doc._id),
    userId: text(doc, 'userId'),
    action: doc.action,
    entity: text(doc, 'entity'),
    entityId: text(doc, 'entityId'),
    oldValue: doc.oldValue ?? null,
    newValue: doc.newValue ?? null,
    ipAddress: text(doc, 'ipAddress'),
    userAgent: text(doc, 'userAgent'),
    createdAt: doc.createdAt,
  };
}
