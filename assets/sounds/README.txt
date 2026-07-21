Свои звуки класть сюда. Имя файла = имя звука в src/utils/sound.js:

  интерфейс   hover.mp3  click.mp3  confirm.mp3  notify.mp3  error.mp3
  комната     join.mp3   leave.mp3  ready.mp3    message.mp3
  партия      start.mp3  reveal.mp3 night.mp3    day.mp3     vote.mp3
              death.mp3  save.mp3   win.mp3      lose.mp3    tick.mp3
  фон         ambient.mp3

Файлы необязательны. Если какого-то нет, звук синтезируется через Web Audio
API: те же ноты, тот же фильтр и тот же хвост, что и у остальных, — набор
звучит цельно даже наполовину пустым.

Если добавляете свои сэмплы, держите их тихими и короткими: общая громкость
уже ограничена в sound.js (MASTER), а ползунок в настройках работает внутри
этого предела.
