import { ADMIN_ROLES, FARMER_ROLES } from '../constants/roles';
import { hasRole } from '../middlewares/authorize';
import { FarmerRepository, FpoRepository } from '../repositories/profile.repository';
import { UserRepository } from '../repositories/user.repository';
import type { AuthUser } from '../types/auth';
import { AuthorizationError, ConflictError, NotFoundError } from '../utils/errors';
import { toGeoPoint } from '../utils/geo';
import { buildMeta, buildSort, toPageQuery } from '../utils/pagination';
import { presentFarmer, presentFpo } from '../utils/presenters';
import { sameId } from '../utils/ids';

interface FpoInput {
  name: string;
  registrationNumber: string;
  description?: string;
  contactPerson: string;
  phone: string;
  email?: string;
  address: string;
  village?: string;
  block?: string;
  district: string;
  state?: string;
  pincode?: string;
  location: { longitude: number; latitude: number };
  primaryCrops?: string[];
}

export class FpoService {
  constructor(
    private readonly fpos: FpoRepository,
    private readonly farmers: FarmerRepository,
    private readonly users: UserRepository,
  ) {}

  async create(actor: AuthUser, input: FpoInput) {
    if (!hasRole(actor, [...FARMER_ROLES, ...ADMIN_ROLES])) {
      throw new AuthorizationError('You cannot create an FPO');
    }
    const fpo = await this.fpos.create({
      ...this.toData(input),
      memberCount: 0,
      memberFarmerIds: [],
      verificationStatus: 'PENDING',
      isVerified: false,
      adminUserId: actor.id,
      state: input.state ?? 'West Bengal',
    });
    if (!actor.roles.includes('FPO_ADMIN') && !hasRole(actor, ADMIN_ROLES)) {
      const user = await this.users.findById(actor.id);
      if (user) {
        user.roles = [...new Set([...user.roles, 'FPO_ADMIN' as const])];
        await user.save();
      }
    }
    return presentFpo(fpo);
  }

  async list(query: { page?: number; limit?: number; district?: string; sortBy?: string; sortOrder?: 'asc' | 'desc' }) {
    const page = toPageQuery(query);
    const filter: Record<string, unknown> = {};
    if (query.district) {
      filter.district = query.district;
    }
    const sort = buildSort(query.sortBy, page.sortOrder, ['createdAt', 'name', 'district'], 'createdAt');
    const result = await this.fpos.list(filter, page.skip, page.limit, sort);
    return {
      items: result.items.map((item) => presentFpo(item)),
      meta: buildMeta(page.page, page.limit, result.total),
    };
  }

  async get(id: string) {
    const fpo = await this.require(id);
    return presentFpo(fpo);
  }

  async update(actor: AuthUser, id: string, input: Partial<FpoInput>) {
    const fpo = await this.require(id);
    this.assertManager(actor, fpo.adminUserId);
    const updated = await this.fpos.updateById(id, this.toData(input));
    if (!updated) {
      throw new NotFoundError('FPO not found');
    }
    return presentFpo(updated);
  }

  async addMember(actor: AuthUser, id: string, farmerId: string) {
    const fpo = await this.require(id);
    this.assertManager(actor, fpo.adminUserId);
    const farmer = await this.farmers.findById(farmerId);
    if (!farmer) {
      throw new NotFoundError('Farmer profile not found');
    }
    if (fpo.memberFarmerIds.some((member) => sameId(member, farmerId))) {
      throw new ConflictError('Farmer is already an FPO member');
    }
    fpo.memberFarmerIds.push(farmer._id);
    fpo.memberCount = fpo.memberFarmerIds.length;
    await fpo.save();
    return presentFpo(fpo);
  }

  async removeMember(actor: AuthUser, id: string, farmerId: string) {
    const fpo = await this.require(id);
    this.assertManager(actor, fpo.adminUserId);
    fpo.memberFarmerIds = fpo.memberFarmerIds.filter((member) => !sameId(member, farmerId));
    fpo.memberCount = fpo.memberFarmerIds.length;
    await fpo.save();
    return presentFpo(fpo);
  }

  async members(id: string, query: { page?: number; limit?: number }) {
    const fpo = await this.require(id);
    const page = toPageQuery(query);
    const ids = fpo.memberFarmerIds.map((member) => String(member));
    const slice = ids.slice(page.skip, page.skip + page.limit);
    const profiles = await Promise.all(slice.map((farmerId) => this.farmers.findById(farmerId)));
    return {
      items: profiles.filter((item) => item !== null).map((item) => presentFarmer(item)),
      meta: buildMeta(page.page, page.limit, ids.length),
    };
  }

  async setVerification(id: string, status: 'PENDING' | 'VERIFIED' | 'REJECTED') {
    const fpo = await this.require(id);
    fpo.verificationStatus = status;
    fpo.isVerified = status === 'VERIFIED';
    await fpo.save();
    return presentFpo(fpo);
  }

  private assertManager(actor: AuthUser, adminUserId: unknown) {
    if (!sameId(adminUserId, actor.id) && !hasRole(actor, ADMIN_ROLES)) {
      throw new AuthorizationError('Only the FPO admin can manage members');
    }
  }

  private async require(id: string) {
    const fpo = await this.fpos.findById(id);
    if (!fpo) {
      throw new NotFoundError('FPO not found');
    }
    return fpo;
  }

  private toData(input: Partial<FpoInput>) {
    const data: Record<string, unknown> = {};
    for (const field of [
      'name',
      'registrationNumber',
      'description',
      'contactPerson',
      'phone',
      'email',
      'address',
      'village',
      'block',
      'district',
      'state',
      'pincode',
      'primaryCrops',
    ] as const) {
      if (input[field] !== undefined) {
        data[field] = input[field];
      }
    }
    if (input.location) {
      data.location = toGeoPoint(input.location.longitude, input.location.latitude);
    }
    return data;
  }
}
