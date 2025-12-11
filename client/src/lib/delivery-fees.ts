import type { DeliveryZone, Neighborhood } from '@shared/schema';
import { NEIGHBORHOODS as STATIC_NEIGHBORHOODS, DELIVERY_ZONES as STATIC_ZONES } from '@shared/delivery-zones';

export interface NeighborhoodWithZone extends Neighborhood {
  zone?: DeliveryZone;
}

export interface DeliveryFeeResult {
  fee: number;
  zoneName: string | null;
  zoneCode: string | null;
  isFromDatabase: boolean;
  isUnlisted: boolean;
}

export async function fetchNeighborhoodsWithZones(): Promise<NeighborhoodWithZone[]> {
  try {
    const [neighborhoodsRes, zonesRes] = await Promise.all([
      fetch('/api/neighborhoods'),
      fetch('/api/delivery-zones')
    ]);
    
    if (!neighborhoodsRes.ok || !zonesRes.ok) {
      throw new Error('Failed to fetch data');
    }
    
    const neighborhoods: Neighborhood[] = await neighborhoodsRes.json();
    const zones: DeliveryZone[] = await zonesRes.json();
    
    const zonesMap = new Map(zones.map(z => [z.id, z]));
    
    return neighborhoods
      .filter(n => n.isActive)
      .map(n => ({
        ...n,
        zone: zonesMap.get(n.zoneId)
      }))
      .sort((a, b) => {
        const zoneOrder = (a.zone?.sortOrder ?? 999) - (b.zone?.sortOrder ?? 999);
        if (zoneOrder !== 0) return zoneOrder;
        return a.name.localeCompare(b.name, 'pt-BR');
      });
  } catch (error) {
    console.error('Error fetching neighborhoods:', error);
    return [];
  }
}

export function calculateDeliveryFee(
  neighborhoodName: string,
  dbNeighborhoods: NeighborhoodWithZone[],
  fallbackFee: number = 19.90
): DeliveryFeeResult {
  const normalizedName = neighborhoodName.toLowerCase().trim();
  
  const dbMatch = dbNeighborhoods.find(
    n => n.name.toLowerCase().trim() === normalizedName
  );
  
  if (dbMatch && dbMatch.zone) {
    return {
      fee: Number(dbMatch.zone.fee),
      zoneName: dbMatch.zone.name,
      zoneCode: dbMatch.zone.code,
      isFromDatabase: true,
      isUnlisted: false
    };
  }
  
  const staticMatch = STATIC_NEIGHBORHOODS.find(
    n => n.name.toLowerCase() === normalizedName
  );
  
  if (staticMatch) {
    const zoneInfo = STATIC_ZONES[staticMatch.zone];
    return {
      fee: zoneInfo.fee,
      zoneName: zoneInfo.name,
      zoneCode: staticMatch.zone,
      isFromDatabase: false,
      isUnlisted: false
    };
  }
  
  return {
    fee: fallbackFee,
    zoneName: null,
    zoneCode: null,
    isFromDatabase: false,
    isUnlisted: true
  };
}

export function groupNeighborhoodsByZone(
  neighborhoods: NeighborhoodWithZone[]
): Map<string, NeighborhoodWithZone[]> {
  const grouped = new Map<string, NeighborhoodWithZone[]>();
  
  for (const n of neighborhoods) {
    if (!n.zone) continue;
    
    const key = n.zone.id;
    if (!grouped.has(key)) {
      grouped.set(key, []);
    }
    grouped.get(key)!.push(n);
  }
  
  return grouped;
}
