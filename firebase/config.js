/**
 * Конфигурация Firebase.
 *
 * Замените значения на свои из консоли Firebase:
 *   Project settings -> Your apps -> Web app -> SDK setup and configuration.
 *
 * Пока поля остаются пустыми, игра работает в локальном режиме:
 * комнаты живут в localStorage и синхронизируются между вкладками
 * одного браузера. Это удобно для разработки и проверки правил игры.
 */
export const firebaseConfig = {
  apiKey: '',
  authDomain: '',
  projectId: '',
  storageBucket: '',
  messagingSenderId: '',
  appId: '',
};

/** Версия Firebase SDK, загружаемого с CDN как ES-модуль. */
export const FIREBASE_SDK = 'https://www.gstatic.com/firebasejs/10.12.2';

/** Настроен ли реальный проект Firebase. */
export function isConfigured() {
  return Boolean(firebaseConfig.apiKey && firebaseConfig.projectId);
}
