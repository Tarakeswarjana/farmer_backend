import { MarketPriceRepository } from '../repositories/catalog.repository';
import { OtpRepository } from '../repositories/user.repository';
import { StatsRepository } from '../repositories/operations.repository';
import { ListingRepository, OfferRepository, RequirementRepository } from '../repositories/trade.repository';
import { FarmerRepository, BuyerRepository } from '../repositories/profile.repository';
import { OrderRepository } from '../repositories/trade.repository';
import { median } from '../utils/money';
import { startOfUtcDay } from '../utils/ids';
import { logger } from '../utils/logger';

export async function expireListings(listings = new ListingRepository()) {
  const result = await listings.expireDue(new Date());
  logger.info({ event: 'LISTINGS_EXPIRED', count: result.modifiedCount });
  return result.modifiedCount;
}

export async function expireOffers(offers = new OfferRepository()) {
  const result = await offers.expireDue(new Date());
  logger.info({ event: 'OFFERS_EXPIRED', count: result.modifiedCount });
  return result.modifiedCount;
}

export async function expireRequirements(requirements = new RequirementRepository()) {
  const result = await requirements.expireDue(new Date());
  logger.info({ event: 'REQUIREMENTS_EXPIRED', count: result.modifiedCount });
  return result.modifiedCount;
}

export async function sendExpiryReminders(listings = new ListingRepository()) {
  const now = new Date();
  const soon = new Date(now.getTime() + 6 * 60 * 60 * 1000);
  const due = await listings.findExpiring(now, soon);
  for (const listing of due) {
    logger.info({
      event: 'LISTING_EXPIRY_REMINDER',
      listingId: String(listing._id),
      userId: String(listing.farmerId),
    });
  }
  return due.length;
}

export async function cleanTemporaryData(otps = new OtpRepository()) {
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const result = await otps.deleteExpired(cutoff);
  logger.info({ event: 'TEMP_DATA_CLEANED', count: result.deletedCount });
  return result.deletedCount;
}

export async function generateDailyStatistics(
  stats = new StatsRepository(),
  farmers = new FarmerRepository(),
  buyers = new BuyerRepository(),
  orders = new OrderRepository(),
) {
  const date = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
  const [totalFarmers, totalBuyers, orderCount, gmv] = await Promise.all([
    farmers.count({}),
    buyers.count({}),
    orders.count({}),
    orders.sumGmv({ orderStatus: { $ne: 'CANCELLED' } }),
  ]);
  await stats.upsertDaily(date, {
    date,
    totalFarmers,
    totalBuyers,
    orders: orderCount,
    gmvPaise: gmv[0]?.total ?? 0,
    generatedAt: new Date(),
  });
  logger.info({ event: 'DAILY_STATS_GENERATED', date });
  return date;
}

export async function updateMarketPricesFromOrders(stats = new StatsRepository(), prices = new MarketPriceRepository()) {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const rows = await stats.recentOrderPrices(since);
  const date = startOfUtcDay(new Date());
  for (const row of rows) {
    const values = row.prices.filter((price) => Number.isFinite(price));
    if (values.length === 0 || !row._id.marketId) continue;
    await prices.upsertDerived(
      { cropId: row._id.cropId, marketId: row._id.marketId, date, source: 'INTERNAL_ORDERS' },
      {
        cropId: row._id.cropId,
        marketId: row._id.marketId,
        date,
        source: 'INTERNAL_ORDERS',
        unit: row._id.unit,
        minimumPricePaise: Math.min(...values),
        maximumPricePaise: Math.max(...values),
        modalPricePaise: median(values),
      },
    );
  }
  logger.info({ event: 'MARKET_PRICES_UPDATED', groups: rows.length });
  return rows.length;
}

export async function runMaintenance() {
  await expireListings();
  await expireOffers();
  await expireRequirements();
  await sendExpiryReminders();
  await cleanTemporaryData();
  await generateDailyStatistics();
  await updateMarketPricesFromOrders();
}
