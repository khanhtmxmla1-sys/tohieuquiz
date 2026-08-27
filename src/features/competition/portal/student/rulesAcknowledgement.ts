export const rulesAcknowledgementKey = (campaignId: string, roundId: string) =>
  `competition-rules:${campaignId}:${roundId}`;

export const hasAcknowledgedRules = (campaignId: string, roundId: string) =>
  sessionStorage.getItem(rulesAcknowledgementKey(campaignId, roundId)) === 'acknowledged';

export const acknowledgeRules = (campaignId: string, roundId: string) => {
  sessionStorage.setItem(rulesAcknowledgementKey(campaignId, roundId), 'acknowledged');
};
