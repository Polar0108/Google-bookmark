import type { Mock } from 'vitest';

import { enableActionIconPanelToggle } from '../src/services/sidePanel';

describe('side panel action behavior', () => {
  it('uses the toolbar icon as the native open and close toggle', async () => {
    const setPanelBehavior = chrome.sidePanel.setPanelBehavior as unknown as Mock;
    setPanelBehavior.mockResolvedValueOnce(undefined);

    await expect(enableActionIconPanelToggle()).resolves.toBeUndefined();
    expect(setPanelBehavior).toHaveBeenCalledWith({ openPanelOnActionClick: true });
  });
});
