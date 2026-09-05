import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatBottomSheetRef } from '@angular/material/bottom-sheet';
import { MatIconModule } from '@angular/material/icon';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { SECONDARY_NAV_ITEMS } from '../../navigation/nav-items';

@Component({
  selector: 'app-more-menu-sheet',
  imports: [RouterLink, RouterLinkActive, MatIconModule],
  templateUrl: './more-menu-sheet.html',
  styleUrl: './more-menu-sheet.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MoreMenuSheet {
  private readonly sheetRef = inject(MatBottomSheetRef<MoreMenuSheet>);

  protected readonly items = SECONDARY_NAV_ITEMS;

  protected close(): void {
    this.sheetRef.dismiss();
  }
}
