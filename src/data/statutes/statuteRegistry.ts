import type { StateStatutePack } from './co/cora200';

export type SupportedStateCode = 'CO';

export interface StateStatuteMeta {
  stateCode: SupportedStateCode;
  stateName: string;
  actName: string;
  statutoryRange: string;
}

export const STATE_STATUTE_CATALOG: Record<SupportedStateCode, StateStatuteMeta> = {
  CO: {
    stateCode: 'CO',
    stateName: 'Colorado',
    actName: 'Colorado Open Records Act (CORA)',
    statutoryRange: 'C.R.S. ? 24-72-200.1 through ? 24-72-206',
  },
};

export async function loadStateStatutePack(
  stateCode: SupportedStateCode
): Promise<StateStatutePack> {
  switch (stateCode) {
    case 'CO': {
      const mod = await import('./co/cora200');
      return mod.CORA_200_PACK;
    }
    default: {
      const _exhaustive: never = stateCode;
      throw new Error(`Unsupported state statute pack: ${_exhaustive}`);
    }
  }
}
