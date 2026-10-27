import type { Locator } from '@playwright/test';
import { BasePage } from './base.page';

export class LoginPage extends BasePage {
  readonly email: Locator = this.page.getByTestId('login-email');
  readonly password: Locator = this.page.getByTestId('login-password');
  readonly submit: Locator = this.page.getByTestId('login-submit');
  readonly error: Locator = this.page.getByTestId('auth-error');

  async goto(next?: string): Promise<void> {
    await this.page.goto(next ? `/login?next=${encodeURIComponent(next)}` : '/login');
  }

  async login(email: string, password: string): Promise<void> {
    await this.email.fill(email);
    await this.password.fill(password);
    await this.submit.click();
  }
}

export class RegisterPage extends BasePage {
  readonly name: Locator = this.page.getByTestId('register-name');
  readonly email: Locator = this.page.getByTestId('register-email');
  readonly password: Locator = this.page.getByTestId('register-password');
  readonly submit: Locator = this.page.getByTestId('register-submit');
  readonly error: Locator = this.page.getByTestId('auth-error');

  async goto(): Promise<void> {
    await this.page.goto('/register');
  }

  async register(name: string, email: string, password: string): Promise<void> {
    await this.name.fill(name);
    await this.email.fill(email);
    await this.password.fill(password);
    await this.submit.click();
  }
}
