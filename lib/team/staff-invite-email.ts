/** E-mail synthétique unique pour les comptes salariés (pas de boîte réelle requise). */
export function staffInviteEmailForInvitation(invitationId: string): string {
  const domain = process.env.STAFF_INVITE_EMAIL_DOMAIN?.trim() || 'reputexa.fr';
  const safe = invitationId.replace(/-/g, '');
  return `staff-inv-${safe}@${domain}`;
}
