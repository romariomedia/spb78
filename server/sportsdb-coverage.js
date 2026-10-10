// TheSportsDB coverage diagnostic — read-only, never publishes to Firestore.
// A free API key is for development; production/App Store publication requires
// a paid licence under https://www.thesportsdb.com/docs_terms_of_use.php.
const API='https://www.thesportsdb.com/api/v1/json';
export const SPORTSDB_REQUIRED_TEAMS = Object.freeze([
  {club:'fc-zenit',label:'FC Zenit Saint Petersburg',sport:'Soccer'},
  {club:'ska',label:'SKA Saint Petersburg',sport:'Ice Hockey'},
  {club:'dragons',label:'Shanghai Dragons',sport:'Ice Hockey'},
  {club:'bc-zenit',label:'Zenit Saint Petersburg Basketball',sport:'Basketball'}
]);

export function sportsDbTeamSearchUrl(team,key='123'){
  if(!/^[0-9A-Za-z]+$/.test(key))throw new Error('Invalid API key');
  return `${API}/${key}/searchteams.php?t=${encodeURIComponent(team)}`;
}
export function sportsDbNextEventsUrl(teamId,key='123'){
  if(!/^\d+$/.test(String(teamId)))throw new Error('Invalid team ID');
  if(!/^[0-9A-Za-z]+$/.test(key))throw new Error('Invalid API key');
  return `${API}/${key}/eventsnext.php?id=${teamId}`;
}
export function assessTeamResults(payload,required){
  const matches=Array.isArray(payload?.teams)?payload.teams:[];
  return matches.filter(team=>String(team?.strSport||'').toLowerCase()===required.sport.toLowerCase()).map(team=>({
    id:String(team.idTeam||''),name:String(team.strTeam||''),
    league:String(team.strLeague||''),sport:String(team.strSport||''),
    country:String(team.strCountry||'')
  })).filter(team=>/^\d+$/.test(team.id));
}
export function assessEventResults(payload){
  return (Array.isArray(payload?.events)?payload.events:[]).map(e=>({
    id:String(e.idEvent||''),home:String(e.strHomeTeam||''),away:String(e.strAwayTeam||''),
    league:String(e.strLeague||''),date:String(e.dateEvent||''),
    time:String(e.strTime||''),venue:String(e.strVenue||'')
  })).filter(e=>/^\d+$/.test(e.id)&&/^\d{4}-\d{2}-\d{2}$/.test(e.date));
}
// Do not infer the city from a team name. Each fixture requires separately
// verified venue, coordinates, home/away status and a stable fixture identity.
export function isPublishableFromSportsDb(){return false;}
