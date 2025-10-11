import library from '../jellyfin/library';
import { queryJellfinOptions } from '../utils';

export function itemQueryOptions(itemId: string, userId?: string | undefined) {
  return queryJellfinOptions({
    queryKey: [
      library.query.getItem.key,
      library.query.getItem.keyFor(itemId, userId),
    ],
    queryFn: async (jf) => library.query.getItem(jf, itemId, userId),
  });
}
