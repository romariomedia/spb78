export const DASHBOARD_SECTIONS=['running','events','calendar','trainers','leaderboard','community'];
export function normalizeDashboardOrder(value) {
 const known=Array.isArray(value)?value.filter(id=>DASHBOARD_SECTIONS.includes(id)):[];
 return [...new Set([...known,...DASHBOARD_SECTIONS])];
}
export function moveDashboardSection(order,id,offset) {
 const result=normalizeDashboardOrder(order),from=result.indexOf(id),to=from+offset;
 if(from<0||to<0||to>=result.length)return result;
 [result[from],result[to]]=[result[to],result[from]];
 return result;
}
