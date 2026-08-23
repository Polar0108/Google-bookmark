import { useEffect, useState } from 'react';

import { db } from '../data/database';

export function useCoverUrl(assetId?: string): string | undefined {
  const [url, setUrl] = useState<string>();

  useEffect(() => {
    let active = true;
    let objectUrl: string | undefined;
    if (!assetId) {
      setUrl(undefined);
      return;
    }
    void db.covers.get(assetId).then((asset) => {
      if (!active || !asset) return;
      objectUrl = URL.createObjectURL(asset.blob);
      setUrl(objectUrl);
    });
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [assetId]);

  return url;
}

