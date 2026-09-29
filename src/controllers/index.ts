import type { Request, Response } from 'express';
import {
  adminService,
  auditService,
  authService,
  buyerService,
  chatService,
  cropService,
  deliveryService,
  disputeService,
  documentService,
  farmerService,
  fpoService,
  listingService,
  marketPriceService,
  marketService,
  matchingService,
  notificationService,
  offerService,
  orderService,
  paymentService,
  requirementService,
  reviewService,
  userService,
} from '../container';
import { databaseStatus } from '../config/database';
import { pingRedis } from '../config/redis';
import { sendSuccess } from '../utils/apiResponse';
import { asyncHandler } from '../utils/asyncHandler';
import { requestMeta } from '../utils/ids';
import { BadRequestError } from '../utils/errors';

function actor(req: Request) {
  if (!req.user) {
    throw new BadRequestError('Authentication required');
  }
  return req.user;
}

export const authController = {
  register: asyncHandler(async (req, res) => {
    sendSuccess(res, { statusCode: 201, message: 'Registered successfully', data: await authService.register(req.body) });
  }),
  login: asyncHandler(async (req, res) => {
    sendSuccess(res, { message: 'Logged in successfully', data: await authService.login(req.body, requestMeta(req)) });
  }),
  refresh: asyncHandler(async (req, res) => {
    sendSuccess(res, { message: 'Token refreshed successfully', data: await authService.refresh(req.body.refreshToken, requestMeta(req)) });
  }),
  logout: asyncHandler(async (req, res) => {
    sendSuccess(res, { message: 'Logged out successfully', data: await authService.logout(actor(req), req.body.refreshToken) });
  }),
  forgot: asyncHandler(async (req, res) => {
    const data = await authService.forgotPassword(req.body);
    sendSuccess(res, { message: data.message, data });
  }),
  reset: asyncHandler(async (req, res) => {
    sendSuccess(res, { message: 'Password reset successfully', data: await authService.resetPassword(req.body) });
  }),
  verifyPhone: asyncHandler(async (req, res) => {
    sendSuccess(res, { message: 'Phone verified successfully', data: await authService.verifyPhone(req.body) });
  }),
  verifyEmail: asyncHandler(async (req, res) => {
    sendSuccess(res, { message: 'Email verified successfully', data: await authService.verifyEmail(req.body) });
  }),
};

export const userController = {
  me: asyncHandler(async (req, res) => {
    sendSuccess(res, { message: 'Profile fetched successfully', data: await userService.me(actor(req)) });
  }),
  update: asyncHandler(async (req, res) => {
    sendSuccess(res, { message: 'Profile updated successfully', data: await userService.updateMe(actor(req), req.body) });
  }),
  location: asyncHandler(async (req, res) => {
    sendSuccess(res, { message: 'Location updated successfully', data: await userService.updateLocation(actor(req), req.body) });
  }),
  password: asyncHandler(async (req, res) => {
    sendSuccess(res, { message: 'Password changed successfully', data: await userService.changePassword(actor(req), req.body) });
  }),
  reviews: asyncHandler(async (req, res) => {
    sendSuccess(res, { message: 'Reviews fetched successfully', ...(await paged(reviewService.forUser(req.params.userId, req.query))) });
  }),
};

export const farmerController = {
  create: asyncHandler(async (req, res) => {
    sendSuccess(res, { statusCode: 201, message: 'Farmer profile created successfully', data: await farmerService.create(actor(req), req.body) });
  }),
  mine: asyncHandler(async (req, res) => {
    sendSuccess(res, { message: 'Farmer profile fetched successfully', data: await farmerService.mine(actor(req)) });
  }),
  update: asyncHandler(async (req, res) => {
    sendSuccess(res, { message: 'Farmer profile updated successfully', data: await farmerService.update(actor(req), req.body) });
  }),
  nearby: asyncHandler(async (req, res) => {
    sendSuccess(res, { message: 'Nearby farmers fetched successfully', ...(await paged(farmerService.nearby(req.query as unknown as { lat: number; lng: number; radius?: number; page?: number; limit?: number }))) });
  }),
  get: asyncHandler(async (req, res) => {
    sendSuccess(res, { message: 'Farmer fetched successfully', data: await farmerService.getById(req.params.farmerId, req.user) });
  }),
  listings: asyncHandler(async (req, res) => {
    sendSuccess(res, { message: 'Listings fetched successfully', ...(await paged(listingService.mine(actor(req), req.query))) });
  }),
};

export const buyerController = {
  create: asyncHandler(async (req, res) => {
    sendSuccess(res, { statusCode: 201, message: 'Buyer profile created successfully', data: await buyerService.create(actor(req), req.body) });
  }),
  mine: asyncHandler(async (req, res) => {
    sendSuccess(res, { message: 'Buyer profile fetched successfully', data: await buyerService.mine(actor(req)) });
  }),
  update: asyncHandler(async (req, res) => {
    sendSuccess(res, { message: 'Buyer profile updated successfully', data: await buyerService.update(actor(req), req.body) });
  }),
  nearby: asyncHandler(async (req, res) => {
    sendSuccess(res, { message: 'Nearby buyers fetched successfully', ...(await paged(buyerService.nearby(req.query as unknown as { lat: number; lng: number; radius?: number; page?: number; limit?: number }))) });
  }),
  get: asyncHandler(async (req, res) => {
    sendSuccess(res, { message: 'Buyer fetched successfully', data: await buyerService.getById(req.params.buyerId, req.user) });
  }),
};

export const fpoController = {
  create: asyncHandler(async (req, res) => {
    sendSuccess(res, { statusCode: 201, message: 'FPO created successfully', data: await fpoService.create(actor(req), req.body) });
  }),
  list: asyncHandler(async (req, res) => {
    sendSuccess(res, { message: 'FPOs fetched successfully', ...(await paged(fpoService.list(req.query))) });
  }),
  get: asyncHandler(async (req, res) => {
    sendSuccess(res, { message: 'FPO fetched successfully', data: await fpoService.get(req.params.id) });
  }),
  update: asyncHandler(async (req, res) => {
    sendSuccess(res, { message: 'FPO updated successfully', data: await fpoService.update(actor(req), req.params.id, req.body) });
  }),
  addMember: asyncHandler(async (req, res) => {
    sendSuccess(res, { message: 'Member added successfully', data: await fpoService.addMember(actor(req), req.params.id, req.body.farmerId) });
  }),
  removeMember: asyncHandler(async (req, res) => {
    sendSuccess(res, { message: 'Member removed successfully', data: await fpoService.removeMember(actor(req), req.params.id, req.params.farmerId) });
  }),
  members: asyncHandler(async (req, res) => {
    sendSuccess(res, { message: 'Members fetched successfully', ...(await paged(fpoService.members(req.params.id, req.query))) });
  }),
};

export const marketController = {
  create: asyncHandler(async (req, res) => {
    sendSuccess(res, { statusCode: 201, message: 'Market created successfully', data: await marketService.create(req.body) });
  }),
  list: asyncHandler(async (req, res) => {
    sendSuccess(res, { message: 'Markets fetched successfully', ...(await paged(marketService.list(req.query))) });
  }),
  nearby: asyncHandler(async (req, res) => {
    sendSuccess(res, { message: 'Nearby markets fetched successfully', ...(await paged(marketService.nearby(req.query as unknown as { lat: number; lng: number; radius?: number; page?: number; limit?: number }))) });
  }),
  get: asyncHandler(async (req, res) => {
    sendSuccess(res, { message: 'Market fetched successfully', data: await marketService.get(req.params.id) });
  }),
  update: asyncHandler(async (req, res) => {
    sendSuccess(res, { message: 'Market updated successfully', data: await marketService.update(req.params.id, req.body) });
  }),
  prices: asyncHandler(async (req, res) => {
    sendSuccess(res, { message: 'Market prices fetched successfully', ...(await paged(marketPriceService.list({ ...req.query, marketId: req.params.id }))) });
  }),
};

export const cropController = {
  create: asyncHandler(async (req, res) => {
    sendSuccess(res, { statusCode: 201, message: 'Crop created successfully', data: await cropService.create(req.body) });
  }),
  list: asyncHandler(async (req, res) => {
    sendSuccess(res, { message: 'Crops fetched successfully', ...(await paged(cropService.list(req.user, req.query))) });
  }),
  get: asyncHandler(async (req, res) => {
    sendSuccess(res, { message: 'Crop fetched successfully', data: await cropService.get(req.params.id) });
  }),
  update: asyncHandler(async (req, res) => {
    sendSuccess(res, { message: 'Crop updated successfully', data: await cropService.update(req.params.id, req.body) });
  }),
};

export const listingController = {
  create: asyncHandler(async (req, res) => {
    sendSuccess(res, { statusCode: 201, message: 'Listing created successfully', data: await listingService.create(actor(req), req.body, requestMeta(req)) });
  }),
  list: asyncHandler(async (req, res) => {
    sendSuccess(res, { message: 'Listings fetched successfully', ...(await paged(listingService.search(req.user, req.query))) });
  }),
  nearby: asyncHandler(async (req, res) => {
    sendSuccess(res, { message: 'Nearby listings fetched successfully', ...(await paged(listingService.search(req.user, req.query))) });
  }),
  search: asyncHandler(async (req, res) => {
    sendSuccess(res, { message: 'Listings fetched successfully', ...(await paged(listingService.search(req.user, req.query))) });
  }),
  get: asyncHandler(async (req, res) => {
    sendSuccess(res, { message: 'Listing fetched successfully', data: await listingService.get(req.params.id, req.user) });
  }),
  update: asyncHandler(async (req, res) => {
    sendSuccess(res, { message: 'Listing updated successfully', data: await listingService.update(actor(req), req.params.id, req.body, requestMeta(req)) });
  }),
  remove: asyncHandler(async (req, res) => {
    sendSuccess(res, { message: 'Listing deleted successfully', data: await listingService.remove(actor(req), req.params.id) });
  }),
  publish: asyncHandler(async (req, res) => {
    sendSuccess(res, { message: 'Listing published successfully', data: await listingService.publish(actor(req), req.params.id) });
  }),
  cancel: asyncHandler(async (req, res) => {
    sendSuccess(res, { message: 'Listing cancelled successfully', data: await listingService.cancel(actor(req), req.params.id) });
  }),
};

export const requirementController = {
  create: asyncHandler(async (req, res) => {
    sendSuccess(res, { statusCode: 201, message: 'Requirement created successfully', data: await requirementService.create(actor(req), req.body) });
  }),
  list: asyncHandler(async (req, res) => {
    sendSuccess(res, { message: 'Requirements fetched successfully', ...(await paged(requirementService.list(req.user, { ...req.query, mine: req.query.mine === 'true' }))) });
  }),
  get: asyncHandler(async (req, res) => {
    sendSuccess(res, { message: 'Requirement fetched successfully', data: await requirementService.get(req.params.id) });
  }),
  update: asyncHandler(async (req, res) => {
    sendSuccess(res, { message: 'Requirement updated successfully', data: await requirementService.update(actor(req), req.params.id, req.body) });
  }),
  remove: asyncHandler(async (req, res) => {
    sendSuccess(res, { message: 'Requirement cancelled successfully', data: await requirementService.remove(actor(req), req.params.id) });
  }),
};

export const offerController = {
  create: asyncHandler(async (req, res) => {
    sendSuccess(res, { statusCode: 201, message: 'Offer created successfully', data: await offerService.create(actor(req), req.params.listingId, req.body, requestMeta(req)) });
  }),
  listForListing: asyncHandler(async (req, res) => {
    sendSuccess(res, { message: 'Offers fetched successfully', ...(await paged(offerService.listForListing(actor(req), req.params.listingId, req.query))) });
  }),
  mine: asyncHandler(async (req, res) => {
    sendSuccess(res, { message: 'Offers fetched successfully', ...(await paged(offerService.mine(actor(req), req.query))) });
  }),
  received: asyncHandler(async (req, res) => {
    sendSuccess(res, { message: 'Offers fetched successfully', ...(await paged(offerService.received(actor(req), req.query))) });
  }),
  accept: asyncHandler(async (req, res) => {
    sendSuccess(res, { message: 'Offer accepted successfully', data: await offerService.accept(actor(req), req.params.id, requestMeta(req)) });
  }),
  reject: asyncHandler(async (req, res) => {
    sendSuccess(res, { message: 'Offer rejected successfully', data: await offerService.reject(actor(req), req.params.id) });
  }),
  counter: asyncHandler(async (req, res) => {
    sendSuccess(res, { message: 'Offer countered successfully', data: await offerService.counter(actor(req), req.params.id, req.body) });
  }),
  cancel: asyncHandler(async (req, res) => {
    sendSuccess(res, { message: 'Offer cancelled successfully', data: await offerService.cancel(actor(req), req.params.id) });
  }),
};

export const orderController = {
  create: asyncHandler(async (req, res) => {
    const idempotencyKey = req.get('Idempotency-Key') || req.body.idempotencyKey;
    sendSuccess(res, { statusCode: 201, message: 'Order created successfully', data: await orderService.createDirect(actor(req), { ...req.body, idempotencyKey }, requestMeta(req)) });
  }),
  list: asyncHandler(async (req, res) => {
    sendSuccess(res, { message: 'Orders fetched successfully', ...(await paged(orderService.list(actor(req), req.query))) });
  }),
  get: asyncHandler(async (req, res) => {
    sendSuccess(res, { message: 'Order fetched successfully', data: await orderService.get(actor(req), req.params.id) });
  }),
  status: asyncHandler(async (req, res) => {
    sendSuccess(res, { message: 'Order status updated successfully', data: await orderService.transition(actor(req), req.params.id, req.body.status, requestMeta(req)) });
  }),
  cancel: asyncHandler(async (req, res) => {
    sendSuccess(res, { message: 'Order cancelled successfully', data: await orderService.cancel(actor(req), req.params.id, requestMeta(req)) });
  }),
  confirm: asyncHandler(async (req, res) => {
    sendSuccess(res, { message: 'Order confirmed successfully', data: await orderService.confirm(actor(req), req.params.id, requestMeta(req)) });
  }),
  complete: asyncHandler(async (req, res) => {
    sendSuccess(res, { message: 'Order completed successfully', data: await orderService.complete(actor(req), req.params.id, requestMeta(req)) });
  }),
};

export const paymentController = {
  create: asyncHandler(async (req, res) => {
    const idempotencyKey = req.get('Idempotency-Key') || req.body.idempotencyKey;
    sendSuccess(res, { statusCode: 201, message: 'Payment created successfully', data: await paymentService.create(actor(req), { ...req.body, idempotencyKey }, requestMeta(req)) });
  }),
  verify: asyncHandler(async (req, res) => {
    sendSuccess(res, { message: 'Payment verified successfully', data: await paymentService.verify(actor(req), req.body) });
  }),
  webhook: asyncHandler(async (req, res) => {
    const raw = req.rawBody ?? Buffer.from(JSON.stringify(req.body));
    sendSuccess(res, { message: 'Webhook processed', data: await paymentService.webhook(raw, req.get('x-webhook-signature'), req.get('x-razorpay-signature')) });
  }),
  get: asyncHandler(async (req, res) => {
    sendSuccess(res, { message: 'Payment fetched successfully', data: await paymentService.get(actor(req), req.params.id) });
  }),
  refund: asyncHandler(async (req, res) => {
    sendSuccess(res, { message: 'Refund processed successfully', data: await paymentService.refund(actor(req), req.params.id, req.body) });
  }),
};

export const deliveryController = {
  createProfile: asyncHandler(async (req, res) => {
    sendSuccess(res, { statusCode: 201, message: 'Transporter profile created successfully', data: await deliveryService.createProfile(actor(req), req.body) });
  }),
  profile: asyncHandler(async (req, res) => {
    sendSuccess(res, { message: 'Transporter profile fetched successfully', data: await deliveryService.myProfile(actor(req)) });
  }),
  updateProfile: asyncHandler(async (req, res) => {
    sendSuccess(res, { message: 'Transporter profile updated successfully', data: await deliveryService.updateProfile(actor(req), req.body) });
  }),
  create: asyncHandler(async (req, res) => {
    sendSuccess(res, { statusCode: 201, message: 'Delivery created successfully', data: await deliveryService.create(actor(req), req.body, actor(req)) });
  }),
  available: asyncHandler(async (req, res) => {
    sendSuccess(res, { message: 'Available deliveries fetched successfully', ...(await paged(deliveryService.available(actor(req), req.query))) });
  }),
  get: asyncHandler(async (req, res) => {
    sendSuccess(res, { message: 'Delivery fetched successfully', data: await deliveryService.get(actor(req), req.params.id) });
  }),
  status: asyncHandler(async (req, res) => {
    sendSuccess(res, { message: 'Delivery status updated successfully', data: await deliveryService.updateStatus(actor(req), req.params.id, req.body.status, req.body.note) });
  }),
  assign: asyncHandler(async (req, res) => {
    sendSuccess(res, { message: 'Delivery assigned successfully', data: await deliveryService.assign(actor(req), req.params.id, req.body) });
  }),
};

export const priceController = {
  create: asyncHandler(async (req, res) => {
    sendSuccess(res, { statusCode: 201, message: 'Market price saved successfully', data: await marketPriceService.create(req.body) });
  }),
  list: asyncHandler(async (req, res) => {
    sendSuccess(res, { message: 'Market prices fetched successfully', ...(await paged(marketPriceService.list(req.query))) });
  }),
  history: asyncHandler(async (req, res) => {
    sendSuccess(res, { message: 'Price history fetched successfully', ...(await paged(marketPriceService.history(req.params.cropId, req.query))) });
  }),
};

export const matchingController = {
  mine: asyncHandler(async (req, res) => {
    sendSuccess(res, { message: 'Matches fetched successfully', data: await matchingService.mine(actor(req)) });
  }),
};

export const notificationController = {
  list: asyncHandler(async (req, res) => {
    const isRead = req.query.isRead === 'true' ? true : req.query.isRead === 'false' ? false : undefined;
    sendSuccess(res, { message: 'Notifications fetched successfully', ...(await paged(notificationService.list(actor(req).id, { ...req.query, isRead }))) });
  }),
  read: asyncHandler(async (req, res) => {
    sendSuccess(res, { message: 'Notification marked as read', data: await notificationService.markRead(actor(req).id, req.params.id) });
  }),
  readAll: asyncHandler(async (req, res) => {
    sendSuccess(res, { message: 'Notifications marked as read', data: await notificationService.markAllRead(actor(req).id) });
  }),
};

export const chatController = {
  open: asyncHandler(async (req, res) => {
    sendSuccess(res, { statusCode: 201, message: 'Conversation ready', data: await chatService.open(actor(req), req.body) });
  }),
  list: asyncHandler(async (req, res) => {
    sendSuccess(res, { message: 'Conversations fetched successfully', ...(await paged(chatService.list(actor(req), req.query))) });
  }),
  messages: asyncHandler(async (req, res) => {
    sendSuccess(res, { message: 'Messages fetched successfully', ...(await paged(chatService.messages(actor(req), req.params.id, req.query))) });
  }),
  post: asyncHandler(async (req, res) => {
    sendSuccess(res, { statusCode: 201, message: 'Message sent successfully', data: await chatService.postMessage(actor(req), req.params.id, req.body) });
  }),
  read: asyncHandler(async (req, res) => {
    sendSuccess(res, { message: 'Message marked as read', data: await chatService.markRead(actor(req), req.params.id) });
  }),
};

export const reviewController = {
  create: asyncHandler(async (req, res) => {
    sendSuccess(res, { statusCode: 201, message: 'Review submitted successfully', data: await reviewService.create(actor(req), req.body) });
  }),
};

export const disputeController = {
  create: asyncHandler(async (req, res) => {
    sendSuccess(res, { statusCode: 201, message: 'Dispute raised successfully', data: await disputeService.create(actor(req), req.body) });
  }),
  list: asyncHandler(async (req, res) => {
    sendSuccess(res, { message: 'Disputes fetched successfully', ...(await paged(disputeService.list(actor(req), req.query))) });
  }),
  get: asyncHandler(async (req, res) => {
    sendSuccess(res, { message: 'Dispute fetched successfully', data: await disputeService.get(actor(req), req.params.id) });
  }),
  resolve: asyncHandler(async (req, res) => {
    sendSuccess(res, { message: 'Dispute updated successfully', data: await disputeService.resolve(actor(req), req.params.id, req.body) });
  }),
};

export const documentController = {
  upload: asyncHandler(async (req, res) => {
    if (!req.file) throw new BadRequestError('A file is required');
    sendSuccess(res, { statusCode: 201, message: 'Document uploaded successfully', data: await documentService.upload(actor(req), req.file, req.body) });
  }),
  list: asyncHandler(async (req, res) => {
    sendSuccess(res, { message: 'Documents fetched successfully', ...(await paged(documentService.list(actor(req), req.query))) });
  }),
  download: asyncHandler(async (req: Request, res: Response) => {
    const file = await documentService.read(actor(req), req.params.id);
    res.setHeader('Content-Type', file.document.mimeType ?? 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${file.document.fileName ?? 'document'}"`);
    res.status(200).send(file.bytes);
  }),
};

export const adminController = {
  dashboard: asyncHandler(async (_req, res) => {
    sendSuccess(res, { message: 'Dashboard fetched successfully', data: await adminService.dashboard() });
  }),
  users: asyncHandler(async (req, res) => {
    sendSuccess(res, { message: 'Users fetched successfully', ...(await paged(adminService.usersList(req.query))) });
  }),
  farmers: asyncHandler(async (req, res) => {
    sendSuccess(res, { message: 'Farmers fetched successfully', ...(await paged(adminService.listFarmers(req.query))) });
  }),
  buyers: asyncHandler(async (req, res) => {
    sendSuccess(res, { message: 'Buyers fetched successfully', ...(await paged(adminService.listBuyers(req.query))) });
  }),
  fpos: asyncHandler(async (req, res) => {
    sendSuccess(res, { message: 'FPOs fetched successfully', ...(await paged(adminService.listFpos(req.query))) });
  }),
  listings: asyncHandler(async (req, res) => {
    sendSuccess(res, { message: 'Listings fetched successfully', ...(await paged(adminService.listListings(req.query))) });
  }),
  orders: asyncHandler(async (req, res) => {
    sendSuccess(res, { message: 'Orders fetched successfully', ...(await paged(adminService.listOrders(req.query))) });
  }),
  payments: asyncHandler(async (req, res) => {
    sendSuccess(res, { message: 'Payments fetched successfully', ...(await paged(adminService.listPayments(req.query))) });
  }),
  markets: asyncHandler(async (req, res) => {
    sendSuccess(res, { message: 'Markets fetched successfully', ...(await paged(adminService.listMarkets(req.query))) });
  }),
  disputes: asyncHandler(async (req, res) => {
    sendSuccess(res, { message: 'Disputes fetched successfully', ...(await paged(adminService.listDisputes(req.query))) });
  }),
  audits: asyncHandler(async (req, res) => {
    sendSuccess(res, { message: 'Audit logs fetched successfully', ...(await paged(adminService.auditLogs(req.query))) });
  }),
  verifyFarmer: asyncHandler(async (req, res) => {
    const data = await farmerService.setVerification(req.params.id, req.body.status);
    await auditService.record({ userId: actor(req).id, action: 'USER_VERIFIED', entity: 'FarmerProfile', entityId: req.params.id, newValue: { status: req.body.status }, meta: requestMeta(req) });
    sendSuccess(res, { message: 'Farmer verification updated', data });
  }),
  verifyBuyer: asyncHandler(async (req, res) => {
    const data = await buyerService.setVerification(req.params.id, req.body.status);
    await auditService.record({ userId: actor(req).id, action: 'USER_VERIFIED', entity: 'BuyerProfile', entityId: req.params.id, newValue: { status: req.body.status }, meta: requestMeta(req) });
    sendSuccess(res, { message: 'Buyer verification updated', data });
  }),
  verifyFpo: asyncHandler(async (req, res) => {
    const data = await fpoService.setVerification(req.params.id, req.body.status);
    await auditService.record({ userId: actor(req).id, action: 'USER_VERIFIED', entity: 'Fpo', entityId: req.params.id, newValue: { status: req.body.status }, meta: requestMeta(req) });
    sendSuccess(res, { message: 'FPO verification updated', data });
  }),
  verifyTransporter: asyncHandler(async (req, res) => {
    sendSuccess(res, { message: 'Transporter verification updated', data: await deliveryService.setVerification(req.params.id, req.body.status) });
  }),
  block: asyncHandler(async (req, res) => {
    const data = await userService.setBlocked(actor(req), req.params.id, req.body.isBlocked, async (userId) => {
      await auditService.record({ userId: actor(req).id, action: 'USER_BLOCKED', entity: 'User', entityId: userId, newValue: { isBlocked: req.body.isBlocked }, meta: requestMeta(req) });
    });
    sendSuccess(res, { message: 'User updated successfully', data });
  }),
  roles: asyncHandler(async (req, res) => {
    sendSuccess(res, { message: 'Roles updated successfully', data: await userService.setRoles(actor(req), req.params.id, req.body.roles) });
  }),
};

export const healthController = {
  live: asyncHandler(async (_req, res) => {
    const redis = (await pingRedis()) ? 'connected' : 'disconnected';
    const database = databaseStatus();
    sendSuccess(res, {
      message: 'Health check completed',
      data: {
        status: database === 'connected' && redis === 'connected' ? 'healthy' : 'degraded',
        database,
        redis,
        timestamp: new Date().toISOString(),
      },
    });
  }),
  database: asyncHandler(async (_req, res) => {
    const database = databaseStatus();
    res.status(database === 'connected' ? 200 : 503).json({
      success: database === 'connected',
      message: database === 'connected' ? 'Database is connected' : 'Database is disconnected',
      data: { status: database === 'connected' ? 'healthy' : 'unhealthy', database, timestamp: new Date().toISOString() },
      meta: null,
    });
  }),
  redis: asyncHandler(async (_req, res) => {
    const connected = await pingRedis();
    res.status(connected ? 200 : 503).json({
      success: connected,
      message: connected ? 'Redis is connected' : 'Redis is disconnected',
      data: { status: connected ? 'healthy' : 'unhealthy', redis: connected ? 'connected' : 'disconnected', timestamp: new Date().toISOString() },
      meta: null,
    });
  }),
};

async function paged(result: Promise<{ items: unknown; meta: { page: number; limit: number; total: number; totalPages: number } }>) {
  const resolved = await result;
  return { data: resolved.items, meta: resolved.meta };
}
