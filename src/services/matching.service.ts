import { haversineMeters } from '../utils/geo';
import { BuyerRepository, FarmerRepository } from '../repositories/profile.repository';
import { MarketPriceRepository, MarketRepository } from '../repositories/catalog.repository';
import { ListingRepository, RequirementRepository } from '../repositories/trade.repository';
import type { AuthUser } from '../types/auth';
import { presentBuyer, presentListing, presentMarket, presentMarketPrice, presentRequirement } from '../utils/presenters';

function scoreSupply(input: {
  quantityFit: boolean;
  priceFit: boolean;
  sameMarket: boolean;
  distance?: number;
  dateFit: boolean;
  qualityFit: boolean;
}): number {
  let score = 50;
  if (input.quantityFit) score += 20;
  if (input.priceFit) score += 20;
  if (input.sameMarket) score += 15;
  if (input.distance !== undefined && input.distance <= 20_000) score += 15;
  else if (input.distance !== undefined && input.distance <= 50_000) score += 8;
  if (input.dateFit) score += 10;
  if (input.qualityFit) score += 5;
  return score;
}

export class MatchingService {
  constructor(
    private readonly listings: ListingRepository,
    private readonly requirements: RequirementRepository,
    private readonly buyers: BuyerRepository,
    private readonly farmers: FarmerRepository,
    private readonly markets: MarketRepository,
    private readonly prices: MarketPriceRepository,
  ) {}

  async mine(actor: AuthUser) {
    const farmer = await this.farmers.findByUserId(actor.id);
    const buyer = await this.buyers.findByUserId(actor.id);
    const farmerMatches = farmer ? await this.forFarmer(String(farmer.userId), farmer.location?.coordinates) : [];
    const buyerMatches = buyer ? await this.forBuyer(String(buyer.userId), buyer.location?.coordinates) : [];
    return { farmerMatches, buyerMatches };
  }

  private async forFarmer(farmerUserId: string, origin?: number[]) {
    const listings = await this.listings.search(
      { farmerId: farmerUserId, status: { $in: ['ACTIVE', 'PARTIALLY_SOLD'] } },
      0,
      10,
      { createdAt: -1 },
    );
    const matches = [];
    for (const listing of listings.items) {
      const requirements = await this.requirements.openForCrop(String(listing.cropId), 30);
      const ranked = requirements
        .map((requirement) => {
          const requirementPoint = requirement.location?.coordinates as number[] | undefined;
          const listingPoint = listing.location?.coordinates as number[] | undefined;
          const distance = requirementPoint && listingPoint
            ? haversineMeters([listingPoint[0], listingPoint[1]], [requirementPoint[0], requirementPoint[1]])
            : origin && requirementPoint
              ? haversineMeters([origin[0], origin[1]], [requirementPoint[0], requirementPoint[1]])
              : undefined;
          const rankedScore = scoreSupply({
            quantityFit: requirement.quantity <= listing.availableQuantity,
            priceFit: listing.expectedPricePaise <= requirement.targetPricePaise * 1.1,
            sameMarket: Boolean(listing.preferredMarketId && requirement.marketId && String(listing.preferredMarketId) === String(requirement.marketId)),
            distance,
            dateFit: requirement.requiredDate >= listing.availableFrom && requirement.requiredDate <= listing.availableUntil,
            qualityFit: !requirement.qualityGrade || requirement.qualityGrade === listing.qualityGrade,
          });
          return { requirement, rankedScore };
        })
        .sort((left, right) => right.rankedScore - left.rankedScore)
        .slice(0, 10);
      const [nearbyBuyers, nearbyMarkets, marketPrices] = await Promise.all([
        origin ? this.buyers.nearby(origin[0], origin[1], 50_000, 0, 5) : Promise.resolve({ items: [] }),
        origin ? this.markets.nearby(origin[0], origin[1], 50_000, 0, 5) : Promise.resolve({ items: [] }),
        this.prices.latestFor(String(listing.cropId), listing.preferredMarketId ? String(listing.preferredMarketId) : undefined, 5),
      ]);
      matches.push({
        listing: presentListing(listing),
        matchingRequirements: ranked.map((item) => presentRequirement(item.requirement)),
        nearbyBuyers: nearbyBuyers.items.map((item) => presentBuyer(item)),
        nearbyMarkets: nearbyMarkets.items.map((item) => presentMarket(item)),
        marketPrices: marketPrices.map((item) => presentMarketPrice(item)),
      });
    }
    return matches;
  }

  private async forBuyer(buyerUserId: string, origin?: number[]) {
    const requirements = await this.requirements.list({ buyerId: buyerUserId, status: 'OPEN' }, 0, 10, { createdAt: -1 });
    const matches = [];
    for (const requirement of requirements.items) {
      const listings = await this.listings.search(
        { cropId: requirement.cropId, status: { $in: ['ACTIVE', 'PARTIALLY_SOLD'] }, availableUntil: { $gt: new Date() } },
        0,
        30,
        { createdAt: -1 },
      );
      const ranked = listings.items
        .map((listing) => {
          const listingPoint = listing.location?.coordinates as number[] | undefined;
          const distance = origin && listingPoint ? haversineMeters([origin[0], origin[1]], [listingPoint[0], listingPoint[1]]) : undefined;
          const rankedScore = scoreSupply({
            quantityFit: listing.availableQuantity >= requirement.quantity,
            priceFit: listing.expectedPricePaise <= requirement.targetPricePaise * 1.1,
            sameMarket: Boolean(requirement.marketId && listing.preferredMarketId && String(requirement.marketId) === String(listing.preferredMarketId)),
            distance,
            dateFit: requirement.requiredDate >= listing.availableFrom && requirement.requiredDate <= listing.availableUntil,
            qualityFit: !requirement.qualityGrade || requirement.qualityGrade === listing.qualityGrade,
          });
          return { listing, rankedScore, distance };
        })
        .filter((item) => item.distance === undefined || item.distance <= 100_000)
        .sort((left, right) => right.rankedScore - left.rankedScore)
        .slice(0, 10);
      const marketPrices = await this.prices.latestFor(String(requirement.cropId), requirement.marketId ? String(requirement.marketId) : undefined, 5);
      matches.push({
        requirement: presentRequirement(requirement),
        matchingListings: ranked.map((item) => presentListing(item.listing)),
        marketPrices: marketPrices.map((item) => presentMarketPrice(item)),
      });
    }
    return matches;
  }
}
