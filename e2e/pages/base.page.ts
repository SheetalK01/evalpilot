import type { Locator, Page } from '@playwright/test';

export type Theme = 'light' | 'dark';

/** Shared bits of every page: navigation, theme and toasts. */
export abstract class BasePage {
  constructor(readonly page: Page) {}

  /**
   * Sets the stored theme before the first page load, exactly as the theme toggle would. Only
   * once per tab, so a later reload keeps whatever the user picked.
   */
  async useTheme(theme: Theme): Promise<void> {
    await this.page.addInitScript((value) => {
      if (sessionStorage.getItem('e2e-theme-set')) return;
      sessionStorage.setItem('e2e-theme-set', '1');
      localStorage.setItem('evalpilot-theme', value);
    }, theme);
  }

  get themeToggle(): Locator {
    return this.page.getByTestId('theme-toggle');
  }

  /** Sonner toasts (the library renders them; we select them by its own attribute). */
  get toasts(): Locator {
    return this.page.locator('[data-sonner-toast]');
  }

  async theme(): Promise<string | undefined> {
    return this.page.evaluate(() => document.documentElement.dataset.theme);
  }
}
