import { computed, inject } from '@angular/core';
import {
  patchState,
  signalStore,
  watchState,
  withComputed,
  withHooks,
  withMethods,
  withState,
} from '@ngrx/signals';
import { BooksDataService } from './books-data.service';
import { pipe, switchMap } from 'rxjs';
import { rxMethod } from '@ngrx/signals/rxjs-interop';
import { setEntities, withEntities } from '@ngrx/signals/entities';
import { tapResponse } from '@ngrx/operators';
import { BookEntity } from '../types';
import { withSelectedBook } from './selected.feature';

const BY_VALUES = ['title', 'author', 'year'] as const;
type SortKey = keyof Pick<BookEntity, 'title' | 'author' | 'year'>;

export type ByValues = (typeof BY_VALUES)[number];
type SortState = {
  by: SortKey;
};

export const BooksStore = signalStore(
  withEntities<BookEntity>(),
  withState<SortState>({
    by: 'title',
  }),
  withSelectedBook(),
  withComputed((store) => {
    return {
      books: computed(() =>
        store.entities().sort((a, b) => {
          const key = store.by();
          switch (key) {
            case 'year':
              return a.year > b.year ? 1 : a.year < b.year ? -1 : 0;
            case 'author':
            case 'title':
              return a[key].localeCompare(b[key]);
          }
        }),
      ),
      booksTotal: computed(() => store.entities().length),
      earliestYearPublished: computed(() =>
        store
          .entities()
          .reduce((a, b) => (b.year < a ? b.year : a), Number.MAX_SAFE_INTEGER),
      ),
      mostRecentYearPublished: computed(() =>
        store
          .entities()
          .reduce((a, b) => (b.year > a ? b.year : a), Number.MIN_SAFE_INTEGER),
      ),
      averageNumberOfPages: computed(() => {
        return (
          store.entities().reduce((sum, books) => sum + books.pages, 0) /
          store.entities().length
        );
      }),
      byValues: computed(() => BY_VALUES),
      selectedBook: computed(() => {
        const id = store.selectedBook();
        return id;
      }),
    };
  }),
  withMethods((store) => {
    const service = inject(BooksDataService);
    return {
      _loadServerData: rxMethod<void>(
        pipe(
          switchMap(() =>
            service.getBooks().pipe(
              tapResponse({
                next(value) {
                  patchState(store, setEntities(value));
                },
                error(error) {
                  console.error(error);
                },
              }),
            ),
          ),
        ),
      ),
      sortBy: (by: SortKey) => patchState(store, { by }),
    };
  }),
  withHooks({
    onInit(store) {
      store._loadServerData();

      const saved = localStorage.getItem('sortBy');
      if (saved !== null) {
        const state = JSON.parse(saved) as unknown as SortState;
        patchState(store, state);
      }
      watchState(store, (state) => {
        localStorage.setItem('sortBy', JSON.stringify(state));
      });
    },
  }),
);
