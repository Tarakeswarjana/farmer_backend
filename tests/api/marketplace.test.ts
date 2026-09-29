import mongoose from 'mongoose';
import request from 'supertest';
import type { Express } from 'express';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { signPayload } from '../../src/utils/crypto';
import { hashPassword } from '../../src/utils/password';
import { runMaintenance } from '../../src/jobs/maintenance';

const PASSWORD = 'Farmer@123';
const location = { longitude: 88.48, latitude: 22.72 };

type Auth = { token: string; refresh: string; userId: string };

function bearer(token: string) {
  return { Authorization: `Bearer ${token}` };
}

describe('marketplace API', () => {
  let replset: MongoMemoryReplSet;
  let app: Express;
  let farmer: Auth;
  let buyer: Auth;
  let transporter: Auth;
  let trader: Auth;
  let adminToken: string;
  let farmerProfileId = '';
  let cropId = '';
  let marketId = '';
  let listingId = '';
  let directListingId = '';
  let disputeListingId = '';
  let offerId = '';
  let orderId = '';
  let directOrderId = '';
  let paymentId = '';
  let deliveryId = '';
  let transporterProfileId = '';
  let vehicleId = '';
  let conversationId = '';
  let fpoId = '';

  beforeAll(async () => {
    replset = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
    const { connectDatabase } = await import('../../src/config/database');
    const { createApp } = await import('../../src/app');
    const { UserModel } = await import('../../src/models/user.model');
    await connectDatabase(replset.getUri());
    app = createApp();
    await UserModel.create({
      name: 'Platform Admin',
      phone: '9810000099',
      email: 'admin@example.com',
      password: await hashPassword('Admin@123'),
      role: 'ADMIN',
      roles: ['ADMIN'],
      isPhoneVerified: true,
      isEmailVerified: true,
      isActive: true,
      isBlocked: false,
    });
    const login = await request(app).post('/api/v1/auth/login').send({ identifier: '9810000099', password: 'Admin@123' });
    adminToken = login.body.data.accessToken;
  }, 180000);

  afterAll(async () => {
    await mongoose.disconnect();
    if (replset) await replset.stop();
  });

  async function register(phone: string, role: string, name: string): Promise<Auth> {
    const created = await request(app).post('/api/v1/auth/register').send({
      name,
      phone,
      email: `${role.toLowerCase()}.${phone}@example.com`,
      password: PASSWORD,
      role,
    });
    expect(created.status).toBe(201);
    expect(created.body.data.debugCode).toHaveLength(6);
    const verified = await request(app).post('/api/v1/auth/verify-phone').send({ phone, code: created.body.data.debugCode });
    expect(verified.status).toBe(200);
    const login = await request(app).post('/api/v1/auth/login').send({ identifier: phone, password: PASSWORD });
    expect(login.status).toBe(200);
    return {
      token: login.body.data.accessToken,
      refresh: login.body.data.refreshToken,
      userId: login.body.data.user._id,
    };
  }

  it('registers, rejects a bad password, and rotates refresh tokens', async () => {
    farmer = await register('9810000001', 'FARMER', 'Rabi Mondal');
    buyer = await register('9810000002', 'BUYER', 'Bapi Traders');
    transporter = await register('9810000003', 'TRANSPORTER', 'North Transport');
    trader = await register('9810000004', 'TRADER', 'Sealdah Trader');
    const bad = await request(app).post('/api/v1/auth/login').send({ identifier: '9810000001', password: 'wrong-pass' });
    expect(bad.status).toBe(401);
    const refreshed = await request(app).post('/api/v1/auth/refresh-token').send({ refreshToken: farmer.refresh });
    expect(refreshed.status).toBe(200);
    farmer.token = refreshed.body.data.accessToken;
    farmer.refresh = refreshed.body.data.refreshToken;
    const loggedOut = await request(app).post('/api/v1/auth/logout').set(bearer(farmer.token)).send({ refreshToken: farmer.refresh });
    expect(loggedOut.status).toBe(200);
    const again = await request(app).post('/api/v1/auth/login').send({ identifier: '9810000001', password: PASSWORD });
    farmer.token = again.body.data.accessToken;
    farmer.refresh = again.body.data.refreshToken;
    const denied = await request(app).get('/api/v1/users/me');
    expect(denied.status).toBe(401);
    const forbidden = await request(app).post('/api/v1/farmers/profile').set(bearer(trader.token)).send({});
    expect(forbidden.status).toBe(403);
  });

  it('resets a password and updates the current user', async () => {
    const forgot = await request(app).post('/api/v1/auth/forgot-password').send({ identifier: '9810000004' });
    expect(forgot.body.data.debugCode).toHaveLength(6);
    const reset = await request(app).post('/api/v1/auth/reset-password').send({
      identifier: '9810000004',
      code: forgot.body.data.debugCode,
      newPassword: 'Trader@123',
    });
    expect(reset.status).toBe(200);
    const login = await request(app).post('/api/v1/auth/login').send({ identifier: '9810000004', password: 'Trader@123' });
    trader.token = login.body.data.accessToken;
    const me = await request(app).patch('/api/v1/users/me').set(bearer(farmer.token)).send({ name: 'Rabi Mondal Farm' });
    expect(me.status).toBe(200);
    const located = await request(app).patch('/api/v1/users/me/location').set(bearer(farmer.token)).send({
      ...location,
      district: 'North 24 Parganas',
      state: 'West Bengal',
      pincode: '743249',
    });
    expect(located.status).toBe(200);
    const changed = await request(app).patch('/api/v1/users/me/change-password').set(bearer(trader.token)).send({
      currentPassword: 'Trader@123',
      newPassword: 'Trader@456',
    });
    expect(changed.status).toBe(200);
  });

  it('creates and verifies farmer and buyer profiles', async () => {
    const farmerProfile = await request(app).post('/api/v1/farmers/profile').set(bearer(farmer.token)).send({
      farmerName: 'Rabi Mondal',
      farmName: 'Mondal Farm',
      phone: '9810000001',
      address: 'Gaighata village road',
      village: 'Gaighata',
      block: 'Gaighata',
      district: 'North 24 Parganas',
      state: 'West Bengal',
      pincode: '743249',
      location,
      farmSize: 3,
      farmSizeUnit: 'ACRE',
      farmingType: 'MIXED',
      bankDetails: {
        accountHolderName: 'Rabi Mondal',
        accountNumber: '123456789012',
        ifsc: 'SBIN0001234',
        bankName: 'State Bank',
      },
    });
    expect(farmerProfile.status).toBe(201);
    farmerProfileId = farmerProfile.body.data._id;
    expect(JSON.stringify(farmerProfile.body)).not.toContain('123456789012');
    const updated = await request(app).patch('/api/v1/farmers/profile').set(bearer(farmer.token)).send({ farmName: 'Mondal Organic Farm' });
    expect(updated.body.data.farmName).toBe('Mondal Organic Farm');
    const buyerProfile = await request(app).post('/api/v1/buyers/profile').set(bearer(buyer.token)).send({
      businessName: 'Bapi Traders',
      businessType: 'WHOLESALER',
      ownerName: 'Bapi Das',
      phone: '9810000002',
      email: 'buyer.9810000002@example.com',
      address: 'Koley Market stall 12',
      district: 'Kolkata',
      state: 'West Bengal',
      pincode: '700014',
      buyingCapacity: 2000,
      paymentTerms: 'Cash on pickup',
      location: { longitude: 88.369, latitude: 22.569 },
    });
    expect(buyerProfile.status).toBe(201);
    const verifiedFarmer = await request(app)
      .patch(`/api/v1/admin/farmers/${farmerProfileId}/verification`)
      .set(bearer(adminToken))
      .send({ status: 'VERIFIED' });
    expect(verifiedFarmer.status).toBe(200);
    const verifiedBuyer = await request(app)
      .patch(`/api/v1/admin/buyers/${buyerProfile.body.data._id}/verification`)
      .set(bearer(adminToken))
      .send({ status: 'VERIFIED' });
    expect(verifiedBuyer.status).toBe(200);
    const nearby = await request(app).get('/api/v1/farmers/nearby').query({ lat: 22.72, lng: 88.48, radius: 50000 });
    expect(nearby.body.data.some((item: { _id: string }) => item._id === farmerProfileId)).toBe(true);
    const publicFarmer = await request(app).get(`/api/v1/farmers/${farmerProfileId}`);
    expect(publicFarmer.status).toBe(200);
  });

  it('creates crops, markets, prices, an FPO, and listings', async () => {
    const crop = await request(app).post('/api/v1/crops').set(bearer(adminToken)).send({
      name: 'Tomato',
      bengaliName: 'টমেটো',
      localNames: ['Bilati Begun'],
      category: 'VEGETABLE',
      unit: 'KG',
      season: 'YEAR_ROUND',
    });
    expect(crop.status).toBe(201);
    cropId = crop.body.data._id;
    const listed = await request(app).get('/api/v1/crops').query({ q: 'tom' });
    expect(listed.body.data.length).toBeGreaterThan(0);
    const market = await request(app).post('/api/v1/markets').set(bearer(adminToken)).send({
      name: 'Barasat Krishak Bazar',
      marketCode: 'N24-BARASAT',
      marketType: 'KRISHAK_BAZAR',
      address: 'Barasat, North 24 Parganas',
      district: 'North 24 Parganas',
      state: 'West Bengal',
      pincode: '700124',
      location,
      commissionRate: 2,
    });
    expect(market.status).toBe(201);
    marketId = market.body.data._id;
    const nearbyMarkets = await request(app).get('/api/v1/markets/nearby').query({ lat: 22.72, lng: 88.48, radius: 20000 });
    expect(nearbyMarkets.body.meta.total).toBeGreaterThan(0);
    const price = await request(app).post('/api/v1/market-prices').set(bearer(adminToken)).send({
      cropId,
      marketId,
      date: '2026-10-01',
      minimumPrice: 28,
      maximumPrice: 34,
      modalPrice: 31,
      unit: 'KG',
    });
    expect(price.status).toBe(201);
    const history = await request(app).get(`/api/v1/market-prices/${cropId}`);
    expect(history.body.data[0].modalPrice).toBe(31);
    const fpo = await request(app).post('/api/v1/fpos').set(bearer(farmer.token)).send({
      name: 'Gaighata Vegetable FPO',
      registrationNumber: 'FPO-N24-001',
      contactPerson: 'Rabi Mondal',
      phone: '9810000001',
      address: 'Gaighata block office',
      district: 'North 24 Parganas',
      location,
    });
    expect(fpo.status).toBe(201);
    fpoId = fpo.body.data._id;
    await request(app).post(`/api/v1/fpos/${fpoId}/members`).set(bearer(farmer.token)).send({ farmerId: farmerProfileId });
    const members = await request(app).get(`/api/v1/fpos/${fpoId}/members`);
    expect(members.body.meta.total).toBe(1);

    const listingBody = {
      cropId,
      quantity: 800,
      unit: 'KG',
      expectedPrice: 28,
      minimumPrice: 24,
      qualityGrade: 'A',
      harvestDate: '2026-10-01',
      availableFrom: '2026-10-01T06:00:00.000Z',
      availableUntil: '2026-10-03T18:00:00.000Z',
      marketId,
      isNegotiable: true,
      allowBidding: true,
      district: 'North 24 Parganas',
    };
    const invalid = await request(app).post('/api/v1/listings').set(bearer(farmer.token)).send({ ...listingBody, quantity: 0 });
    expect(invalid.status).toBe(400);
    const draft = await request(app).post('/api/v1/listings').set(bearer(farmer.token)).send(listingBody);
    expect(draft.status).toBe(201);
    expect(draft.body.data.status).toBe('DRAFT');
    listingId = draft.body.data._id;
    const published = await request(app).patch(`/api/v1/listings/${listingId}/publish`).set(bearer(farmer.token));
    expect(published.status).toBe(200);
    expect(published.body.data.status).toBe('ACTIVE');
    const search = await request(app).get('/api/v1/listings').query({ crop: 'tomato', district: 'North 24 Parganas', page: 1, limit: 20 });
    expect(search.body.data.some((item: { _id: string }) => item._id === listingId)).toBe(true);
    const mine = await request(app).get('/api/v1/farmers/me/listings').set(bearer(farmer.token));
    expect(mine.body.meta.total).toBe(1);

    const second = await request(app).post('/api/v1/listings').set(bearer(farmer.token)).send({ ...listingBody, quantity: 300 });
    directListingId = second.body.data._id;
    await request(app).patch(`/api/v1/listings/${directListingId}/publish`).set(bearer(farmer.token));
    const third = await request(app).post('/api/v1/listings').set(bearer(farmer.token)).send({ ...listingBody, quantity: 120 });
    disputeListingId = third.body.data._id;
    await request(app).patch(`/api/v1/listings/${disputeListingId}/publish`).set(bearer(farmer.token));
  });

  it('negotiates an offer and creates an order atomically', async () => {
    const tooMuch = await request(app).post(`/api/v1/listings/${listingId}/offers`).set(bearer(buyer.token)).send({
      offeredPrice: 26,
      quantity: 5000,
    });
    expect(tooMuch.status).toBe(422);
    const offer = await request(app).post(`/api/v1/listings/${listingId}/offers`).set(bearer(buyer.token)).send({
      offeredPrice: 26,
      quantity: 200,
      message: 'Can you do 26 for Barasat?',
    });
    expect(offer.status).toBe(201);
    offerId = offer.body.data._id;
    const duplicate = await request(app).post(`/api/v1/listings/${listingId}/offers`).set(bearer(buyer.token)).send({
      offeredPrice: 27,
      quantity: 100,
    });
    expect(duplicate.status).toBe(409);
    const buyerAccept = await request(app).patch(`/api/v1/offers/${offerId}/accept`).set(bearer(buyer.token));
    expect(buyerAccept.status).toBe(403);
    const countered = await request(app).patch(`/api/v1/offers/${offerId}/counter`).set(bearer(farmer.token)).send({
      offeredPrice: 27,
      quantity: 200,
      message: '27 is my floor',
    });
    expect(countered.body.data.status).toBe('COUNTERED');
    const accepted = await request(app).patch(`/api/v1/offers/${offerId}/accept`).set(bearer(buyer.token));
    expect(accepted.status).toBe(200);
    expect(accepted.body.data.orderNumber).toMatch(/^VEG-\d{4}-\d{6}$/);
    orderId = accepted.body.data._id;
    const listing = await request(app).get(`/api/v1/listings/${listingId}`);
    expect(listing.body.data.availableQuantity).toBe(600);
    const received = await request(app).get('/api/v1/offers/received').set(bearer(farmer.token));
    expect(received.body.meta.total).toBeGreaterThan(0);
  });

  it('buys directly, cancels to release quantity, and records payment', async () => {
    const farmerOffer = await request(app).post(`/api/v1/listings/${directListingId}/offers`).set(bearer(buyer.token)).send({
      offeredPrice: 28,
      quantity: 40,
    });
    expect(farmerOffer.status).toBe(201);
    const farmerAccepted = await request(app).patch(`/api/v1/offers/${farmerOffer.body.data._id}/accept`).set(bearer(farmer.token));
    expect(farmerAccepted.status).toBe(200);
    const rejectedOffer = await request(app).post(`/api/v1/listings/${disputeListingId}/offers`).set(bearer(buyer.token)).send({
      offeredPrice: 26,
      quantity: 10,
    });
    expect(rejectedOffer.status).toBe(201);
    const rejected = await request(app).patch(`/api/v1/offers/${rejectedOffer.body.data._id}/reject`).set(bearer(farmer.token));
    expect(rejected.body.data.status).toBe('REJECTED');
    const created = await request(app).post('/api/v1/orders').set(bearer(buyer.token)).send({
      listingId: directListingId,
      quantity: 50,
      idempotencyKey: 'direct-buy-001',
      notes: 'Morning pickup',
    });
    expect(created.status).toBe(201);
    directOrderId = created.body.data._id;
    const replay = await request(app).post('/api/v1/orders').set(bearer(buyer.token)).send({
      listingId: directListingId,
      quantity: 50,
      idempotencyKey: 'direct-buy-001',
    });
    expect(replay.body.data._id).toBe(directOrderId);
    const cancelled = await request(app).post(`/api/v1/orders/${directOrderId}/cancel`).set(bearer(buyer.token));
    expect(cancelled.status).toBe(200);
    const restored = await request(app).get(`/api/v1/listings/${directListingId}`);
    expect(restored.body.data.availableQuantity).toBe(260);

    const confirmed = await request(app).post(`/api/v1/orders/${orderId}/confirm`).set(bearer(farmer.token));
    expect(confirmed.body.data.orderStatus).toBe('CONFIRMED');
    const payment = await request(app).post('/api/v1/payments/create').set(bearer(buyer.token)).send({
      orderId,
      method: 'CASH',
      idempotencyKey: 'cash-pay-001',
    });
    expect(payment.status).toBe(201);
    paymentId = payment.body.data.payment._id;
    const verified = await request(app).post('/api/v1/payments/verify').set(bearer(buyer.token)).send({ paymentId });
    expect(verified.body.data.status).toBe('SUCCESS');
    const again = await request(app).post('/api/v1/payments/verify').set(bearer(buyer.token)).send({ paymentId });
    expect(again.body.data.status).toBe('SUCCESS');

    const mock = await request(app).post('/api/v1/payments/create').set(bearer(buyer.token)).send({
      orderId,
      method: 'RAZORPAY',
      amount: 10,
      idempotencyKey: 'mock-pay-001',
    });
    const mockId = mock.body.data.payment._id as string;
    const providerPaymentId = 'pay_mock_1';
    const signature = signPayload(`${mockId}:${providerPaymentId}`);
    const mockVerified = await request(app).post('/api/v1/payments/verify').set(bearer(buyer.token)).send({
      paymentId: mockId,
      providerPaymentId,
      signature,
    });
    expect(mockVerified.body.data.status).toBe('SUCCESS');
    const raw = JSON.stringify({
      eventId: 'evt-mock-1',
      paymentId: mockId,
      status: 'SUCCESS',
      providerPaymentId,
      provider: 'MOCK',
    });
    const hook = await request(app)
      .post('/api/v1/payments/webhook')
      .set('Content-Type', 'application/json')
      .set('x-webhook-signature', signPayload(raw))
      .send(raw);
    expect(hook.body.data.received).toBe(true);
    const duplicateHook = await request(app)
      .post('/api/v1/payments/webhook')
      .set('Content-Type', 'application/json')
      .set('x-webhook-signature', signPayload(raw))
      .send(raw);
    expect(duplicateHook.body.data.duplicate).toBe(true);
    const refunded = await request(app).post(`/api/v1/payments/${mockId}/refund`).set(bearer(buyer.token)).send({ amount: 10 });
    expect(refunded.body.data.status).toBe('REFUNDED');
  });

  it('assigns transport, completes the order, and records reviews', async () => {
    const profile = await request(app).post('/api/v1/transporters/profile').set(bearer(transporter.token)).send({
      businessName: 'Gaighata Haulers',
      phone: '9810000003',
      vehicleTypes: ['PICKUP'],
      vehicles: [{
        vehicleNumber: 'WB23A1234',
        vehicleType: 'PICKUP',
        capacity: 1500,
        driverName: 'Sukumar',
        driverPhone: '9810000088',
      }],
      serviceAreas: [{ district: 'North 24 Parganas', state: 'West Bengal' }],
      location,
    });
    expect(profile.status).toBe(201);
    transporterProfileId = profile.body.data._id;
    vehicleId = profile.body.data.vehicles[0]._id;
    const verifiedTransporter = await request(app).patch(`/api/v1/admin/transporters/${transporterProfileId}/verification`).set(bearer(adminToken)).send({ status: 'VERIFIED' });
    expect(verifiedTransporter.status).toBe(200);
    const delivery = await request(app).post('/api/v1/deliveries').set(bearer(farmer.token)).send({
      orderId,
      dropAddress: 'Koley Market stall 12',
      dropLongitude: 88.369,
      dropLatitude: 22.569,
      estimatedCost: 500,
    });
    expect(delivery.status).toBe(201);
    deliveryId = delivery.body.data._id;
    const available = await request(app).get('/api/v1/deliveries/available').set(bearer(transporter.token));
    expect(available.body.meta.total).toBeGreaterThan(0);
    const assigned = await request(app).post(`/api/v1/deliveries/${deliveryId}/assign`).set(bearer(transporter.token)).send({
      transporterId: transporterProfileId,
      vehicleId,
    });
    if (assigned.status !== 200) {
      throw new Error(`${assigned.status} ${JSON.stringify(assigned.body)}`);
    }
    expect(assigned.body.data.status).toBe('ASSIGNED');
    await request(app).patch(`/api/v1/deliveries/${deliveryId}/status`).set(bearer(transporter.token)).send({ status: 'PICKED_UP' });
    await request(app).patch(`/api/v1/deliveries/${deliveryId}/status`).set(bearer(transporter.token)).send({ status: 'IN_TRANSIT' });
    const delivered = await request(app).patch(`/api/v1/deliveries/${deliveryId}/status`).set(bearer(transporter.token)).send({ status: 'DELIVERED' });
    expect(delivered.body.data.status).toBe('DELIVERED');
    const earlyReview = await request(app).post('/api/v1/reviews').set(bearer(buyer.token)).send({ orderId, rating: 5 });
    expect(earlyReview.status).toBe(422);
    const completed = await request(app).post(`/api/v1/orders/${orderId}/complete`).set(bearer(buyer.token));
    expect(completed.body.data.orderStatus).toBe('COMPLETED');
    const review = await request(app).post('/api/v1/reviews').set(bearer(buyer.token)).send({ orderId, rating: 5, comment: 'Fresh tomatoes' });
    expect(review.status).toBe(201);
    const farmerReview = await request(app).post('/api/v1/reviews').set(bearer(farmer.token)).send({ orderId, rating: 4, comment: 'Prompt pickup' });
    expect(farmerReview.status).toBe(201);
    const duplicateReview = await request(app).post('/api/v1/reviews').set(bearer(buyer.token)).send({ orderId, rating: 5 });
    expect(duplicateReview.status).toBe(409);
    const reviews = await request(app).get(`/api/v1/users/${farmer.userId}/reviews`);
    expect(reviews.body.meta.total).toBe(1);
  });

  it('covers demand, chat, disputes, documents, admin, and jobs', async () => {
    const requirement = await request(app).post('/api/v1/requirements').set(bearer(buyer.token)).send({
      cropId,
      quantity: 1000,
      unit: 'KG',
      targetPrice: 30,
      requiredDate: '2026-10-01',
      marketId,
      district: 'Kolkata',
      location: { longitude: 88.369, latitude: 22.569 },
    });
    expect(requirement.status).toBe(201);
    const matches = await request(app).get('/api/v1/matches/my').set(bearer(farmer.token));
    expect(matches.body.data.farmerMatches.length).toBeGreaterThan(0);
    expect(matches.body.data.farmerMatches[0].score).toBeUndefined();
    const notes = await request(app).get('/api/v1/notifications').set(bearer(farmer.token));
    expect(notes.body.meta.total).toBeGreaterThan(0);
    const noteId = notes.body.data[0]._id as string;
    await request(app).patch(`/api/v1/notifications/${noteId}/read`).set(bearer(farmer.token));
    await request(app).patch('/api/v1/notifications/read-all').set(bearer(farmer.token));

    const conversation = await request(app).post('/api/v1/conversations').set(bearer(buyer.token)).send({
      participantId: farmer.userId,
      listingId,
    });
    conversationId = conversation.body.data._id;
    const message = await request(app).post(`/api/v1/conversations/${conversationId}/messages`).set(bearer(buyer.token)).send({
      message: 'I can pick up at 6am',
    });
    expect(message.status).toBe(201);
    await request(app).patch(`/api/v1/messages/${message.body.data._id}/read`).set(bearer(farmer.token));
    const thread = await request(app).get(`/api/v1/conversations/${conversationId}/messages`).set(bearer(farmer.token));
    expect(thread.body.meta.total).toBe(1);

    const disputedOrder = await request(app).post('/api/v1/orders').set(bearer(buyer.token)).send({
      listingId: disputeListingId,
      quantity: 20,
      idempotencyKey: 'dispute-order-01',
    });
    await request(app).post(`/api/v1/orders/${disputedOrder.body.data._id}/confirm`).set(bearer(farmer.token));
    const dispute = await request(app).post('/api/v1/disputes').set(bearer(buyer.token)).send({
      orderId: disputedOrder.body.data._id,
      reason: 'Short weight',
      description: 'The crates were lighter than the agreed quantity.',
    });
    expect(dispute.status).toBe(201);
    const resolved = await request(app).patch(`/api/v1/disputes/${dispute.body.data._id}/resolve`).set(bearer(adminToken)).send({
      status: 'RESOLVED',
      resolution: 'Farmer will supply the missing 5 kg on the next pickup.',
    });
    expect(resolved.body.data.status).toBe('RESOLVED');

    const uploaded = await request(app)
      .post('/api/v1/documents')
      .set(bearer(farmer.token))
      .field('documentType', 'PAN')
      .field('ownerType', 'FARMER')
      .attach('file', Buffer.from('%PDF-1.4 demo'), { filename: 'pan.pdf', contentType: 'application/pdf' });
    expect(uploaded.status).toBe(201);
    const download = await request(app).get(`/api/v1/documents/${uploaded.body.data._id}/download`).set(bearer(farmer.token));
    expect(download.status).toBe(200);

    const dashboard = await request(app).get('/api/v1/admin/dashboard').set(bearer(adminToken));
    expect(dashboard.body.data.totalFarmers).toBeGreaterThan(0);
    expect(dashboard.body.data.totalGmv).toBeGreaterThan(0);
    for (const path of ['users', 'farmers', 'buyers', 'fpos', 'listings', 'orders', 'payments', 'markets', 'disputes', 'audit-logs']) {
      const response = await request(app).get(`/api/v1/admin/${path}`).set(bearer(adminToken));
      expect(response.status).toBe(200);
    }
    const blockedRole = await request(app).patch(`/api/v1/admin/users/${trader.userId}/roles`).set(bearer(adminToken)).send({ roles: ['SUPER_ADMIN'] });
    expect(blockedRole.status).toBe(403);
    await request(app).patch(`/api/v1/admin/users/${trader.userId}/block`).set(bearer(adminToken)).send({ isBlocked: true });
    const blockedLogin = await request(app).post('/api/v1/auth/login').send({ identifier: '9810000004', password: 'Trader@456' });
    expect(blockedLogin.status).toBe(403);

    const health = await request(app).get('/health');
    expect(health.body.data.database).toBe('connected');
    expect((await request(app).get('/health/database')).status).toBe(200);
    expect((await request(app).get('/health/redis')).status).toBe(503);
    expect((await request(app).get('/api/v1/missing')).status).toBe(404);

    const userIndexes = await mongoose.connection.collection('users').indexes();
    expect(userIndexes.some((index) => index.key.phone === 1)).toBe(true);
    const listingIndexes = await mongoose.connection.collection('vegetablelistings').indexes();
    expect(listingIndexes.some((index) => index.key.location === '2dsphere')).toBe(true);
    const offerIndexes = await mongoose.connection.collection('offers').indexes();
    expect(offerIndexes.some((index) => index.key.listingId === 1)).toBe(true);

    const buyerProfile = await request(app).get('/api/v1/buyers/profile').set(bearer(buyer.token));
    expect(buyerProfile.status).toBe(200);
    await request(app).patch('/api/v1/buyers/profile').set(bearer(buyer.token)).send({ paymentTerms: 'UPI on delivery' });
    await request(app).get(`/api/v1/buyers/${buyerProfile.body.data._id}`);
    await request(app).get('/api/v1/buyers/nearby').query({ lat: 22.57, lng: 88.36, radius: 80000 });
    await request(app).get('/api/v1/farmers/profile').set(bearer(farmer.token));
    await request(app).get(`/api/v1/crops/${cropId}`);
    await request(app).patch(`/api/v1/crops/${cropId}`).set(bearer(adminToken)).send({ description: 'Round tomato' });
    await request(app).get(`/api/v1/markets/${marketId}`);
    await request(app).patch(`/api/v1/markets/${marketId}`).set(bearer(adminToken)).send({ closingTime: '15:00' });
    await request(app).get(`/api/v1/markets/${marketId}/prices`);
    await request(app).get('/api/v1/fpos').query({ district: 'North 24 Parganas' });
    await request(app).get(`/api/v1/fpos/${fpoId}`);
    await request(app).patch(`/api/v1/fpos/${fpoId}`).set(bearer(farmer.token)).send({ description: 'Gaighata growers' });
    await request(app).delete(`/api/v1/fpos/${fpoId}/members/${farmerProfileId}`).set(bearer(farmer.token));
    await request(app).patch(`/api/v1/listings/${directListingId}`).set(bearer(farmer.token)).send({ description: 'Updated lot' });
    await request(app).get('/api/v1/listings/nearby').query({ lat: 22.72, lng: 88.48, radius: 50000 });
    await request(app).get('/api/v1/listings/search').query({ q: 'Tomato' });
    const draft = await request(app).post('/api/v1/listings').set(bearer(farmer.token)).send({
      cropId,
      quantity: 15,
      unit: 'KG',
      expectedPrice: 22,
      qualityGrade: 'B',
      harvestDate: '2026-10-01',
      availableFrom: '2026-10-01T06:00:00.000Z',
      availableUntil: '2026-10-03T18:00:00.000Z',
    });
    await request(app).delete(`/api/v1/listings/${draft.body.data._id}`).set(bearer(farmer.token));
    await request(app).patch(`/api/v1/listings/${directListingId}/cancel`).set(bearer(farmer.token));
    const requirementId = (await request(app).get('/api/v1/requirements').set(bearer(buyer.token)).query({ mine: 'true' })).body.data[0]._id;
    await request(app).patch(`/api/v1/requirements/${requirementId}`).set(bearer(buyer.token)).send({ quantity: 900 });
    await request(app).delete(`/api/v1/requirements/${requirementId}`).set(bearer(buyer.token));
    await request(app).get('/api/v1/offers/my').set(bearer(buyer.token));
    await request(app).get(`/api/v1/listings/${listingId}/offers`).set(bearer(farmer.token));
    await request(app).get('/api/v1/orders').set(bearer(buyer.token));
    await request(app).get(`/api/v1/orders/${orderId}`).set(bearer(farmer.token));
    const invalidStatus = await request(app).patch(`/api/v1/orders/${orderId}/status`).set(bearer(farmer.token)).send({ status: 'PENDING' });
    expect(invalidStatus.status).toBeGreaterThanOrEqual(400);
    await request(app).get('/api/v1/conversations').set(bearer(buyer.token));
    await request(app).get('/api/v1/documents').set(bearer(farmer.token));
    await request(app).get('/api/v1/disputes').set(bearer(buyer.token));
    await request(app).get('/api/v1/matches/my').set(bearer(buyer.token));
    const badHook = await request(app).post('/api/v1/payments/webhook').set('Content-Type', 'application/json').set('x-webhook-signature', '00').send('{"eventId":"x","paymentId":"y","status":"SUCCESS"}');
    expect(badHook.status).toBe(401);
    const duplicateProfile = await request(app).post('/api/v1/farmers/profile').set(bearer(farmer.token)).send({
      farmerName: 'Rabi Mondal',
      phone: '9810000001',
      address: 'Gaighata village road',
      district: 'North 24 Parganas',
      pincode: '743249',
      location,
    });
    expect(duplicateProfile.status).toBe(409);
    await request(app).post('/api/v1/auth/login').set('Content-Type', 'application/json').send('{');
    const { FarmerProfileModel } = await import('../../src/models/farmerProfile.model');
    const savedFarmer = await FarmerProfileModel.findById(farmerProfileId);
    savedFarmer?.toJSON();
    const { startJobs, stopJobs } = await import('../../src/jobs');
    await startJobs();
    await stopJobs();

    await runMaintenance();
    const { OfferModel } = await import('../../src/models/offer.model');
    await OfferModel.create({
      listingId,
      buyerId: buyer.userId,
      farmerId: farmer.userId,
      offeredPricePaise: 2500,
      quantity: 10,
      status: 'PENDING',
      expiresAt: new Date(Date.now() - 60_000),
    });
    await runMaintenance();
  });

  it('rejects invalid business transitions', async () => {
    const duplicateUser = await request(app).post('/api/v1/auth/register').send({
      name: 'Rabi Mondal',
      phone: '9810000001',
      password: PASSWORD,
      role: 'FARMER',
    });
    expect(duplicateUser.status).toBe(409);
    expect((await request(app).post('/api/v1/auth/refresh-token').send({ refreshToken: 'not-a-valid-token' })).status).toBe(401);
    expect((await request(app).post('/api/v1/auth/verify-phone').send({ phone: '9810000001', code: '000000' })).status).toBe(400);
    expect((await request(app).post('/api/v1/auth/forgot-password').send({ identifier: '9799999999' })).body.data.debugCode).toBeUndefined();
    const email = await request(app).patch('/api/v1/users/me').set(bearer(farmer.token)).send({ email: 'rabi.verified@example.com' });
    expect(email.body.data.debugCode).toHaveLength(6);
    expect((await request(app).post('/api/v1/auth/verify-email').send({ email: 'rabi.verified@example.com', code: email.body.data.debugCode })).status).toBe(200);
    expect((await request(app).patch('/api/v1/users/me/change-password').set(bearer(farmer.token)).send({ currentPassword: 'nope', newPassword: 'Farmer@999' })).status).toBe(400);

    const priced = await request(app).post('/api/v1/listings').set(bearer(farmer.token)).send({
      cropId,
      quantity: 40,
      unit: 'KG',
      expectedPrice: 20,
      minimumPrice: 30,
      qualityGrade: 'A',
      harvestDate: '2026-10-01',
      availableFrom: '2026-10-01T06:00:00.000Z',
      availableUntil: '2026-10-03T18:00:00.000Z',
    });
    expect(priced.status).toBe(422);
    const lot = await request(app).post('/api/v1/listings').set(bearer(farmer.token)).send({
      cropId,
      quantity: 40,
      unit: 'KG',
      expectedPrice: 30,
      minimumPrice: 25,
      qualityGrade: 'A',
      harvestDate: '2026-10-01',
      availableFrom: '2026-10-01T06:00:00.000Z',
      availableUntil: '2026-10-03T18:00:00.000Z',
    });
    expect(lot.status).toBe(201);
    const published = await request(app).patch(`/api/v1/listings/${lot.body.data._id}/publish`).set(bearer(farmer.token));
    expect(published.status).toBe(200);
    expect((await request(app).patch(`/api/v1/listings/${lot.body.data._id}/publish`).set(bearer(farmer.token))).status).toBe(409);
    const low = await request(app).post(`/api/v1/listings/${lot.body.data._id}/offers`).set(bearer(buyer.token)).send({ offeredPrice: 10, quantity: 5 });
    expect(low.status).toBe(422);
    const bid = await request(app).post(`/api/v1/listings/${lot.body.data._id}/offers`).set(bearer(buyer.token)).send({ offeredPrice: 26, quantity: 5 });
    expect(bid.status).toBe(201);
    const countered = await request(app).patch(`/api/v1/offers/${bid.body.data._id}/counter`).set(bearer(farmer.token)).send({ offeredPrice: 28, quantity: 5 });
    expect(countered.status).toBe(200);
    expect((await request(app).patch(`/api/v1/offers/${bid.body.data._id}/counter`).set(bearer(farmer.token)).send({ offeredPrice: 29, quantity: 5 })).status).toBe(422);
    expect((await request(app).patch(`/api/v1/offers/${bid.body.data._id}/counter`).set(bearer(buyer.token)).send({ offeredPrice: 27, quantity: 5 })).status).toBe(200);
    expect((await request(app).patch(`/api/v1/offers/${bid.body.data._id}/accept`).set(bearer(farmer.token))).status).toBe(200);
    expect((await request(app).patch(`/api/v1/listings/${lot.body.data._id}`).set(bearer(farmer.token)).send({ quantity: 1 })).status).toBe(422);
    const freshBid = await request(app).post(`/api/v1/listings/${lot.body.data._id}/offers`).set(bearer(buyer.token)).send({ offeredPrice: 30, quantity: 2 });
    expect((await request(app).patch(`/api/v1/offers/${freshBid.body.data._id}/cancel`).set(bearer(buyer.token))).status).toBe(200);
    const { OfferModel } = await import('../../src/models/offer.model');
    const expired = await OfferModel.create({
      listingId: lot.body.data._id,
      buyerId: buyer.userId,
      farmerId: farmer.userId,
      offeredPricePaise: 2600,
      quantity: 4,
      status: 'PENDING',
      expiresAt: new Date(Date.now() - 1000),
    });
    expect((await request(app).patch(`/api/v1/offers/${String(expired._id)}/accept`).set(bearer(farmer.token))).status).toBe(409);
    expect((await request(app).post(`/api/v1/orders/${orderId}/cancel`).set(bearer(buyer.token))).status).toBeGreaterThanOrEqual(400);
    const overpay = await request(app).post('/api/v1/payments/verify').set(bearer(buyer.token)).send({
      paymentId,
      providerPaymentId: 'bad',
      signature: 'bad',
    });
    expect([200, 400]).toContain(overpay.status);
    expect((await request(app).post(`/api/v1/payments/${paymentId}/refund`).set(bearer(buyer.token)).send({ amount: 999999 })).status).toBeGreaterThanOrEqual(400);
    const raw = JSON.stringify({ eventId: 'missing-payment', paymentId: cropId, status: 'FAILED', provider: 'MOCK' });
    expect((await request(app).post('/api/v1/payments/webhook').set('Content-Type', 'application/json').set('x-webhook-signature', signPayload(raw)).send(raw)).status).toBe(404);
    expect((await request(app).post('/api/v1/crops').set(bearer(adminToken)).send({ name: 'Tomato', category: 'VEGETABLE', unit: 'KG', season: 'RABI' })).status).toBe(409);
    expect((await request(app).get('/api/v1/orders/674a1b2c3d4e5f6789012345').set(bearer(buyer.token))).status).toBe(404);
    expect((await request(app).get(`/api/v1/orders/${orderId}`).set(bearer(transporter.token))).status).toBe(403);
    const mockPayment = await request(app).post('/api/v1/payments/create').set(bearer(buyer.token)).send({
      orderId,
      method: 'RAZORPAY',
      amount: 5,
      idempotencyKey: 'bad-signature-pay',
    });
    expect((await request(app).post('/api/v1/payments/verify').set(bearer(buyer.token)).send({
      paymentId: mockPayment.body.data.payment._id,
      providerPaymentId: 'pay_bad',
      signature: 'bad-signature',
    })).status).toBe(400);
    expect((await request(app).post('/api/v1/orders').set(bearer(buyer.token)).send({ listingId: lot.body.data._id, quantity: 5000 })).status).toBeGreaterThanOrEqual(400);
    expect((await request(app).post('/api/v1/deliveries').set(bearer(buyer.token)).send({ orderId, dropAddress: 'Again' })).status).toBeGreaterThanOrEqual(400);
    expect((await request(app).patch(`/api/v1/admin/users/${farmer.userId}/roles`).set(bearer(adminToken)).send({ roles: ['FARMER', 'FPO_ADMIN'] })).status).toBe(200);
    expect((await request(app).patch(`/api/v1/admin/fpos/${fpoId}/verification`).set(bearer(adminToken)).send({ status: 'VERIFIED' })).status).toBe(200);
    expect((await request(app).get(`/api/v1/payments/${paymentId}`).set(bearer(farmer.token))).status).toBe(200);
    expect((await request(app).get('/api/v1/market-prices').query({ cropId, marketId })).status).toBe(200);
    const badFile = await request(app).post('/api/v1/documents').set(bearer(farmer.token)).field('documentType', 'PAN').field('ownerType', 'USER').attach('file', Buffer.from('hi'), { filename: 'note.txt', contentType: 'text/plain' });
    expect(badFile.status).toBeGreaterThanOrEqual(400);
    expect((await request(app).post('/api/v1/auth/register').send({ name: 'Nope', phone: '9810000077', password: PASSWORD, role: 'ADMIN' })).status).toBe(400);
    expect((await request(app).get('/api/v1/listings').query({ minPrice: 1, maxPrice: 100, quality: 'A', minQuantity: 1, sortBy: 'expectedPrice', sortOrder: 'asc' })).status).toBe(200);
    expect((await request(app).get('/api/v1/farmers/nearby')).status).toBe(400);
    expect((await request(app).post('/api/v1/requirements').set(bearer(farmer.token)).send({ cropId, quantity: 1, unit: 'KG', targetPrice: 10, requiredDate: '2026-10-01' })).status).toBe(403);
    expect((await request(app).get('/api/v1/admin/dashboard').set(bearer(farmer.token))).status).toBe(403);
    expect((await request(app).post('/api/v1/markets').set(bearer(adminToken)).send({
      name: 'Barasat Krishak Bazar',
      marketCode: 'N24-BARASAT',
      marketType: 'MANDI',
      address: 'Barasat',
      district: 'North 24 Parganas',
      location,
    })).status).toBe(409);
    expect((await request(app).post('/api/v1/reviews').set(bearer(buyer.token)).send({ orderId, rating: 9 })).status).toBe(400);
    expect((await request(app).post('/api/v1/auth/reset-password').send({ identifier: '9810000002', code: '000000', newPassword: 'Buyer@999' })).status).toBe(400);
    expect((await request(app).post('/api/v1/auth/logout').set(bearer(buyer.token)).send({ refreshToken: farmer.refresh })).status).toBeGreaterThanOrEqual(400);
    expect((await request(app).patch(`/api/v1/admin/buyers/${(await request(app).get('/api/v1/buyers/profile').set(bearer(buyer.token))).body.data._id}/verification`).set(bearer(adminToken)).send({ status: 'REJECTED' })).status).toBe(200);
    expect((await request(app).post('/api/v1/orders').set(bearer(buyer.token)).send({ listingId: lot.body.data._id, quantity: 1 })).status).toBeGreaterThanOrEqual(400);
  });
});
