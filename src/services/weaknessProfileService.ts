import { callApi } from './apiAdapter';
import type { ResultSkillBreakdownResponse, WeaknessProfileResponse } from '../shared/skillTaxonomy';

export async function fetchResultSkillBreakdown(resultId: string | number): Promise<ResultSkillBreakdownResponse> {
    return callApi<ResultSkillBreakdownResponse>('get_result_skill_breakdown', { resultId });
}

export async function fetchWeaknessProfile(resultId: string | number): Promise<WeaknessProfileResponse> {
    return callApi<WeaknessProfileResponse>('get_result_weakness_profile', { resultId });
}
