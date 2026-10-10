import { createPaymentProviders } from './providers/payment';
import { createStorageProvider } from './providers/storage';
import { CropRepository, MarketPriceRepository, MarketRepository } from './repositories/catalog.repository';
import {
  AuditRepository,
  ChatRepository,
  DeliveryRepository,
  DisputeRepository,
  DocumentRepository,
  NotificationRepository,
  ReviewRepository,
  StatsRepository,
} from './repositories/operations.repository';
import { BuyerRepository, FarmerRepository, FpoRepository, TransporterRepository } from './repositories/profile.repository';
import {
  ListingRepository,
  OfferRepository,
  OrderRepository,
  PaymentRepository,
  RequirementRepository,
  WebhookRepository,
} from './repositories/trade.repository';
import { CounterRepository, OtpRepository, RefreshTokenRepository, UserRepository } from './repositories/user.repository';
import { AdminService } from './services/admin.service';
import { AuditService } from './services/audit.service';
import { AuthService } from './services/auth.service';
import { BuyerService } from './services/buyer.service';
import { CropService, MarketPriceService, MarketService } from './services/catalog.service';
import { DeliveryService } from './services/delivery.service';
import { ChatService, DisputeService, DocumentService, ReviewService } from './services/engagement.service';
import { FarmerService } from './services/farmer.service';
import { FpoService } from './services/fpo.service';
import { ListingService } from './services/listing.service';
import { MatchingService } from './services/matching.service';
import { NotificationService } from './services/notification.service';
import { OfferService } from './services/offer.service';
import { OrderService } from './services/order.service';
import { PaymentService } from './services/payment.service';
import { RequirementService } from './services/requirement.service';
import { UserService } from './services/user.service';

const users = new UserRepository();
const tokens = new RefreshTokenRepository();
const otps = new OtpRepository();
const counters = new CounterRepository();
const farmers = new FarmerRepository();
const buyers = new BuyerRepository();
const fpos = new FpoRepository();
const transporters = new TransporterRepository();
const crops = new CropRepository();
const markets = new MarketRepository();
const prices = new MarketPriceRepository();
const listings = new ListingRepository();
const offers = new OfferRepository();
const orders = new OrderRepository();
const requirements = new RequirementRepository();
const payments = new PaymentRepository();
const webhooks = new WebhookRepository();
const deliveries = new DeliveryRepository();
const notifications = new NotificationRepository();
const chat = new ChatRepository();
const reviews = new ReviewRepository();
const disputes = new DisputeRepository();
const documents = new DocumentRepository();
const audits = new AuditRepository();
const stats = new StatsRepository();

const audit = new AuditService(audits);
export const auditService = audit;
export const notificationService = new NotificationService(notifications, users);
export const authService = new AuthService(users, tokens, otps, audit);
export const userService = new UserService(users, tokens, farmers, buyers, transporters, authService);
export const farmerService = new FarmerService(farmers, crops);
export const buyerService = new BuyerService(buyers, crops, markets);
export const fpoService = new FpoService(fpos, farmers, users);
export const cropService = new CropService(crops);
export const marketService = new MarketService(markets);
export const marketPriceService = new MarketPriceService(prices, crops, markets);
export const listingService = new ListingService(listings, farmers, crops, markets, fpos, offers, audit, users);
export const requirementService = new RequirementService(requirements, buyers, crops, markets);
export const orderService = new OrderService(orders, listings, offers, farmers, buyers, markets, counters, payments, audit);
export const offerService = new OfferService(offers, listings, orders, buyers, farmers, counters, orderService, audit);
export const paymentService = new PaymentService(payments, orders, webhooks, createPaymentProviders(), orderService, audit);
export const deliveryService = new DeliveryService(deliveries, orders, transporters, orderService);
export const matchingService = new MatchingService(listings, requirements, buyers, farmers, markets, prices);
export const chatService = new ChatService(chat);
export const reviewService = new ReviewService(reviews, orders, farmers, buyers);
export const disputeService = new DisputeService(disputes, orders);
export const documentService = new DocumentService(documents, createStorageProvider(), farmers, buyers);
export const adminService = new AdminService(
  users,
  farmers,
  buyers,
  fpos,
  listings,
  orders,
  payments,
  markets,
  disputes,
  deliveries,
  stats,
  audits,
);
