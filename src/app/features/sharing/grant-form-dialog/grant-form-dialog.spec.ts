import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatDialogRef } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { vi } from 'vitest';
import { DataError } from '../../../core/supabase/data-error';
import { GrantUserNotFoundError, GrantsStore, SelfGrantError } from '../grants.store';
import { GrantFormDialog } from './grant-form-dialog';

describe('GrantFormDialog', () => {
  let fixture: ComponentFixture<GrantFormDialog>;
  let component: GrantFormDialog;
  let store: { grantByEmail: ReturnType<typeof vi.fn> };
  let dialogRef: { close: ReturnType<typeof vi.fn> };
  let snackBar: { open: ReturnType<typeof vi.fn> };

  const form = () => (component as unknown as { form: GrantFormDialog['form'] }).form;
  const errorText = () => (fixture.nativeElement as HTMLElement).querySelector('.grant-form__error')?.textContent?.trim();

  beforeEach(async () => {
    store = { grantByEmail: vi.fn().mockResolvedValue(undefined) };
    dialogRef = { close: vi.fn() };
    snackBar = { open: vi.fn() };
    await TestBed.configureTestingModule({
      imports: [GrantFormDialog],
      providers: [
        { provide: MatDialogRef, useValue: dialogRef },
        { provide: MatSnackBar, useValue: snackBar },
        { provide: GrantsStore, useValue: store },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(GrantFormDialog);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('grants VIEW by default', async () => {
    form().patchValue({ email: 'pai@example.com' });
    await component['save']();
    expect(store.grantByEmail).toHaveBeenCalledWith('pai@example.com', 'VIEW');
    expect(dialogRef.close).toHaveBeenCalledWith('saved');
  });

  it('does not submit an invalid e-mail', async () => {
    form().patchValue({ email: 'pai' });
    await component['save']();
    expect(store.grantByEmail).not.toHaveBeenCalled();
  });

  it('shows inline messages for unknown users and self grants', async () => {
    form().patchValue({ email: 'x@example.com', permission: 'MANAGE' });
    store.grantByEmail.mockRejectedValueOnce(new GrantUserNotFoundError());
    await component['save']();
    fixture.detectChanges();
    expect(errorText()).toBe('Nenhum usuário com este e-mail.');

    store.grantByEmail.mockRejectedValueOnce(new SelfGrantError());
    await component['save']();
    fixture.detectChanges();
    expect(errorText()).toBe('Não é possível compartilhar com você mesmo.');
    expect(dialogRef.close).not.toHaveBeenCalled();
  });

  it('maps a duplicate grant to a snackbar message', async () => {
    form().patchValue({ email: 'pai@example.com' });
    store.grantByEmail.mockRejectedValueOnce(new DataError('dup', '23505'));
    await component['save']();
    expect(snackBar.open).toHaveBeenCalledWith('Já existe um compartilhamento ativo com esta pessoa.', 'OK', expect.anything());
  });
});
