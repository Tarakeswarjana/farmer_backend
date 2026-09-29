import { connectDatabase, disconnectDatabase } from '../config/database';
import { CropModel } from '../models/crop.model';
import { MarketModel } from '../models/market.model';
import { MarketPriceModel } from '../models/marketPrice.model';
import { ListingModel } from '../models/listing.model';
import { UserModel } from '../models/user.model';
import { FarmerProfileModel } from '../models/farmerProfile.model';
import { BuyerProfileModel } from '../models/buyerProfile.model';
import { hashPassword } from '../utils/password';
import { logger } from '../utils/logger';
import { startOfUtcDay } from '../utils/ids';

const DEMO_PASSWORD = 'Demo@12345';

const crops = [
  { name: 'Potato', bengaliName: 'আলু', localNames: ['Aloo'], category: 'ROOT', season: 'RABI' },
  { name: 'Tomato', bengaliName: 'টমেটো', localNames: ['Bilati Begun'], category: 'VEGETABLE', season: 'YEAR_ROUND' },
  { name: 'Brinjal', bengaliName: 'বেগুন', localNames: ['Begun'], category: 'VEGETABLE', season: 'YEAR_ROUND' },
  { name: 'Cauliflower', bengaliName: 'ফুলকপি', localNames: ['Phulkopi'], category: 'VEGETABLE', season: 'RABI' },
  { name: 'Cabbage', bengaliName: 'বাঁধাকপি', localNames: ['Badhakopi'], category: 'VEGETABLE', season: 'RABI' },
  { name: 'Onion', bengaliName: 'পেঁয়াজ', localNames: ['Piyaj'], category: 'ROOT', season: 'RABI' },
  { name: 'Pumpkin', bengaliName: 'কুমড়ো', localNames: ['Kumro'], category: 'GOURD', season: 'YEAR_ROUND' },
  { name: 'Bottle Gourd', bengaliName: 'লাউ', localNames: ['Lau'], category: 'GOURD', season: 'KHARIF' },
  { name: 'Bitter Gourd', bengaliName: 'করলা', localNames: ['Karola'], category: 'GOURD', season: 'KHARIF' },
  { name: 'Green Chili', bengaliName: 'কাঁচা লঙ্কা', localNames: ['Kancha Lanka'], category: 'SPICE', season: 'YEAR_ROUND' },
  { name: 'Cucumber', bengaliName: 'শসা', localNames: ['Shosha'], category: 'GOURD', season: 'ZAID' },
  { name: 'Okra', bengaliName: 'ঢেঁড়স', localNames: ['Dherosh'], category: 'VEGETABLE', season: 'KHARIF' },
  { name: 'Carrot', bengaliName: 'গাজর', localNames: ['Gajor'], category: 'ROOT', season: 'RABI' },
  { name: 'Radish', bengaliName: 'মুলো', localNames: ['Mulo'], category: 'ROOT', season: 'RABI' },
  { name: 'Spinach', bengaliName: 'পালং', localNames: ['Palong'], category: 'LEAFY', season: 'RABI' },
] as const;

const markets = [
  { name: 'Koley Market', marketCode: 'KOL-KOLEY', marketType: 'WHOLESALE_MARKET', district: 'Kolkata', address: 'Koley Market, Sealdah, Kolkata', pincode: '700014', longitude: 88.369, latitude: 22.569 },
  { name: 'Barasat Krishak Bazar', marketCode: 'N24-BARASAT', marketType: 'KRISHAK_BAZAR', district: 'North 24 Parganas', address: 'Barasat, North 24 Parganas', pincode: '700124', longitude: 88.481, latitude: 22.722 },
  { name: 'Bongaon Mandi', marketCode: 'N24-BONGAON', marketType: 'MANDI', district: 'North 24 Parganas', address: 'Bongaon, North 24 Parganas', pincode: '743235', longitude: 88.829, latitude: 23.045 },
  { name: 'Gaighata Collection Center', marketCode: 'N24-GAIGHATA', marketType: 'COLLECTION_CENTER', district: 'North 24 Parganas', address: 'Gaighata, North 24 Parganas', pincode: '743249', longitude: 88.729, latitude: 22.933 },
  { name: 'Basirhat Haat', marketCode: 'N24-BASIRHAT', marketType: 'RETAIL_MARKET', district: 'North 24 Parganas', address: 'Basirhat, North 24 Parganas', pincode: '743411', longitude: 88.894, latitude: 22.657 },
  { name: 'Bagda Haat', marketCode: 'N24-BAGDA', marketType: 'MANDI', district: 'North 24 Parganas', address: 'Bagda, North 24 Parganas', pincode: '743232', longitude: 88.888, latitude: 23.216 },
] as const;

async function seedCrops() {
  for (const crop of crops) {
    await CropModel.updateOne(
      { nameKey: crop.name.toLowerCase() },
      {
        $set: {
          name: crop.name,
          nameKey: crop.name.toLowerCase(),
          bengaliName: crop.bengaliName,
          localNames: [...crop.localNames],
          category: crop.category,
          season: crop.season,
          unit: 'KG',
          description: `Demo seed crop: ${crop.name}`,
          isActive: true,
          isSeeded: true,
        },
      },
      { upsert: true },
    );
  }
}

async function seedMarkets() {
  for (const market of markets) {
    await MarketModel.updateOne(
      { marketCode: market.marketCode },
      {
        $set: {
          name: market.name,
          marketCode: market.marketCode,
          marketType: market.marketType,
          address: market.address,
          district: market.district,
          state: 'West Bengal',
          pincode: market.pincode,
          location: { type: 'Point', coordinates: [market.longitude, market.latitude] },
          operatingDays: ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'],
          openingTime: '06:00',
          closingTime: '14:00',
          commissionBps: 200,
          isActive: true,
          isDemo: true,
        },
      },
      { upsert: true },
    );
  }
}

async function seedDemoUsers() {
  const password = await hashPassword(DEMO_PASSWORD);
  const people = [
    { name: 'Demo Farmer', phone: '9810000001', email: 'farmer.demo@example.com', role: 'FARMER' },
    { name: 'Demo Buyer', phone: '9810000002', email: 'buyer.demo@example.com', role: 'BUYER' },
    { name: 'Demo Admin', phone: '9810000003', email: 'admin.demo@example.com', role: 'ADMIN' },
    { name: 'Demo Transporter', phone: '9810000004', email: 'transport.demo@example.com', role: 'TRANSPORTER' },
  ] as const;
  for (const person of people) {
    await UserModel.updateOne(
      { phone: person.phone },
      {
        $set: {
          name: person.name,
          phone: person.phone,
          email: person.email,
          password,
          role: person.role,
          roles: [person.role],
          isPhoneVerified: true,
          isEmailVerified: true,
          isActive: true,
          isBlocked: false,
          isDemo: true,
        },
      },
      { upsert: true },
    );
  }
  const farmer = await UserModel.findOne({ phone: '9810000001' });
  const buyer = await UserModel.findOne({ phone: '9810000002' });
  const tomato = await CropModel.findOne({ nameKey: 'tomato' });
  const barasat = await MarketModel.findOne({ marketCode: 'N24-BARASAT' });
  if (farmer) {
    await FarmerProfileModel.updateOne(
      { userId: farmer._id },
      {
        $set: {
          userId: farmer._id,
          farmerName: 'Demo Farmer',
          farmName: 'Demo Gaighata Farm',
          phone: '9810000001',
          address: 'Gaighata, North 24 Parganas',
          village: 'Gaighata',
          block: 'Gaighata',
          district: 'North 24 Parganas',
          state: 'West Bengal',
          pincode: '743249',
          location: { type: 'Point', coordinates: [88.73, 22.93] },
          farmSize: 2,
          farmSizeUnit: 'ACRE',
          primaryCrops: tomato ? [tomato._id] : [],
          farmingType: 'CONVENTIONAL',
          verificationStatus: 'VERIFIED',
          isVerified: true,
          isDemo: true,
        },
      },
      { upsert: true },
    );
  }
  if (buyer && barasat && tomato) {
    await BuyerProfileModel.updateOne(
      { userId: buyer._id },
      {
        $set: {
          userId: buyer._id,
          businessName: 'Bapi Traders (demo)',
          businessType: 'WHOLESALER',
          ownerName: 'Demo Buyer',
          phone: '9810000002',
          email: 'buyer.demo@example.com',
          address: 'Koley Market, Kolkata',
          district: 'Kolkata',
          state: 'West Bengal',
          pincode: '700014',
          markets: [barasat._id],
          preferredCrops: [tomato._id],
          buyingCapacity: 2000,
          paymentTerms: 'Cash on pickup',
          location: { type: 'Point', coordinates: [88.369, 22.569] },
          verificationStatus: 'VERIFIED',
          isVerified: true,
          isDemo: true,
        },
      },
      { upsert: true },
    );
  }
}

const demoListings = [
  { crop: 'tomato', market: 'N24-BARASAT', title: 'Tomato — Barasat Krishak Bazar', quantity: 800, price: 28, min: 24, grade: 'A' },
  { crop: 'potato', market: 'N24-BONGAON', title: 'Potato — Bongaon Mandi', quantity: 1500, price: 16, min: 14, grade: 'A' },
  { crop: 'brinjal', market: 'N24-BASIRHAT', title: 'Brinjal — Basirhat Haat', quantity: 400, price: 22, min: 18, grade: 'A' },
  { crop: 'cauliflower', market: 'N24-GAIGHATA', title: 'Cauliflower — Gaighata Collection Center', quantity: 600, price: 18, min: 15, grade: 'B' },
  { crop: 'cabbage', market: 'KOL-KOLEY', title: 'Cabbage — Koley Market', quantity: 900, price: 14, min: 12, grade: 'A' },
  { crop: 'green chili', market: 'N24-BAGDA', title: 'Green Chili — Bagda Haat', quantity: 200, price: 40, min: 34, grade: 'A' },
  { crop: 'okra', market: 'N24-BARASAT', title: 'Okra — Barasat Krishak Bazar', quantity: 300, price: 25, min: 20, grade: 'B' },
  { crop: 'onion', market: 'N24-BONGAON', title: 'Onion — Bongaon Mandi', quantity: 1000, price: 30, min: 26, grade: 'A' },
  { crop: 'pumpkin', market: 'N24-BASIRHAT', title: 'Pumpkin — Basirhat Haat', quantity: 500, price: 12, min: 10, grade: 'B' },
  { crop: 'spinach', market: 'N24-GAIGHATA', title: 'Spinach — Gaighata Collection Center', quantity: 180, price: 15, min: 12, grade: 'A' },
] as const;

async function seedListings() {
  const farmer = await UserModel.findOne({ phone: '9810000001' });
  const profile = farmer ? await FarmerProfileModel.findOne({ userId: farmer._id }) : null;
  if (!farmer || !profile) {
    throw new Error('Demo farmer is missing. Seed users before listings.');
  }

  const from = startOfUtcDay(new Date());
  const harvest = new Date(from);
  harvest.setUTCDate(harvest.getUTCDate() - 1);
  const until = new Date(from);
  until.setUTCDate(until.getUTCDate() + 21);

  for (const item of demoListings) {
    const crop = await CropModel.findOne({ nameKey: item.crop });
    const market = await MarketModel.findOne({ marketCode: item.market });
    if (!crop || !market) continue;
    const [longitude, latitude] = market.location.coordinates;
    await ListingModel.updateOne(
      { title: item.title, farmerId: farmer._id },
      {
        $set: {
          farmerId: farmer._id,
          farmerProfileId: profile._id,
          cropId: crop._id,
          title: item.title,
          description: `Demo sabji listing for ${crop.name} at ${market.name}.`,
          quantity: item.quantity,
          availableQuantity: item.quantity,
          unit: 'KG',
          qualityGrade: item.grade,
          qualityParameters: { organic: false, notes: 'Fresh morning harvest' },
          expectedPricePaise: item.price * 100,
          minimumPricePaise: item.min * 100,
          harvestDate: harvest,
          availableFrom: from,
          availableUntil: until,
          location: { type: 'Point', coordinates: [longitude, latitude] },
          pickupLocation: {
            address: market.address,
            landmark: market.name,
            location: { type: 'Point', coordinates: [longitude, latitude] },
          },
          preferredMarketId: market._id,
          district: market.district,
          state: 'West Bengal',
          images: [],
          status: 'ACTIVE',
          isNegotiable: true,
          allowBidding: true,
        },
      },
      { upsert: true },
    );
    await MarketModel.updateOne({ _id: market._id }, { $addToSet: { commodities: crop._id } });
    await MarketPriceModel.updateOne(
      { cropId: crop._id, marketId: market._id, date: from, source: 'MANUAL' },
      {
        $set: {
          cropId: crop._id,
          marketId: market._id,
          date: from,
          minimumPricePaise: item.min * 100,
          maximumPricePaise: item.price * 100,
          modalPricePaise: item.price * 100,
          unit: 'KG',
          source: 'MANUAL',
          isDemo: true,
        },
      },
      { upsert: true },
    );
  }
}

async function seedPrices() {
  const tomato = await CropModel.findOne({ nameKey: 'tomato' });
  if (!tomato) return;
  const samples = [
    { code: 'N24-BONGAON', min: 26, max: 30, modal: 28 },
    { code: 'N24-BARASAT', min: 29, max: 33, modal: 31 },
    { code: 'KOL-KOLEY', min: 32, max: 36, modal: 34 },
  ];
  const date = startOfUtcDay(new Date());
  for (const sample of samples) {
    const market = await MarketModel.findOne({ marketCode: sample.code });
    if (!market) continue;
    await MarketPriceModel.updateOne(
      { cropId: tomato._id, marketId: market._id, date, source: 'MANUAL' },
      {
        $set: {
          cropId: tomato._id,
          marketId: market._id,
          date,
          minimumPricePaise: sample.min * 100,
          maximumPricePaise: sample.max * 100,
          modalPricePaise: sample.modal * 100,
          unit: 'KG',
          source: 'MANUAL',
          isDemo: true,
        },
      },
      { upsert: true },
    );
  }
}

async function main() {
  await connectDatabase();
  await seedCrops();
  await seedMarkets();
  await seedDemoUsers();
  await seedPrices();
  await seedListings();
  logger.info({
    event: 'SEED_COMPLETED',
    crops: crops.length,
    markets: markets.length,
    listings: demoListings.length,
    demoPassword: 'stored',
    note: 'Demo records are marked isDemo or isSeeded. Change the demo password before any shared deployment.',
  });
  console.log('Seed complete. Demo password for 9810000001-9810000004 is Demo@12345. These accounts are marked isDemo.');
  await disconnectDatabase();
}

main().catch(async (error: Error) => {
  logger.error({ event: 'SEED_FAILED', message: error.message });
  await disconnectDatabase();
  process.exit(1);
});
