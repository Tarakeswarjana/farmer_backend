import { MAX_NEARBY_RADIUS_METERS } from '../constants/enums';
import type { GeoPoint } from '../types/common';
import { UnprocessableError } from './errors';

export function toGeoPoint(lng: number, lat: number): GeoPoint {
  if (lng < -180 || lng > 180 || lat < -90 || lat > 90) {
    throw new UnprocessableError('Location coordinates are out of range');
  }
  return { type: 'Point', coordinates: [lng, lat] };
}

export function assertRadius(radius: number): number {
  if (!Number.isFinite(radius) || radius <= 0 || radius > MAX_NEARBY_RADIUS_METERS) {
    throw new UnprocessableError(`Radius must be between 1 and ${MAX_NEARBY_RADIUS_METERS} meters`);
  }
  return radius;
}

export function haversineMeters(from: [number, number], to: [number, number]): number {
  const earth = 6_371_000;
  const toRad = (value: number) => (value * Math.PI) / 180;
  const dLat = toRad(to[1] - from[1]);
  const dLng = toRad(to[0] - from[0]);
  const lat1 = toRad(from[1]);
  const lat2 = toRad(to[1]);
  const a =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return Math.round(earth * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}
