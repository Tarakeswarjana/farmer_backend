import { Router } from 'express';
import {
  adminController,
  authController,
  buyerController,
  chatController,
  cropController,
  deliveryController,
  disputeController,
  documentController,
  farmerController,
  fpoController,
  listingController,
  marketController,
  matchingController,
  notificationController,
  offerController,
  orderController,
  paymentController,
  priceController,
  requirementController,
  reviewController,
  userController,
} from '../../controllers';
import { registerRoute } from '../../docs/swagger/registerRoute';
import { authRateLimit, sensitiveAuthRateLimit } from '../../middlewares/rateLimiter';
import { uploadSingle } from '../../middlewares/upload';
import { z } from '../../openapi/setup';
import {
  BuyerSchema,
  ConversationSchema,
  CropSchema,
  DeliverySchema,
  DisputeSchema,
  DocumentSchema,
  FarmerSchema,
  FpoSchema,
  ListingSchema,
  MarketPriceSchema,
  MarketSchema,
  MessageSchema,
  NotificationSchema,
  OfferSchema,
  OrderSchema,
  PaymentSchema,
  RequirementSchema,
  ReviewSchema,
  UserSchema,
  assignBody,
  blockBody,
  buyerBody,
  buyerIdParams,
  changePasswordBody,
  conversationBody,
  counterBody,
  cropBody,
  cropIdParams,
  deliveryBody,
  deliveryStatusBody,
  disputeBody,
  farmerBody,
  farmerIdParams,
  farmerPatch,
  fpoBody,
  idParams,
  identifierBody,
  listQuery,
  listingBody,
  listingIdParams,
  listingQuery,
  locationBody,
  loginBody,
  marketBody,
  memberBody,
  memberParams,
  messageBody,
  nearbyQuery,
  objectIdSchema,
  offerBody,
  ok,
  orderBody,
  page,
  paymentCreateBody,
  paymentVerifyBody,
  priceBody,
  refreshBody,
  refundBody,
  registerBody,
  requirementBody,
  resetBody,
  resolveBody,
  reviewBody,
  rolesBody,
  simplePage,
  statusBody,
  transporterBody,
  updateMeBody,
  userIdParams,
  verificationBody,
  verifyEmailBody,
  verifyPhoneBody,
} from '../../validators/schemas';

const adminRoles = ['ADMIN', 'SUPER_ADMIN'] as const;
const buyerRoles = ['BUYER', 'TRADER', 'RETAILER', 'RESTAURANT'] as const;
const farmerRoles = ['FARMER', 'FPO_ADMIN'] as const;
const marketRoles = ['ADMIN', 'MARKET_MANAGER'] as const;

export const v1Router = Router();

const auth = Router();
auth.use(authRateLimit);
registerRoute({ router: auth, method: 'post', path: '/register', openApiPath: '/api/v1/auth/register', tag: 'Authentication', summary: 'Register a user', description: 'Registers a farmer, buyer, trader, retailer, restaurant, or transporter. A phone verification code is issued. Non-production responses include debugCode so local development does not need an SMS provider.', body: registerBody, successStatus: 201, successSchema: ok(z.object({ user: UserSchema, debugCode: z.string().optional() })), errors: [409], handlers: [authController.register] });
registerRoute({ router: auth, method: 'post', path: '/login', openApiPath: '/api/v1/auth/login', tag: 'Authentication', summary: 'Log in', description: 'Accepts a phone number or email plus password and returns a short-lived access token and a rotating refresh token.', body: loginBody, successSchema: ok(z.object({ user: UserSchema, accessToken: z.string(), refreshToken: z.string() })), errors: [401, 403], handlers: [authController.login] });
registerRoute({ router: auth, method: 'post', path: '/refresh-token', openApiPath: '/api/v1/auth/refresh-token', tag: 'Authentication', summary: 'Rotate refresh token', description: 'Issues a new access token and refresh token. Reuse of a revoked refresh token revokes the token family.', body: refreshBody, successSchema: ok(z.object({ user: UserSchema, accessToken: z.string(), refreshToken: z.string() })), errors: [401], handlers: [authController.refresh] });
registerRoute({ router: auth, method: 'post', path: '/logout', openApiPath: '/api/v1/auth/logout', tag: 'Authentication', summary: 'Log out', description: 'Revokes the presented refresh token.', auth: true, body: refreshBody, successSchema: ok(z.object({ loggedOut: z.boolean() })), handlers: [authController.logout] });
registerRoute({ router: auth, method: 'post', path: '/forgot-password', openApiPath: '/api/v1/auth/forgot-password', tag: 'Authentication', summary: 'Request a password reset code', description: 'Always returns the same message so accounts cannot be enumerated. Non-production responses include debugCode when the account exists.', body: identifierBody, successSchema: ok(z.object({ message: z.string(), debugCode: z.string().optional() })), handlers: [sensitiveAuthRateLimit, authController.forgot] });
registerRoute({ router: auth, method: 'post', path: '/reset-password', openApiPath: '/api/v1/auth/reset-password', tag: 'Authentication', summary: 'Reset password', description: 'Sets a new password using a valid reset code and revokes existing refresh tokens.', body: resetBody, successSchema: ok(z.object({ reset: z.boolean() })), errors: [400], handlers: [sensitiveAuthRateLimit, authController.reset] });
registerRoute({ router: auth, method: 'post', path: '/verify-phone', openApiPath: '/api/v1/auth/verify-phone', tag: 'Authentication', summary: 'Verify phone', description: 'Confirms the 6-digit phone verification code.', body: verifyPhoneBody, successSchema: ok(UserSchema), errors: [400], handlers: [authController.verifyPhone] });
registerRoute({ router: auth, method: 'post', path: '/verify-email', openApiPath: '/api/v1/auth/verify-email', tag: 'Authentication', summary: 'Verify email', description: 'Confirms the 6-digit email verification code.', body: verifyEmailBody, successSchema: ok(UserSchema), errors: [400], handlers: [authController.verifyEmail] });
v1Router.use('/auth', auth);

const users = Router();
registerRoute({ router: users, method: 'get', path: '/me', openApiPath: '/api/v1/users/me', tag: 'Users', summary: 'Get current user', description: 'Returns the authenticated user and linked business profile ids.', auth: true, successSchema: ok(UserSchema), handlers: [userController.me] });
registerRoute({ router: users, method: 'patch', path: '/me', openApiPath: '/api/v1/users/me', tag: 'Users', summary: 'Update current user', description: 'Updates name, email, or profile image. Changing email clears email verification.', auth: true, body: updateMeBody, successSchema: ok(UserSchema), errors: [409], handlers: [userController.update] });
registerRoute({ router: users, method: 'patch', path: '/me/location', openApiPath: '/api/v1/users/me/location', tag: 'Users', summary: 'Update current location', description: 'Stores a GeoJSON point for the signed-in user.', auth: true, body: locationBody, successSchema: ok(UserSchema), handlers: [userController.location] });
registerRoute({ router: users, method: 'patch', path: '/me/change-password', openApiPath: '/api/v1/users/me/change-password', tag: 'Users', summary: 'Change password', description: 'Verifies the current password, stores a new hash, and revokes refresh tokens.', auth: true, body: changePasswordBody, successSchema: ok(z.object({ changed: z.boolean() })), errors: [400], handlers: [userController.password] });
registerRoute({ router: users, method: 'get', path: '/:userId/reviews', openApiPath: '/api/v1/users/{userId}/reviews', tag: 'Reviews', summary: 'List reviews for a user', description: 'Returns paginated reviews written about the user.', params: userIdParams, query: simplePage, successSchema: page(ReviewSchema), handlers: [userController.reviews] });
v1Router.use('/users', users);

const farmers = Router();
registerRoute({ router: farmers, method: 'post', path: '/profile', openApiPath: '/api/v1/farmers/profile', tag: 'Farmers', summary: 'Create farmer profile', description: 'Creates the farm profile used for listings. Bank account numbers are encrypted and only a masked value is returned.', auth: true, roles: farmerRoles, body: farmerBody, successStatus: 201, successSchema: ok(FarmerSchema), errors: [409, 422], handlers: [farmerController.create] });
registerRoute({ router: farmers, method: 'get', path: '/profile', openApiPath: '/api/v1/farmers/profile', tag: 'Farmers', summary: 'Get my farmer profile', description: 'Returns the signed-in farmer profile, including masked bank details.', auth: true, roles: farmerRoles, successSchema: ok(FarmerSchema), errors: [404], handlers: [farmerController.mine] });
registerRoute({ router: farmers, method: 'patch', path: '/profile', openApiPath: '/api/v1/farmers/profile', tag: 'Farmers', summary: 'Update my farmer profile', description: 'Updates farm details. Verification status cannot be changed here.', auth: true, roles: farmerRoles, body: farmerPatch, successSchema: ok(FarmerSchema), handlers: [farmerController.update] });
registerRoute({ router: farmers, method: 'get', path: '/nearby', openApiPath: '/api/v1/farmers/nearby', tag: 'Farmers', summary: 'Find nearby farmers', description: 'Geo search of verified farmers. Radius is in meters.', query: nearbyQuery, successSchema: page(FarmerSchema), errors: [422], handlers: [farmerController.nearby] });
registerRoute({ router: farmers, method: 'get', path: '/me/listings', openApiPath: '/api/v1/farmers/me/listings', tag: 'Listings', summary: 'List my listings', description: 'Returns the signed-in farmer listings, including drafts.', auth: true, roles: farmerRoles, query: listingQuery, successSchema: page(ListingSchema), handlers: [farmerController.listings] });
registerRoute({ router: farmers, method: 'get', path: '/:farmerId', openApiPath: '/api/v1/farmers/{farmerId}', tag: 'Farmers', summary: 'Get a farmer profile', description: 'Public farmer profile. Bank details are omitted.', params: farmerIdParams, successSchema: ok(FarmerSchema), errors: [404], handlers: [farmerController.get] });
v1Router.use('/farmers', farmers);

const buyers = Router();
registerRoute({ router: buyers, method: 'post', path: '/profile', openApiPath: '/api/v1/buyers/profile', tag: 'Buyers', summary: 'Create buyer profile', description: 'Creates a wholesale, trader, retailer, restaurant, hotel, or processor profile.', auth: true, roles: buyerRoles, body: buyerBody, successStatus: 201, successSchema: ok(BuyerSchema), errors: [409], handlers: [buyerController.create] });
registerRoute({ router: buyers, method: 'get', path: '/profile', openApiPath: '/api/v1/buyers/profile', tag: 'Buyers', summary: 'Get my buyer profile', description: 'Returns the signed-in buyer profile.', auth: true, roles: buyerRoles, successSchema: ok(BuyerSchema), errors: [404], handlers: [buyerController.mine] });
registerRoute({ router: buyers, method: 'patch', path: '/profile', openApiPath: '/api/v1/buyers/profile', tag: 'Buyers', summary: 'Update my buyer profile', description: 'Updates business details. Verification status cannot be changed here.', auth: true, roles: buyerRoles, body: buyerBody.partial(), successSchema: ok(BuyerSchema), handlers: [buyerController.update] });
registerRoute({ router: buyers, method: 'get', path: '/nearby', openApiPath: '/api/v1/buyers/nearby', tag: 'Buyers', summary: 'Find nearby buyers', description: 'Geo search of verified buyers. Radius is in meters.', query: nearbyQuery, successSchema: page(BuyerSchema), handlers: [buyerController.nearby] });
registerRoute({ router: buyers, method: 'get', path: '/:buyerId', openApiPath: '/api/v1/buyers/{buyerId}', tag: 'Buyers', summary: 'Get a buyer profile', description: 'Public buyer profile without GST or direct contact details.', params: buyerIdParams, successSchema: ok(BuyerSchema), errors: [404], handlers: [buyerController.get] });
v1Router.use('/buyers', buyers);

const fpos = Router();
registerRoute({ router: fpos, method: 'post', path: '/', openApiPath: '/api/v1/fpos', tag: 'FPOs', summary: 'Create an FPO', description: 'Creates a Farmer Producer Organisation. The creator becomes its admin.', auth: true, roles: ['FARMER', 'FPO_ADMIN', 'ADMIN'], body: fpoBody, successStatus: 201, successSchema: ok(FpoSchema), errors: [409], handlers: [fpoController.create] });
registerRoute({ router: fpos, method: 'get', path: '/', openApiPath: '/api/v1/fpos', tag: 'FPOs', summary: 'List FPOs', description: 'Paginated FPO directory. Filter by district.', query: listQuery.extend({ district: z.string().optional(), sortBy: z.enum(['createdAt', 'name', 'district']).optional() }), successSchema: page(FpoSchema), handlers: [fpoController.list] });
registerRoute({ router: fpos, method: 'get', path: '/:id', openApiPath: '/api/v1/fpos/{id}', tag: 'FPOs', summary: 'Get an FPO', description: 'Returns one FPO.', params: idParams, successSchema: ok(FpoSchema), errors: [404], handlers: [fpoController.get] });
registerRoute({ router: fpos, method: 'patch', path: '/:id', openApiPath: '/api/v1/fpos/{id}', tag: 'FPOs', summary: 'Update an FPO', description: 'Updates an FPO. Only its admin or a platform admin can update it.', auth: true, roles: ['FARMER', 'FPO_ADMIN', 'ADMIN'], params: idParams, body: fpoBody.partial(), successSchema: ok(FpoSchema), errors: [404], handlers: [fpoController.update] });
registerRoute({ router: fpos, method: 'post', path: '/:id/members', openApiPath: '/api/v1/fpos/{id}/members', tag: 'FPOs', summary: 'Add an FPO member', description: 'Adds a farmer profile to the FPO.', auth: true, roles: ['FARMER', 'FPO_ADMIN', 'ADMIN'], params: idParams, body: memberBody, successSchema: ok(FpoSchema), errors: [404, 409], handlers: [fpoController.addMember] });
registerRoute({ router: fpos, method: 'delete', path: '/:id/members/:farmerId', openApiPath: '/api/v1/fpos/{id}/members/{farmerId}', tag: 'FPOs', summary: 'Remove an FPO member', description: 'Removes a farmer profile from the FPO.', auth: true, roles: ['FARMER', 'FPO_ADMIN', 'ADMIN'], params: memberParams, successSchema: ok(FpoSchema), errors: [404], handlers: [fpoController.removeMember] });
registerRoute({ router: fpos, method: 'get', path: '/:id/members', openApiPath: '/api/v1/fpos/{id}/members', tag: 'FPOs', summary: 'List FPO members', description: 'Paginated farmer profiles that belong to the FPO.', params: idParams, query: simplePage, successSchema: page(FarmerSchema), errors: [404], handlers: [fpoController.members] });
v1Router.use('/fpos', fpos);

const markets = Router();
registerRoute({ router: markets, method: 'post', path: '/', openApiPath: '/api/v1/markets', tag: 'Markets', summary: 'Create a market', description: 'Creates a mandi, krishak bazar, wholesale market, retail market, or collection center.', auth: true, roles: marketRoles, body: marketBody, successStatus: 201, successSchema: ok(MarketSchema), errors: [409], handlers: [marketController.create] });
registerRoute({ router: markets, method: 'get', path: '/', openApiPath: '/api/v1/markets', tag: 'Markets', summary: 'List markets', description: 'Lists active markets. q matches haat name, village, block, district, or address. Also supports district and market type filters.', query: listQuery.extend({ district: z.string().optional(), marketType: z.string().optional(), sortBy: z.enum(['name', 'createdAt', 'district']).optional() }), successSchema: page(MarketSchema), handlers: [marketController.list] });
registerRoute({ router: markets, method: 'get', path: '/nearby', openApiPath: '/api/v1/markets/nearby', tag: 'Markets', summary: 'Find nearby markets', description: 'Example: /api/v1/markets/nearby?lat=22.72&lng=88.48&radius=20000', query: nearbyQuery, successSchema: page(MarketSchema), handlers: [marketController.nearby] });
registerRoute({ router: markets, method: 'get', path: '/:id', openApiPath: '/api/v1/markets/{id}', tag: 'Markets', summary: 'Get a market', description: 'Returns one market.', params: idParams, successSchema: ok(MarketSchema), errors: [404], handlers: [marketController.get] });
registerRoute({ router: markets, method: 'patch', path: '/:id', openApiPath: '/api/v1/markets/{id}', tag: 'Markets', summary: 'Update a market', description: 'Updates market details. Commission rate is a percentage such as 2.5.', auth: true, roles: marketRoles, params: idParams, body: marketBody.partial(), successSchema: ok(MarketSchema), errors: [404], handlers: [marketController.update] });
registerRoute({ router: markets, method: 'get', path: '/:id/prices', openApiPath: '/api/v1/markets/{id}/prices', tag: 'Market Prices', summary: 'Prices at a market', description: 'Historical and current prices recorded for this market.', params: idParams, query: simplePage.extend({ cropId: objectIdSchema.optional(), from: z.string().optional(), to: z.string().optional() }), successSchema: page(MarketPriceSchema), handlers: [marketController.prices] });
v1Router.use('/markets', markets);

const crops = Router();
registerRoute({ router: crops, method: 'post', path: '/', openApiPath: '/api/v1/crops', tag: 'Crops', summary: 'Create a crop', description: 'Adds a vegetable to the master catalog.', auth: true, roles: adminRoles, body: cropBody, successStatus: 201, successSchema: ok(CropSchema), errors: [409], handlers: [cropController.create] });
registerRoute({ router: crops, method: 'get', path: '/', openApiPath: '/api/v1/crops', tag: 'Crops', summary: 'List crops', description: 'Returns active vegetables. q matches English name, Bengali name, or local names. Also supports category.', query: listQuery.extend({ category: z.string().optional(), sortBy: z.enum(['name', 'createdAt', 'category']).optional() }), successSchema: page(CropSchema), handlers: [cropController.list] });
registerRoute({ router: crops, method: 'get', path: '/:id', openApiPath: '/api/v1/crops/{id}', tag: 'Crops', summary: 'Get a crop', description: 'Returns one crop.', params: idParams, successSchema: ok(CropSchema), errors: [404], handlers: [cropController.get] });
registerRoute({ router: crops, method: 'patch', path: '/:id', openApiPath: '/api/v1/crops/{id}', tag: 'Crops', summary: 'Update a crop', description: 'Updates master data. Admins only.', auth: true, roles: adminRoles, params: idParams, body: cropBody.partial(), successSchema: ok(CropSchema), errors: [404], handlers: [cropController.update] });
v1Router.use('/crops', crops);

const listings = Router();
registerRoute({ router: listings, method: 'post', path: '/', openApiPath: '/api/v1/listings', tag: 'Listings', summary: 'Create a listing', description: 'Creates a draft vegetable listing for the signed-in farmer. A farm profile is created from the account when one does not exist yet. Publishing still requires a verified farmer. Prices are rupees.', auth: true, roles: farmerRoles, body: listingBody, successStatus: 201, successSchema: ok(ListingSchema), errors: [422], handlers: [listingController.create] });
registerRoute({ router: listings, method: 'get', path: '/', openApiPath: '/api/v1/listings', tag: 'Listings', summary: 'Search listings', description: 'Filter live supply by crop, district, market, price, quantity, quality, and dates. Example: /api/v1/listings?crop=tomato&district=North%2024%20Parganas&page=1&limit=20', query: listingQuery, successSchema: page(ListingSchema), handlers: [listingController.list] });
registerRoute({ router: listings, method: 'get', path: '/nearby', openApiPath: '/api/v1/listings/nearby', tag: 'Listings', summary: 'Nearby listings', description: 'Geo search of live listings.', query: nearbyQuery.extend({ crop: z.string().optional(), status: z.string().optional() }), successSchema: page(ListingSchema), handlers: [listingController.nearby] });
registerRoute({ router: listings, method: 'get', path: '/search', openApiPath: '/api/v1/listings/search', tag: 'Listings', summary: 'Text search listings', description: 'q matches listing title, vegetable name in English, Bengali, or local script, and haat or market name. The same filters as the listing index still apply.', query: listingQuery, successSchema: page(ListingSchema), handlers: [listingController.search] });
registerRoute({ router: listings, method: 'get', path: '/:id', openApiPath: '/api/v1/listings/{id}', tag: 'Listings', summary: 'Get a listing', description: 'Returns one listing. Drafts are visible to the owner and admins.', params: idParams, successSchema: ok(ListingSchema), errors: [404], handlers: [listingController.get] });
registerRoute({ router: listings, method: 'patch', path: '/:id', openApiPath: '/api/v1/listings/{id}', tag: 'Listings', summary: 'Update a listing', description: 'Owner update. Quantity cannot drop below the reserved amount.', auth: true, roles: farmerRoles, params: idParams, body: listingBody.partial(), successSchema: ok(ListingSchema), errors: [422], handlers: [listingController.update] });
registerRoute({ router: listings, method: 'delete', path: '/:id', openApiPath: '/api/v1/listings/{id}', tag: 'Listings', summary: 'Delete a listing', description: 'Deletes a draft. Published listings are cancelled.', auth: true, roles: farmerRoles, params: idParams, successSchema: ok(z.object({ deleted: z.boolean().optional() }).passthrough()), handlers: [listingController.remove] });
registerRoute({ router: listings, method: 'patch', path: '/:id/publish', openApiPath: '/api/v1/listings/{id}/publish', tag: 'Listings', summary: 'Publish a listing', description: 'Moves a draft to ACTIVE for the signed-in farmer. The farm profile is marked verified when the listing goes live.', auth: true, roles: farmerRoles, params: idParams, successSchema: ok(ListingSchema), errors: [409], handlers: [listingController.publish] });
registerRoute({ router: listings, method: 'patch', path: '/:id/cancel', openApiPath: '/api/v1/listings/{id}/cancel', tag: 'Listings', summary: 'Cancel a listing', description: 'Cancels a listing and rejects open offers.', auth: true, roles: farmerRoles, params: idParams, successSchema: ok(ListingSchema), errors: [409], handlers: [listingController.cancel] });
registerRoute({ router: listings, method: 'post', path: '/:listingId/offers', openApiPath: '/api/v1/listings/{listingId}/offers', tag: 'Offers', summary: 'Make an offer', description: 'A verified buyer bids on a live listing. Quantity must be positive and not greater than available quantity. Duplicate open offers are rejected.', auth: true, roles: buyerRoles, params: listingIdParams, body: offerBody, successStatus: 201, successSchema: ok(OfferSchema), errors: [409, 422], handlers: [offerController.create] });
registerRoute({ router: listings, method: 'get', path: '/:listingId/offers', openApiPath: '/api/v1/listings/{listingId}/offers', tag: 'Offers', summary: 'List offers on a listing', description: 'The listing owner sees every offer. A buyer sees only their own.', auth: true, params: listingIdParams, query: simplePage, successSchema: page(OfferSchema), handlers: [offerController.listForListing] });
v1Router.use('/listings', listings);

const requirements = Router();
registerRoute({ router: requirements, method: 'post', path: '/', openApiPath: '/api/v1/requirements', tag: 'Requirements', summary: 'Post a purchase requirement', description: 'A verified buyer posts demand, for example 1000 KG of tomato at a target price.', auth: true, roles: buyerRoles, body: requirementBody, successStatus: 201, successSchema: ok(RequirementSchema), errors: [422], handlers: [requirementController.create] });
registerRoute({ router: requirements, method: 'get', path: '/', openApiPath: '/api/v1/requirements', tag: 'Requirements', summary: 'List requirements', description: 'Lists open buyer demand. Pass mine=true to see your own requirements.', auth: true, query: listQuery.extend({ cropId: objectIdSchema.optional(), marketId: objectIdSchema.optional(), district: z.string().optional(), mine: z.enum(['true', 'false']).optional(), sortBy: z.enum(['createdAt', 'requiredDate', 'quantity']).optional() }), successSchema: page(RequirementSchema), handlers: [requirementController.list] });
registerRoute({ router: requirements, method: 'get', path: '/:id', openApiPath: '/api/v1/requirements/{id}', tag: 'Requirements', summary: 'Get a requirement', description: 'Returns one purchase requirement.', auth: true, params: idParams, successSchema: ok(RequirementSchema), errors: [404], handlers: [requirementController.get] });
registerRoute({ router: requirements, method: 'patch', path: '/:id', openApiPath: '/api/v1/requirements/{id}', tag: 'Requirements', summary: 'Update a requirement', description: 'The owning buyer can update quantity, price, date, or status.', auth: true, roles: buyerRoles, params: idParams, body: requirementBody.partial().extend({ status: z.enum(['OPEN', 'FULFILLED', 'CANCELLED']).optional() }), successSchema: ok(RequirementSchema), handlers: [requirementController.update] });
registerRoute({ router: requirements, method: 'delete', path: '/:id', openApiPath: '/api/v1/requirements/{id}', tag: 'Requirements', summary: 'Cancel a requirement', description: 'Marks the requirement cancelled.', auth: true, roles: buyerRoles, params: idParams, successSchema: ok(RequirementSchema), handlers: [requirementController.remove] });
v1Router.use('/requirements', requirements);

const offers = Router();
registerRoute({ router: offers, method: 'get', path: '/my', openApiPath: '/api/v1/offers/my', tag: 'Offers', summary: 'My offers', description: 'Offers created by the signed-in buyer.', auth: true, roles: buyerRoles, query: simplePage.extend({ status: z.string().optional() }), successSchema: page(OfferSchema), handlers: [offerController.mine] });
registerRoute({ router: offers, method: 'get', path: '/received', openApiPath: '/api/v1/offers/received', tag: 'Offers', summary: 'Offers received', description: 'Offers received by the signed-in farmer.', auth: true, roles: farmerRoles, query: simplePage.extend({ status: z.string().optional() }), successSchema: page(OfferSchema), handlers: [offerController.received] });
registerRoute({ router: offers, method: 'patch', path: '/:id/accept', openApiPath: '/api/v1/offers/{id}/accept', tag: 'Offers', summary: 'Accept an offer', description: 'Atomically reserves quantity, creates an order, and accepts the offer. Only the listing owner can accept a new offer. A buyer can accept after the farmer counters. Expired offers are rejected.', auth: true, params: idParams, successSchema: ok(OrderSchema), errors: [403, 409, 422], handlers: [offerController.accept] });
registerRoute({ router: offers, method: 'patch', path: '/:id/reject', openApiPath: '/api/v1/offers/{id}/reject', tag: 'Offers', summary: 'Reject an offer', description: 'Only the listing owner can reject an offer.', auth: true, roles: farmerRoles, params: idParams, successSchema: ok(OfferSchema), errors: [403, 409], handlers: [offerController.reject] });
registerRoute({ router: offers, method: 'patch', path: '/:id/counter', openApiPath: '/api/v1/offers/{id}/counter', tag: 'Offers', summary: 'Counter an offer', description: 'The other party proposes a new price and quantity. The latest terms become the offer.', auth: true, params: idParams, body: counterBody, successSchema: ok(OfferSchema), errors: [422], handlers: [offerController.counter] });
registerRoute({ router: offers, method: 'patch', path: '/:id/cancel', openApiPath: '/api/v1/offers/{id}/cancel', tag: 'Offers', summary: 'Cancel an offer', description: 'The buyer or farmer cancels an open offer.', auth: true, params: idParams, successSchema: ok(OfferSchema), errors: [409], handlers: [offerController.cancel] });
v1Router.use('/offers', offers);

const orders = Router();
registerRoute({ router: orders, method: 'post', path: '/', openApiPath: '/api/v1/orders', tag: 'Orders', summary: 'Buy a listing directly', description: 'Creates an order at the listing expected price and reserves quantity inside a transaction. Send Idempotency-Key to make retries safe. Order numbers look like VEG-2026-000001.', auth: true, roles: buyerRoles, body: orderBody, successStatus: 201, successSchema: ok(OrderSchema), errors: [409, 422], handlers: [orderController.create] });
registerRoute({ router: orders, method: 'get', path: '/', openApiPath: '/api/v1/orders', tag: 'Orders', summary: 'List my orders', description: 'Buyers see purchases and farmers see sales. Admins see every order.', auth: true, query: simplePage.extend({ status: z.string().optional(), sortBy: z.enum(['createdAt', 'orderStatus']).optional() }), successSchema: page(OrderSchema), handlers: [orderController.list] });
registerRoute({ router: orders, method: 'get', path: '/:id', openApiPath: '/api/v1/orders/{id}', tag: 'Orders', summary: 'Get an order', description: 'Returns one order when the caller is a party or an admin.', auth: true, params: idParams, successSchema: ok(OrderSchema), errors: [404], handlers: [orderController.get] });
registerRoute({ router: orders, method: 'patch', path: '/:id/status', openApiPath: '/api/v1/orders/{id}/status', tag: 'Orders', summary: 'Change order status', description: 'Applies an allowed status transition. Invalid jumps return 409.', auth: true, params: idParams, body: statusBody, successSchema: ok(OrderSchema), errors: [409], handlers: [orderController.status] });
registerRoute({ router: orders, method: 'post', path: '/:id/cancel', openApiPath: '/api/v1/orders/{id}/cancel', tag: 'Orders', summary: 'Cancel an order', description: 'Cancels an order that has not been picked up and releases reserved quantity. Paid orders must be refunded first unless an admin cancels them.', auth: true, params: idParams, successSchema: ok(OrderSchema), errors: [409, 422], handlers: [orderController.cancel] });
registerRoute({ router: orders, method: 'post', path: '/:id/confirm', openApiPath: '/api/v1/orders/{id}/confirm', tag: 'Orders', summary: 'Confirm an order', description: 'The farmer confirms a pending order. Repeating the call is safe.', auth: true, roles: farmerRoles, params: idParams, successSchema: ok(OrderSchema), errors: [409], handlers: [orderController.confirm] });
registerRoute({ router: orders, method: 'post', path: '/:id/complete', openApiPath: '/api/v1/orders/{id}/complete', tag: 'Orders', summary: 'Complete an order', description: 'Marks a delivered order completed. Only completed orders can be reviewed.', auth: true, params: idParams, successSchema: ok(OrderSchema), errors: [409], handlers: [orderController.complete] });
v1Router.use('/orders', orders);

const payments = Router();
registerRoute({ router: payments, method: 'post', path: '/create', openApiPath: '/api/v1/payments/create', tag: 'Payments', summary: 'Create a payment', description: 'Creates a provider-neutral payment for an order. Cash, UPI, bank transfer, and Razorpay are selected through the provider interface. Without Razorpay credentials the Razorpay method uses the local mock provider.', auth: true, roles: buyerRoles, body: paymentCreateBody, successStatus: 201, successSchema: ok(z.object({ payment: PaymentSchema, providerPayload: z.record(z.unknown()) })), errors: [409, 422], handlers: [paymentController.create] });
registerRoute({ router: payments, method: 'post', path: '/verify', openApiPath: '/api/v1/payments/verify', tag: 'Payments', summary: 'Verify a payment', description: 'Confirms cash or manual payments by a party to the order. Mock and Razorpay payments require a signature. Repeating a successful verification is safe.', auth: true, body: paymentVerifyBody, successSchema: ok(PaymentSchema), errors: [400], handlers: [paymentController.verify] });
registerRoute({ router: payments, method: 'post', path: '/webhook', openApiPath: '/api/v1/payments/webhook', tag: 'Payments', summary: 'Payment webhook', description: 'Idempotent webhook. Sign the raw body with HMAC SHA256 and send it as x-webhook-signature. Repeat deliveries of the same eventId are acknowledged without applying twice.', successSchema: ok(z.object({ received: z.boolean(), duplicate: z.boolean() })), errors: [401], handlers: [paymentController.webhook] });
registerRoute({ router: payments, method: 'get', path: '/:id', openApiPath: '/api/v1/payments/{id}', tag: 'Payments', summary: 'Get a payment', description: 'Returns one payment for a party to the order or an admin.', auth: true, params: idParams, successSchema: ok(PaymentSchema), errors: [404], handlers: [paymentController.get] });
registerRoute({ router: payments, method: 'post', path: '/:id/refund', openApiPath: '/api/v1/payments/{id}/refund', tag: 'Payments', summary: 'Refund a payment', description: 'Refunds a successful payment in full or in part. A completed full refund is idempotent.', auth: true, params: idParams, body: refundBody, successSchema: ok(PaymentSchema), errors: [409, 422], handlers: [paymentController.refund] });
v1Router.use('/payments', payments);

const deliveries = Router();
registerRoute({ router: deliveries, method: 'post', path: '/', openApiPath: '/api/v1/deliveries', tag: 'Deliveries', summary: 'Create a delivery', description: 'Opens a delivery request for an order. Repeating the call returns the existing delivery.', auth: true, body: deliveryBody, successStatus: 201, successSchema: ok(DeliverySchema), errors: [409], handlers: [deliveryController.create] });
registerRoute({ router: deliveries, method: 'get', path: '/available', openApiPath: '/api/v1/deliveries/available', tag: 'Deliveries', summary: 'List unassigned deliveries', description: 'Deliveries waiting for a transporter.', auth: true, roles: ['TRANSPORTER', 'ADMIN'], query: simplePage, successSchema: page(DeliverySchema), handlers: [deliveryController.available] });
registerRoute({ router: deliveries, method: 'get', path: '/:id', openApiPath: '/api/v1/deliveries/{id}', tag: 'Deliveries', summary: 'Get a delivery', description: 'Returns delivery details and tracking events.', auth: true, params: idParams, successSchema: ok(DeliverySchema), errors: [404], handlers: [deliveryController.get] });
registerRoute({ router: deliveries, method: 'patch', path: '/:id/status', openApiPath: '/api/v1/deliveries/{id}/status', tag: 'Deliveries', summary: 'Update delivery status', description: 'The assigned transporter updates pickup, transit, and delivery. The linked order status moves with it.', auth: true, roles: ['TRANSPORTER', 'ADMIN'], params: idParams, body: deliveryStatusBody, successSchema: ok(DeliverySchema), errors: [409], handlers: [deliveryController.status] });
registerRoute({ router: deliveries, method: 'post', path: '/:id/assign', openApiPath: '/api/v1/deliveries/{id}/assign', tag: 'Deliveries', summary: 'Assign a transporter', description: 'Assigns a verified transporter and vehicle.', auth: true, roles: ['TRANSPORTER', 'ADMIN'], params: idParams, body: assignBody, successSchema: ok(DeliverySchema), errors: [422], handlers: [deliveryController.assign] });
v1Router.use('/deliveries', deliveries);

const transporters = Router();
registerRoute({ router: transporters, method: 'post', path: '/profile', openApiPath: '/api/v1/transporters/profile', tag: 'Deliveries', summary: 'Create transporter profile', description: 'Registers vehicles and service areas.', auth: true, roles: ['TRANSPORTER'], body: transporterBody, successStatus: 201, successSchema: ok(z.object({ businessName: z.string() }).passthrough()), errors: [409], handlers: [deliveryController.createProfile] });
registerRoute({ router: transporters, method: 'get', path: '/profile', openApiPath: '/api/v1/transporters/profile', tag: 'Deliveries', summary: 'Get transporter profile', description: 'Returns the signed-in transporter profile.', auth: true, roles: ['TRANSPORTER'], successSchema: ok(z.object({ businessName: z.string() }).passthrough()), handlers: [deliveryController.profile] });
registerRoute({ router: transporters, method: 'patch', path: '/profile', openApiPath: '/api/v1/transporters/profile', tag: 'Deliveries', summary: 'Update transporter profile', description: 'Updates vehicles or service areas.', auth: true, roles: ['TRANSPORTER'], body: transporterBody.partial(), successSchema: ok(z.object({ businessName: z.string() }).passthrough()), handlers: [deliveryController.updateProfile] });
v1Router.use('/transporters', transporters);

const prices = Router();
registerRoute({ router: prices, method: 'post', path: '/', openApiPath: '/api/v1/market-prices', tag: 'Market Prices', summary: 'Record a market price', description: 'Stores minimum, maximum, and modal prices for a crop at a market on a date. Prices are rupees per unit.', auth: true, roles: marketRoles, body: priceBody, successStatus: 201, successSchema: ok(MarketPriceSchema), errors: [409], handlers: [priceController.create] });
registerRoute({ router: prices, method: 'get', path: '/', openApiPath: '/api/v1/market-prices', tag: 'Market Prices', summary: 'List market prices', description: 'Filter by crop, market, and date range.', query: simplePage.extend({ cropId: objectIdSchema.optional(), marketId: objectIdSchema.optional(), from: z.string().optional(), to: z.string().optional() }), successSchema: page(MarketPriceSchema), handlers: [priceController.list] });
registerRoute({ router: prices, method: 'get', path: '/:cropId', openApiPath: '/api/v1/market-prices/{cropId}', tag: 'Market Prices', summary: 'Price history for a crop', description: 'Date-based historical prices for one vegetable.', params: cropIdParams, query: simplePage.extend({ marketId: objectIdSchema.optional(), from: z.string().optional(), to: z.string().optional() }), successSchema: page(MarketPriceSchema), errors: [404], handlers: [priceController.history] });
v1Router.use('/market-prices', prices);

registerRoute({ router: v1Router, method: 'get', path: '/matches/my', openApiPath: '/api/v1/matches/my', tag: 'Matching', summary: 'My supply and demand matches', description: 'Matches the caller farmer listings or buyer requirements by crop, quantity, price, distance, date, market, and quality. Ranking details are not returned.', auth: true, successSchema: ok(z.object({ farmerMatches: z.array(z.object({ listing: ListingSchema, matchingRequirements: z.array(RequirementSchema), nearbyBuyers: z.array(BuyerSchema), nearbyMarkets: z.array(MarketSchema), marketPrices: z.array(MarketPriceSchema) }).passthrough()), buyerMatches: z.array(z.unknown()) })), handlers: [matchingController.mine] });

const notifications = Router();
registerRoute({ router: notifications, method: 'get', path: '/', openApiPath: '/api/v1/notifications', tag: 'Notifications', summary: 'List notifications', description: 'Defaults to in-app notifications. Channels include IN_APP, SMS, EMAIL, WHATSAPP, and PUSH.', auth: true, query: simplePage.extend({ channel: z.string().optional(), isRead: z.enum(['true', 'false']).optional() }), successSchema: page(NotificationSchema), handlers: [notificationController.list] });
registerRoute({ router: notifications, method: 'patch', path: '/read-all', openApiPath: '/api/v1/notifications/read-all', tag: 'Notifications', summary: 'Mark all notifications read', description: 'Marks every unread in-app notification as read.', auth: true, successSchema: ok(z.object({ updated: z.number() })), handlers: [notificationController.readAll] });
registerRoute({ router: notifications, method: 'patch', path: '/:id/read', openApiPath: '/api/v1/notifications/{id}/read', tag: 'Notifications', summary: 'Mark a notification read', description: 'Marks one notification read.', auth: true, params: idParams, successSchema: ok(NotificationSchema), errors: [404], handlers: [notificationController.read] });
v1Router.use('/notifications', notifications);

const conversations = Router();
registerRoute({ router: conversations, method: 'post', path: '/', openApiPath: '/api/v1/conversations', tag: 'Conversations', summary: 'Open a conversation', description: 'Opens or reuses a buyer-farmer conversation. Realtime adapters can subscribe to the in-process message bus.', auth: true, body: conversationBody, successStatus: 201, successSchema: ok(ConversationSchema), handlers: [chatController.open] });
registerRoute({ router: conversations, method: 'get', path: '/', openApiPath: '/api/v1/conversations', tag: 'Conversations', summary: 'List conversations', description: 'Conversations that include the signed-in user.', auth: true, query: simplePage, successSchema: page(ConversationSchema), handlers: [chatController.list] });
registerRoute({ router: conversations, method: 'get', path: '/:id/messages', openApiPath: '/api/v1/conversations/{id}/messages', tag: 'Conversations', summary: 'List messages', description: 'Paginated messages. Default sort is oldest first.', auth: true, params: idParams, query: simplePage, successSchema: page(MessageSchema), handlers: [chatController.messages] });
registerRoute({ router: conversations, method: 'post', path: '/:id/messages', openApiPath: '/api/v1/conversations/{id}/messages', tag: 'Conversations', summary: 'Send a message', description: 'Posts a message to a conversation the caller belongs to.', auth: true, params: idParams, body: messageBody, successStatus: 201, successSchema: ok(MessageSchema), handlers: [chatController.post] });
v1Router.use('/conversations', conversations);

registerRoute({ router: v1Router, method: 'patch', path: '/messages/:id/read', openApiPath: '/api/v1/messages/{id}/read', tag: 'Conversations', summary: 'Mark a message read', description: 'Marks one message read for a participant.', auth: true, params: idParams, successSchema: ok(MessageSchema), errors: [404], handlers: [chatController.read] });
registerRoute({ router: v1Router, method: 'post', path: '/reviews', openApiPath: '/api/v1/reviews', tag: 'Reviews', summary: 'Review a completed order', description: 'Buyer and farmer can each review the other once. Rating is an integer from 1 to 5. Self reviews and duplicate reviews are rejected.', auth: true, body: reviewBody, successStatus: 201, successSchema: ok(ReviewSchema), errors: [409, 422], handlers: [reviewController.create] });

const disputes = Router();
registerRoute({ router: disputes, method: 'post', path: '/', openApiPath: '/api/v1/disputes', tag: 'Disputes', summary: 'Raise a dispute', description: 'An order party opens a dispute. The order moves to DISPUTED when that transition is allowed.', auth: true, body: disputeBody, successStatus: 201, successSchema: ok(DisputeSchema), errors: [409], handlers: [disputeController.create] });
registerRoute({ router: disputes, method: 'get', path: '/', openApiPath: '/api/v1/disputes', tag: 'Disputes', summary: 'List disputes', description: 'Parties see their disputes. Admins see all disputes.', auth: true, query: simplePage.extend({ status: z.string().optional() }), successSchema: page(DisputeSchema), handlers: [disputeController.list] });
registerRoute({ router: disputes, method: 'get', path: '/:id', openApiPath: '/api/v1/disputes/{id}', tag: 'Disputes', summary: 'Get a dispute', description: 'Returns one dispute.', auth: true, params: idParams, successSchema: ok(DisputeSchema), errors: [404], handlers: [disputeController.get] });
registerRoute({ router: disputes, method: 'patch', path: '/:id/resolve', openApiPath: '/api/v1/disputes/{id}/resolve', tag: 'Disputes', summary: 'Resolve a dispute', description: 'Admins move a dispute to under review, resolved, or rejected.', auth: true, roles: adminRoles, params: idParams, body: resolveBody, successSchema: ok(DisputeSchema), errors: [422], handlers: [disputeController.resolve] });
v1Router.use('/disputes', disputes);

const documents = Router();
const documentFields = z.object({
  documentType: z.enum(['AADHAAR', 'PAN', 'GST', 'FPO_REGISTRATION', 'BANK_PROOF', 'BUSINESS_DOCUMENT', 'OTHER']),
  ownerType: z.enum(['FARMER', 'BUYER', 'FPO', 'USER']),
});
registerRoute({ router: documents, method: 'post', path: '/', openApiPath: '/api/v1/documents', tag: 'Documents', summary: 'Upload a document', description: 'Uploads a verification file. Bytes are stored outside MongoDB. The database stores only file key, URL, name, mime type, uploader, and document type. Sensitive document contents are never logged.', auth: true, body: documentFields, beforeValidate: [uploadSingle], successStatus: 201, successSchema: ok(DocumentSchema), errors: [400], handlers: [documentController.upload] });
registerRoute({ router: documents, method: 'get', path: '/', openApiPath: '/api/v1/documents', tag: 'Documents', summary: 'List my documents', description: 'Metadata for files uploaded by the signed-in user.', auth: true, query: simplePage, successSchema: page(DocumentSchema), handlers: [documentController.list] });
registerRoute({ router: documents, method: 'get', path: '/:id/download', openApiPath: '/api/v1/documents/{id}/download', tag: 'Documents', summary: 'Download a document', description: 'Streams a private file to its owner or an admin.', auth: true, params: idParams, successSchema: ok(z.object({ fileName: z.string() })), errors: [404], handlers: [documentController.download] });
v1Router.use('/documents', documents);

const admin = Router();
const adminQuery = simplePage.extend({ role: z.string().optional(), q: z.string().optional(), status: z.string().optional(), sortBy: z.string().optional(), district: z.string().optional(), verificationStatus: z.string().optional(), businessType: z.string().optional(), action: z.string().optional(), entity: z.string().optional() });
registerRoute({ router: admin, method: 'get', path: '/dashboard', openApiPath: '/api/v1/admin/dashboard', tag: 'Admin', summary: 'Dashboard statistics', description: 'Farmers, buyers, listings, today orders, GMV, payments, deliveries, top vegetables, and top markets.', auth: true, roles: adminRoles, successSchema: ok(z.object({ totalFarmers: z.number(), activeFarmers: z.number(), totalBuyers: z.number(), activeBuyers: z.number(), totalListings: z.number(), activeListings: z.number(), todaysOrders: z.number(), totalGmv: z.number(), pendingPayments: z.number(), completedOrders: z.number(), activeDeliveries: z.number(), topVegetables: z.array(z.unknown()), topMarkets: z.array(z.unknown()) })), handlers: [adminController.dashboard] });
registerRoute({ router: admin, method: 'get', path: '/users', openApiPath: '/api/v1/admin/users', tag: 'Admin', summary: 'List users', description: 'Search users by name, phone, or role.', auth: true, roles: adminRoles, query: adminQuery, successSchema: page(UserSchema), handlers: [adminController.users] });
registerRoute({ router: admin, method: 'get', path: '/farmers', openApiPath: '/api/v1/admin/farmers', tag: 'Admin', summary: 'List farmers', description: 'Admin farmer directory.', auth: true, roles: adminRoles, query: adminQuery, successSchema: page(FarmerSchema), handlers: [adminController.farmers] });
registerRoute({ router: admin, method: 'get', path: '/buyers', openApiPath: '/api/v1/admin/buyers', tag: 'Admin', summary: 'List buyers', description: 'Admin buyer directory.', auth: true, roles: adminRoles, query: adminQuery, successSchema: page(BuyerSchema), handlers: [adminController.buyers] });
registerRoute({ router: admin, method: 'get', path: '/fpos', openApiPath: '/api/v1/admin/fpos', tag: 'Admin', summary: 'List FPOs', description: 'Admin FPO directory.', auth: true, roles: adminRoles, query: adminQuery, successSchema: page(FpoSchema), handlers: [adminController.fpos] });
registerRoute({ router: admin, method: 'get', path: '/listings', openApiPath: '/api/v1/admin/listings', tag: 'Admin', summary: 'List listings', description: 'Admin listing directory.', auth: true, roles: adminRoles, query: adminQuery, successSchema: page(ListingSchema), handlers: [adminController.listings] });
registerRoute({ router: admin, method: 'get', path: '/orders', openApiPath: '/api/v1/admin/orders', tag: 'Admin', summary: 'List orders', description: 'Admin order directory.', auth: true, roles: adminRoles, query: adminQuery, successSchema: page(OrderSchema), handlers: [adminController.orders] });
registerRoute({ router: admin, method: 'get', path: '/payments', openApiPath: '/api/v1/admin/payments', tag: 'Admin', summary: 'List payments', description: 'Admin payment directory.', auth: true, roles: adminRoles, query: adminQuery, successSchema: page(PaymentSchema), handlers: [adminController.payments] });
registerRoute({ router: admin, method: 'get', path: '/markets', openApiPath: '/api/v1/admin/markets', tag: 'Admin', summary: 'List markets', description: 'Admin market directory.', auth: true, roles: adminRoles, query: adminQuery, successSchema: page(MarketSchema), handlers: [adminController.markets] });
registerRoute({ router: admin, method: 'get', path: '/disputes', openApiPath: '/api/v1/admin/disputes', tag: 'Admin', summary: 'List disputes', description: 'Admin dispute queue.', auth: true, roles: adminRoles, query: adminQuery, successSchema: page(DisputeSchema), handlers: [adminController.disputes] });
registerRoute({ router: admin, method: 'get', path: '/audit-logs', openApiPath: '/api/v1/admin/audit-logs', tag: 'Admin', summary: 'List audit logs', description: 'Security-relevant actions such as login, listing changes, offers, orders, payments, and verification.', auth: true, roles: adminRoles, query: adminQuery, successSchema: page(z.object({ action: z.string(), entity: z.string(), entityId: z.string() }).passthrough()), handlers: [adminController.audits] });
registerRoute({ router: admin, method: 'patch', path: '/farmers/:id/verification', openApiPath: '/api/v1/admin/farmers/{id}/verification', tag: 'Admin', summary: 'Verify a farmer', description: 'Sets farmer verification to pending, verified, or rejected. Only admins can verify farmers.', auth: true, roles: adminRoles, params: idParams, body: verificationBody, successSchema: ok(FarmerSchema), handlers: [adminController.verifyFarmer] });
registerRoute({ router: admin, method: 'patch', path: '/buyers/:id/verification', openApiPath: '/api/v1/admin/buyers/{id}/verification', tag: 'Admin', summary: 'Verify a buyer', description: 'Sets buyer verification status.', auth: true, roles: adminRoles, params: idParams, body: verificationBody, successSchema: ok(BuyerSchema), handlers: [adminController.verifyBuyer] });
registerRoute({ router: admin, method: 'patch', path: '/fpos/:id/verification', openApiPath: '/api/v1/admin/fpos/{id}/verification', tag: 'Admin', summary: 'Verify an FPO', description: 'Sets FPO verification status.', auth: true, roles: adminRoles, params: idParams, body: verificationBody, successSchema: ok(FpoSchema), handlers: [adminController.verifyFpo] });
registerRoute({ router: admin, method: 'patch', path: '/transporters/:id/verification', openApiPath: '/api/v1/admin/transporters/{id}/verification', tag: 'Admin', summary: 'Verify a transporter', description: 'Sets transporter verification status.', auth: true, roles: adminRoles, params: idParams, body: verificationBody, successSchema: ok(z.object({ isVerified: z.boolean() }).passthrough()), handlers: [adminController.verifyTransporter] });
registerRoute({ router: admin, method: 'patch', path: '/users/:id/block', openApiPath: '/api/v1/admin/users/{id}/block', tag: 'Admin', summary: 'Block or unblock a user', description: 'Blocks a user and revokes refresh tokens.', auth: true, roles: adminRoles, params: idParams, body: blockBody, successSchema: ok(UserSchema), handlers: [adminController.block] });
registerRoute({ router: admin, method: 'patch', path: '/users/:id/roles', openApiPath: '/api/v1/admin/users/{id}/roles', tag: 'Admin', summary: 'Update user roles', description: 'Replaces the role list. Only a super admin can grant SUPER_ADMIN.', auth: true, roles: adminRoles, params: idParams, body: rolesBody, successSchema: ok(UserSchema), handlers: [adminController.roles] });
v1Router.use('/admin', admin);
