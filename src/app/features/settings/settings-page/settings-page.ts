import { ChangeDetectionStrategy, Component } from '@angular/core';
import { MatTabsModule } from '@angular/material/tabs';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

interface SettingsTab {
  readonly path: string;
  readonly label: string;
}

@Component({
  selector: 'app-settings-page',
  imports: [MatTabsModule, RouterLink, RouterLinkActive, RouterOutlet],
  templateUrl: './settings-page.html',
  styleUrl: './settings-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SettingsPage {
  protected readonly tabs: readonly SettingsTab[] = [
    { path: 'accounts', label: 'Contas' },
    { path: 'categories', label: 'Categorias' },
    { path: 'profile', label: 'Perfil' },
  ];
}
