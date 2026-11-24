import type { StateStatutePack } from './co/cora200';

export type SupportedStateCode = 'CO';
export type SupportedStatutePackId = 'CO_CORA' | 'CO_CCJRA';

export interface StateStatuteMeta {
  id: SupportedStatutePackId;
  stateCode: SupportedStateCode;
  stateName: string;
  actName: string;
  shortCode: 'CORA' | 'CCJRA';
  statutoryRange: string;
}

export const STATUTE_PACK_CATALOG: Record<SupportedStatutePackId, StateStatuteMeta> = {
  CO_CORA: {
    id: 'CO_CORA',
    stateCode: 'CO',
    stateName: 'Colorado',
    actName: 'Colorado Open Records Act (CORA)',
    shortCode: 'CORA',
    statutoryRange: 'C.R.S. ? 24-72-200.1 through ? 24-72-206',
  },
  CO_CCJRA: {
    id: 'CO_CCJRA',
    stateCode: 'CO',
    stateName: 'Colorado',
    actName: 'Colorado Criminal Justice Records Act (CCJRA)',
    shortCode: 'CCJRA',
    statutoryRange: 'C.R.S. ? 24-72-301 through ? 24-72-309',
  },
};

export const STATE_STATUTE_CATALOG: Record<SupportedStateCode, StateStatuteMeta> = {
  CO: STATUTE_PACK_CATALOG.CO_CORA,
};

export async function loadStatutePackById(
  packId: SupportedStatutePackId
): Promise<StateStatutePack> {
  switch (packId) {
    case 'CO_CORA': {
      const mod = await import('./co/cora200');
      return mod.CORA_200_PACK;
    }
    case 'CO_CCJRA': {
      const mod = await import('./co/ccjra300');
      return mod.CCJRA_300_PACK;
    }
    default: {
      const _exhaustive: never = packId;
      throw new Error(`Unsupported statute pack: ${_exhaustive}`);
    }
  }
}

export async function loadStateStatutePack(
  stateCode: SupportedStateCode
): Promise<StateStatutePack> {
  switch (stateCode) {
    case 'CO':
      return loadStatutePackById('CO_CORA');
    default: {
      const _exhaustive: never = stateCode;
      throw new Error(`Unsupported state statute pack: ${_exhaustive}`);
    }
  }
}
