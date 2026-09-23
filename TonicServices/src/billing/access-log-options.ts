export function accessLogOptions(query: any, now = new Date()) {
  const period = ['30', '90', '180', '365', 'all'].includes(query.period) ? query.period : '30';
  const page = Math.min(1000000000, Math.max(1, Math.floor(Number(query.page)) || 1));
  const pageSize = [10, 20, 50, 100].includes(Number(query.pageSize)) ? Number(query.pageSize) : 20;
  return {
    period, page, pageSize,
    since: period === 'all' ? null : new Date(+now - Number(period) * 86400000),
    search: typeof query.search === 'string' ? query.search.trim().slice(0, 200) : '',
    result: ['granted', 'denied'].includes(query.result) ? query.result : 'all',
    sort: ['name', 'result', 'timestamp'].includes(query.sort) ? query.sort : 'timestamp',
    order: (query.order === 'asc' ? 'ASC' : 'DESC') as 'ASC' | 'DESC',
  };
}
