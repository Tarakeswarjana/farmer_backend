import { ADMIN_ROLES } from '../constants/roles';
import type { DeliveryStatus, OrderStatus } from '../constants/enums';
import { domainBus } from '../events/bus';
import { hasRole } from '../middlewares/authorize';
import { TransporterRepository } from '../repositories/profile.repository';
import { DeliveryRepository } from '../repositories/operations.repository';
import { OrderRepository } from '../repositories/trade.repository';
import type { AuthUser } from '../types/auth';
import { AuthorizationError, ConflictError, NotFoundError, UnprocessableError } from '../utils/errors';
import { haversineMeters, toGeoPoint } from '../utils/geo';
import { sameId } from '../utils/ids';
import { rupeesToPaise } from '../utils/money';
import { buildMeta, toPageQuery } from '../utils/pagination';
import { presentDelivery, presentTransporter } from '../utils/presenters';
import { OrderService } from './order.service';

const DELIVERY_TO_ORDER: Partial<Record<DeliveryStatus, OrderStatus>> = {
  ASSIGNED: 'READY_FOR_PICKUP',
  PICKED_UP: 'PICKED_UP',
  IN_TRANSIT: 'IN_TRANSIT',
  DELIVERED: 'DELIVERED',
};

export class DeliveryService {
  constructor(
    private readonly deliveries: DeliveryRepository,
    private readonly orders: OrderRepository,
    private readonly transporters: TransporterRepository,
    private readonly orderService: OrderService,
  ) {}

  async createProfile(actor: AuthUser, input: {
    businessName: string;
    phone: string;
    vehicleTypes: string[];
    vehicles: Array<{ vehicleNumber: string; vehicleType: string; capacity: number; driverName: string; driverPhone: string }>;
    serviceAreas: Array<{ district: string; state?: string }>;
    location: { longitude: number; latitude: number };
  }) {
    if (!hasRole(actor, ['TRANSPORTER'])) throw new AuthorizationError('Only transporters can create this profile');
    if (await this.transporters.findByUserId(actor.id)) throw new ConflictError('Transporter profile already exists');
    const profile = await this.transporters.create({
      ...input,
      userId: actor.id,
      location: toGeoPoint(input.location.longitude, input.location.latitude),
      serviceAreas: input.serviceAreas.map((area) => ({ ...area, state: area.state ?? 'West Bengal' })),
      verificationStatus: 'PENDING',
      isVerified: false,
    });
    return presentTransporter(profile);
  }

  async myProfile(actor: AuthUser) {
    const profile = await this.transporters.findByUserId(actor.id);
    if (!profile) throw new NotFoundError('Transporter profile not found');
    return presentTransporter(profile);
  }

  async updateProfile(actor: AuthUser, input: Record<string, unknown> & { location?: { longitude: number; latitude: number } }) {
    const profile = await this.transporters.findByUserId(actor.id);
    if (!profile) throw new NotFoundError('Transporter profile not found');
    const data: Record<string, unknown> = { ...input };
    if (input.location) data.location = toGeoPoint(input.location.longitude, input.location.latitude);
    const updated = await this.transporters.updateById(String(profile._id), data);
    if (!updated) throw new NotFoundError('Transporter profile not found');
    return presentTransporter(updated);
  }

  async setVerification(id: string, status: 'PENDING' | 'VERIFIED' | 'REJECTED') {
    const profile = await this.transporters.findById(id);
    if (!profile) throw new NotFoundError('Transporter profile not found');
    profile.verificationStatus = status;
    profile.isVerified = status === 'VERIFIED';
    await profile.save();
    return presentTransporter(profile);
  }

  async create(actor: AuthUser, input: {
    orderId: string;
    pickupAddress?: string;
    dropAddress: string;
    dropLongitude?: number;
    dropLatitude?: number;
    scheduledPickup?: string;
    scheduledDelivery?: string;
    estimatedCost?: number;
  }, metaUser: AuthUser) {
    const order = await this.orders.findById(input.orderId);
    if (!order) throw new NotFoundError('Order not found');
    const allowed = sameId(order.buyerId, actor.id) || sameId(order.farmerId, actor.id) || hasRole(actor, ADMIN_ROLES);
    if (!allowed) throw new AuthorizationError();
    if (['CANCELLED', 'COMPLETED'].includes(order.orderStatus)) {
      throw new ConflictError('Delivery cannot be created for this order');
    }
    const existing = await this.deliveries.findByOrderId(input.orderId);
    if (existing) return presentDelivery(existing);
    const pickupCoordinates = order.pickupLocation?.location?.coordinates as number[] | undefined;
    const dropLocation = {
      address: input.dropAddress,
      location:
        input.dropLongitude !== undefined && input.dropLatitude !== undefined
          ? toGeoPoint(input.dropLongitude, input.dropLatitude)
          : undefined,
    };
    const distance = pickupCoordinates && dropLocation.location
      ? haversineMeters(
          [pickupCoordinates[0], pickupCoordinates[1]],
          dropLocation.location.coordinates,
        )
      : undefined;
    const delivery = await this.deliveries.create({
      orderId: order._id,
      pickupLocation: {
        address: input.pickupAddress ?? order.pickupLocation?.address ?? 'Farm pickup',
        location: order.pickupLocation?.location,
      },
      dropLocation,
      scheduledPickup: input.scheduledPickup ? new Date(input.scheduledPickup) : order.scheduledPickupDate,
      scheduledDelivery: input.scheduledDelivery ? new Date(input.scheduledDelivery) : order.scheduledDeliveryDate,
      distanceMeters: distance,
      estimatedCostPaise: input.estimatedCost ? rupeesToPaise(input.estimatedCost) : 0,
      status: 'REQUESTED',
      trackingEvents: [{ status: 'REQUESTED', at: new Date(), actorId: metaUser.id }],
    });
    return presentDelivery(delivery);
  }

  async get(actor: AuthUser, id: string) {
    const delivery = await this.requireVisible(actor, id);
    return presentDelivery(delivery);
  }

  async available(actor: AuthUser, query: { page?: number; limit?: number }) {
    if (!hasRole(actor, ['TRANSPORTER', ...ADMIN_ROLES])) throw new AuthorizationError();
    const page = toPageQuery(query);
    const result = await this.deliveries.list({ status: 'REQUESTED', transporterId: { $exists: false } }, page.skip, page.limit);
    return { items: result.items.map((item) => presentDelivery(item)), meta: buildMeta(page.page, page.limit, result.total) };
  }

  async assign(actor: AuthUser, id: string, input: { transporterId: string; vehicleId: string }) {
    const delivery = await this.deliveries.findById(id);
    if (!delivery) throw new NotFoundError('Delivery not found');
    const transporter = await this.transporters.findById(input.transporterId);
    if (!transporter?.isVerified) throw new UnprocessableError('Transporter is not verified');
    const self = sameId(transporter.userId, actor.id);
    if (!self && !hasRole(actor, ADMIN_ROLES)) throw new AuthorizationError();
    const vehicle = transporter.vehicles.find((item) => sameId(item._id, input.vehicleId));
    if (!vehicle) throw new NotFoundError('Vehicle not found');
    delivery.transporterId = transporter._id;
    delivery.vehicleId = vehicle._id;
    delivery.status = 'ASSIGNED';
    delivery.trackingEvents.push({ status: 'ASSIGNED', at: new Date(), actorId: actor.id });
    await delivery.save();
    await this.moveOrder(actor, String(delivery.orderId), 'READY_FOR_PICKUP');
    const order = await this.orders.findById(String(delivery.orderId));
    if (order) {
      await domainBus.publish({
        event: 'PICKUP_ASSIGNED',
        userIds: [String(order.buyerId), String(order.farmerId), String(transporter.userId)],
        title: 'Pickup assigned',
        body: `A transporter was assigned to order ${order.orderNumber}.`,
        entityType: 'delivery',
        entityId: String(delivery._id),
        dedupeKey: `pickup:${String(delivery._id)}`,
      });
    }
    return presentDelivery(delivery);
  }

  async updateStatus(actor: AuthUser, id: string, status: DeliveryStatus, note?: string) {
    const delivery = await this.deliveries.findById(id);
    if (!delivery) throw new NotFoundError('Delivery not found');
    const transporter = delivery.transporterId ? await this.transporters.findById(String(delivery.transporterId)) : null;
    const allowed = hasRole(actor, ADMIN_ROLES) || (transporter && sameId(transporter.userId, actor.id));
    if (!allowed) throw new AuthorizationError();
    delivery.status = status;
    delivery.trackingEvents.push({ status, note, at: new Date(), actorId: actor.id });
    if (status === 'DELIVERED' && delivery.estimatedCostPaise && delivery.actualCostPaise == null) {
      delivery.actualCostPaise = delivery.estimatedCostPaise;
    }
    await delivery.save();
    const orderStatus = DELIVERY_TO_ORDER[status];
    if (orderStatus) await this.moveOrder(actor, String(delivery.orderId), orderStatus);
    const order = await this.orders.findById(String(delivery.orderId));
    if (order && (status === 'IN_TRANSIT' || status === 'DELIVERED')) {
      await domainBus.publish({
        event: status === 'IN_TRANSIT' ? 'DELIVERY_STARTED' : 'DELIVERY_COMPLETED',
        userIds: [String(order.buyerId), String(order.farmerId)],
        title: status === 'IN_TRANSIT' ? 'Delivery started' : 'Delivery completed',
        body: `Order ${order.orderNumber} delivery is ${status.toLowerCase().replace('_', ' ')}.`,
        entityType: 'delivery',
        entityId: String(delivery._id),
        dedupeKey: `delivery-${status}:${String(delivery._id)}`,
      });
    }
    return presentDelivery(delivery);
  }

  private async moveOrder(actor: AuthUser, orderId: string, status: OrderStatus) {
    try {
      await this.orderService.transition(actor, orderId, status, {});
    } catch (error) {
      if (error instanceof ConflictError) return;
      throw error;
    }
  }

  private async requireVisible(actor: AuthUser, id: string) {
    const delivery = await this.deliveries.findById(id);
    if (!delivery) throw new NotFoundError('Delivery not found');
    if (hasRole(actor, ADMIN_ROLES)) return delivery;
    const order = await this.orders.findById(String(delivery.orderId));
    const transporter = delivery.transporterId ? await this.transporters.findById(String(delivery.transporterId)) : null;
    const allowed = order && (sameId(order.buyerId, actor.id) || sameId(order.farmerId, actor.id) || (transporter && sameId(transporter.userId, actor.id)));
    if (!allowed) throw new AuthorizationError();
    return delivery;
  }
}
