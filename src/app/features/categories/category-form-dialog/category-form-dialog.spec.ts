import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { vi } from 'vitest';
import { makeCategory } from '../../../testing/finance-fixtures';
import { CategoriesStore } from '../categories.store';
import { CategoryFormData, CategoryFormDialog } from './category-form-dialog';

describe('CategoryFormDialog', () => {
  let fixture: ComponentFixture<CategoryFormDialog>;
  let component: CategoryFormDialog;
  let store: { create: ReturnType<typeof vi.fn>; rename: ReturnType<typeof vi.fn> };
  let dialogRef: { close: ReturnType<typeof vi.fn> };

  const form = () => (component as unknown as { form: CategoryFormDialog['form'] }).form;

  async function setup(data: CategoryFormData = {}): Promise<void> {
    store = { create: vi.fn().mockResolvedValue(undefined), rename: vi.fn().mockResolvedValue(undefined) };
    dialogRef = { close: vi.fn() };
    await TestBed.configureTestingModule({
      imports: [CategoryFormDialog],
      providers: [
        { provide: MatDialogRef, useValue: dialogRef },
        { provide: MAT_DIALOG_DATA, useValue: data },
        { provide: MatSnackBar, useValue: { open: vi.fn() } },
        { provide: CategoriesStore, useValue: store },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(CategoryFormDialog);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  it('creates a category with the preselected kind and a trimmed name', async () => {
    await setup({ kind: 'INCOME' });
    form().controls.name.setValue('  Bônus ');
    await component['save']();
    expect(store.create).toHaveBeenCalledWith({ kind: 'INCOME', name: 'Bônus' });
    expect(dialogRef.close).toHaveBeenCalledWith('saved');
  });

  it('renames on edit and keeps the kind locked', async () => {
    await setup({ category: makeCategory({ id: 'cat-1', name: 'Pets', kind: 'EXPENSE' }) });
    expect(form().controls.kind.disabled).toBe(true);
    form().controls.name.setValue('Animais');
    await component['save']();
    expect(store.rename).toHaveBeenCalledWith('cat-1', 'Animais');
    expect(store.create).not.toHaveBeenCalled();
  });

  it('does not save an empty name', async () => {
    await setup();
    await component['save']();
    expect(store.create).not.toHaveBeenCalled();
  });
});
