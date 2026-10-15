const eventFields = 'title category sport description tagline coverUrl videoUrl locationName address lat lng dateLabel time participantsMax participantIds prizePool entryFee audienceMode dateKey startsAt league isMediaLeague homeTeam awayTeam officialSourceUrl ticketUrl ticketSourceName ticketVerified officialClubId organizerUrl isImported status createdBy createdAt isOfficial'.split(' ');
const trainingFields = 'title sport dateLabel time districtId locationName address lat lng level participantsMax participantIds description participantGender isOfficial officialOrganizerName officialStatus cancelledAt venueId venueName venueRentalConfirmed createdBy createdAt dateKey isCompleted completedAt ratedParticipantIds organizerRatedByParticipantIds checkedInUserIds'.split(' ');
export function trainingVisible(value) {
  return value.isHidden !== true && (value.isOfficial !== true || ['published','completed'].includes(value.officialStatus));
}
export function projectActivity(kind, id, value) {
  const result = {id};
  for (const key of kind === 'events' ? eventFields : trainingFields) if (value[key] !== undefined) result[key] = value[key];
  return result;
}
export function publicActivity(kind, id, value) {
  if (kind === 'events' ? value.status !== 'published' || value.adminHidden === true : !trainingVisible(value)) return null;
  return projectActivity(kind, id, value);
}
