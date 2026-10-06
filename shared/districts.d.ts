export interface District { id: string; name: string; region: 'spb' | 'lo' }
export const DISTRICTS: District[];
export function getDistrict(id: unknown): District | undefined;
export function districtLabel(id: unknown): string;
export function validateDistrictId(value: unknown): string;
export function matchesDistrict(training: {districtId?: string}, filter: string): boolean;
