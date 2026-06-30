import { Injectable } from '@nestjs/common';
import { Subject, Observable } from 'rxjs';
import { filter, map } from 'rxjs/operators';

// Описываем структуру глобального события бэкенда
export interface AppEvent {
  type:
    | 'LOGIN'
    | 'WORKSPACE_ADDED'
    | 'TASK_ASSIGNED'
    | 'TASK_UPDATED'
    | 'COMMENT_MUTATED';
  targetUserId?: string; // Для персональных уведомлений юзера
  targetTaskId?: string; // Для подписок на конкретную задачу
  data: any; // Полезная нагрузка события
}

@Injectable()
export class NotificationsService {
  // Единая глобальная шина событий приложения
  private readonly eventBus$ = new Subject<AppEvent>();

  // Метод, куда другие сервисы будут отправлять события
  emit(event: AppEvent) {
    this.eventBus$.next(event);
  }

  // Поток персональных уведомлений для конкретного пользователя (Вход, Пространство, Назначение таски)
  subscribeToUserEvents(userId: string): Observable<{ data: any }> {
    return this.eventBus$.asObservable().pipe(
      // Фильтруем события: пропускаем только те, которые адресованы этому юзеру
      filter((event) => event.targetUserId === userId),
      // Форматируем под стандарт SSE (обязательно поле data)
      map((event) => ({
        data: {
          event: event.type,
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          payload: event.data,
        },
      })),
    );
  }

  // Поток уведомлений по конкретной задаче (Изменение полей, комментарии)
  subscribeToTaskEvents(taskId: string): Observable<{ data: any }> {
    return this.eventBus$.asObservable().pipe(
      // Пропускаем только события, связанные с этой задачей
      filter((event) => event.targetTaskId === taskId),
      map((event) => ({
        data: {
          event: event.type,
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          payload: event.data,
        },
      })),
    );
  }
}
