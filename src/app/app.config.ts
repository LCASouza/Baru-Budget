import { registerLocaleData } from '@angular/common';
import localePt from '@angular/common/locales/pt';
import {
  ApplicationConfig,
  DEFAULT_CURRENCY_CODE,
  LOCALE_ID,
  inject,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import { MAT_DATE_LOCALE, provideNativeDateAdapter } from '@angular/material/core';
import { MatIconRegistry } from '@angular/material/icon';
import { TitleStrategy, provideRouter, withComponentInputBinding } from '@angular/router';
import { environment } from '../environments/environment';
import { routes } from './app.routes';
import { AppTitleStrategy } from './core/navigation/app-title.strategy';
import { provideSupabase } from './core/supabase/supabase-client';

registerLocaleData(localePt);

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes, withComponentInputBinding()),
    provideNativeDateAdapter(),
    provideSupabase({
      url: environment.supabaseUrl,
      publishableKey: environment.supabasePublishableKey,
    }),
    provideAppInitializer(() => {
      inject(MatIconRegistry).setDefaultFontSetClass('material-icons-outlined');
    }),
    { provide: TitleStrategy, useClass: AppTitleStrategy },
    { provide: LOCALE_ID, useValue: 'pt-BR' },
    { provide: DEFAULT_CURRENCY_CODE, useValue: 'BRL' },
    { provide: MAT_DATE_LOCALE, useValue: 'pt-BR' },
  ],
};
