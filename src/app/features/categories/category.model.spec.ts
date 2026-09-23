import { makeCategory } from '../../testing/finance-fixtures';
import { categoryIcon, categoryIconByName } from './category.model';

describe('category.model', () => {
  it('assigns distinct icons to the predefined expense categories', () => {
    expect(categoryIconByName('EXPENSE', 'Moradia')).toBe('home');
    expect(categoryIconByName('EXPENSE', 'Alimentação')).toBe('restaurant');
    expect(categoryIconByName('EXPENSE', 'Transporte')).toBe('directions_car');
    expect(categoryIconByName('EXPENSE', 'Saúde')).toBe('medical_services');
    expect(categoryIconByName('EXPENSE', 'Educação')).toBe('school');
    expect(categoryIconByName('EXPENSE', 'Lazer')).toBe('sports_esports');
    expect(categoryIconByName('EXPENSE', 'Assinaturas')).toBe('subscriptions');
    expect(categoryIconByName('EXPENSE', 'Compras')).toBe('shopping_bag');
  });

  it('uses a saved icon first and a generic icon for custom categories', () => {
    expect(categoryIcon(makeCategory({ name: 'Pets', icon: 'pets' }))).toBe('pets');
    expect(categoryIcon(makeCategory({ name: 'Pets', icon: null }))).toBe('label');
  });
});
